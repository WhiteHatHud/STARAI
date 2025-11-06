# app/utils/vector_search.py
import os
from bson import ObjectId
from app.database.connection import chunks_collection, docs_collection
from app.utils.chunking import embed_sentence_sagemaker
import logging

logger = logging.getLogger(__name__)

class VectorSearch:
    def __init__(self, collection=chunks_collection):
        self.ENV = os.getenv("APP_ENV", "development")
        self.collection = collection
        
    async def search(self, query, k, case_id=None, document_ids=None, query_vector=None):
        """
        Search for similar document chunks using vector search
        
        Args:
            query: The search query text
            k: Number of results to return
            case_id: Optional case ID to filter documents
            document_ids: Optional list of specific document IDs to search within
            query_vector: Optional pre-computed vector embedding
        """
        # logger.info(f"Performing vector search for query: {query[:50]}...")
        
        # Get vector embedding for the query if not provided
        if query_vector is None:
            # logger.info("Generating embedding for query")
            query_vector = await embed_sentence_sagemaker(query)
        else:
            logger.info("Using pre-computed query vector")
            
        if not query_vector:
            logger.error("Failed to generate embedding for query")
            return []
        
        # Initialize pipeline with vector search as FIRST stage
        pipeline = []
        
        if self.ENV == "production":
            pipeline.append({
                "$search": {
                    "vectorSearch": {
                        "vector": query_vector,
                        "path": "embedding",
                        "k": k * 10,
                        "similarity": "cosine",
                    }
                }
            })
        else:
            pipeline.append({
                "$vectorSearch": {
                    "index": "my_vss_index",
                    "queryVector": query_vector,
                    "path": "embedding",
                    "numCandidates": k * 20,  
                    "limit": k * 10
                }
            })
        
        # Document filtering logic - AFTER vector search
        normalized_doc_ids = []
        
        # Prepare document IDs for filtering if needed
        if document_ids and len(document_ids) > 0:
            logger.info(f"Filtering by {len(document_ids)} specific document IDs")
            
            # Normalize document IDs
            for doc_id in document_ids:
                normalized_doc_ids.append(doc_id)  # Original format
                if isinstance(doc_id, str):
                    # If it's a valid ObjectId string, add the ObjectId version too
                    if len(doc_id) == 24:
                        try:
                            normalized_doc_ids.append(ObjectId(doc_id))
                        except:
                            pass
                else:
                    # If it's an ObjectId, add the string version too
                    normalized_doc_ids.append(str(doc_id))
                    
            # Add document filter AFTER vector search
            pipeline.append({
                "$match": {
                    "doc_id": {"$in": normalized_doc_ids}
                }
            })
            
        # If no specific documents provided but case_id is, filter by all documents in the case
        elif case_id:
            logger.info(f"Filtering by all documents in case: {case_id}")
            try:
                # Get all document IDs for this case
                case_id_obj = case_id
                if isinstance(case_id, str) and len(case_id) == 24:
                    try:
                        case_id_obj = ObjectId(case_id)
                    except:
                        pass
                
                doc_filter = {"case_id": case_id_obj}
                docs = docs_collection.find(doc_filter, {"_id": 1})
                
                # Extract document IDs (both formats)
                case_doc_ids = []
                for doc in docs:
                    doc_id = doc["_id"]
                    case_doc_ids.append(doc_id)
                    case_doc_ids.append(str(doc_id))
                
                if case_doc_ids:
                    # Filter chunks by these document IDs AFTER vector search
                    pipeline.append({
                        "$match": {
                            "doc_id": {"$in": case_doc_ids}
                        }
                    })
                else:
                    logger.warning(f"No documents found for case_id {case_id}")
                    return []  # No documents, so no results
                    
            except Exception as e:
                logger.error(f"Error filtering by case_id: {str(e)}")
                return []
        
        # Add limit stage at the end if we're filtering (to get exactly k results)
        pipeline.append({"$limit": k})
        
        # Execute aggregation
        try:
            results = list(self.collection.aggregate(pipeline))
            doc_ids = set(str(result.get("doc_id", "")) for result in results)
            doc_names = {}
            
            for doc_id in doc_ids:
                if not doc_id:
                    continue
                    
                try:
                    # Try both ObjectId and string formats
                    doc = None
                    if len(doc_id) == 24:
                        doc = docs_collection.find_one({"_id": ObjectId(doc_id)})
                    
                    if not doc:
                        doc = docs_collection.find_one({"_id": doc_id})
                        
                    if doc:
                        doc_names[doc_id] = doc.get("name", "Unknown Document")
                    else:
                        doc_names[doc_id] = "Unknown Document"
                except Exception as e:
                    logger.error(f"Error looking up document {doc_id}: {str(e)}")
                    doc_names[doc_id] = "Unknown Document"
            
            # Add document names to results
            for result in results:
                doc_id = str(result.get("doc_id", ""))
                result["document_name"] = doc_names.get(doc_id, "Unknown Document")
                
            return results
            
        except Exception as e:
            logger.error(f"Error performing vector search: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return []
