from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from app.models.models import User, DocumentModel
from typing import Dict
from app.repositories.document_repo import upload_document, get_documents, delete_document, choose_one_document, get_document_presigned_url, search_documents_exact, search_documents_similar
from app.core.auth import get_current_active_user
from app.models.report_models import ReportProgressUpdate
from app.utils.progress_utils import store_progress
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/", response_model=Dict[str, str])
async def create_document(
    case_id: str,
    file: UploadFile = File(...),
    created_at: str | None = Form(None),
    current_user: User = Depends(get_current_active_user)
):
    """API endpoint to upload an Excel file (.xlsx only) for a specific case."""
    content_type = file.content_type
    filename = file.filename

    logger.info(f"Document upload request - User: {current_user.username}, Case: {case_id}, File: {filename}, Type: {content_type}, Size: {file.size if hasattr(file, 'size') else 'unknown'}")

    # Validate file type - ONLY .xlsx files allowed
    if not filename.lower().endswith('.xlsx'):
        logger.error(f"Invalid file type uploaded: {filename}")
        raise HTTPException(
            status_code=415,  # Unsupported Media Type
            detail="Only .xlsx files are supported. PDFs, images, and other formats are not allowed."
        )

    progress_id = str(uuid4())
    report_id = str(uuid4())  # Generate a new case study ID

    logger.debug(f"Generated progress_id: {progress_id} for Excel upload")

    progress_data = ReportProgressUpdate(
        progress_id=progress_id,
        status="initializing",
        progress=0,
        message="Starting upload of Excel file...",
        report_id=report_id,
        error=None,
        study_type="document_upload",
        doc_id=case_id
    )

    try:
        store_progress(progress_id, progress_data, user_id=str(current_user.id))
        logger.debug(f"Stored initial progress for upload: {progress_id}")
    except Exception as e:
        logger.error(f"Failed to store initial progress for upload {progress_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initialize upload progress")

    try:
        file_content = await file.read()
        logger.info(f"Successfully read Excel file content - Size: {len(file_content)} bytes")
    except Exception as e:
        logger.error(f"Failed to read file content for {filename}: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to read uploaded file")
    
    try:
        logger.info(f"Starting document upload process for {filename} in case {case_id}")
        upload_document(
            case_id=case_id,
            current_user=current_user,
            file_content=file_content, 
            content_type=content_type,
            filename=filename,
            username=current_user.username,
            progress_id=progress_id,
            created_at=created_at,
        )
        logger.info(f"Document upload task queued successfully - Progress ID: {progress_id}")
    except ValueError as e:
        logger.error(f"Document upload validation error for {filename}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error starting document upload for {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start document upload")

    return {
        "progress_id": progress_id,
        "message": "Document upload started."
    }

@router.get("/", response_model=list[DocumentModel])
async def read_documents(case_id: str, current_user: User = Depends(get_current_active_user)):
    """API endpoint to fetch all documents for a specific case."""
    logger.info(f"Fetching documents for case: {case_id}, User: {current_user.username}")
    
    try:
        documents = await get_documents(case_id, current_user)
        logger.info(f"Successfully retrieved {len(documents)} documents for case {case_id}")
        
        # Even if there are no documents, return an empty list instead of 204
        if not documents:
            logger.debug(f"No documents found for case {case_id}")
            return []
        return documents
    except HTTPException as e:
        logger.warning(f"HTTP error fetching documents for case {case_id}: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching documents for case {case_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch documents")

@router.get("/{document_id}", response_model=DocumentModel)
async def read_document(case_id: str, document_id: str, current_user: User = Depends(get_current_active_user)):
    """API endpoint to fetch a specific document by ID."""
    logger.info(f"Fetching document {document_id} from case {case_id} for user {current_user.username}")
    
    try:
        document = await choose_one_document(document_id, current_user)
        logger.info(f"Successfully retrieved document {document_id}")
        return document
    except HTTPException as e:
        logger.warning(f"HTTP error fetching document {document_id}: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching document {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch document")

@router.delete("/{document_id}")
async def remove_document(case_id: str, document_id: str, current_user: User = Depends(get_current_active_user)):
    """API endpoint to delete a specific document by ID."""
    logger.info(f"Deleting document {document_id} from case {case_id} for user {current_user.username}")
    
    try:
        result = await delete_document(document_id, current_user)
        logger.info(f"Successfully deleted document {document_id}")
        return result
    except HTTPException as e:
        logger.warning(f"HTTP error deleting document {document_id}: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error deleting document {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete document")

@router.get("/{document_id}/url", response_model=Dict[str, str])
async def get_document_url_endpoint(case_id: str, document_id: str, current_user = Depends(get_current_active_user)):
    logger.info(f"Generating presigned URL for document {document_id} in case {case_id}")
    
    try:
        result = await get_document_presigned_url(case_id, document_id, current_user)
        logger.info(f"Successfully generated presigned URL for document {document_id}")
        return result
    except HTTPException as e:
        logger.warning(f"HTTP error generating URL for document {document_id}: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error generating URL for document {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate document URL")

@router.post("/search", response_model=list[DocumentModel])
async def search_documents(
    case_id: str,  # This comes from the path parameter in the router prefix
    query: str = Form(...),
    search_mode: str = Form(default="exact"),  # "exact" or "similar"
    current_user: User = Depends(get_current_active_user)
):
    """API endpoint to search documents within a specific case."""
    logger.info(f"Document search request - User: {current_user.username}, Case: {case_id}, Query: '{query}', Mode: {search_mode}")
    
    if not query.strip():
        logger.debug("Empty search query provided, returning empty results")
        return []
    
    try:
        if search_mode == "similar":
            logger.debug(f"Performing vector similarity search for query: '{query}'")
            results = await search_documents_similar(query, case_id, current_user)
        else:  # Default to exact search
            logger.debug(f"Performing exact regex search for query: '{query}'")
            results = await search_documents_exact(query, case_id, current_user)
        
        logger.info(f"Search completed - Found {len(results)} documents matching '{query}' in case {case_id}")
        return results
        
    except HTTPException as e:
        logger.warning(f"HTTP error during document search for '{query}': {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during document search for '{query}': {str(e)}")
        raise HTTPException(status_code=500, detail="Search operation failed")