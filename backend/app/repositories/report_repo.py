# app/repositories/report_repo.py
from typing import List, Optional
from app.database.connection import db
from app.models.report_models import (
    ReportModel, 
    ReportCreate, 
    ReportMetadata,
    ReportMetrics,
    StudyType  # Import the StudyType enum
)
from app.models.models import User
from fastapi import HTTPException
from bson import ObjectId
from datetime import datetime, timezone
import logging
logger = logging.getLogger(__name__)

async def create_report(
    data: ReportCreate, 
    current_user: User, 
) -> ReportModel:
    """Create a new case study with specified type"""
    # Initialize with empty metrics
    metrics = ReportMetrics(
        started_at=datetime.now(timezone.utc),
        question_count=0,
        answered_count=0,
        overall_confidence=0.0
    )
     
    metadata = ReportMetadata(
        document_count=len(data.document_ids) if data.document_ids else 0,
        generation_metrics=metrics,
        coherence_scores={},
        enhancement_history=[]
    )
    
    # Add type-specific metadata fields
    if data.study_type == StudyType.STYLE_B:
        metadata.teaching_notes = {}
    elif data.study_type == StudyType.STYLE_C:
        metadata.multimedia_elements = []
        metadata.interactive_features = {}
    elif data.study_type == StudyType.STYLE_SOF:
        metadata.multimedia_elements = []
        metadata.interactive_features = {}
        metadata.style_sof_features = {}
    
    print(f'Creating case study with type: {data.study_type}')
    report = ReportModel(
        user_id=str(current_user.id),
        case_id=data.case_id,
        title=data.title,
        document_ids=data.document_ids if data.document_ids else [],
        status="draft",
        sections=[],
        metadata=metadata,
        study_type=data.study_type,  # Set the study type
        template_name=data.template_name,  # Store template name for filtering
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
 
    # Log template_name for debugging public template issues
    logger.info(f"Creating case study with template_name: {data.template_name}")
    
    result = db.reports.insert_one(report.model_dump(by_alias=True))
    report.id = result.inserted_id
    logger.info(f"type of report.id is {type(report.id)} and type of result.inserted_id is {type(result.inserted_id)}")
    report_inserted = db.reports.find_one({"_id": (report.id), "user_id": report.user_id})

    logger.info(f" this is wat is inserted {report_inserted} and this is what is returned{report}")
    return report

# Helper functions for specific study types
async def create_style_b_study(data: ReportCreate, current_user: User) -> ReportModel:
    """Create a style_b-style case study"""
    return await create_report(data, current_user, StudyType.STYLE_B)

async def create_style_c_study(data: ReportCreate, current_user: User) -> ReportModel:
    """Create an style_c-style case study"""
    return await create_report(data, current_user, StudyType.STYLE_C)

async def create_style_sof_study(data: ReportCreate, current_user: User) -> ReportModel:
    """Create a style_sof-style case study"""
    return await create_report(data, current_user, StudyType.STYLE_SOF)

async def get_reports(
    current_user: User, 
    study_type: Optional[StudyType] = None  # Add optional study_type filter
) -> List[ReportModel]:
    """Get all case studies for the current user, optionally filtered by type"""
    # Base query
    query = {"user_id": str(current_user.id)}
    
    # Add study_type filter if provided
    if study_type:
        query["study_type"] = study_type.value
    
    cursor = db.reports.find(query).sort("created_at", -1)

    # Convert cursor to list directly - no await needed with PyMongo
    reports = list(cursor)
    
    # Handle legacy enum values and validate models
    validated_studies = []
    for doc in reports:
        try:
            # Migrate legacy enum values
            if 'study_type' in doc:
                if doc['study_type'] == 'styled':
                    doc['study_type'] = 'style_d'
                elif doc['study_type'] == 'stylea':
                    doc['study_type'] = 'style_a'
                elif doc['study_type'] == 'styleb':
                    doc['study_type'] = 'style_b'
                elif doc['study_type'] == 'stylec':
                    doc['study_type'] = 'style_c'
                elif doc['study_type'] == 'stylecustom':
                    doc['study_type'] = 'style_custom'
                # Update the document in database with corrected enum
                if doc['study_type'] in ['style_d', 'style_a', 'style_b', 'style_c', 'style_custom']:
                    db.reports.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"study_type": doc['study_type']}}
                    )
            
            validated_studies.append(ReportModel.model_validate(doc))
        except Exception as e:
            logger.error(f"Error validating case study {doc.get('_id', 'unknown')}: {str(e)}")
            # Skip invalid documents rather than failing the entire request
            continue
    
    return validated_studies

# Helper functions for getting specific study types
async def get_style_b_studies(current_user: User) -> List[ReportModel]:
    """Get all style_b studies for the current user"""
    return await get_reports(current_user, StudyType.STYLE_B)

async def get_style_c_studies(current_user: User) -> List[ReportModel]:
    """Get all style_c studies for the current user"""
    return await get_reports(current_user, StudyType.STYLE_C)

async def get_style_sof_studies(current_user: User) -> List[ReportModel]:
    """Get all style_sof studies for the current user"""
    return await get_reports(current_user, StudyType.STYLE_SOF)

async def get_style_a_reports(current_user: User) -> List[ReportModel]:
    """Get all StyleA-style case studies for the current user"""
    return await get_reports(current_user, StudyType.STYLE_A)

async def get_reports_by_template_name(current_user: User, template_name: str) -> List[ReportModel]:
    """Get case studies filtered by specific template_name"""
    try:
        logger.info(f"Searching for case studies with template_name: {template_name}")
        
        # For private templates, template_name is just the UUID
        query = {
            "user_id": str(current_user.id),
            "template_name": template_name,
            "status": "published"
        }
        
        cursor = db.reports.find(query).sort("created_at", -1)
        reports = list(cursor)
        
        if reports:
            logger.info(f"Found {len(reports)} case studies using exact match")
        else:
            # For public templates, template_name is in the format userID:UUID
            alt_query = {
                "user_id": str(current_user.id), 
                "template_name": {"$regex": template_name, "$options": "i"},
                "status": "published"
            }
            alt_cursor = db.reports.find(alt_query).sort("created_at", -1)
            reports = list(alt_cursor)
            if reports:
                logger.info(f"Found {len(reports)} case studies using regex fallback")
            
        # Handle legacy enum values and validate models
        validated_studies = []
        for doc in reports:
            try:
                # Migrate legacy enum values
                if 'study_type' in doc:
                    if doc['study_type'] == 'styled':
                        doc['study_type'] = 'style_d'
                    elif doc['study_type'] == 'stylea':
                        doc['study_type'] = 'style_a'
                    elif doc['study_type'] == 'styleb':
                        doc['study_type'] = 'style_b'
                    elif doc['study_type'] == 'stylec':
                        doc['study_type'] = 'style_c'
                    elif doc['study_type'] == 'stylecustom':
                        doc['study_type'] = 'style_custom'
                    # Update the document in database with corrected enum
                    if doc['study_type'] in ['style_d', 'style_a', 'style_b', 'style_c', 'style_custom']:
                        db.reports.update_one(
                            {"_id": doc["_id"]},
                            {"$set": {"study_type": doc['study_type']}}
                        )
                
                validated_studies.append(ReportModel.model_validate(doc))
            except Exception as e:
                logger.error(f"Error validating case study {doc.get('_id', 'unknown')}: {str(e)}")
                # Skip invalid documents rather than failing the entire request
                continue
        
        return validated_studies
        
    except Exception as e:
        logger.error(f"Error getting case studies by template name {template_name}: {str(e)}")
        return []


async def get_reports_by_user_id(user_id: str, current_user: User) -> List[ReportModel]:
    """Get case studies for a specific user_id.

    Admins may request case studies for any user. Non-admins may only request their own case studies.
    """
    # Permission check: allow if admin or requesting own cases
    try:
        requester_id = str(current_user.id)
    except Exception:
        requester_id = None

    if not getattr(current_user, "is_admin", False) and requester_id != str(user_id):
        raise HTTPException(status_code=403, detail="Not authorized to view these case studies")

    query = {"user_id": str(user_id)}
    cursor = db.reports.find(query).sort("created_at", -1)
    reports = list(cursor)

    validated_studies = []
    for doc in reports:
        try:
            validated_studies.append(ReportModel.model_validate(doc))
        except Exception as e:
            logger.error(f"Error validating case study {doc.get('_id', 'unknown')}: {str(e)}")
            continue

    return validated_studies

async def get_report(
    report_id: str, 
    current_user: User,
    expected_type: Optional[StudyType] = None  # Add optional type validation
) -> ReportModel:
    """Get a specific case study by ID, optionally validating its type"""
    # Build query depending on whether the requester is an admin
    # Try to convert the incoming id to an ObjectId, but fall back to string if conversion fails
    if getattr(current_user, "is_admin", False):
        query = {"_id": report_id}
    else:
        query = {"_id": report_id, "user_id": str(current_user.id)}

    report = db.reports.find_one(query)
    
    if not report:
        raise HTTPException(status_code=404, detail="Case study not found")
    
    # Migrate legacy enum values
    if 'study_type' in report:
        if report['study_type'] == 'styled':
            report['study_type'] = 'style_d'
            # Update the document in database
            db.reports.update_one(
                {"_id": report["_id"]},
                {"$set": {"study_type": 'style_d'}}
            )
        elif report['study_type'] == 'stylea':
            report['study_type'] = 'style_a'
            db.reports.update_one(
                {"_id": report["_id"]},
                {"$set": {"study_type": 'style_a'}}
            )
        elif report['study_type'] == 'styleb':
            report['study_type'] = 'style_b'
            db.reports.update_one(
                {"_id": report["_id"]},
                {"$set": {"study_type": 'style_b'}}
            )
        elif report['study_type'] == 'stylec':
            report['study_type'] = 'style_c'
            db.reports.update_one(
                {"_id": report["_id"]},
                {"$set": {"study_type": 'style_c'}}
            )
        elif report['study_type'] == 'stylecustom':
            report['study_type'] = 'style_custom'
            db.reports.update_one(
                {"_id": report["_id"]},
                {"$set": {"study_type": 'style_custom'}}
            )
    
    result = ReportModel.model_validate(report)
    logger.info(result)
    # Validate study type if expected_type is provided
    if expected_type and result.study_type != expected_type:
        raise HTTPException(
            status_code=400, 
            detail=f"Case study is not of expected type '{expected_type.value}'. Found '{result.study_type.value}' instead."
        )
    
    return result

# Helper functions for getting specific study types by ID
async def get_style_b_study(report_id: str, current_user: User) -> ReportModel:
    """Get a specific style_b study by ID"""
    return await get_report(report_id, current_user, StudyType.STYLE_B)

async def get_style_c_study(report_id: str, current_user: User) -> ReportModel:
    """Get a specific style_c study by ID"""
    return await get_report(report_id, current_user, StudyType.STYLE_C)

async def get_style_sof_study(report_id: str, current_user: User) -> ReportModel:
    """Get a specific style_sof study by ID"""
    return await get_report(report_id, current_user, StudyType.STYLE_SOF)

async def update_report(report_id: str, updated_report: ReportModel, current_user: User) -> ReportModel:
    """Update a case study"""
    # Verify case study exists and belongs to user
    existing = await get_report(report_id, current_user)
    # Ensure updated_at is set
    updated_report.updated_at = datetime.now(timezone.utc)
    
    # Update the case study
    update_data = updated_report.model_dump(by_alias=True, exclude={"id", "user_id"})
    logger.info(f"update_data is {update_data}")

    # Remove await for synchronous operation
    db.reports.update_one(
        {"_id": (report_id)},
        {"$set": update_data}
    )
    # Check if we need to calculate processing time
    if hasattr(updated_report, 'status') and updated_report.status == "published":
        if not hasattr(updated_report, 'processing_time') or not updated_report.processing_time:
            if hasattr(updated_report, 'processing_start_time') and updated_report.processing_start_time:
                processing_end_time = datetime.now(timezone.utc)
                processing_time = (processing_end_time - updated_report.processing_start_time).total_seconds()
                update_data['processing_time'] = processing_time
                update_data['processing_end_time'] = processing_end_time
    return await get_report(report_id, current_user)

async def toggle_report_status(report_id: str, current_user: User) -> ReportModel:
    """One Time Toggle custom case study status from pending_review to published'"""
    # Verify case study exists and belongs to user (this also enforces ownership)
    existing = await get_report(report_id, current_user)
    
    # Determine new status based on current status
    current_status = existing.status
    if current_status == "pending_review":
        new_status = "published"
    else:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot toggle status from '{current_status}'. Status must be 'published' or 'pending_review'."
        )
    
    # Update the status and timestamp - include user_id in the query for extra security
    update_data = {
        "status": new_status,
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Build query to ensure we only update if user owns the case study
    query = {"_id": report_id, "user_id": str(current_user.id)}
    
    # Update the case study with ownership verification in the query
    result = db.reports.update_one(query, {"$set": update_data})
    
    # Verify the update actually happened (additional safety check)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case study not found or you don't have permission to modify it")
    
    # Return the updated case study
    return await get_report(report_id, current_user)

async def delete_report(report_id: str, current_user: User) -> bool:
    """Delete a case study"""
    # Verify case study exists and belongs to user
    existing = await get_report(report_id, current_user)
    
    # Delete the case study - remove await
    result = db.reports.delete_one({"_id": (report_id)})
    
    return result.deleted_count > 0

async def _delete_all_user_reports(user_id: ObjectId, session=None):
    """Internal function to delete all case studies for a user within a transaction."""
    db.reports.delete_many({"user_id": str(user_id)}, session=session)
    db.report_progress.delete_many({"user_id": str(user_id)}, session=session)