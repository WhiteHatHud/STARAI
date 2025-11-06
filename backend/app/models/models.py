# app/models/models.py

from pydantic import BaseModel, EmailStr, Field
from pydantic_core import core_schema
from bson import ObjectId
from typing import Any, Optional, List
from datetime import datetime

# --- Pydantic v2 Compliant PyObjectId ---
class PyObjectId(str):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, _source_type: Any, _handler: Any
    ) -> core_schema.CoreSchema:
        """
        Defines the Pydantic core schema for ObjectId.
        This method is essential for Pydantic v2 compatibility.
        It specifies how to:
        1. Validate the data (from_str_schema).
        2. Serialize the data (to_string_ser_schema).
        3. Generate the JSON schema (a string).
        """
        # Validator: Check if the input is a valid ObjectId
        def validate_from_str(value: str) -> ObjectId:
            if not ObjectId.is_valid(value):
                raise ValueError("Invalid ObjectId")
            return ObjectId(value)

        from_str_schema = core_schema.chain_schema(
            [
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(validate_from_str),
            ]
        )

        return core_schema.json_or_python_schema(
            json_schema=from_str_schema,
            python_schema=core_schema.union_schema(
                [
                    # Check if it's already a valid ObjectId
                    core_schema.is_instance_schema(ObjectId),
                    # Otherwise, try to validate it from a string
                    from_str_schema,
                ]
            ),
            # How to serialize the ObjectId back to a string
            serialization=core_schema.to_string_ser_schema(),
        )

# ------------------------------------------------------User-related models------------------------------------------------------
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class User(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    email: EmailStr
    username: str
    disabled: bool = False
    is_admin: bool = False
    is_first_login: bool = False

    model_config = {
        "populate_by_name": True,
        "validate_assignment": True,
        "arbitrary_types_allowed": True,
        "json_schema_extra": {
            "example": {
                "id": "60d725b4e24b5400f7d5e7c8",
                "email": "user@example.com",
                "username": "username",
                "disabled": False,
                "is_admin": False,
                "is_first_login": False
            }
        },
    }

class PasswordUpdate(BaseModel):
    new_password: str
    confirm_password: str

class UsernameUpdate(BaseModel):
    new_username: str

class UserInDB(User):
    hashed_password: str

class AdminUserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    disabled: Optional[bool] = None
    is_admin: Optional[bool] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: PyObjectId


# ------------------------------------------------------Case/Document-related models------------------------------------------------------
# Case model
class Case(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: PyObjectId
    name: str

    model_config = {
        "populate_by_name": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        },
        "json_schema_extra": {
            "example": {
                "id": "60d725b4e24b5400f7d5e7c8",
                "user_id": "user123",
                "name": "Case Name"
            }
        }
    }

class CaseCreate(BaseModel):
    name: str

# Document model - need to change when using agentic chunking
class ChunkModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    doc_id: PyObjectId
    index: int
    embedding: Optional[List[float]] = None
    content: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        }
    }

class DocumentModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    case_id: PyObjectId
    name: str
    content: str
    content_type: Optional[str] = None
    s3_key: str # need this for generating presigned url
    # Optional timestamps - older documents may not have these fields which is why
    # they are optional. Stored as ISO8601 strings for easy parsing on frontend.
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        },
        "json_schema_extra": {
            "example": {
                "id": "60d725b4e24b5400f7d5e7c8",
                "case_id": "case123",
                "name": "Document Name",
                "content": "Document content...",
                "content_type": "application/pdf",
                "s3_key": "documents/file.pdf"
                ,
                "created_at": "2025-01-01T00:00:00Z",
                "updated_at": "2025-01-01T00:00:00Z"
            }
        }
    }