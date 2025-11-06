"""Progress tracking utilities for case study generation"""

from app.models.report_models import ReportProgressUpdate
from app.database.connection import db
from typing import Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def get_progress_collection():
    """Get MongoDB collection for progress tracking"""
    return db.get_collection("report_progress")

def convert_objectid_to_str(obj):
    """Recursively convert ObjectId instances to strings in a dictionary or list"""
    from bson import ObjectId
    
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {key: convert_objectid_to_str(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectid_to_str(item) for item in obj]
    else:
        return obj

def store_progress(progress_id: str, progress_data, user_id: Optional[str] = None, raise_on_fail: bool = False):
    """Store progress in MongoDB with optional user tracking."""
    collection = get_progress_collection()
    try:
        progress_dict = (
            progress_data.model_dump() if hasattr(progress_data, 'model_dump')
            else progress_data.dict()
        )
        # Convert any ObjectIds to strings
        progress_dict = convert_objectid_to_str(progress_dict)
        
        if user_id:
            progress_dict["user_id"] = user_id
        collection.replace_one(
            {"progress_id": progress_id},
            {**progress_dict, "progress_id": progress_id, "updated_at": datetime.utcnow()},
            upsert=True
        )
        return True
    except Exception as e:
        logger.error(f"Failed to store progress {progress_id}: {str(e)}")
        if raise_on_fail:
            raise
        return False

def get_progress(progress_id: str):
    """Get progress from MongoDB"""
    try:
        collection = get_progress_collection()
        doc = collection.find_one({"progress_id": progress_id})
        if doc:
            doc.pop('_id', None)  # Remove MongoDB _id
            # Convert any remaining ObjectIds to strings
            doc = convert_objectid_to_str(doc)
            return ReportProgressUpdate(**doc)
        return None
    except Exception as e:
        logger.error(f"Failed to get progress {progress_id}: {str(e)}")
        return None

def update_progress_field(progress_id: str, **updates):
    """Update specific progress fields in MongoDB"""
    try:
        collection = get_progress_collection()
        # Convert any ObjectIds in updates to strings
        updates = convert_objectid_to_str(updates)
        collection.update_one(
            {"progress_id": progress_id},
            {"$set": {**updates, "updated_at": datetime.now()}}
        )
    except Exception as e:
        logger.error(f"Failed to update progress {progress_id}: {str(e)}")
        
def get_progress_by_case_id(case_id: str):
    """Get full progress from MongoDB by case_id, excluding completed status"""
    try:
        collection = get_progress_collection()
        doc = collection.find_one({
            "report_id": case_id,
            "status": {"$ne": "completed"}  # exclude completed
        })
        if doc:
            doc.pop('_id', None)  # Remove MongoDB _id
            return ReportProgressUpdate(**doc)
        return None
    except Exception as e:
        logger.error(f"Failed to get progress by case_id {case_id}: {str(e)}")
        return None