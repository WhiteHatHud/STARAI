from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.models import ChunkModel,User
from app.repositories.chunk_repo import (
    create_chunks,
    delete_all_chunks
)
from app.core.auth import get_current_user

router = APIRouter()

@router.post("/chunks")
async def add_chunks(doc_id: str, content:str, current_user: User = Depends(get_current_user)):
    """API endpoint to create new chunks."""
    return await create_chunks(doc_id, content, current_user)
@router.delete("/chunks")
async def remove_all_chunks(doc_id: str, current_user: User = Depends(get_current_user)):
    """API endpoint to delete all chunks."""
    return await delete_all_chunks(doc_id)