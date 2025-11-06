# repositories/case_repo.py

from app.database.connection import cases_collection, docs_collection
from app.models.models import Case, CaseCreate, User
from bson import ObjectId
from fastapi import HTTPException
from app.repositories import document_repo

async def get_cases(current_user):
    cases = []
    # Filter cases by user_id to only show cases owned by the current user
    user_filter = {"user_id": ObjectId(current_user.id)}
    
    cursor = cases_collection.find(user_filter).sort("name", 1)
    for case_doc in cursor:
        # Let Pydantic handle the _id to id conversion
        cases.append(Case.model_validate(case_doc))
    
    if len(cases) == 0:
        raise HTTPException(status_code=204, detail="No cases found. Create a new case first.")
    return cases


async def create_case(case_create: CaseCreate, current_user: User):
    try:
        new_case = {
            "name": case_create.name,
            "user_id": ObjectId(current_user.id)  # Associate case with current user
        }
        result = cases_collection.insert_one(new_case)
        
        # Retrieve the inserted document
        created_case = cases_collection.find_one({"_id": result.inserted_id})
        # Let Pydantic handle the _id to id conversion
        return Case.model_validate(created_case)
    except Exception as e:
        raise HTTPException(status_code=409, detail=f"Duplicate case name! {str(e)}")


async def choose_one_case(case_id: str, current_user):
    try:
        # Filter by both case ID and user_id for security
        case = cases_collection.find_one({
            "_id": ObjectId(case_id),
            "user_id": ObjectId(current_user.id)  
        })
        
        if case is None:
            raise HTTPException(status_code=404, detail="Case not found or not accessible")
        
        # Let Pydantic handle the _id to id conversion
        return Case.model_validate(case)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid case ID format: {str(e)}")


async def delete_case(case_id: str, current_user, session=None):
    # This public-facing function now accepts an optional session
    try:
        # We need the full user object for delete_document
        await _delete_case_internal(case_id, current_user.id, session=session)
        return {"detail": "Case and its documents deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid case ID format or deletion failed: {str(e)}")


async def _delete_case_internal(case_id: str, user_id: ObjectId, session=None):
    """Internal helper to delete a case and its contents."""
    case_doc = cases_collection.find_one({"_id": ObjectId(case_id), "user_id": user_id}, session=session)
    if not case_doc:
        # In a transaction, it's better to just log and continue than raise HTTP error
        print(f"Case {case_id} not found for user {user_id}. Skipping.")
        return
    
    # Find and delete all documents and their chunks within this case
    doc_ids_to_delete = [doc['_id'] for doc in docs_collection.find({"case_id": ObjectId(case_id)}, {"_id": 1}, session=session)]
    for doc_id in doc_ids_to_delete:
        await document_repo._delete_document_internal(str(doc_id), session=session)

    # Now, delete the case itself
    cases_collection.delete_one({"_id": ObjectId(case_id)}, session=session)


async def _delete_all_user_data(user_id: ObjectId, session=None):
    """Internal function to delete all cases and their nested content for a user."""
    # Find all cases belonging to the user
    cases_to_delete_cursor = cases_collection.find({"user_id": user_id}, {"_id": 1}, session=session)
    case_ids = [case["_id"] for case in cases_to_delete_cursor]

    # Use the internal helper to delete each case
    for case_id in case_ids:
        await _delete_case_internal(str(case_id), user_id, session=session)


async def get_cases_by_user_id(user_id: str, current_user: User):
    """Return cases belonging to a given user_id.

    Permission: only allow if the current_user is an admin or is the same
    user as the requested user_id.
    """
    # Permission check
    try:
        # current_user.id may be an ObjectId or a string-compatible value
        is_self = str(current_user.id) == str(user_id)
        if not (current_user.is_admin or is_self):
            raise HTTPException(status_code=403, detail="Not authorized to view these cases")

        oid = ObjectId(user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid user_id format: {str(e)}")

    cases = []
    cursor = cases_collection.find({"user_id": oid}).sort("name", 1)
    for case_doc in cursor:
        cases.append(Case.model_validate(case_doc))

    return cases