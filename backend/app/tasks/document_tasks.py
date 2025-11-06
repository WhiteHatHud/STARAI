# app/tasks/report_tasks.py

from app.core.celery_manager import celery_app, r, MAPPING_KEY
from app.utils.progress_utils import update_progress_field
from app.database.connection import cases_collection, docs_collection
from app.models.models import DocumentModel
from app.tools.main import process_file
from app.core.s3_manager import s3_manager
from app.repositories.chunk_repo import create_chunks
import logging
import asyncio

from bson import ObjectId
import re
from datetime import datetime


logger = logging.getLogger(__name__)

@celery_app.task(name="upload_document", bind=True)
def upload_document_task(self, task_data):
    progress_id = task_data['progress_id']
    filename = task_data.get('filename', 'unknown')
    case_id = task_data.get('case_id', 'unknown')
    file_size = task_data.get('file_size', 0)

    logger.info(f"Starting document upload task - Progress ID: {progress_id}, File: {filename}, Case: {case_id}, Size: {file_size} bytes")

    try:
        # Run async function in event loop
        result = asyncio.run(upload_document_async(task_data))
        logger.info(f"Document upload task completed successfully - Progress ID: {progress_id}")
        return result
    except Exception as e:
        logger.error(f"Document upload task failed - Progress ID: {progress_id}, File: {filename}, Error: {str(e)}")
        # Update progress with error
        try:
            update_progress_field(progress_id, 
                                status="error", 
                                progress=0,
                                error=str(e))
            logger.debug(f"Updated progress with error status for {progress_id}")
        except Exception as progress_error:
            logger.error(f"Failed to update progress with error for {progress_id}: {str(progress_error)}")
        raise

async def upload_document_async(task_data):
    s3_key = task_data['s3_key']
    case_id = task_data['case_id']
    filename = task_data['filename']
    current_user_data = task_data['user']  # This is now a dict, not a UserInDB object
    case = task_data['case']
    progress_id = task_data['progress_id']
    file_size = task_data['file_size']

    logger.info(f"Processing document upload - Progress ID: {progress_id}, File: {filename}, S3 Key: {s3_key}, User: {current_user_data.get('username', 'unknown')}, Size: {file_size} bytes")

    def update_progress(percent, message):
        """Update progress in MongoDB"""
        logger.debug(f"📊 Progress update for {progress_id}: {percent}% - {message}")
        try:
            update_progress_field(progress_id, 
                                 progress=int(percent), 
                                 message=message)
        except Exception as e:
            logger.error(f"Failed to update progress for {progress_id}: {str(e)}")
    
    try:
        logger.info(f"Starting Excel file processing for {filename} from S3")
        update_progress(5, "Parsing Excel file...")

        # Generate presigned URL for processing
        presigned_url = s3_manager.generate_presigned_url(s3_key)
        logger.debug(f"Generated presigned URL for processing: {filename}")

        # Get content_type from task_data
        content_type_upload = task_data.get('content_type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

        # Process the Excel file - returns Dict (JSON structure) and content_type
        parsed_data, content_type = await process_file(presigned_url, file_size, filename, content_type_upload)
        logger.info(f"Successfully parsed Excel file - Sheets: {len(parsed_data.get('sheets', []))}, Total rows: {parsed_data.get('workbookMeta', {}).get('totalRows', 0)}")
        
    except Exception as processing_error:
        logger.error(f"File processing failed for {filename}: {str(processing_error)}")
        
        # If processing fails, delete the file from S3 before re-raising
        if s3_key:
            logger.warning(f"Deleting S3 file due to processing failure: {s3_key}")
            try:
                s3_manager.delete_file(s3_key)
                logger.info(f"Successfully deleted S3 file after processing error: {s3_key}")
            except Exception as delete_error:
                logger.error(f"Failed to delete S3 file after processing error: {delete_error}")

        # Re-raise the original error
        error_msg = f"Error processing file: {str(processing_error)}"
        logger.error(error_msg)
        raise ValueError(error_msg)

    update_progress(10, "Storing document...")
    logger.debug(f"Creating document record in database for {filename}")

    # Serialize parsed Excel data to JSON string for storage
    import json
    content_json = json.dumps(parsed_data, ensure_ascii=False)

    # Create the document model
    # Use provided created_at if present, otherwise add current timestamps
    provided_created_at = task_data.get("created_at")
    now_iso = datetime.utcnow().isoformat() + "Z"
    created_at_iso = provided_created_at if provided_created_at else now_iso
    new_document = {
        "case_id": ObjectId(case_id),
        "name": filename,
        "content": content_json,  # Store as JSON string
        "content_type": content_type,  # "excel"
        "s3_key": s3_key,
        "created_at": created_at_iso,
        "updated_at": now_iso,
        "parsed_data": parsed_data,  # Store full structured data for easy access
    }

    try:
        # Store document in collection
        result = docs_collection.insert_one(new_document)
        result_id = result.inserted_id
        logger.info(f"Document stored in database - ID: {result_id}, File: {filename}")
    except Exception as e:
        logger.error(f"Failed to store document in database for {filename}: {str(e)}")
        raise
    
    update_progress(30, "Processing document...")

    # Skip chunking for Excel files - they're already structured as JSON
    # If you need chunking in the future, you can process the parsed_data here
    chunk_success = True  # Excel files don't need traditional chunking
    logger.info(f"Skipping text chunking for Excel file - data is already structured")
    
    update_progress(70, "Finalizing document...")
    
    try:
        # Update the case - check if documents field exists
        if "documents" not in case:
            case["documents"] = []
            logger.debug(f"Initialized documents array for case {case_id}")
        
        # Append the new document ID
        case["documents"].append(str(result_id))
        
        # Update the case in the database
        update_result = cases_collection.update_one(
            {"_id": ObjectId(case_id)}, 
            {"$set": {"documents": case["documents"]}}
        )
        
        if update_result.modified_count > 0:
            logger.info(f"Successfully updated case {case_id} with new document {result_id}")
        else:
            logger.warning(f"Case update may have failed - Modified count: {update_result.modified_count}")
            
    except Exception as e:
        logger.error(f"Failed to update case {case_id} with document {result_id}: {str(e)}")
        raise
    
    logger.info(f"Document upload process completed successfully - Document ID: {result_id}, File: {filename}")
    
    try:
        # Update the document's updated_at to mark processing completion
        now_iso_end = datetime.utcnow().isoformat() + "Z"
        try:
            docs_collection.update_one(
                {"_id": result_id},
                {"$set": {"updated_at": now_iso_end, "processing_status": "completed"}},
            )
            # Also update local copy so the response contains the final timestamp
            new_document["updated_at"] = now_iso_end
        except Exception as update_err:
            logger.error(f"Failed to update document timestamps for {result_id}: {str(update_err)}")

        # Create the final document model for the response
        final_document = DocumentModel(**new_document, id=str(result_id))
        document_json = final_document.model_dump_json()

        update_progress_field(
            progress_id,
            status="completed",
            progress=100,
            message="Document uploaded successfully!",
            template=document_json,
        )

        logger.info(f"Final progress update completed for document upload: {progress_id}")

    except Exception as e:
        logger.error(f"Failed to complete final progress update for {progress_id}: {str(e)}")
        # Don't raise here as the document was successfully processed