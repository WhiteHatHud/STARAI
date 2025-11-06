from app.models.presentation_models import *
from app.database.connection import slides_collection
from app.models.models import User
from bson import ObjectId
from fastapi import HTTPException

def create_presentation_for_user(presentation: dict, user_id: str) -> str:
    if hasattr(presentation, "model_dump"):
        doc = presentation.model_dump()
    elif hasattr(presentation, "dict"):
        doc = presentation.dict()
    elif isinstance(presentation, dict):
        doc = presentation.copy()
    else:
        raise ValueError("presentation must be a PresentationModel or dict")

    doc.pop("_id", None)
    doc.setdefault("created_at", datetime.now(timezone.utc))
    doc.setdefault("updated_at", datetime.now(timezone.utc))
    doc["user_id"] = user_id

    result = slides_collection.insert_one(doc)
    return str(result.inserted_id)

def get_presentations(user_id: str) -> List[dict]:
    presentations = []
    cursor = slides_collection.find(
        {"user_id": user_id},
        {"_id": 1, "content": 1, "updated_at": 1}
    ).sort("updated_at", -1)
    
    for doc in cursor:
        presentations.append({
            "id": str(doc["_id"]),
            "content": doc.get("content", ""),
            "updated_at": doc.get("updated_at")
        })
    return presentations

def get_presentation(presentation_id: str) -> PresentationModel:
    presentation_data = slides_collection.find_one({"_id": ObjectId(presentation_id)})
    if not presentation_data:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return PresentationModel(**presentation_data)

def update_presentation(presentation_id: str, updates: dict) -> bool:
    """
    Update a presentation document with the given updates dict.
    Returns True if update was successful, False if presentation not found.
    """
    # Ensure presentation exists
    presentation_data = slides_collection.find_one({"_id": ObjectId(presentation_id)})
    if not presentation_data:
        return False

    # Validate that keys in updates are valid PresentationModel fields
    allowed_fields = set(PresentationModel.model_fields.keys())
    invalid_fields = set(updates.keys()) - allowed_fields
    if invalid_fields:
        # Reject unknown fields explicitly so callers know they sent bad input
        raise HTTPException(status_code=400, detail={
            "error": "Invalid fields in update",
            "invalid_fields": list(invalid_fields),
        })

    # Merge the existing document with updates and validate using Pydantic
    merged = {**presentation_data, **updates}
    try:
        # This will raise a pydantic.ValidationError on type/format problems
        PresentationModel(**merged)
    except Exception as e:
        # Surface validation error details to the client
        raise HTTPException(status_code=400, detail=str(e))

    # Perform the update and set updated_at
    result = slides_collection.update_one(
        {"_id": ObjectId(presentation_id)},
        {"$set": {**updates, "updated_at": datetime.now(timezone.utc)}}
    )
    return result.matched_count > 0