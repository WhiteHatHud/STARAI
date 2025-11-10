import os
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

# If this file is your "already-filtered anomalies", point here.
# If it's the full BETH file, script will filter using sus/evil/anomaly.
INPUT_CSV = "BETH_anomaly.csv"
OUTPUT_CSV = "BETH_anomaly_explanations.csv"

# Safety limit for testing so you don't burn tokens by accident
MAX_ROWS = 200

SYSTEM_PROMPT = """
You are a senior SOC analyst.

You are given individual events from the BETH dataset.
Each event has ALREADY been flagged as anomalous by an upstream detector.
Your job is INTERPRETATION, not detection.

For each event:
- Explain plausible reasons why it may be anomalous or malicious.
- Always reference specific fields from the event (e.g. processName, parentPro, userId, eventName, args).
- When relevant, mention MITRE ATT&CK tactics/techniques (by ID and name).
- Explicitly state your CONFIDENCE as: high / medium / low.
- If evidence is weak or ambiguous, say so and list 1–2 pieces of missing context.
- Be concise (max ~5 sentences).
- Never give exploit code or offensive step-by-step instructions.
"""

def load_beth_csv(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Input CSV not found: {path}")

    # First try default (comma)
    try:
        df = pd.read_csv(path)
    except pd.errors.EmptyDataError:
        raise ValueError(f"File exists but is empty: {path}")
    except pd.errors.ParserError:
        df = pd.read_csv(path, engine="python", on_bad_lines="skip")

    # If it looks like a single-column TSV, re-read as tab-separated
    if df.shape[1] == 1 and df.iloc[0, 0] and "\t" in str(df.iloc[0, 0]):
        df = pd.read_csv(path, sep="\t")

    print(f"[INFO] Loaded {df.shape[0]} rows, {df.shape[1]} columns from {path}")
    print(f"[INFO] Columns: {list(df.columns)}")
    return df

def summarize_beth_row(row: pd.Series) -> str:
    """Turn a BETH row into a compact textual summary for the LLM."""
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
    """
    Handle both legacy string content and new list-based content formats.
    """
    content = message.content

    # Newer models: content can be a list of parts
    if isinstance(content, list):
        parts = []
        for c in content:
            # openai v1 objects: c has .type and .text + maybe .text.value
            text = getattr(c, "text", None)
            if text is None and isinstance(c, dict):
                text = c.get("text")
            if hasattr(text, "value"):
                text = text.value
            if text:
                parts.append(str(text))
        return "".join(parts).strip()

    # Older / simple: direct string
    if content is not None:
        return str(content).strip()

    return ""


def explain_beth_anomaly(row: pd.Series) -> str:
    """Call GPT-5-mini to explain why this row (already flagged) might be anomalous."""
    summary = summarize_beth_row(row)
    print("\n[DEBUG] Event summary for LLM:")
    print(summary)

    user_content = (
        "The following event has been flagged as anomalous by an upstream detector:\n"
        f"{summary}\n\n"
        "Explain why this event may be anomalous or malicious. "
        "Reference concrete fields and keep the answer concise."
    )

    resp = client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    )

    # Uncomment once to see the raw shape:
    # print("[DEBUG] Raw response:", resp)

    message = resp.choices[0].message
    explanation = extract_text_from_message(message)

    print("[DEBUG] LLM explanation:")
    print(explanation or "<EMPTY>")

    return explanation

def select_anomalies(df: pd.DataFrame) -> pd.DataFrame:
    """
    Decide which rows to treat as anomalies.

    Cases:
    - If file already only has anomalies: no sus/evil/anomaly columns -> return all rows.
    - If sus/evil/anomaly columns exist: use them to filter.
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

    anomalies = df[mask].copy()
    print(f"[INFO] Found {anomalies.shape[0]} anomalies using sus/evil/anomaly flags.")
    return anomalies


def main():
    print(f"[INFO] Loading BETH data from {INPUT_CSV}")
    df = load_beth_csv(INPUT_CSV)

    anomalies = select_anomalies(df)

    if anomalies.empty:
        print("[WARN] No anomalies to explain. Check your INPUT_CSV and flags.")
        return

    if MAX_ROWS is not None:
        anomalies = anomalies.head(MAX_ROWS)
        print(f"[INFO] Limiting to first {len(anomalies)} anomalies for this run.")

    print(f"[INFO] Explaining {len(anomalies)} anomalous events ...")

    explanations = []
    for idx, row in anomalies.iterrows():
        try:
            explanation = explain_beth_anomaly(row)
        except Exception as e:
            explanation = f"[ERROR calling LLM: {e}]"
        print("explanation:")
        print(explanation)

        explanations.append(
            {
                **row.to_dict(),
                "llm_explanation": explanation,
                "llm_timestamp_utc": datetime.utcnow().isoformat(),
            }
        )

        if len(explanations) % 10 == 0:
            print(f"[INFO] Processed {len(explanations)} anomalies...")

    out_df = pd.DataFrame(explanations)
    out_df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8")
    print(f"[INFO] Wrote {len(out_df)} rows with explanations to {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
