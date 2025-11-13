"""
LLM Triage Analyzer
Uses Azure OpenAI GPT-5-mini to analyze detected anomalies and generate security triage reports.
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import pandas as pd

from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Azure OpenAI configuration
ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
API_KEY = os.environ.get("AZURE_OPENAI_API_KEY")
DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT")
API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION")

# Check if Azure OpenAI is configured
AZURE_CONFIGURED = all([ENDPOINT, API_KEY, DEPLOYMENT, API_VERSION])

if AZURE_CONFIGURED:
    client = AzureOpenAI(
        api_version=API_VERSION,
        azure_endpoint=ENDPOINT,
        api_key=API_KEY,
    )
    logger.info("Azure OpenAI client initialized successfully")
else:
    client = None
    logger.warning("Azure OpenAI not configured. LLM triage will not be available.")


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


def summarize_anomaly_row(row_data: Dict[str, Any]) -> str:
    """
    Create a compact textual summary for the LLM from anomaly data.

    Args:
        row_data: Dictionary containing anomaly fields

    Returns:
        Formatted string summary
    """
    candidate_fields = [
        "timestamp",
        "hostName",
        "hostname",
        "userId",
        "user_id",
        "processId",
        "pid",
        "parentProcessId",
        "ppid",
        "mountNamespace",
        "mount_ns",
        "processName",
        "process_name",
        "eventId",
        "event_id",
        "eventName",
        "event_name",
        "args",
        "sus",
        "evil",
        "anomaly",
        "anomaly_score",
        "label",
    ]

    parts = []
    for field in candidate_fields:
        if field in row_data and row_data[field] is not None and row_data[field] != "":
            val = str(row_data[field])
            if len(val) > 200:
                val = val[:200] + "..."
            parts.append(f"{field}={val}")

    return ", ".join(parts)


def extract_text_from_message(message) -> str:
    """
    Handle both string and list-style message.content formats from Azure OpenAI.

    Args:
        message: Response message from OpenAI API

    Returns:
        Extracted text content
    """
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


def analyze_anomaly_with_llm(
    anomaly_data: Dict[str, Any],
    dataset_id: str,
    anomaly_id: str,
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Call Azure OpenAI GPT-5-mini to analyze an anomaly and generate triage report.

    Args:
        anomaly_data: Dictionary containing the anomaly row data
        dataset_id: ID of the dataset
        anomaly_id: ID of the anomaly
        session_id: Optional analysis session ID

    Returns:
        Dictionary containing the LLM analysis (matching LLMExplanation schema)

    Raises:
        ValueError: If Azure OpenAI is not configured
        Exception: If LLM call fails
    """
    if not AZURE_CONFIGURED or client is None:
        raise ValueError(
            "Azure OpenAI is not configured. Please set AZURE_OPENAI_ENDPOINT, "
            "AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, and AZURE_OPENAI_API_VERSION "
            "in your environment variables."
        )

    logger.info(f"Analyzing anomaly {anomaly_id} with Azure OpenAI")

    # Create summary for LLM
    summary = summarize_anomaly_row(anomaly_data)

    user_content = f"""
This event was flagged as anomalous by an upstream detector:

{summary}

Return ONLY the JSON object as specified. No extra text.
"""

    try:
        start_time = datetime.now()

        resp = client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,
        )

        end_time = datetime.now()
        latency_ms = (end_time - start_time).total_seconds() * 1000

        message = resp.choices[0].message
        text = extract_text_from_message(message)

        # Parse JSON response
        try:
            data = json.loads(text)

            # Add metadata
            data["_llm_timestamp_utc"] = datetime.now().astimezone().isoformat()

            # Update provenance with actual token counts and latency
            if "provenance" in data:
                data["provenance"]["tokens_prompt"] = resp.usage.prompt_tokens if resp.usage else None
                data["provenance"]["tokens_output"] = resp.usage.completion_tokens if resp.usage else None
                data["provenance"]["latency_ms"] = latency_ms

            # Ensure IDs are set correctly
            data["dataset_id"] = dataset_id
            data["anomaly_id"] = anomaly_id
            if session_id:
                data["session_id"] = session_id

            logger.info(f"Successfully analyzed anomaly {anomaly_id} (latency: {latency_ms:.2f}ms)")
            return data

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.debug(f"Raw LLM response: {text}")

            # Return a fallback response
            return {
                "schema_version": "1.0",
                "dataset_id": dataset_id,
                "anomaly_id": anomaly_id,
                "session_id": session_id,
                "verdict": "unclear",
                "severity": "low",
                "confidence_label": "low",
                "confidence_score": 0.0,
                "mitre": [],
                "actors": {},
                "host": {},
                "event": {"name": "unknown", "timestamp": None, "args": []},
                "features": [],
                "evidence_refs": [],
                "key_indicators": ["LLM response was not valid JSON"],
                "triage": {
                    "immediate_actions": ["Manually review the anomaly"],
                    "short_term": [],
                    "long_term": []
                },
                "notes": f"LLM response parsing failed: {str(e)}. Raw response captured for debugging.",
                "status": "new",
                "owner": None,
                "provenance": {
                    "model_name": "gpt-5-mini",
                    "model_version": "base",
                    "prompt_id": "beth-triage-v1",
                    "temperature": 0.2,
                    "tokens_prompt": resp.usage.prompt_tokens if resp.usage else None,
                    "tokens_output": resp.usage.completion_tokens if resp.usage else None,
                    "latency_ms": latency_ms
                },
                "_created_at": datetime.now(timezone=None).isoformat(),
                "hash": None,
                "_llm_timestamp_utc": datetime.now().astimezone().isoformat(),
                "_raw_response": text
            }

    except Exception as e:
        logger.error(f"Error calling Azure OpenAI for anomaly {anomaly_id}: {str(e)}", exc_info=True)
        raise


def batch_analyze_anomalies(
    anomalies: list[Dict[str, Any]],
    dataset_id: str,
    session_id: Optional[str] = None,
    max_anomalies: Optional[int] = None
) -> list[Dict[str, Any]]:
    """
    Analyze multiple anomalies in batch.

    Args:
        anomalies: List of anomaly dictionaries
        dataset_id: ID of the dataset
        session_id: Optional analysis session ID
        max_anomalies: Optional limit on number of anomalies to process

    Returns:
        List of LLM analysis dictionaries
    """
    if not AZURE_CONFIGURED:
        raise ValueError("Azure OpenAI is not configured")

    if max_anomalies:
        anomalies = anomalies[:max_anomalies]

    results = []

    for i, anomaly in enumerate(anomalies, start=1):
        try:
            anomaly_id = str(anomaly.get("_id", f"anomaly_{i}"))
            analysis = analyze_anomaly_with_llm(
                anomaly_data=anomaly,
                dataset_id=dataset_id,
                anomaly_id=anomaly_id,
                session_id=session_id
            )
            results.append(analysis)

            if i % 10 == 0:
                logger.info(f"Processed {i}/{len(anomalies)} anomalies")

        except Exception as e:
            logger.error(f"Failed to analyze anomaly {i}: {str(e)}")
            # Continue with next anomaly

    logger.info(f"Completed batch analysis: {len(results)}/{len(anomalies)} anomalies processed")
    return results
