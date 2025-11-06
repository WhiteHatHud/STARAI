# app/tasks/report_tasks.py

import asyncio
from app.core.celery_manager import celery_app, r, MAPPING_KEY
from app.models.report_models import ReportCreate, StudyType
from app.models.models import User
from app.repositories import report_repo
from app.utils.report_agent import ReportAgent
from app.utils.custom_report_agent import CustomReportAgent, CustomReprocessor

from app.tools.main import clean_markdown_text
from datetime import datetime
from app.utils.progress_utils import update_progress_field
import logging
import json

logger = logging.getLogger(__name__)

@celery_app.task(name="process_report", bind=True)
def process_report_task(self, progress_id: str, report_data_dict: dict, user_dict: dict, report_id: str,report_structure=None):
    """
    Celery task for processing case study generation.
    Note: Celery tasks must be synchronous, so we'll run the async code using asyncio.
    """
    # Convert dict back to objects
    report_data = ReportCreate(**report_data_dict)
    user = User(**user_dict)
    
    # Run the async function in the event loop
    return asyncio.run(
        process_report_async(progress_id, report_data, user, report_id, report_structure)
    )

async def process_report_async(
    progress_id: str,
    report_data: ReportCreate,
    current_user: User,
    report_id: str,
    report_structure=None
):
    """Async version of the case study processing logic"""
    start_time = datetime.now()
    
    def update_progress(percent, message):
        """Update progress in MongoDB"""
        print(f"📊 Progress update for {progress_id}: {percent}% - {message}")
        update_progress_field(progress_id, 
                             progress=int(percent), 
                             message=message)

    try:
        print(f"📝 Using existing case study with ID: {report_id}")
        update_progress(5, "Using existing case study record...")
        
        # Get the existing case study from database
        report = await report_repo.get_report(report_id, current_user)
        if not report:
            raise ValueError(f"Case study {report_id} not found")
        
        print(f"✅ Case study loaded with ID: {report.id}")

        update_progress_field(progress_id, status="processing")
        update_progress(10, "Processing case study sections...")
        
        document_ids = None
        if report_data.document_ids:
            document_ids = [str(doc_id) for doc_id in report_data.document_ids]
                
        update_progress(15, "Initializing AI agent...")
        
        if report_data.study_type == StudyType.STYLE_CUSTOM:
            agent = CustomReportAgent(study_type=report_data.study_type, report_structure=report_structure)
        else:
            agent = ReportAgent(study_type=report_data.study_type)
            
        total_sections = len(agent.report_structure)        
        update_progress(20, f"Preparing to generate {total_sections} sections...")
        
        update_progress(50, f"Generating {report_data.study_type.value if report_data.study_type else 'case'} study content")
        
        if report_data.study_type == StudyType.STYLE_CUSTOM:
            generated_report = await agent.generate_complete_report(
                str(report_data.case_id),
                document_ids,
                title=report_data.title,
                study_type=report_data.study_type,
                progress_callback=update_progress,
                report_structure=report_structure
            )
        else:
            generated_report = await agent.generate_complete_report(
                str(report_data.case_id),
                document_ids,
                title=report_data.title,
                study_type=report_data.study_type,
                progress_callback=update_progress
            )            

        if report_data.study_type != StudyType.STYLE_CUSTOM:
            for section in generated_report["sections"]:
                if hasattr(section, "content"):
                    section.content = clean_markdown_text(section.content)
                elif isinstance(section, dict) and "content" in section:
                    section["content"] = clean_markdown_text(section["content"])
        
        update_progress(96, "Saving case study to database...")
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        # Update the existing case study with generated content
        report.sections = generated_report["sections"]
        report.metadata = generated_report["metadata"]
        report.status = generated_report["status"]
        report.study_type = generated_report["study_type"]

        if report_data.study_type == StudyType.STYLE_CUSTOM:
            report.header = generated_report["header"]
            report.footer = generated_report["footer"]
        
        report.processing_time = processing_time
        report.processing_start_time = start_time
        report.processing_end_time = end_time
        
        report.update_timestamp()
        updated_report = await report_repo.update_report(
            str(report.id), 
            report, 
            current_user
        )
        
        update_progress_field(progress_id,
                             status="completed",
                             progress=100,
                             message=f"Case study generation complete ({processing_time:.1f}s)",
                             report_id=str(report.id))
                
    except Exception as e:
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        logger.error(f"Case study generation error after {processing_time:.1f}s: {str(e)}")
        update_progress_field(progress_id,
                             status="error",
                             error=str(e),
                             message=f"Error after {processing_time:.1f}s: {str(e)}")
        
@celery_app.task(name="reprocess_report", bind=True)
def reprocess_report_task(self, progress_id:str, remarks: str, section: str, report: str):
    return asyncio.run(reprocess_report_task_async(self, progress_id, remarks, section, report))


async def reprocess_report_task_async(self, progress_id:str, remarks: str, section: str, report: str):
    # Deserialize the section JSON string back into a dictionary
    def update_progress(percent, message):
        """Update progress in MongoDB"""
        print(f"📊 Progress update for {progress_id}: {percent}% - {message}")
        update_progress_field(progress_id, 
                             progress=int(percent), 
                             message=message)
        
    section_data = json.loads(section)
    report_data = json.loads(report)
    update_progress_field(progress_id, status="processing")
    update_progress(10, "Processing case study section...")
    reprocessor = CustomReprocessor(remarks, section_data, report_data)
    result = await reprocessor.reprocess_section()
    update_progress_field(progress_id,
                        status="completed",
                        progress=100,
                        message="Reprocessing completed",
                        template=result)
