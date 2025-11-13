import os
import json
from datetime import datetime

import pandas as pd
from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()

ENDPOINT = os.environ["AZURE_OPENAI_ENDPOINT"]
API_KEY = os.environ["AZURE_OPENAI_API_KEY"]
DEPLOYMENT = os.environ["AZURE_OPENAI_DEPLOYMENT"]
API_VERSION = os.environ["AZURE_OPENAI_API_VERSION"]

client = AzureOpenAI(
    api_version=API_VERSION,
    azure_endpoint=ENDPOINT,
    api_key=API_KEY,
)

# Read from environment variables (set by API endpoint) or use defaults
INPUT_CSV = os.environ.get("INPUT_CSV", "BETH_anomaly.csv")  # your anomalies file (TSV or CSV)
OUTPUT_JSONL = os.environ.get("OUTPUT_JSONL", "BETH_llm_explanations.jsonl")  # only JSON explanations
MAX_ROWS = 200                                # safety limit


SYSTEM_PROMPT = """
You are a senior SOC analyst and assistant for an automated anomaly triage pipeline.

You receive:
- A single security anomaly event derived from the BETH dataset or similar telemetry.
- Minimal metadata: dataset_id, anomaly_id, session_id, row_index, timestamps, and model scores.

Your task:
Return ONE JSON object that conforms EXACTLY to the following schema:

{
  "schema_version": "1.0",
  "dataset_id": "<string>",
  "anomaly_id": "<string>",
  "session_id": "<string or null>",
  "verdict": "suspicious" | "likely_malicious" | "unclear",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence_label": "low" | "medium" | "high",
  "confidence_score": <float between 0 and 1>,
  "mitre": [
    {"id": "<TACTIC/TECHNIQUE ID>", "name": "<name>", "confidence": <0-1>, "rationale": "<optional string>"}
  ],
  "actors": {
    "user_id": "<string or null>",
    "username": "<string or null>",
    "process_name": "<string or null>",
    "pid": <int or null>,
    "ppid": <int or null>
  },
  "host": {
    "hostname": "<string or null>",
    "mount_ns": "<string or null>"
  },
  "event": {
    "name": "<eventName or similar>",
    "timestamp": "<ISO-8601 or null>",
    "args": [
      {"name": "<arg_name>", "type": "<arg_type>", "value": "<stringified_value>"}
    ]
  },
  "features": [
    {"name": "<feature_name>", "value": <float>, "z": <float or null>}
  ],
  "evidence_refs": [
    {
      "type": "row",
      "row_index": <int or null>,
      "sheet": "<string or null>",
      "s3_key": "<string or null>"
    }
  ],
  "key_indicators": [
    "<short bullet referencing specific fields and why they are suspicious>"
  ],
  "triage": {
    "immediate_actions": ["<short actionable step>", "..."],
    "short_term": ["<playbook / follow-up>", "..."],
    "long_term": ["<hardening / strategic>", "..."]
  },
  "notes": "<2-4 sentences summarizing reasoning and uncertainties>",
  "status": "new",
  "owner": null,
  "provenance": {
    "model_name": "gpt-5-mini",
    "model_version": "base",
    "prompt_id": "beth-triage-v1",
    "temperature": 0.2,
    "tokens_prompt": null,
    "tokens_output": null,
    "latency_ms": null
  },
  "_created_at": "<ISO-8601 UTC timestamp for when this explanation is generated>",
  "hash": null
}

Rules:
- Use ONLY valid JSON. No comments, no trailing commas, no markdown.
- Fill fields using ONLY provided event data and reasonable security judgement.
- Do NOT fabricate usernames or paths that conflict with given data.
- If a field cannot be inferred, set it to null or a safe default (e.g. [], null).
- "mitre" entries must be plausible and tied to evidence in key_indicators/notes.
- "severity" should reflect potential impact given the event context and verdict.
- "confidence_score" must be consistent with "confidence_label".
- "key_indicators" must reference concrete fields (e.g. processName, args, userId).
- "triage" actions must be defensive and realistic.
- Do NOT include exploit instructions or offensive guidance.
- Output exactly ONE JSON object per request.
"""



def load_beth_csv(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Input CSV not found: {path}")

    # Try comma-separated
    try:
        df = pd.read_csv(path)
    except pd.errors.EmptyDataError:
        raise ValueError(f"File exists but is empty: {path}")
    except pd.errors.ParserError:
        df = pd.read_csv(path, engine="python", on_bad_lines="skip")

    # Detect TSV case (one column with tabs inside)
    if df.shape[1] == 1 and df.iloc[0, 0] and "\t" in str(df.iloc[0, 0]):
        df = pd.read_csv(path, sep="\t")

    print(f"[INFO] Loaded {df.shape[0]} rows, {df.shape[1]} cols from {path}")
    print(f"[INFO] Columns: {list(df.columns)}")
    return df


def summarize_beth_row(row: pd.Series) -> str:
    """Compact textual summary for the LLM."""
    candidate_fields = [
        "timestamp",
        "hostName",
        "userId",
        "processId",
        "parentPro",
        "mountNamespace",
        "processName",
        "eventId",
        "eventName",
        "args",
        "sus",
        "evil",
        "anomaly",
        "label",
    ]

    parts = []
    for field in candidate_fields:
        if field in row and pd.notna(row[field]) and row[field] != "":
            val = str(row[field])
            if len(val) > 200:
                val = val[:200] + "..."
            parts.append(f"{field}={val}")

    return ", ".join(parts)


def extract_text_from_message(message) -> str:
    """Handle both string and list-style message.content formats."""
    content = message.content

    if isinstance(content, list):
        pieces = []
        for c in content:
            text = getattr(c, "text", None)
            if text is None and isinstance(c, dict):
                text = c.get("text")
            if hasattr(text, "value"):
                text = text.value
            if text:
                pieces.append(str(text))
        return "".join(pieces).strip()

    if content is not None:
        return str(content).strip()

    return ""


def explain_beth_anomaly(row: pd.Series) -> dict:
    """
    Call GPT-5-mini to explain an anomaly.
    Returns a Python dict with the JSON explanation.
    """
    summary = summarize_beth_row(row)

    user_content = f"""
This event was flagged as anomalous by an upstream detector:

{summary}

Return ONLY the JSON object as specified. No extra text.
"""

    resp = client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    )

    message = resp.choices[0].message
    text = extract_text_from_message(message)

    # Try to parse JSON, fall back to wrapping raw text
    try:
        data = json.loads(text)
        # Add timestamp for traceability
        data["_llm_timestamp_utc"] = datetime.now().astimezone().isoformat()
        return data
    except Exception:
        # If it's not valid JSON, keep it so you can debug later
        return {
            "verdict": "unclear",
            "confidence": "low",
            "mitre_techniques": [],
            "key_indicators": [],
            "notes": "LLM response was not valid JSON; raw text captured.",
            "raw_response": text,
            "_llm_timestamp_utc": datetime.now().astimezone().isoformat(),
        }


def select_anomalies(df: pd.DataFrame) -> pd.DataFrame:
    """
    Decide which rows to treat as anomalies.
    - If sus/evil/anomaly flags exist, use them.
    - Otherwise, treat all rows as anomalies.
    """
    has_flags = any(col in df.columns for col in ["sus", "evil", "anomaly"])

    if not has_flags:
        print("[INFO] No sus/evil/anomaly columns found; treating ALL rows as anomalies.")
        return df

    mask = False
    if "sus" in df.columns:
        mask = mask | (df["sus"] == 1)
    if "evil" in df.columns:
        mask = mask | (df["evil"] == 1)
    if "anomaly" in df.columns:
        mask = mask | (df["anomaly"] == 1)

    anomalies = df[mask].copy()
    print(f"[INFO] Found {anomalies.shape[0]} anomalies using sus/evil/anomaly flags.")
    return anomalies


def main():
    print(f"[INFO] Loading BETH data from {INPUT_CSV}")
    df = load_beth_csv(INPUT_CSV)

    anomalies = select_anomalies(df)
    if anomalies.empty:
        print("[WARN] No anomalies to explain.")
        return

    if MAX_ROWS is not None:
        anomalies = anomalies.head(MAX_ROWS)
        print(f"[INFO] Limiting to first {len(anomalies)} anomalies for this run.")

    print(f"[INFO] Explaining {len(anomalies)} anomalies with LLM...")

    with open(OUTPUT_JSONL, "w", encoding="utf-8") as f_out:
        for i, (_, row) in enumerate(anomalies.iterrows(), start=1):
            try:
                explanation = explain_beth_anomaly(row)
            except Exception as e:
                explanation = {
                    "verdict": "unclear",
                    "confidence": "low",
                    "mitre_techniques": [],
                    "key_indicators": [],
                    "notes": f"Error calling LLM: {e}",
                    "_llm_timestamp_utc": datetime.now().astimezone().isoformat(),
                }

            # Write one JSON object per line
            f_out.write(json.dumps(explanation, ensure_ascii=False) + "\n")

            if i % 10 == 0:
                print(f"[INFO] Processed {i} anomalies...")

    print(f"[INFO] Wrote explanations to {OUTPUT_JSONL}")


if __name__ == "__main__":
    main()
