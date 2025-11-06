# app/routes/report_routes.py
import json
import logging
import tempfile
import os
import zipfile
import shutil
from bson import ObjectId
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body, Request, Query
from typing import Any, List, Dict, Optional
from uuid import uuid4
import json
from app.models.report_models import (
    ReportModel, 
    ReportCreate, 
    ReportProgressUpdate,
    StudyType,
    RegenerateFeedbackRequest,
    SectionUpdateRequest
)
from app.utils.report_report import ReportReportService
from app.utils.custom_report_report import CustomReportReportService
from app.utils.sof_report import SOFReportService
from app.models.models import User
from app.core.auth import get_current_active_user
from app.repositories import report_repo
from datetime import datetime
from fastapi.responses import FileResponse
from app.utils.custom_report_agent.date_filter import apply_date_filter
from app.utils.report_agent import ReportAgent
from app.utils.report_agent.section_generator import SectionGenerator
from app.tasks.report_tasks import process_report_task, reprocess_report_task
from app.utils.progress_utils import store_progress, get_progress, get_progress_collection, get_progress_by_case_id
from app.core.sagemaker_manager import sagemaker_manager

router = APIRouter()
logger = logging.getLogger(__name__)

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

@router.get("/health")
async def health_check():
    """Health check endpoint to keep proxy connections warm"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@router.post("/", response_model=ReportModel)
async def create_report(
    report_data: ReportCreate = Body(...),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new empty case study"""
    return await report_repo.create_report(report_data, current_user)

@router.get("/", response_model=List[ReportModel])
async def get_reports(
    current_user: User = Depends(get_current_active_user)
):
    """Get all case studies for the current user"""
    return await report_repo.get_reports(current_user)

@router.get("/type/{study_type}", response_model=List[ReportModel])
async def get_reports_by_type(
    study_type: StudyType,
    current_user: User = Depends(get_current_active_user)
):
    """Get case studies filtered by study type (style-a, style-b, style-c)"""
    all_reports = await report_repo.get_reports(current_user)
    return [cs for cs in all_reports if cs.study_type == study_type]


@router.get("/user/{user_id}", response_model=List[ReportModel])
async def get_reports_for_user(
    user_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get case studies for a specific user by user_id (admins may request others)."""
    return await report_repo.get_reports_by_user_id(user_id, current_user)

@router.get("/{report_id}", response_model=ReportModel)
async def get_report(
    report_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific case study by ID"""
    return await report_repo.get_report(report_id, current_user)

@router.delete("/{report_id}")
async def delete_report(
    report_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Delete a case study"""
    return await report_repo.delete_report(report_id, current_user)

@router.patch("/{report_id}/toggle-status")
async def toggle_report_status(
    report_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Toggle case study status between 'published' and 'pending review'. Only case study owners can toggle status."""
    return await report_repo.toggle_report_status(report_id, current_user)

@router.post("/api/reports/generate/stream")
async def generate_streaming_report(request: Request):
    payload = await request.json()
    return await sagemaker_manager.streaming_response(payload)

@router.post("/generate/{study_type}")
async def generate_report_unified(
    study_type: str,
    request_body: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_active_user)
):
    """Unified case study generation endpoint for all study types"""
    
    # Parse study type and validate
    study_type_map = {
        "default": StudyType.STYLE_A,
        "style_a": StudyType.STYLE_A,
        "style_b": StudyType.STYLE_B,
        "style_c": StudyType.STYLE_C,
        "style_sof": StudyType.STYLE_SOF,
        "customstyle": StudyType.STYLE_CUSTOM
    }
    
    if study_type not in study_type_map:
        raise HTTPException(status_code=400, detail=f"Invalid study type: {study_type}")
    
    progress_id = str(uuid4())
    report_structure = None
    
    # Handle different input formats
    if study_type == "customstyle":
        # Custom style has different request structure
        report_data_dict = request_body.get("report_data", {})
        report_data_dict["study_type"] = StudyType.STYLE_CUSTOM
        report_structure = request_body.get("report_structure")
        if report_structure:
            report_structure = json.loads(report_structure) if isinstance(report_structure, str) else report_structure
        
        # Remove created_report_id if it exists in the dict for validation
        temp_report_data_dict = report_data_dict.copy()
        temp_report_data_dict.pop('created_report_id', None)
        report_data = ReportCreate(**temp_report_data_dict)
        report_data.study_type = StudyType.STYLE_CUSTOM
    else:
        # Standard request body is the case study data directly
        report_data = ReportCreate(**request_body)
        mapped_study_type = study_type_map[study_type]
        
        # Handle single section flag for style_a
        if study_type == "style_a" and hasattr(report_data, 'single_section') and report_data.single_section:
            report_data.study_type = StudyType.STYLE_A_SINGLE
        else:
            report_data.study_type = mapped_study_type
    
    # Create case study in database BEFORE starting Celery task
    report = await report_repo.create_report(report_data, current_user)
    logger.info(f"📝 {study_type} case study created with ID: {report.id}")
    report_id = str(report.id)

    # Create appropriate message based on study type
    message_map = {
        "default": "Starting case study generation...",
        "style_a": "Starting StyleA case study generation...",
        "style_b": "Starting StyleB case study generation...",
        "style_c": "Starting StyleC case study generation...",
        "style_sof": "Starting Style SOF generation...",
        "customstyle": "Starting Custom Style case study generation..."
    }
    
    # Initialize progress tracking with report_id
    progress_data = ReportProgressUpdate(
        progress_id=progress_id,
        status="initializing",
        progress=0,
        message=message_map.get(study_type, "Starting case study generation..."),
        report_id=report_id,
        error=None,
        study_type=report_data.study_type
    )
    store_progress(progress_id, progress_data, user_id=str(current_user.id))
    
    # Convert objects to dicts for Celery serialization with ObjectId handling
    report_data_dict = report_data.model_dump() if hasattr(report_data, 'model_dump') else report_data.dict()
    report_data_dict = convert_objectid_to_str(report_data_dict)
    report_data_dict['created_report_id'] = str(report.id)
    
    user_dict = current_user.model_dump() if hasattr(current_user, 'model_dump') else current_user.dict()
    user_dict = convert_objectid_to_str(user_dict)
    
    # Start Celery task with appropriate parameters
    if study_type == "customstyle":
        process_report_task.delay(
            progress_id,
            report_data_dict,
            user_dict,
            report_id,
            report_structure
        )
    else:
        process_report_task.delay(
            progress_id,
            report_data_dict,
            user_dict,
            report_id
        )
    
    return {"progress_id": progress_id, "report_id": report_id}

@router.get("/progress/by-id/{progress_id}", response_model=ReportProgressUpdate)
async def check_progress(
    progress_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Check the progress of a case study generation task with timeout handling"""
    try:
        # Get progress from MongoDB
        progress_data = get_progress(progress_id)
        if not progress_data:
            raise HTTPException(status_code=404, detail="Progress ID not found")
        
        # Convert Pydantic model to dict with proper datetime serialization
        if hasattr(progress_data, 'model_dump'):
            # Pydantic v2
            return progress_data.model_dump(mode='json')
        elif hasattr(progress_data, 'dict'):
            # Pydantic v1 
            return progress_data.dict()
        else:
            # Fallback for plain dict
            return progress_data
        
    except HTTPException:
        raise
    except Exception as e:
        # Log error but don't let it cause 500 errors
        logger.error(f"Progress check error for {progress_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error checking progress")
    
@router.get("/progress/by-case-id/{case_id}", response_model=ReportProgressUpdate)
async def check_progress_by_case_id(
    case_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Check the progress of a case study generation task by case_id"""
    try:
        progress_data = get_progress_by_case_id(case_id)
        if not progress_data:
            raise HTTPException(status_code=404, detail="Case ID not found or already completed")
        
        # Convert Pydantic model to dict with proper datetime serialization
        if hasattr(progress_data, 'model_dump'):
            # Pydantic v2
            return progress_data.model_dump(mode='json')
        elif hasattr(progress_data, 'dict'):
            # Pydantic v1 
            return progress_data.dict()
        else:
            return progress_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Progress check error for case_id={case_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error checking progress by case_id")


@router.get("/progress/active", response_model=List[ReportProgressUpdate])
async def get_active_progress(current_user: User = Depends(get_current_active_user)):
    """Fetch all active progress for the current user"""
    try:
        collection = get_progress_collection()
        # Query for all progress entries that are not completed or error
        active_progress_cursor = collection.find(
            {
                "user_id": str(current_user.id),
                "status": {"$in": ["initializing", "processing"]}
            }
        )

        active_progress = []
        for progress in active_progress_cursor:
            progress_data = dict(progress)

            # # fetch full case study model
            # report = await report_repo.get_report(
            #     progress_data["report_id"], current_user
            # )
            # # add title
            # progress_data["report_title"] = report.title

            active_progress.append(ReportProgressUpdate(**progress_data))

        return active_progress

    except Exception as e:
        logger.error(f"Error fetching active progress for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error fetching active progress")


@router.post("/{report_id}/regenerate-with-feedback/{section_id}")
async def regenerate_section_with_feedback(
    report_id: str,
    section_id: str,
    feedback_request: RegenerateFeedbackRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Regenerate a section with feedback to improve retrieval and content generation"""
    try:
        # Get the case study
        report = await report_repo.get_report(report_id, current_user)
        
        # Find the section configuration
        section_config = None
        for section in report.sections:
            if section.section_id == section_id:
                report_agent = ReportAgent(study_type=report.study_type) 
                section_config = next(
                    (config for config in report_agent.report_structure if config["section"] == section_id),
                    None
                )
                break
        
        if not section_config:
            raise HTTPException(status_code=404, detail=f"Section {section_id} not found")
        
        # Initialize the agent and section generator
        agent = ReportAgent()
        section_generator = SectionGenerator(report.study_type, agent.report_structure)
        
        # Step 1: Generate new queries based on feedback
        query_list = await section_generator.generate_feedback_queries(
            section_config, feedback_request.feedback_items
        )
        
        # Step 2: Get previous sections for context
        previous_sections = []
        for section in report.sections:
            if section.section_id != section_config["section"]:
                previous_sections.append({
                    "title": section.title,
                    "content": section.content
                })
                if section.title == section_config["title"]:
                    break
        
        # Step 3: Regenerate section with enhanced retrieval
        regenerated_section = await section_generator.regenerate_section_with_feedback(
            section_config,
            str(report.case_id),
            [str(doc_id) for doc_id in report.document_ids] if report.document_ids else None,
            previous_sections,
            additional_queries=query_list
        )
        
        # Step 4: Update the case study
        for i, section in enumerate(report.sections):
            if section.section_id == section_config["section"]:
                report.sections[i] = regenerated_section
                break
        
        # Save updated case study
        report.update_timestamp()
        await report_repo.update_report(str(report.id), report, current_user)
        
        return {
            "success": True,
            "updated_content": regenerated_section.content,
            "message": f"Section regenerated successfully with feedback",
            "additional_queries_used": query_list
        }
        
    except Exception as e:
        logger.error(f"Regeneration with feedback error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to regenerate section: {str(e)}")

# Highlighted function to regenerate a section in the background
@router.post("/custom-highlight-feedback")
async def custom_highlight_feedback(
    request_body: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Accept user remarks for highlighted sections and trigger AI reprocessing.
    Returns a progress_id for polling.
    """
    # Extract fields from request body
    remarks = request_body.get("remarks", "")
    section = request_body.get("section", "")
    report = request_body.get("report", "")
    
    if not remarks or not section:
        raise HTTPException(status_code=400, detail="Both remarks and section are required")
    
    progress_id = str(uuid4())
    report_id = str(uuid4()) 
    
    progress_data = ReportProgressUpdate(
        progress_id=progress_id,
        status="initializing",
        progress=0,
        message="Starting AI reprocessing with your feedback...",
        report_id=report_id,
    )
    store_progress(progress_id, progress_data, user_id=str(current_user.id))
    
    # Pass the correct report_id to the task
    reprocess_report_task.delay(
        progress_id,
        remarks,
        section,
        report
    )
    return {"progress_id": progress_id}

@router.patch("/{report_id}/sections/{section_id}")
async def update_report_section(
    report_id: str,
    section_id: str,
    update: SectionUpdateRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Update the content of a specific section in a case study.
    """
    # Fetch the case study
    report = await report_repo.get_report(report_id, current_user)
    if not report:
        raise HTTPException(status_code=404, detail="Case study not found")

    # Find the section
    found = False
    for section in report.sections:
        if section.section_id == section_id:
            section.content = update.content
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Section not found")

    # Save the updated case study
    await report_repo.update_report(report_id, report, current_user)
    return {"message": "Section updated", "section_id": section_id, "content": update.content}

@router.get("/{report_id}/download")
async def download_report(
    report_id: str,
    background_tasks: BackgroundTasks,
    format: str = "pdf",
    current_user: User = Depends(get_current_active_user)
):
    """
    Download a case study as PDF or DOCX.
    """
    report = await report_repo.get_report(report_id, current_user)
    if not report:
        raise HTTPException(status_code=404, detail="Case study not found")
    format = format.lower()
    if format not in ["pdf", "docx"]:
        format = "pdf"
    suffix = f".{format}"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_path = temp_file.name
    temp_file.close()
    if format == "pdf":
        output_path = ReportReportService.generate_pdf_report(report, temp_path)
        media_type = "application/pdf"
    elif format == "docx":
        output_path = ReportReportService.generate_docx_report(report, temp_path)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    background_tasks.add_task(os.unlink, output_path)
    return FileResponse(
        path=output_path,
        filename=f"{report.title or 'Report'}{suffix}",
        media_type=media_type,
        background=background_tasks
    )

@router.get("/{report_id}/download-custom")
async def download_custom_report(
    report_id: str,
    background_tasks: BackgroundTasks,
    format: str = "pdf",
    current_user: User = Depends(get_current_active_user)
):
    """
    Download a case study as PDF or DOCX.
    """
    report = await report_repo.get_report(report_id, current_user)
    if not report:
        raise HTTPException(status_code=404, detail="Case study not found")
    
    format = format.lower()
    if format not in ["pdf", "docx"]:
        format = "pdf"
        
    # Convert case study to form data format
    form_data = {
        "title": report.title,
        "form_type": report.study_type.value,
        "sections": []
    }
    
    # Convert sections to form-friendly format
    for section in report.sections:
        form_data["sections"].append({
            "title": section.title,
            "content": section.content,
            "section_id": section.section_id
        })
    
    # Add metadata if available
    if hasattr(report, 'metadata') and report.metadata:
        form_data["metadata"] = report.metadata
    
    # Add header and footer if available
    if hasattr(report, 'header') and report.header:
        form_data["header"] = report.header
    
    if hasattr(report, 'footer') and report.footer:
        form_data["footer"] = report.footer
    
    # Generate temporary file
    suffix = f".{format}"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_path = temp_file.name
    temp_file.close()        
        
    if format == "pdf":
        output_path = CustomReportReportService.generate_pdf_custom_report(report, temp_path)
        media_type = "application/pdf"
    elif format == "docx":
        output_path = CustomReportReportService.generate_docx_custom_report(report, temp_path)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    
    background_tasks.add_task(os.unlink, output_path)
    filename = f"{report.title}.{suffix}"
    
    return FileResponse(
        path=output_path,
        filename=filename,
        media_type=media_type,
        background=background_tasks
    )

@router.get("/{report_id}/download-form")
async def download_filled_form(
    report_id: str,
    background_tasks: BackgroundTasks,
    format: str = "pdf",
    current_user: User = Depends(get_current_active_user)
):
    """
    Download a filled form for sof.
    """
    report = await report_repo.get_report(report_id, current_user)
    if not report:
        raise HTTPException(status_code=404, detail="Case study not found")
    
    format = format.lower()
    if format not in ["pdf", "docx"]:
        format = "pdf"
    
    # Convert case study to form data format
    form_data = {
        "title": report.title or "Statement of Facts",
        "form_type": report.study_type.value if report.study_type else "general",
        "sections": []
    }
    
    # Convert sections to form-friendly format
    for section in report.sections:
        form_data["sections"].append({
            "title": section.title,
            "content": section.content,
            "section_id": section.section_id
        })
    
    # Add metadata if available
    if hasattr(report, 'metadata') and report.metadata:
        form_data["metadata"] = report.metadata
    
    # Generate temporary file
    suffix = f".{format}"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_path = temp_file.name
    temp_file.close()
    
    if format == "pdf":
        output_path = SOFReportService.generate_legal_statement_pdf(form_data, temp_path)
        media_type = "application/pdf"
    elif format == "docx":
        output_path = SOFReportService.generate_legal_statement_docx(form_data, temp_path)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    
    # Clean up file after response
    background_tasks.add_task(os.unlink, output_path)
    
    filename = f"{report.title or 'Document'}.{format}"
    
    return FileResponse(
        path=output_path,
        filename=filename,
        media_type=media_type,
        background=background_tasks
    )

@router.get("/template/{template_name}/downloadExcel")
async def download_reports_by_template_as_excel(
    template_name: str,
    background_tasks: BackgroundTasks,
    start_date: Optional[str] = Query(None, description="Start date for filtering (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date for filtering (ISO format)"),
    display_name: Optional[str] = Query(None, description="Human-readable template name for Excel title"),
    current_user: User = Depends(get_current_active_user)
):
    """Download case studies filtered by specific template_name as Excel file"""
    try:
        # Get case studies by template_name
        reports = await report_repo.get_reports_by_template_name(current_user, template_name)
        
        # Apply date filtering if provided
        reports = apply_date_filter(reports, start_date, end_date)
        
        if not reports:
            raise HTTPException(status_code=404)
        
        # Generate temporary file with .xlsx extension
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
        temp_path = temp_file.name
        temp_file.close()
        
        # Generate Excel file
        output_path = CustomReportReportService.generate_report_xlsx_file(
            reports, temp_path, display_name
        )
        
        # Schedule file cleanup
        background_tasks.add_task(os.unlink, output_path)
        
        # Create safe filename from display name
        safe_filename = "".join(c for c in display_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_filename = safe_filename.replace(' ', '_')
        while '__' in safe_filename:
            safe_filename = safe_filename.replace('__', '_')
        
        return FileResponse(
            path=output_path,
            filename=f"{safe_filename}_Reports.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            background=background_tasks
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating Excel export for template {display_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating Excel file: {str(e)}")
    
async def _generate_reports_zip(
    reports_data: Dict[str, List[ReportModel]] | List[ReportModel],
    format: str,
    zip_filename: str,
    background_tasks: BackgroundTasks,
    user_info: Dict[str, str] = None,
    organize_by_user: bool = False
) -> FileResponse:
    """
    Unified function to generate documents from case studies and return as ZIP file.
    
    Args:
        reports_data: Either a dict {user_id: [reports]} or List[ReportModel]
        format: Document format ('pdf' or 'docx')
        zip_filename: Name for the ZIP file
        background_tasks: FastAPI background tasks for cleanup
        user_info: Optional dict mapping user_id to username for folder naming
        organize_by_user: Whether to organize files by user folders
    
    Returns:
        FileResponse containing the ZIP file
    """
    
    # Normalize input to consistent format
    if isinstance(reports_data, list):
        # Simple list - all case studies in one folder
        user_reports = {"": reports_data}
        organize_by_user = False
    else:
        # Dict format - organized by user
        user_reports = reports_data
        organize_by_user = True
    
    total_reports = sum(len(studies) for studies in user_reports.values())
    if total_reports == 0:
        raise HTTPException(status_code=404, detail="No case studies found")
    
    # Create temporary directory
    temp_dir = tempfile.mkdtemp()
    main_folder = Path(temp_dir) / ("All_Users_Reports" if organize_by_user else "reports")
    main_folder.mkdir(exist_ok=True)

    logger.info(f"Generating {format.upper()} documents for {total_reports} case studies")

    # Generate documents for each user/group
    total_generated_files = 0
    for user_id, reports in user_reports.items():
        if not reports:
            continue
            
        # Determine folder structure
        if organize_by_user and user_id:
            username = user_info.get(user_id, f"User_{user_id[:8]}") if user_info else f"User_{user_id[:8]}"
            user_folder = main_folder / username
            user_folder.mkdir(exist_ok=True)
        else:
            user_folder = main_folder

        # Generate documents for this user's case studies
        for i, report in enumerate(reports):
            try:
                # Generate safe filename
                safe_title = "".join(c for c in (report.title or f"Report_{i+1}") if c.isalnum() or c in (' ', '-', '_')).strip()
                safe_title = safe_title.replace(' ', '_')
                while '__' in safe_title:
                    safe_title = safe_title.replace('__', '_')
                safe_title = safe_title[:50]  # Limit length
                case_id_short = str(report.id)[:8]
                
                # Add status indicator if pending review
                pending_status = "(PENDING)" if report.status == "pending_review" else ""
                filename = f"{pending_status}{safe_title}_{case_id_short}.{format}"
                temp_path = str(user_folder / filename)

                # Generate document
                if format == "docx":
                    output_path = CustomReportReportService.generate_docx_custom_report(
                        report, temp_path
                    )
                else:  # pdf
                    output_path = CustomReportReportService.generate_pdf_custom_report(
                        report, temp_path
                    )
                
                if output_path and os.path.exists(output_path):
                    total_generated_files += 1
                    logger.info(f"Generated {format.upper()} {total_generated_files}/{total_reports}: {output_path}")
                else:
                    logger.warning(f"Failed to generate {format.upper()} for case study {report.id}")
                    
            except Exception as e:
                logger.error(f"Error generating document for case study {report.id}: {str(e)}")
                continue
    
    if total_generated_files == 0:
        # Clean up temp directory before raising exception
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate any {format.upper()} documents"
        )
    
    # Create ZIP file
    zip_path = Path(temp_dir) / zip_filename
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        if organize_by_user:
            # Include user folder structure in ZIP
            for user_folder in main_folder.iterdir():
                if user_folder.is_dir():
                    for file_path in user_folder.rglob('*'):
                        if file_path.is_file():
                            arcname = f"{user_folder.name}/{file_path.name}"
                            zipf.write(file_path, arcname)
        else:
            # Flat structure - all files in root of ZIP
            for file_path in main_folder.rglob('*'):
                if file_path.is_file():
                    zipf.write(file_path, file_path.name)
    
    logger.info(f"Created ZIP file with {total_generated_files} {format.upper()} documents: {zip_path}")
    
    # Schedule cleanup of temporary files
    def cleanup_temp_files():
        try:
            shutil.rmtree(temp_dir)
            logger.info(f"Cleaned up temporary directory: {temp_dir}")
        except Exception as e:
            logger.error(f"Failed to cleanup temporary directory {temp_dir}: {str(e)}")
    
    background_tasks.add_task(cleanup_temp_files)
    
    # Return the ZIP file
    return FileResponse(
        path=str(zip_path),
        filename=zip_filename,
        media_type="application/zip"
    )

@router.get("/template/{template_name}/downloadDocuments")
async def download_reports_by_template_as_documents(
    template_name: str,
    background_tasks: BackgroundTasks,
    format: str = Query("docx", description="Document format: pdf or docx"),
    start_date: Optional[str] = Query(None, description="Start date for filtering (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date for filtering (ISO format)"),
    display_name: Optional[str] = Query(None, description="Human-readable template name for folder naming"),
    current_user: User = Depends(get_current_active_user)
):
    """Download case studies by template as PDF/DOCX documents in a ZIP file"""
    
    # Validate format
    if format not in ["pdf", "docx"]:
        raise HTTPException(status_code=400, detail="Format must be 'pdf' or 'docx'")
    
    try:
        # Get case studies by template with date filtering
        reports = await report_repo.get_reports_by_template_name(
            current_user, template_name
        )
        
        # Apply date filtering if provided
        if start_date or end_date:
            reports = apply_date_filter(reports, start_date, end_date)

        if not reports:
            raise HTTPException(
                status_code=404,
                detail="No case studies found for the selected template or date range"
            )
        
        # Create ZIP filename
        safe_display_name = display_name.replace(" ", "_") if display_name else "Template"
        zip_filename = f"{safe_display_name}_Reports_{format.upper()}.zip"
        
        # Use unified helper function with simple list format
        return await _generate_reports_zip(
            reports, format, zip_filename, background_tasks, 
            organize_by_user=False
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in template {format.upper()} download: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during template {format.upper()} generation"
        )
    
@router.get("/admin/users/{user_id}/reports/download")
async def download_user_reports(
    user_id: str,
    background_tasks: BackgroundTasks,
    format: str = Query("pdf", description="Download format: pdf or docx"),
    current_user: User = Depends(get_current_active_user)
):
    """Download all published custom case studies for a specific user as PDF or DOCX documents in a ZIP file. Admin only."""

    # Check if user is admin
    if not getattr(current_user, 'is_admin', False):
        raise HTTPException(
            status_code=403,
            detail="Access denied. This endpoint requires admin privileges."
        )
    
    # Validate format
    if format not in ["pdf", "docx"]:
        raise HTTPException(status_code=400, detail="Format must be 'pdf' or 'docx'")
    
    try:
        from app.database.connection import db
        
        # Get all published custom case studies for this user
        query = {
            "user_id": str(user_id),
            "study_type": "style_custom",
            "status": "published"
        }
        
        cursor = db.reports.find(query).sort("created_at", -1)
        reports_data = list(cursor)
        
        if not reports_data:
            raise HTTPException(
                status_code=404, 
                detail="No published custom case studies found for user"
            )
        
        # Convert to ReportModel objects
        from app.models.report_models import ReportModel
        reports = []
        for doc in reports_data:
            try:
                report = ReportModel.model_validate(doc)
                reports.append(report)
            except Exception as e:
                logger.warning(f"Failed to validate case study {doc.get('_id')}: {str(e)}")
                continue
        
        logger.info(f"Found {len(reports)} published custom case studies for user")
        
        # Create ZIP filename
        zip_filename = f"Reports_{format.upper()}.zip"
        
        # Use unified helper function with simple list format
        return await _generate_reports_zip(
            reports, format, zip_filename, background_tasks,
            organize_by_user=False
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in user case studies download: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during download")


@router.get("/admin/bulk-download")
async def bulk_download_all_users_reports(
    background_tasks: BackgroundTasks,
    format: str = Query("docx", description="Download format: docx or pdf"),
    template_name: Optional[str] = Query(None, description="Filter by template name"),
    status: Optional[str] = Query(None, description="Filter by status: published or pending_review"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Admin only.
    Download case studies from all users with optional template and status filtering.
    Creates a ZIP file with user folders containing their respective case studies.
    """
    # Check admin privileges
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    format = format.lower()
    if format not in ["pdf", "docx"]:
        raise HTTPException(status_code=400, detail="Format must be 'pdf' or 'docx'")
    
    try:
        from app.database.connection import db
        
        # Build query for case studies
        query = {"study_type": "style_custom"}  # Only custom studies
        
        # Add status filter if provided
        if status and status in ["published", "pending_review"]:
            query["status"] = status
        else:
            query["status"] = {"$in": ["published", "pending_review"]}
            
        # Add template filter if provided
        if template_name:
            # Template filter needs to work across all users
            # For public templates, they might be stored as userID:template_name
            # For private templates, they're stored as just the template_name
            query["$or"] = [
                {"template_name": template_name},
                {"template_name": {"$regex": f".*:{template_name}$", "$options": "i"}},
                {"template_name": {"$regex": template_name, "$options": "i"}}
            ]
        
        logger.info(f"Bulk download query: {query}")
        
        # Get all matching case studies
        cursor = db.reports.find(query).sort("user_id", 1).sort("created_at", -1)
        reports_data = list(cursor)
        
        if not reports_data:
            raise HTTPException(
                status_code=404, 
                detail="No case studies found matching the specified filters"
            )
        
        # Convert to ReportModel objects and group by user
        from app.models.report_models import ReportModel
        user_reports = {}
        
        for doc in reports_data:
            try:
                report = ReportModel.model_validate(doc)
                user_id = report.user_id
                
                if user_id not in user_reports:
                    user_reports[user_id] = []
                
                user_reports[user_id].append(report)
            except Exception as e:
                logger.warning(f"Failed to validate case study {doc.get('_id')}: {str(e)}")
                continue
        
        logger.info(f"Found case studies for {len(user_reports)} users")
        
        # Get user information for folder naming
        user_info = {}
        if user_reports:
            user_ids = list(user_reports.keys())
            users_cursor = db.users.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids]}})
            for user_doc in users_cursor:
                user_info[str(user_doc["_id"])] = user_doc.get("username", f"User_{str(user_doc['_id'])[:8]}")
        
        # Create ZIP filename
        zip_filename = f"All_Users_Reports_{format.upper()}.zip"
        
        # Use unified helper function with user organization
        return await _generate_reports_zip(
            user_reports, format, zip_filename, background_tasks,
            user_info=user_info, organize_by_user=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in bulk download: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during bulk download")
