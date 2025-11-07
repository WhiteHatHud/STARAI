"""
Dataset Parser Module
Parses .xlsx and .csv files into structured JSON format using pandas.
No AI/LLM processing - deterministic parsing only.
"""

import logging
import pandas as pd
from io import BytesIO, StringIO
from typing import Dict, List, Any
from datetime import datetime

logger = logging.getLogger(__name__)


def parse_xlsx_to_json(
    file_content: bytes,
    filename: str
) -> Dict[str, Any]:
    """
    Parse Excel (.xlsx) or CSV file into structured JSON format.

    Args:
        file_content: Raw bytes of the file
        filename: Original filename

    Returns:
        Dict containing workbook metadata, sheets data, and source file info

    Raises:
        ValueError: If file is empty, corrupted, or lacks valid data
    """
    is_csv = filename.lower().endswith('.csv')
    file_type = "csv" if is_csv else "xlsx"

    logger.info(f"Starting {file_type.upper()} parsing for file: {filename}")

    try:
        sheets = []
        total_rows = 0
        sheet_names = []

        if is_csv:
            # Parse CSV file
            logger.debug("Parsing as CSV file")

            # Try to decode as UTF-8, fallback to latin-1 if needed
            try:
                text_content = file_content.decode('utf-8')
            except UnicodeDecodeError:
                logger.warning("UTF-8 decode failed, trying latin-1")
                text_content = file_content.decode('latin-1')

            # Read CSV
            df = pd.read_csv(StringIO(text_content))

            # Replace NaN values with None for JSON serialization
            df = df.where(pd.notnull(df), None)

            # Convert to list of dictionaries
            rows = df.to_dict(orient='records')

            if not rows:
                raise ValueError("CSV file is empty or contains no data")

            sheets.append({
                "name": "Sheet1",  # CSVs only have one "sheet"
                "rows": rows,
                "rowCount": len(rows),
                "columnCount": len(df.columns)
            })

            total_rows = len(rows)
            sheet_names = ["Sheet1"]

            logger.debug(f"Parsed CSV: {len(rows)} rows, {len(df.columns)} columns")

        else:
            # Parse Excel file
            logger.debug("Parsing as Excel file")
            excel_file = pd.ExcelFile(BytesIO(file_content), engine='openpyxl')

            if not excel_file.sheet_names:
                raise ValueError("Excel file contains no sheets")

            logger.debug(f"Found {len(excel_file.sheet_names)} sheets: {excel_file.sheet_names}")
            sheet_names = excel_file.sheet_names

            # Parse all sheets
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
            raise ValueError("No valid data found. The file appears empty or lacks headers.")

        # Build the standardized JSON structure
        result = {
            "workbookMeta": {
                "sheetNames": sheet_names,
                "sheetCount": len(sheet_names),
                "totalRows": total_rows
            },
            "sheets": sheets,
            "sourceFile": {
                "filename": filename,
                "size": len(file_content),
                "uploadedAt": datetime.utcnow().isoformat() + "Z",
                "fileType": file_type
            }
        }

        logger.info(f"Successfully parsed {file_type.upper()} file: {len(sheets)} sheet(s), {total_rows} total rows")
        return result

    except pd.errors.EmptyDataError:
        logger.error(f"File is empty: {filename}")
        raise ValueError("The file is empty")
    except Exception as e:
        logger.error(f"Failed to parse file '{filename}': {str(e)}")
        raise ValueError(f"Failed to parse file: {str(e)}")


def validate_xlsx_file(content_type: str, filename: str) -> bool:
    """
    Validate that the uploaded file is a valid .xlsx or .csv file.

    Args:
        content_type: MIME type from the upload
        filename: Original filename

    Returns:
        True if valid file

    Raises:
        ValueError: If file is not a supported format
    """
    logger.debug(f"Validating file: {filename}, content_type: {content_type}")

    # Check file extension
    is_xlsx = filename.lower().endswith('.xlsx')
    is_csv = filename.lower().endswith('.csv')

    if not (is_xlsx or is_csv):
        raise ValueError(
            f"Invalid file extension. Only .xlsx and .csv files are supported. "
            f"Received: {filename}"
        )

    # Check MIME type
    if is_xlsx:
        valid_mime_types = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/octet-stream',  # Sometimes browsers send this
            'application/xlsx'  # Alternative MIME type
        ]
    else:  # CSV
        valid_mime_types = [
            'text/csv',
            'text/plain',
            'application/csv',
            'application/octet-stream'  # Sometimes browsers send this
        ]

    if content_type not in valid_mime_types:
        logger.warning(
            f"Unexpected MIME type for {'.xlsx' if is_xlsx else '.csv'} file: {content_type}. "
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
