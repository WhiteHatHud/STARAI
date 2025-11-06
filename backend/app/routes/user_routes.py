from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from typing import List
from app.models.models import User, UserCreate, Token, AdminUserUpdate, PasswordUpdate, UsernameUpdate
from app.repositories import user_repo
from app.core.auth import get_current_active_user, get_current_admin_user
import json
import csv
import io
import logging

# Add logger
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate):
    """Register a new user"""
    return user_repo.create_user(user)

@router.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login and get access token"""
    return user_repo.login_for_access_token(form_data)

@router.get("/users/me", response_model=User)
def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user profile"""
    return current_user

@router.put("/users/me", response_model=User)
def update_user_profile(
    user_data: AdminUserUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """Update current user profile. A user cannot make themselves an admin."""
    user_id = str(current_user.id)
    update_dict = user_data.model_dump(exclude_unset=True)
    if 'is_admin' in update_dict:
        del update_dict['is_admin']
        
    return user_repo.update_user(user_id, update_dict)

@router.get("/validate-token")
async def validate_token(current_user = Depends(get_current_active_user)):
    """Endpoint to validate if a token is still valid"""
    return {"detail": "Token is valid", "user_id": str(current_user.id)}

admin_router = APIRouter(prefix="/admin", tags=["Admin"])

@router.put("/users/update-password")
def update_user_password(
    password_update: PasswordUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """Allow users to update their own password"""
    return user_repo.update_user_password(
        user_id=str(current_user.id),
        new_password=password_update.new_password,
        confirm_password=password_update.confirm_password
    )

@router.put("/users/update-username")
def update_user_username(
    username_update: UsernameUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """Allow users to update their own username"""
    return user_repo.update_user_username(
        user_id=str(current_user.id),
        new_username=username_update.new_username
    )

@admin_router.get("/users", response_model=List[User], dependencies=[Depends(get_current_admin_user)])
def get_all_users_as_admin():
    """
    Get a list of all users. (Admin only)
    """
    return user_repo.get_all_users()

@admin_router.post("/users/mass-create", dependencies=[Depends(get_current_admin_user)])
async def mass_create_users(
    csv_file: UploadFile = File(...), 
    template_ids: str = Form(None),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Create multiple users at once from CSV file with optional template assignment. (Admin only)
    Expected CSV format:
    email
    xxx@xxx.com
    xxx@xxx.com
    
    template_ids: JSON string array of template IDs to assign to all created users
    """
    admin_id = str(current_user.id)
    admin_username = current_user.username
    
    logger.info(f"Mass create users initiated by admin: {admin_username} (ID: {admin_id})")
    logger.info(f"Uploaded file: {csv_file.filename}, size: {csv_file.size} bytes")
    
    if not csv_file.filename.endswith('.csv'):
        logger.warning(f"Invalid file type uploaded by admin {admin_username}: {csv_file.filename}")
        raise HTTPException(status_code=400, detail="File must be a CSV file")
    
    # Parse template_ids if provided
    selected_templates = []
    if template_ids:
        try:
            import json
            selected_templates = json.loads(template_ids)
            logger.info(f"Template IDs to assign: {selected_templates}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid template_ids JSON format: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid template_ids format")
    
    try:
        content = await csv_file.read()
        csv_content = content.decode('utf-8')
        csv_reader = csv.reader(io.StringIO(csv_content))
        
        emails = []
        current_section = None
        row_count = 0
        
        for row in csv_reader:
            row_count += 1
            if not row or not row[0].strip():
                continue
                
            value = row[0].strip()
            
            if value == "email":
                current_section = "email"
                logger.debug(f"Found email section at row {row_count}")
            elif current_section == "email":
                emails.append(value)
        
        logger.info(f"Parsed CSV - Emails: {len(emails)}")
        logger.debug(f"Email list: {emails[:5]}..." if len(emails) > 5 else f"Email list: {emails}")
        
        if not emails:
            logger.warning(f"No emails found in CSV by admin {admin_username}")
            raise HTTPException(status_code=400, detail="No valid emails found in CSV file")
        
        # Call repository function with template IDs
        logger.info(f"Starting mass user creation for {len(emails)} users with {len(selected_templates)} templates")
        response_list = user_repo.mass_create_users(emails, selected_templates, current_user.id)
        logger.info(f"Mass user creation completed. Response contains {len(response_list)} rows")
        
        # Generate CSV response
        output = io.StringIO()
        writer = csv.writer(output)
        
        for row in response_list:
            writer.writerow(row)
        
        output.seek(0)
        
        def iter_csv():
            yield output.getvalue()
        
        logger.info(f"Mass create operation completed successfully by admin {admin_username}")
        
        return StreamingResponse(
            iter_csv(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=mass_create_results.csv"}
        )
        
    except UnicodeDecodeError as e:
        logger.error(f"CSV encoding error for admin {admin_username}: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid CSV file encoding")
    except HTTPException:
        # Re-raise HTTP exceptions without logging (already logged above)
        raise
    except Exception as e:
        logger.error(f"Unexpected error during mass create by admin {admin_username}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {str(e)}")

@admin_router.put("/users/{user_id}", response_model=User, dependencies=[Depends(get_current_admin_user)])
def update_user_as_admin(user_id: str, user_data: AdminUserUpdate):
    """
    Update a user's details, including password and status. (Admin only)
    """
    update_dict = user_data.model_dump(exclude_unset=True)
    return user_repo.update_user(user_id, update_dict)

@admin_router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user_as_admin(user_id: str, current_user: User = Depends(get_current_admin_user)):
    """
    Delete a user account. (Admin only)
    """
    current_admin_id = str(current_user.id)
    return await user_repo.delete_user(user_id, current_admin_id)