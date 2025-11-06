from app.database.connection import docs_collection, chunks_collection
from fastapi import HTTPException
from app.utils.chunking import semantic_embed
import logging
from bson import ObjectId

logger = logging.getLogger(__name__)

#-----------------------CHUNK REPO--------------------------------

async def create_chunks(doc_id: str, content: str, current_user):
    """
    Create chunks from the document content and store them in the database.
    """
    # Ensure document hasn't been chunked before
    existing_doc = docs_collection.find_one({"_id": ObjectId(doc_id)})
    if not existing_doc:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")

    # Check if chunks already exist for this document
    existing_chunks = chunks_collection.find_one({"doc_id": ObjectId(doc_id)})
    if existing_chunks:
        logger.warning(f"Chunks already exist for document {doc_id}")
        # Return the IDs of existing chunks (up to 5)
        return [chunk["_id"] for chunk in chunks_collection.find({"doc_id": ObjectId(doc_id)}).limit(5)]

    try:
        # Split the content into chunks
        logger.info(f"Creating embeddings for semantic chunks for document {doc_id}")
        chunks = await semantic_embed(content)
        
        # Make sure each chunk has the doc_id and a unique index
        chunk_objects = []
        for i, chunk in enumerate(chunks):
            # Create proper chunk object
            chunk_obj = {
                "doc_id": ObjectId(doc_id),
                "index": i,
                "content": chunk["content"] if "content" in chunk else "",
                "embedding": chunk["embedding"] if "embedding" in chunk else []
            }
            chunk_objects.append(chunk_obj)
            
        if not chunk_objects:
            logger.warning(f"No chunks were generated for document {doc_id}")
            return []

        # Insert all chunks in a single DB operation
        result = chunks_collection.insert_many(chunk_objects)
        logger.info(f"Inserted {len(result.inserted_ids)} chunks for document {doc_id}")
        return result.inserted_ids[:5]  # Return first 5 IDs
    except Exception as e:
        logger.error(f"Error inserting chunks for document {doc_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error inserting chunks")

async def delete_all_chunks(doc_id: str, session=None):
    """
    Delete all chunks associated with a specific document ID.
    """
    logger.info(f"Deleting all chunks for document {doc_id}")
    result = chunks_collection.delete_many({"doc_id": ObjectId(doc_id)}, session=session)
    print(f"Deleted {result.deleted_count} chunks for document {doc_id}")
    return {"detail": f"{result.deleted_count} chunks deleted, see collection for changes"}
