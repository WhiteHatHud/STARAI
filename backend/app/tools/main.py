"""
Main File Processing Module
Handles ONLY .xlsx file uploads with deterministic parsing.
All AI/OCR processing has been removed.
"""

import logging
import re
import requests
from typing import Tuple, Dict, Any
from fastapi import HTTPException

from app.tools.excel_parser import parse_xlsx_to_json, validate_xlsx_file, get_excel_summary

logger = logging.getLogger(__name__)


async def process_file(
    url: str,
    file_size: int,
    filename: str,
    content_type: str
) -> Tuple[Dict[str, Any], str]:
    """
    Process uploaded Excel file (.xlsx only) and return structured JSON.

    This function:
    1. Validates the file is .xlsx format
    2. Downloads the file from S3 presigned URL
    3. Parses Excel into structured JSON
    4. Returns both the parsed data and a summary

    Args:
        url: Presigned S3 URL of the file
        file_size: Size of the file in bytes
        filename: Original filename
        content_type: MIME type of the file

    Returns:
        Tuple[Dict[str, Any], str]: (parsed_json_data, content_type)
        where content_type is always "excel"

    Raises:
        HTTPException: If file is not .xlsx or parsing fails
    """
    logger.info(f"process_file called - File: {filename}, Size: {file_size} bytes, Type: {content_type}")

    # Validate file type FIRST before downloading
    try:
        validate_xlsx_file(content_type, filename)
    except ValueError as e:
        logger.error(f"File validation failed: {str(e)}")
        raise HTTPException(
            status_code=415,  # Unsupported Media Type
            detail=f"Only .xlsx files are supported. PDFs, images, and other formats are not allowed. {str(e)}"
        )

    # Check file size (configurable limit, default 25MB)
    MAX_FILE_SIZE_MB = 25
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

    if file_size > MAX_FILE_SIZE_BYTES:
        logger.error(f"File too large: {file_size} bytes (max: {MAX_FILE_SIZE_BYTES})")
        raise HTTPException(
            status_code=413,  # Payload Too Large
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE_MB}MB"
        )

    # Download file from S3
    try:
        logger.debug(f"Downloading file from S3: {filename}")
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        file_content = response.content
        logger.info(f"Successfully downloaded file - Size: {len(file_content)} bytes")
    except requests.RequestException as e:
        logger.error(f"Failed to download file from S3: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download file from storage: {str(e)}"
        )

    # Parse Excel file
    try:
        logger.info(f"Starting Excel parsing for: {filename}")
        parsed_data = parse_xlsx_to_json(file_content, filename)

        # Generate summary for logging/display
        summary = get_excel_summary(parsed_data)
        logger.info(f"Excel parsing completed successfully:\n{summary}")

        # Return parsed data and content type
        # The parsed_data follows the standard schema:
        # {
        #   "workbookMeta": {...},
        #   "sheets": [...],
        #   "sourceFile": {...}
        # }
        return parsed_data, "excel"

    except ValueError as e:
        logger.error(f"Excel parsing failed: {str(e)}")
        raise HTTPException(
            status_code=422,  # Unprocessable Entity
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error during Excel parsing: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process Excel file: {str(e)}"
        )


# ----------------------------------------- UTILITY FUNCTIONS --------------------------------------------

def clean_markdown_text(text: str) -> str:
    """
    Clean markdown text to plain text.
    This utility function is used by case study generation tasks.
    """
    # Remove markdown headers (# symbols)
    text = re.sub(r'^#+\s*', '', text, flags=re.MULTILINE)

    # Remove bullet points (but not dashes in words)
    text = re.sub(r'^\s*[-*•·]\s+', '', text, flags=re.MULTILINE)

    # Remove multiple newlines
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Remove any remaining markdown symbols
    text = re.sub(r'[*_`~]', '', text)

    # CONVERT Unicode to ASCII before removing non-ASCII
    text = text.replace('\u2018', "'")  # Left single quotation mark
    text = text.replace('\u2019', "'")  # Right single quotation mark
    text = text.replace('\u201C', '"')  # Left double quotation mark
    text = text.replace('\u201D', '"')  # Right double quotation mark
    text = text.replace('\u2013', '-')  # En dash
    text = text.replace('\u2014', '-')  # Em dash

    # Remove any non-printable characters
    text = re.sub(r'[^\x20-\x7E\n]', '', text)

    # Remove leading/trailing whitespace from each line
    text = '\n'.join(line.strip() for line in text.splitlines())

    # Remove extra spaces
    text = re.sub(r' +', ' ', text)

    # Final trim
    text = text.strip()

    return text
