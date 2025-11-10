import os
import json
from datetime import datetime
import pandas as pd
from app.agent.base_agent import BaseAgent
from app.repositories.agent_repo import AgentRepository

INPUT_CSV = "BETH_anomaly.csv"                # your anomalies file (TSV or CSV)
OUTPUT_JSONL = "BETH_llm_explanations.jsonl"  # only JSON explanations
MAX_ROWS = 200                                # safety limit
MODEL_ID = "gpt-5-mini"

def load_beth_csv(path: str) -> pd.DataFrame:
    """Load BETH anomaly CSV/TSV file."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Input CSV not found: {path}")

    try:
        df = pd.read_csv(path)
    except pd.errors.EmptyDataError:
        raise ValueError(f"File exists but is empty: {path}")
    except pd.errors.ParserError:
        df = pd.read_csv(path, engine="python", on_bad_lines="skip")

    # Detect TSV format
    if df.shape[1] == 1 and df.iloc[0, 0] and "\t" in str(df.iloc[0, 0]):
        df = pd.read_csv(path, sep="\t")

    print(f"[INFO] Loaded {df.shape[0]} rows, {df.shape[1]} cols from {path}")
    print(f"[INFO] Columns: {list(df.columns)}")
    return df


def summarize_beth_row(row: pd.Series) -> str:
    """Create compact textual summary for the LLM."""
    candidate_fields = [
        "timestamp", "hostName", "userId", "processId", "parentPro",
        "mountNamespace", "processName", "eventId", "eventName", "args",
        "sus", "evil", "anomaly", "label"
    ]

    parts = []
    for field in candidate_fields:
        if field in row and pd.notna(row[field]) and row[field] != "":
            val = str(row[field])
            if len(val) > 200:
                val = val[:200] + "..."
            parts.append(f"{field}={val}")

    return ", ".join(parts)


def parse_json_response(text: str) -> dict:
    """Parse JSON from LLM response, handling markdown code blocks."""
    text = text.strip()
    
    # Remove markdown code blocks
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    
    if text.endswith("```"):
        text = text[:-3]
    
    text = text.strip()
    return json.loads(text)


def explain_beth_anomaly(agent: BaseAgent, row: pd.Series, row_index: int) -> dict:
    """
    Use BaseAgent to explain an anomaly.
    
    Args:
        agent: Initialized BaseAgent instance
        row: Pandas Series containing anomaly data
        row_index: Original row index from DataFrame
        
    Returns:
        Dictionary containing structured JSON explanation
    """
    summary = summarize_beth_row(row)

    user_prompt = f"""
This event was flagged as anomalous by an upstream detector:

Row Index: {row_index}
Event Data: {summary}

Return ONLY the JSON object as specified. No extra text.
"""

    try:
        # Call BaseAgent with system prompt and low temperature
        response = agent.run(
            prompt=user_prompt,
            system=SYSTEM_PROMPT,
            temperature=0.2
        )

        # Parse JSON response
        data = parse_json_response(response)
        
        # Add metadata
        data["_llm_timestamp_utc"] = datetime.now().astimezone().isoformat()
        data["_row_index"] = row_index
        
        # Ensure provenance is populated
        if "provenance" not in data:
            data["provenance"] = {}
        
        data["provenance"].update({
            "model_name": MODEL_ID,
            "temperature": 0.2,
        })
        
        return data

    except json.JSONDecodeError as e:
        print(f"[WARN] Row {row_index}: JSON decode error: {e}")
        return {
            "verdict": "unclear",
            "confidence_label": "low",
            "confidence_score": 0.1,
            "mitre": [],
            "key_indicators": [],
            "notes": f"LLM response was not valid JSON. Parse error: {e}",
            "raw_response": response[:500] if 'response' in locals() else "",
            "_llm_timestamp_utc": datetime.now().astimezone().isoformat(),
            "_row_index": row_index,
            "_error": "json_decode_error"
        }
    
    except Exception as e:
        print(f"[ERROR] Row {row_index}: {e}")
        return {
            "verdict": "unclear",
            "confidence_label": "low",
            "confidence_score": 0.1,
            "mitre": [],
            "key_indicators": [],
            "notes": f"Error calling LLM: {e}",
            "_llm_timestamp_utc": datetime.now().astimezone().isoformat(),
            "_row_index": row_index,
            "_error": str(e)
        }


def select_anomalies(df: pd.DataFrame) -> pd.DataFrame:
    """
    Filter rows that are flagged as anomalies.
    
    If sus/evil/anomaly columns exist, use them.
    Otherwise, treat all rows as anomalies.
    """
    has_flags = any(col in df.columns for col in ["sus", "evil", "anomaly"])

    if not has_flags:
        print("[INFO] No sus/evil/anomaly columns found; treating ALL rows as anomalies.")
        return df

    mask = pd.Series([False] * len(df))
    
    if "sus" in df.columns:
        mask = mask | (df["sus"] == 1)
    if "evil" in df.columns:
        mask = mask | (df["evil"] == 1)
    if "anomaly" in df.columns:
        mask = mask | (df["anomaly"] == 1)

    anomalies = df[mask].copy()
    print(f"[INFO] Found {len(anomalies)} anomalies using sus/evil/anomaly flags.")
    return anomalies


def main():
    """Main execution function."""
    print(f"[INFO] Initializing BaseAgent with model: {MODEL_ID}")
    
    try:
        agent = BaseAgent(model_id=MODEL_ID)
        print(f"[INFO] Successfully initialized {MODEL_ID}")
    except Exception as e:
        print(f"[ERROR] Failed to initialize BaseAgent: {e}")
        print("\n[INFO] Available models:")
        try:
            from app.repositories import AgentRepository
            repo = AgentRepository()
            for model in repo.list_models():
                print(f"  - {model}")
        except Exception:
            pass
        return

    print(f"\n[INFO] Loading BETH data from {INPUT_CSV}")
    try:
        df = load_beth_csv(INPUT_CSV)
    except Exception as e:
        print(f"[ERROR] Failed to load CSV: {e}")
        return

    anomalies = select_anomalies(df)
    if anomalies.empty:
        print("[WARN] No anomalies to explain.")
        return

    if MAX_ROWS is not None and len(anomalies) > MAX_ROWS:
        anomalies = anomalies.head(MAX_ROWS)
        print(f"[INFO] Limiting to first {len(anomalies)} anomalies for this run.")

    print(f"\n[INFO] Explaining {len(anomalies)} anomalies with {MODEL_ID}...")
    print(f"[INFO] Output will be saved to: {OUTPUT_JSONL}\n")

    explained_count = 0
    error_count = 0

    with open(OUTPUT_JSONL, "w", encoding="utf-8") as f_out:
        for i, (original_idx, row) in enumerate(anomalies.iterrows(), start=1):
            try:
                explanation = explain_beth_anomaly(agent, row, original_idx)
                
                if "_error" in explanation:
                    error_count += 1
                else:
                    explained_count += 1
                
            except Exception as e:
                print(f"[ERROR] Unexpected error on row {original_idx}: {e}")
                error_count += 1
                explanation = {
                    "verdict": "unclear",
                    "confidence_label": "low",
                    "confidence_score": 0.1,
                    "mitre": [],
                    "key_indicators": [],
                    "notes": f"Unexpected error: {e}",
                    "_llm_timestamp_utc": datetime.now().astimezone().isoformat(),
                    "_row_index": original_idx,
                    "_error": "unexpected_error"
                }

            # Write one JSON object per line
            f_out.write(json.dumps(explanation, ensure_ascii=False) + "\n")

            if i % 10 == 0:
                print(f"[PROGRESS] Processed {i}/{len(anomalies)} anomalies... "
                      f"(✓ {explained_count} | ✗ {error_count})")

    print(f"\n[SUCCESS] Completed processing {len(anomalies)} anomalies")
    print(f"[STATS] Successfully explained: {explained_count}")
    print(f"[STATS] Errors encountered: {error_count}")
    print(f"[OUTPUT] Results written to: {os.path.abspath(OUTPUT_JSONL)}")


if __name__ == "__main__":
    main()