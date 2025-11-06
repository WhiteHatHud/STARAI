from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, Request
from app.models.models import User
from app.core.auth import get_current_active_user
from app.repositories.report_template_repo import template_repository
from app.tasks.template_tasks import process_custom_format_task
from app.utils.progress_utils import store_progress, get_progress
from app.models.report_models import ReportProgressUpdate
from uuid import uuid4
import logging

# Set up logger
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/custom-format")
async def generate_custom_format(
    request: Request,
    template: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """API endpoint to generate custom format content using a template file and selected documents."""
    
    # Extract supporting documents and processing method from form data
    form = await request.form()
    supporting_documents = []
    processing_method = "pandoc"  # Default value
    
    # Look for files with pattern "document_0", "document_1", etc. and extract processing_method
    for key, value in form.items():
        if key.startswith("document_") and hasattr(value, 'filename'):
            supporting_documents.append(value)
        elif key == "processing_method":
            processing_method = value
    
    logger.info(f"Found {len(supporting_documents)} supporting documents")
    logger.info(f"Processing method: {processing_method}")
    
    # Validate template file
    if not template.filename:
        raise HTTPException(status_code=400, detail="No template file provided")
    
    # Validate file types and sizes
    await _validate_files([template] + supporting_documents)
    
    # Generate progress ID
    progress_id = str(uuid4())
    report_id = str(uuid4())
    
    # Initialize progress tracking
    progress_data = ReportProgressUpdate(
        progress_id=progress_id,
        status="initializing",
        progress=0,
        message="Starting custom format generation...",
        report_id=report_id,
        error=None,
        study_type=None
    )
    store_progress(progress_id, progress_data, user_id=str(current_user.id))
    
    # Read file contents
    template_content = await template.read()
    supporting_docs_content = []
    
    for doc in supporting_documents:
        doc_content = await doc.read()
        supporting_docs_content.append({
            'filename': doc.filename,
            'content': doc_content,
        })
    
    # Prepare data for Celery task
    task_data = {
        'template': {
            'filename': template.filename,
            'content': template_content,
            },
        'supporting_documents': supporting_docs_content,
        'processing_method': processing_method,
        'user_id': str(current_user.id),
        'username': current_user.username,
        'progress_id': progress_id
    }
    
    # Start Celery task
    process_custom_format_task.delay(task_data)
    
    return {
        "progress_id": progress_id,
        "message": "Custom format generation started",
        "supporting_documents_count": len(supporting_documents)
    }

@router.get("/custom-format/progress/{progress_id}")
async def check_custom_format_progress(
    progress_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Check the progress of a custom format generation task"""
    try:
        progress_data = get_progress(progress_id)
        if not progress_data:
            raise HTTPException(status_code=404, detail="Progress ID not found")
        
        # Convert Pydantic model to dict with proper datetime serialization
        if hasattr(progress_data, 'model_dump'):
            return progress_data.model_dump(mode='json')
        elif hasattr(progress_data, 'dict'):
            return progress_data.dict()
        else:
            return progress_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Progress check error for {progress_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error checking progress")

async def _validate_files(files):
    """Validate file types and sizes"""
    allowed_types = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
        'text/markdown',
        'text/html',
        'application/json',
        'application/pdf'
    ]
    
    allowed_extensions = ('.md', '.txt', '.docx', '.doc', '.html', '.json', '.pdf')
    
    for i, file in enumerate(files):
        # Check file type
        if file.content_type not in allowed_types and not file.filename.endswith(allowed_extensions):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type for {file.filename}. Supported formats: .docx, .doc, .txt, .md, .html, .json, .pdf"
            )
        
        # Check file size (10MB limit)
        file_content = await file.read()
        await file.seek(0)  # Reset file pointer
        
        if len(file_content) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(
                status_code=400, 
                detail=f"File {file.filename} too large. Maximum size is 10MB"
            )

# Keep existing routes for templates management
@router.get("/templates")
async def list_templates(current_user: User = Depends(get_current_active_user)):
    """API endpoint to list all templates for the current user with metadata."""
    try:
        templates = template_repository.list_user_templates(current_user.id)
        logger.info(f"Listed {len(templates)} templates for user {current_user.id}")
        return {"templates": templates, "total_count": len(templates)}
    except Exception as e:
        logger.error(f"Error listing templates for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing templates: {str(e)}")

@router.get("/templates/public")
async def list_public_templates(current_user: User = Depends(get_current_active_user)):
    """API endpoint to list all public templates with cached metadata."""
    try:
        data = template_repository.get_public_templates_dict()
        logger.info(f"Listed {len(data['public_templates'])} public templates")
        return {
            "templates": data['public_templates'],
            "total_count": len(data['public_templates'])
        }
        
    except Exception as e:
        logger.error(f"Error listing public templates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing public templates: {str(e)}")

@router.get("/templates/{template_name}")
async def get_template(template_name: str, current_user: User = Depends(get_current_active_user)):
    """API endpoint to get a specific template with its content and metadata."""
    try:
        template_data = template_repository.get_template_by_name(current_user.id, template_name)
        logger.info(f"Retrieved template {template_name} for user {current_user.id}")
        return template_data
    except Exception as e:
        logger.error(f"Error getting template {template_name} for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=404, detail=f"Template not found: {template_name}")

@router.put("/templates/{template_name}")
async def update_template(template_name: str, request: Request, current_user: User = Depends(get_current_active_user)):
    """API endpoint to update a specific template."""
    try:
        body = await request.json()
        updated_template = body.get("updated_template")
        
        if not updated_template:
            raise HTTPException(status_code=400, detail="updated_template is required in request body")

        success = template_repository.update_template(
            user_id=current_user.id, 
            username=current_user.username, 
            template_name=template_name, 
            updated_content=updated_template
        )
        
        if success:
            logger.info(f"Updated template {template_name} for user {current_user.id}")
            return {"message": f"Template {template_name} updated successfully"}
        else:
            raise HTTPException(status_code=404, detail=f"Template not found: {template_name}")

    except Exception as e:
        logger.error(f"Error updating template {template_name} for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating template: {str(e)}")

@router.delete("/templates/{template_name}")
async def delete_template(template_name: str, current_user: User = Depends(get_current_active_user)):
    """API endpoint to delete a specific template."""
    try:
        success = template_repository.delete_template(current_user.id, template_name)
        
        if success:
            logger.info(f"Deleted template {template_name} for user {current_user.id}")
            return {"message": f"Template {template_name} deleted successfully"}
        else:
            logger.warning(f"Template {template_name} not found for user {current_user.id}")
            raise HTTPException(status_code=404, detail=f"Template not found: {template_name}")
        
    except Exception as e:
        logger.error(f"Error deleting template {template_name} for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=404, detail=f"Template not found: {template_name}")

@router.post("/templates/{template_name}/share")
async def share_template(template_name: str, current_user: User = Depends(get_current_active_user)):
    """API endpoint to generate a shareable code for a template."""
    try:
        share_code = template_repository.share_template(current_user.id, template_name)
        
        logger.info(f"Generated share code for template {template_name} by user {current_user.id}")
        return {
            "message": "Template shared successfully",
            "share_code": share_code,
            "expires_in_days": 7
        }
        
    except Exception as e:
        logger.error(f"Error sharing template {template_name} for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sharing template: {str(e)}")

@router.post("/templates/import/{share_code}")
async def import_shared_template(share_code: str, current_user: User = Depends(get_current_active_user)):
    """API endpoint to import a template using a share code."""
    try:
        result = template_repository.get_share_template(current_user.id, current_user.username, share_code)
        
        if result.get("result") == "Template has expired":
            raise HTTPException(status_code=410, detail="Template share code has expired")
        elif result.get("result") == "Failed to retrieve shared template":
            raise HTTPException(status_code=404, detail="Invalid share code or template not found")
        elif result.get("result") == "Template has been deleted":
            raise HTTPException(status_code=410, detail="Template has been deleted")
        elif result.get("result") == "Template imported successfully":
            logger.info(f"Template imported successfully for user {current_user.id} with share code {share_code}")
            return {
                "message": "Template imported successfully",
                "template_name": result.get("template_name"),
                "template_key": result.get("template_key")
            }
        else:
            raise HTTPException(status_code=500, detail="Unexpected error occurred")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing template with share code {share_code} for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error importing template: {str(e)}")

@router.post("/templates/{template_name}/toggle-public")
async def toggle_template_public(template_name: str, current_user: User = Depends(get_current_active_user)):
    """API endpoint to toggle a template's public visibility."""
    try:
        is_now_public = template_repository.toggle_public(current_user.id, template_name)
        
        status = "public" if is_now_public else "private"
        logger.info(f"Template {template_name} is now {status} for user {current_user.id}")
        
        return {
            "message": f"Template is now {status}",
            "template_name": template_name,
            "is_public": is_now_public
        }
        
    except Exception as e:
        logger.error(f"Error toggling public status for template {template_name} by user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error toggling template visibility: {str(e)}")

@router.get("/templates/public/{template_identifier}/content")
async def get_public_template_content(template_identifier: str, current_user: User = Depends(get_current_active_user)):
    """API endpoint to get the full content of a public template."""
    try:
        template_data = template_repository.get_public_template_content(template_identifier)
        
        logger.info(f"Retrieved public template content for {template_identifier} by user {current_user.id}")
        return template_data
        
    except Exception as e:
        logger.error(f"Error getting public template content for {template_identifier}: {str(e)}")
        raise HTTPException(status_code=404, detail=f"Public template not found: {template_identifier}")

@router.get("/admin/templates/existing-users")
async def list_templates_for_existing_users_admin(current_user: User = Depends(get_current_active_user)):
    """Admin endpoint to list templates only for users that exist in the current database."""
    
    # Check admin privileges
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get templates only for existing database users
        filtered_templates = template_repository.list_templates_for_existing_users()
        logger.info(f"Admin {current_user.id} fetched {len(filtered_templates)} templates from existing users")
        return {"templates": filtered_templates, "total_count": len(filtered_templates)}
        
    except Exception as e:
        logger.error(f"Error listing templates for existing users for admin {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing templates for existing users: {str(e)}")