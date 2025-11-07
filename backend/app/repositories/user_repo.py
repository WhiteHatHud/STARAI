from fastapi import HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from typing import List, Optional
from app.models.models import User, UserCreate, UserInDB, Token
from app.database.connection import db, users_collection
from app.core.auth import (
    authenticate_user,
    create_access_token,
    get_password_hash,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from bson import ObjectId
import logging
import hashlib

# Add logger at the top of the file
logger = logging.getLogger(__name__)

# User registration
def create_user(user: UserCreate, is_mass_create: bool = False) -> User:
    # Check if user already exists
    existing_user = users_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    existing_username = users_collection.find_one({"username": user.username})
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)

    user_in_db = UserInDB(
        **user.model_dump(),
        hashed_password=hashed_password,
        disabled=False,
        is_admin=False,
        is_first_login=is_mass_create,
    )
    
    new_user_data = user_in_db.model_dump(by_alias=True, exclude_none=True)
    result = users_collection.insert_one(new_user_data)
    created_user_dict = users_collection.find_one({"_id": result.inserted_id})
    return User(**created_user_dict)

# User login
def login_for_access_token(form_data: OAuth2PasswordRequestForm):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"user_id": str(user.id)},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# Get user by ID
def get_user_by_id(user_id: str):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return User(**user)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user ID format: {str(e)}"
        )
    
def get_all_users() -> List[User]:
    users = []
    for user_doc in users_collection.find():
        users.append(User(**user_doc))
    return users

# Update user
def update_user(user_id: str, user_data: dict):
    try:
        update_payload = user_data.copy()
        if 'password' in update_payload and update_payload['password']:
            update_payload['hashed_password'] = get_password_hash(update_payload.pop('password'))
        
        if 'is_first_login' in update_payload and update_payload.get('is_first_login') is True:
            update_payload['is_first_login'] = False

        # Filter out None values so we don't overwrite fields with null
        update_payload = {k: v for k, v in update_payload.items() if v is not None}
        
        if not update_payload:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update data provided."
            )

        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_payload}
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        updated_user = users_collection.find_one({"_id": ObjectId(user_id)})
        return User(**updated_user)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user ID format or update failed: {str(e)}"
        )


async def delete_user(user_id_to_delete: str, current_admin_id: str):
    """
    Deletes a user and all their associated anomaly detection data.
    """
    from app.repositories import anomaly_repo

    if user_id_to_delete == current_admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot delete their own account."
        )

    try:
        user_obj_id = ObjectId(user_id_to_delete)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format.")

    # Use a client session for a multi-document transaction
    with db.client.start_session() as session:
        with session.start_transaction():
            try:
                # Delete all datasets for this user (cascades to anomalies/reports)
                datasets = db.datasets.find({"user_id": str(user_obj_id)}, session=session)
                for dataset in datasets:
                    dataset_id = str(dataset["_id"])
                    # Delete associated anomalies, reports, and sessions
                    db.anomalies.delete_many({"dataset_id": dataset_id}, session=session)
                    db.anomaly_reports.delete_many({"dataset_id": dataset_id}, session=session)
                    db.analysis_sessions.delete_many({"dataset_id": dataset_id}, session=session)

                # Delete all datasets
                db.datasets.delete_many({"user_id": str(user_obj_id)}, session=session)

                # Finally, delete the user document itself
                result = users_collection.delete_one({"_id": user_obj_id}, session=session)

                if result.deleted_count == 0:
                    raise HTTPException(status_code=404, detail="User not found during transaction, rolling back.")

            except Exception as e:
                # The transaction will be aborted automatically on an exception
                print(f"Transaction aborted: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to delete user and associated data: {e}")

    return {"detail": "User and all associated data deleted successfully"}

def mass_create_users(emails: List[str], template_ids: List[str], current_admin_id: str) -> List[List[str]]:
    """
    Create multiple users from email list.
    Returns a list of lists for CSV response format.

    Note: Template assignment removed (old case study system).
    """
    logger.info(f"Starting mass user creation for {len(emails)} emails")

    user_list = []
    response_list = []

    # Add header row
    response_list.append(["email", "username", "password"])

    # Create users from email list
    for i, email in enumerate(emails):
        try:
            logger.debug(f"Creating user {i+1}/{len(emails)}: {email}")
            username = email.split('@')[0]
            object_id_str = str(ObjectId())
            password_hash = hashlib.sha256(object_id_str.encode()).hexdigest()
            password = password_hash[:8]

            user_create = UserCreate(
                email=email,
                username=username,
                password=password,
            )

            created_user = create_user(user_create, is_mass_create=True)
            response_list.append([email, username, password])
            user_list.append(created_user)

            logger.debug(f"Successfully created user: {email}")

        except HTTPException as e:
            error_msg = f"Failed to create user for {email}: {str(e.detail)}"
            logger.warning(error_msg)
            response_list.append([error_msg])
            continue
        except Exception as e:
            error_msg = f"Unexpected error creating user {email}: {str(e)}"
            logger.error(error_msg)
            response_list.append([error_msg])
            continue

    logger.info(f"User creation completed. Created {len(user_list)} out of {len(emails)} users")

    return response_list

def update_user_password(user_id: str,new_password: str, confirm_password: str):
    """Update a user's password after verifying their current password"""
    logger.info(f"Password update requested for user ID: {user_id}")
    
    try:
        # Get the user to verify current password
        user_doc = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            logger.warning(f"User not found for password update: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if new_password != confirm_password:
            logger.warning(f"New password and confirm password do not match for user: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password and confirm password do not match"
            )
        
        # Hash the new password
        new_hashed_password = get_password_hash(new_password)
        
        # Update the password and clear is_first_login if set.
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"hashed_password": new_hashed_password, "is_first_login": False}}
        )
        
        if result.modified_count == 0:
            logger.error(f"Failed to update password for user: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update password"
            )
        
        logger.info(f"Password updated successfully for user: {user_id}")
        return {"detail": "Password updated successfully"}
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error during password update for user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user ID format or update failed: {str(e)}"
        )

def update_user_username(user_id: str, new_username: str):
    """Update a user's username after checking it's not already taken"""
    logger.info(f"Username update requested for user ID: {user_id}, new username: {new_username}")
    
    try:
        # Check if the new username is already taken by another user
        existing_username = users_collection.find_one({
            "username": new_username,
            "_id": {"$ne": ObjectId(user_id)}  # Exclude current user
        })
        
        if existing_username:
            logger.warning(f"Username already taken: {new_username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        
        # Check if user exists
        user_doc = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            logger.warning(f"User not found for username update: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update the username and clear is_first_login if set.
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"username": new_username, "is_first_login": False}}
        )
        
        if result.modified_count == 0:
            logger.error(f"Failed to update username for user: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update username"
            )
        
        # Get and return the updated user
        updated_user = users_collection.find_one({"_id": ObjectId(user_id)})
        logger.info(f"Username updated successfully for user: {user_id}")
        return User(**updated_user)
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error during username update for user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user ID format or update failed: {str(e)}"
        )
