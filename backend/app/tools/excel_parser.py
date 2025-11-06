"""
Excel Parser Module
Parses .xlsx files into structured JSON format using pandas and openpyxl.
No AI/LLM processing - deterministic parsing only.
"""

import logging
import pandas as pd
from io import BytesIO
from typing import Dict, List, Any
from datetime import datetime

logger = logging.getLogger(__name__)


def parse_xlsx_to_json(
    file_content: bytes,
    filename: str
) -> Dict[str, Any]:
    """
    Parse Excel file (.xlsx) into structured JSON format.

    Args:
        file_content: Raw bytes of the Excel file
        filename: Original filename

    Returns:
        Dict containing workbook metadata, sheets data, and source file info

    Raises:
        ValueError: If file is empty, corrupted, or lacks valid data
    """
    logger.info(f"Starting Excel parsing for file: {filename}")

    try:
        # Read Excel file using pandas
        excel_file = pd.ExcelFile(BytesIO(file_content), engine='openpyxl')

        if not excel_file.sheet_names:
            raise ValueError("Excel file contains no sheets")

        logger.debug(f"Found {len(excel_file.sheet_names)} sheets: {excel_file.sheet_names}")

        # Parse all sheets
        sheets = []
        total_rows = 0

        for sheet_name in excel_file.sheet_names:
            try:
                # Read sheet and handle null values
                df = excel_file.parse(sheet_name)

                # Replace NaN values with None for JSON serialization
                df = df.where(pd.notnull(df), None)

                # Convert to list of dictionaries (each row becomes a dict)
                rows = df.to_dict(orient='records')

                # Check if sheet has data
                if not rows:
                    logger.warning(f"Sheet '{sheet_name}' is empty, skipping")
                    continue

                sheets.append({
                    "name": sheet_name,
                    "rows": rows,
                    "rowCount": len(rows),
                    "columnCount": len(df.columns)
                })

                total_rows += len(rows)
                logger.debug(f"Parsed sheet '{sheet_name}': {len(rows)} rows, {len(df.columns)} columns")

            except Exception as sheet_error:
                logger.error(f"Error parsing sheet '{sheet_name}': {str(sheet_error)}")
                # Continue with other sheets instead of failing completely
                continue

        if not sheets:
            raise ValueError("No valid data found in any sheet. The workbook appears empty or lacks headers.")

        # Build the standardized JSON structure
        result = {
            "workbookMeta": {
                "sheetNames": excel_file.sheet_names,
                "sheetCount": len(excel_file.sheet_names),
                "totalRows": total_rows
            },
            "sheets": sheets,
            "sourceFile": {
                "filename": filename,
                "size": len(file_content),
                "uploadedAt": datetime.utcnow().isoformat() + "Z",
                "fileType": "xlsx"
            }
        }

        logger.info(f"Successfully parsed Excel file: {len(sheets)} sheets, {total_rows} total rows")
        return result

    except pd.errors.EmptyDataError:
        logger.error(f"Excel file is empty: {filename}")
        raise ValueError("The Excel file is empty")
    except Exception as e:
        logger.error(f"Failed to parse Excel file '{filename}': {str(e)}")
        raise ValueError(f"Failed to parse Excel file: {str(e)}")


def validate_xlsx_file(content_type: str, filename: str) -> bool:
    """
    Validate that the uploaded file is a valid .xlsx file.

    Args:
        content_type: MIME type from the upload
        filename: Original filename

    Returns:
        True if valid .xlsx file

    Raises:
        ValueError: If file is not a valid .xlsx file
    """
    logger.debug(f"Validating file: {filename}, content_type: {content_type}")

    # Check file extension
    if not filename.lower().endswith('.xlsx'):
        raise ValueError(
            f"Invalid file extension. Only .xlsx files are supported. "
            f"Received: {filename}"
        )

    # Check MIME type (can be application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    # or sometimes application/octet-stream)
    valid_mime_types = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream',  # Sometimes browsers send this
        'application/xlsx'  # Alternative MIME type
    ]

    if content_type not in valid_mime_types:
        logger.warning(
            f"Unexpected MIME type for .xlsx file: {content_type}. "
            f"Expected one of: {valid_mime_types}"
        )
        # Still allow if extension is correct, but log warning

    logger.debug(f"File validation passed for: {filename}")
    return True


def get_excel_summary(parsed_data: Dict[str, Any]) -> str:
    """
    Generate a human-readable summary of the parsed Excel data.

    Args:
        parsed_data: The parsed JSON structure from parse_xlsx_to_json

    Returns:
        str: Summary text
    """
    meta = parsed_data.get('workbookMeta', {})
    sheets = parsed_data.get('sheets', [])

    summary_parts = [
        f"Excel file successfully parsed:",
        f"- {meta.get('sheetCount', 0)} sheet(s): {', '.join(meta.get('sheetNames', []))}",
        f"- {meta.get('totalRows', 0)} total rows"
    ]

    for sheet in sheets:
        summary_parts.append(
            f"  • {sheet['name']}: {sheet['rowCount']} rows × {sheet['columnCount']} columns"
        )

    return "\n".join(summary_parts)
