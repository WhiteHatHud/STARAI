from app.database.connection import cases_collection, docs_collection
from app.models.models import DocumentModel
from fastapi import HTTPException
from app.core.s3_manager import s3_manager
from app.tasks.document_tasks import upload_document_task
from app.repositories.chunk_repo import delete_all_chunks
import os
import uuid
import io
import logging
from bson import ObjectId
import re
from app.utils.vector_search import VectorSearch

logger = logging.getLogger(__name__)

def upload_document(
    case_id: str,
    current_user,
    file_content: bytes,
    content_type: str,
    filename: str,
    username: str,
    progress_id: str,
    created_at: str | None = None):
    logger.info(f"Starting document upload - Case: {case_id}, File: {filename}, Size: {len(file_content)} bytes, User: {username}")
    
    # Fetch the case
    try:
        case = cases_collection.find_one({"_id": ObjectId(case_id)})
        if case is None:
            logger.error(f"Case not found for upload: {case_id}")
            raise HTTPException(status_code=404, detail="Case not found")
        logger.debug(f"Case found for upload: {case_id}")
    except Exception as e:
        logger.error(f"Error fetching case {case_id} for upload: {str(e)}")
        raise

    document_id = str(uuid.uuid4())
    file_ext = os.path.splitext(filename)[1].lower()
    s3_key = None
    
    logger.debug(f"Generated document ID: {document_id}, File extension: {file_ext}")

    # Ensure document isn't duplicated before uploading to S3
    try:
        existing_doc = docs_collection.find_one({"case_id": ObjectId(case_id), "name": filename})
        if existing_doc:
            logger.warning(f"Duplicate document detected: {filename} in case {case_id}")
            raise HTTPException(status_code=409, detail="Duplicate document!")
        logger.debug(f"No duplicate found for {filename}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking for duplicate document {filename}: {str(e)}")
        raise

    # Generate S3 key and upload the file to S3 first
    base_path = os.environ.get("S3_BASE_PATH", "dataset/")
    s3_key = f"{base_path}documents/{case_id}/{document_id}{file_ext}"
    logger.info(f"Uploading file to S3 - Key: {s3_key}")
    
    try:
        s3_result = s3_manager.upload_file(
            file_obj=io.BytesIO(file_content),
            key=s3_key,
            content_type=content_type
        )
        logger.info(f"Successfully uploaded file to S3: {s3_key}")
    except Exception as e:
        logger.error(f"Failed to upload file to S3 {s3_key}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload file to storage")

    # Convert case data to be JSON serializable
    serializable_case = {}
    for key, value in case.items():
        if isinstance(value, ObjectId):
            serializable_case[key] = str(value)
        else:
            serializable_case[key] = value

    task_data = {
        "progress_id": progress_id,
        "s3_key": s3_key,
        "case_id": case_id,
        "filename": filename,
        "content_type": content_type,  # Pass content_type for validation
        "user": {
            "id": str(current_user.id),
            "username": current_user.username,
            "email": current_user.email,
        },
        "case": serializable_case,
        "created_at": created_at,
        "file_size": len(file_content),
    }
    
    logger.info(f"Queuing document processing task for {filename} - Progress ID: {progress_id}")
    try:
        upload_document_task.delay(task_data)
        logger.debug(f"Document processing task queued successfully")
    except Exception as e:
        logger.error(f"Failed to queue document processing task: {str(e)}")
        # Try to clean up S3 file if task queueing fails
        try:
            s3_manager.delete_file(s3_key)
            logger.info(f"Cleaned up S3 file after task queue failure: {s3_key}")
        except Exception as cleanup_error:
            logger.error(f"Failed to cleanup S3 file after task queue failure: {str(cleanup_error)}")
        raise HTTPException(status_code=500, detail="Failed to start document processing")


async def get_documents(case_id: str, current_user):
    logger.info(f"Fetching documents for case: {case_id}, User: {current_user.username if hasattr(current_user, 'username') else 'unknown'}")
    
    try:
        case = cases_collection.find_one({"_id": ObjectId(case_id)})
        if case is None:
            logger.error(f"Case not found when fetching documents: {case_id}")
            raise HTTPException(status_code=404, detail="Case not found")
        logger.debug(f"Case found for document fetch: {case_id}")
    except Exception as e:
        logger.error(f"Error fetching case {case_id}: {str(e)}")
        raise

    documents = []
    try:
        # Use case_id filter to fetch documents for that case, sort by name
        cursor = docs_collection.find({"case_id": ObjectId(case_id)}).sort("name", 1)
        
        # With sync MongoDB, we iterate normally
        doc_count = 0
        for doc in cursor:
            documents.append(DocumentModel.model_validate(doc))
            doc_count += 1
        
        logger.info(f"Successfully fetched {doc_count} documents for case {case_id}")
        return documents
        
    except Exception as e:
        logger.error(f"Error fetching documents for case {case_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch documents")


async def delete_document(document_id: str, current_user):
    logger.info(f"Deleting document: {document_id}, User: {current_user.username if hasattr(current_user, 'username') else 'unknown'}")
    
    # First get the document to retrieve the S3 key
    try:
        document = docs_collection.find_one({"_id": ObjectId(document_id)})
        if document is None:
            logger.warning(f"Document not found for deletion: {document_id}")
            raise HTTPException(status_code=404, detail="Document not found")
        
        logger.debug(f"Found document for deletion: {document_id}, Name: {document.get('name', 'unknown')}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching document for deletion {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch document for deletion")
    
    # Get the S3 key from the document
    s3_key = document.get("s3_key")
    logger.debug(f"Document S3 key: {s3_key}")
    
    try:
        # Delete the document from the database
        result = docs_collection.delete_one({"_id": ObjectId(document_id)})
        
        if result.deleted_count == 0:
            logger.warning(f"No document was deleted for ID: {document_id}")
        else:
            logger.info(f"Successfully deleted document from database: {document_id}")
        
        # Delete associated chunks
        await delete_all_chunks(document_id)
        logger.debug(f"Deleted chunks for document: {document_id}")
        
        # Delete the file from S3 if it exists
        if s3_key:
            try:
                s3_manager.delete_file(s3_key)
                logger.info(f"Deleted document file from S3: {s3_key}")
            except Exception as e:
                logger.error(f"Failed to delete file from S3: {str(e)}")
                # Continue with deletion even if S3 fails
        
        # Also update any cases that reference this document
        try:
            case_update_result = cases_collection.update_many(
                {"documents": str(document_id)},
                {"$pull": {"documents": str(document_id)}}
            )
            logger.debug(f"Updated {case_update_result.modified_count} cases to remove document reference")
        except Exception as e:
            logger.error(f"Failed to update case references for deleted document {document_id}: {str(e)}")
        
        logger.info(f"Successfully completed deletion of document: {document_id}")
        return {"detail": "Document and associated resources deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error during document deletion {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete document")


async def choose_one_document(document_id: str, current_user):
    logger.info(f"Fetching single document: {document_id}, User: {current_user.username if hasattr(current_user, 'username') else 'unknown'}")
    
    try:
        # Use a unique id to fetch a document
        document = docs_collection.find_one({"_id": ObjectId(document_id)})
        if document is None:
            logger.warning(f"Document not found: {document_id}")
            raise HTTPException(status_code=404, detail="Document not found")
        
        logger.debug(f"Successfully fetched document: {document_id}, Name: {document.get('name', 'unknown')}")
        return DocumentModel.model_validate(document)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching document {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch document")


async def get_document_presigned_url(
    case_id: str, 
    document_id: str, 
    current_user
):
    logger.info(f"Generating presigned URL - Case: {case_id}, Document: {document_id}, User: {current_user.username if hasattr(current_user, 'username') else 'unknown'}")
    
    # First check if the case exists and user has access
    try:
        case = cases_collection.find_one({"_id": ObjectId(case_id)})
        if case is None:
            logger.error(f"Case not found for presigned URL: {case_id}")
            raise HTTPException(status_code=404, detail="Case not found")
        logger.debug(f"Case found for presigned URL: {case_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching case {case_id} for presigned URL: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to verify case access")
    
    # Find the document
    try:
        document = docs_collection.find_one({
            "_id": ObjectId(document_id),
            "case_id": ObjectId(case_id)
        })
        
        if document is None:
            logger.warning(f"Document not found in case for presigned URL - Document: {document_id}, Case: {case_id}")
            raise HTTPException(status_code=404, detail="Document not found in this case")
        
        logger.debug(f"Document found for presigned URL: {document_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching document {document_id} for presigned URL: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch document")
    
    # Get the S3 key from the document
    s3_key = document.get("s3_key")
    
    if not s3_key:
        logger.warning(f"Document has no S3 key for presigned URL: {document_id}")
        raise HTTPException(status_code=404, detail="Document has no associated file")
    
    try:
        # Generate a presigned URL for the file (valid for 1 hour)
        presigned_url = s3_manager.generate_presigned_url(
            s3_key,
            expiration=3600  # 1 hour in seconds
        )
        
        logger.info(f"Generated presigned URL for document: {document_id}")
        return {"presigned_url": presigned_url}
    
    except Exception as e:
        logger.error(f"Failed to generate presigned URL for {document_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate access URL for document"
        )
    
async def _delete_document_internal(document_id: str, session=None):
    """Internal helper to delete a document and its resources within a transaction."""
    document = docs_collection.find_one({"_id": ObjectId(document_id)}, session=session)
    if not document:
        return

    s3_key = document.get("s3_key")
    
    # Delete associated chunks
    await delete_all_chunks(document_id, session=session)
    
    # Delete the document from the database
    docs_collection.delete_one({"_id": ObjectId(document_id)}, session=session)

    if s3_key:
        try:
            s3_manager.delete_file(s3_key)
        except Exception as e:
            # In a transaction, we log the error but don't want to fail the whole process for an S3 issue
            print(f"WARNING: Failed to delete S3 file {s3_key} during cascading delete: {e}")


async def search_documents_exact(query: str, case_id: str, current_user):
    """
    Perform exact regex search on document content within a specific case.
    Returns documents that match the query.
    """
    logger.info(f"Exact document search - Query: '{query}', Case: {case_id}, User: {current_user.username if hasattr(current_user, 'username') else 'unknown'}")
    
    try:
        # Verify case exists and user has access
        case = cases_collection.find_one({"_id": ObjectId(case_id)})
        if case is None:
            logger.error(f"Case not found for exact search: {case_id}")
            raise HTTPException(status_code=404, detail="Case not found")
        
        logger.debug(f"Case found for exact search: {case_id}")
        
        # Create case-insensitive regex pattern
        regex_pattern = re.compile(re.escape(query), re.IGNORECASE)
        logger.debug(f"Created regex pattern for search: {regex_pattern.pattern}")
        
        # Search documents in the specific case
        matching_docs = []
        cursor = docs_collection.find({
            "case_id": ObjectId(case_id),
            "content": {"$regex": regex_pattern}
        }).sort("name", 1)
        
        doc_count = 0
        for doc in cursor:
            matching_docs.append(DocumentModel.model_validate(doc))
            doc_count += 1
            
        logger.info(f"Exact search found {len(matching_docs)} documents for query: '{query}' in case {case_id}")
        return matching_docs
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in exact document search for '{query}': {str(e)}")
        raise HTTPException(status_code=500, detail="Search failed")


async def search_documents_similar(query: str, case_id: str, current_user, k: int = 20):
    """
    Perform vector similarity search on document chunks within a specific case.
    Returns documents that contain similar content.
    """
    logger.info(f"Similar document search - Query: '{query}', Case: {case_id}, K: {k}, User: {current_user.username if hasattr(current_user, 'username') else 'unknown'}")
    
    try:
        # Verify case exists and user has access
        case = cases_collection.find_one({"_id": ObjectId(case_id)})
        if case is None:
            logger.error(f"Case not found for similar search: {case_id}")
            raise HTTPException(status_code=404, detail="Case not found")
        
        logger.debug(f"Case found for similar search: {case_id}")
        
        # Use existing VectorSearch class
        vector_search = VectorSearch()
        logger.debug(f"Initialized VectorSearch for similarity search")
        
        # Perform vector search on chunks within the case
        similar_chunks = await vector_search.search(
            query=query,
            k=k,
            case_id=case_id
        )
        
        logger.debug(f"Vector search returned {len(similar_chunks) if similar_chunks else 0} chunks")
        
        # Extract unique document IDs from matching chunks
        doc_ids = set()
        for chunk in similar_chunks:
            doc_id = chunk.get("doc_id")
            if doc_id:
                doc_ids.add(ObjectId(doc_id) if isinstance(doc_id, str) else doc_id)
        
        logger.debug(f"Found {len(doc_ids)} unique document IDs from vector search")
        
        # Fetch the actual documents
        matching_docs = []
        if doc_ids:
            cursor = docs_collection.find({
                "_id": {"$in": list(doc_ids)},
                "case_id": ObjectId(case_id)
            }).sort("name", 1)
            
            doc_count = 0
            for doc in cursor:
                matching_docs.append(DocumentModel.model_validate(doc))
                doc_count += 1
        
        logger.info(f"Similar search found {len(matching_docs)} documents for query: '{query}' in case {case_id}")
        return matching_docs
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in similar document search for '{query}': {str(e)}")
        raise HTTPException(status_code=500, detail="Search failed")