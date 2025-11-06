from fastapi import APIRouter, HTTPException, Depends, Query
from app.models.models import Case, CaseCreate, User, DocumentModel
from app.database.connection import docs_collection
from bson import ObjectId
from app.repositories import case_repo
from app.core.auth import get_current_active_user

router = APIRouter()

@router.get("/", response_model=list[Case], response_model_by_alias=False)
async def read_cases(current_user: User = Depends(get_current_active_user)):
    return await case_repo.get_cases(current_user)

@router.post("/", response_model=Case, response_model_by_alias=False, status_code=201)
async def create_case(
    case: CaseCreate, 
    current_user: User = Depends(get_current_active_user)
):
    return await case_repo.create_case(case, current_user)

@router.get("/documents", response_model=list[DocumentModel])
async def read_documents_for_cases(
    case_ids: list[str] = Query(..., description="List of case IDs"),
):
    """
    Fetch all documents uploaded by the current user,
    filtered by a list of case IDs passed as query params.
    """
    # Convert case_ids to ObjectId
    try:
        case_object_ids = [ObjectId(cid) for cid in case_ids]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid case_id format")

    # Query MongoDB
    cursor = docs_collection.find(
        {
            "case_id": {"$in": case_object_ids},
        }
    ).sort("name", 1)

    return [DocumentModel.model_validate(doc) for doc in cursor]


@router.get("/{case_id}", response_model=Case, response_model_by_alias=False)
async def read_case(
    case_id: str, 
    current_user: User = Depends(get_current_active_user)
):
    return await case_repo.choose_one_case(case_id, current_user)

@router.delete("/{case_id}")
async def delete_case(
    case_id: str, 
    current_user: User = Depends(get_current_active_user)
):
    return await case_repo.delete_case(case_id, current_user)

@router.delete("/")
async def delete_all_cases(current_user: User = Depends(get_current_active_user)):
    return await case_repo.delete_all_cases(current_user)


@router.get("/user/{user_id}", response_model=list[Case], response_model_by_alias=False)
async def read_cases_by_user(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve cases for the provided user_id.

    Only the admin or the user themselves may access this endpoint.
    """
    return await case_repo.get_cases_by_user_id(user_id, current_user)