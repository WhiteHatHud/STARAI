from celery import Celery
from app.core.celery_manager import celery_app
from app.utils.report_prompt import ReportPromptGenerator
from app.repositories.report_template_repo import template_repository
# REMOVED: AI/OCR imports - feature disabled
# from app.tools.marker import process_document
# from pdf2docx import Converter
# import pypandoc
from app.utils.progress_utils import update_progress_field, store_progress
from app.models.report_models import ReportProgressUpdate
from datetime import datetime
import tempfile
import os
import logging
import asyncio
import base64

logger = logging.getLogger(__name__)

# Stub function to replace removed process_document
async def process_document(url: str) -> str:
    """
    FEATURE DISABLED: AI/OCR document processing has been removed.
    This function is a stub to prevent import errors.
    """
    raise NotImplementedError(
        "AI/OCR document processing has been removed. "
        "This feature is no longer supported. "
        "Only .xlsx file uploads are supported via the document upload endpoint."
    )

@celery_app.task(bind=True)
def process_custom_format_task(self, task_data):
    """Celery task to process custom format generation"""
    progress_id = task_data['progress_id']
    
    try:
        # Run async function in event loop
        return asyncio.run(process_custom_format_async(progress_id, task_data))
    except Exception as e:
        logger.error(f"Custom format task failed: {str(e)}")
        # Update progress with error
        update_progress_field(progress_id, 
                            status="error", 
                            progress=0,
                            error=str(e))
        raise

async def process_custom_format_async(progress_id: str, task_data: dict):
    """Async version of the custom format processing logic"""
    start_time = datetime.now()
    
    def update_progress(percent, message):
        """Update progress in MongoDB"""
        print(f"📊 Progress update for {progress_id}: {percent}% - {message}")
        update_progress_field(progress_id, 
                             progress=int(percent), 
                             message=message)
    
    try:
        update_progress(5, "Processing template file...")
        
        template_info = task_data['template']
        supporting_docs = task_data['supporting_documents']
        processing_method = task_data['processing_method']
        user_id = task_data['user_id']
        username = task_data['username']
        
        template_content = template_info['content']
        if isinstance(template_content, str):
            template_content = base64.b64decode(template_content)
        
        template_text = await process_file_content(
            template_info['filename'], 
            template_content, 
            user_id, 
            processing_method
        )
        
        update_progress(20, f"Processed template: {template_info['filename']}")
        
        supporting_docs_text = []
        doc_progress_step = 40 / max(len(supporting_docs), 1)
        
        for i, doc_info in enumerate(supporting_docs):
            try:
                doc_content = doc_info['content']
                if isinstance(doc_content, str):
                    doc_content = base64.b64decode(doc_content)
                
                doc_text = await process_file_content(
                    doc_info['filename'], 
                    doc_content, 
                    user_id, 
                    processing_method
                )
                
                supporting_docs_text.append({
                    'filename': doc_info['filename'],
                    'content': doc_text
                })
    
                current_progress = 20 + ((i + 1) * doc_progress_step)
                update_progress(current_progress, f"Processed document {i+1}: {doc_info['filename']}")
                
            except Exception as e:
                logger.warning(f"Failed to process supporting document {doc_info['filename']}: {str(e)}")
                update_progress(20 + ((i + 1) * doc_progress_step), 
                              f"Skipped document {i+1} (processing failed): {doc_info['filename']}")
                continue
        
        update_progress(65, "Generating custom format content...")
        
        generator = ReportPromptGenerator()
        generated_content = await generator.call(template_text, supporting_docs_text)
        update_progress(85, "Saving generated template...")
        
        save_result = await template_repository.save_template(
            user_id=user_id,
            template_content=generated_content,
            username=username
        )
        logger.info(f"Custom format generation completed successfully: {save_result['template_name']}")
        
        update_progress_field(progress_id,
                            status="completed",
                            progress=100,
                            message=f"Custom format generation completed successfully!",
                            template=generated_content)
        
    except Exception as e:
        error_msg = f"Custom format generation failed: {str(e)}"
        logger.error(error_msg)
        
        # Update progress with error
        error_progress = ReportProgressUpdate(
            progress_id=progress_id,
            status="error",
            progress=0,
            message=error_msg,
            report_id=None,
            error=str(e),
            study_type="custom_template"
        )
        store_progress(progress_id, error_progress, user_id=task_data.get('user_id'))
        
        raise Exception(error_msg)

# Helper functions
async def process_file_content(filename: str, file_content: bytes, user_id: str, processing_method: str = "pandoc") -> str:
    """Process file content and return extracted text."""
    
    if filename.endswith(('.docx', '.doc')):
        return await _process_word_document(filename, file_content, user_id, processing_method)
    elif filename.endswith('.pdf'):
        return await _process_pdf_document(filename, file_content, user_id, processing_method)
    else:
        # For all other file types (.md, .txt, .html, .json, etc.)
        return file_content.decode('utf-8', errors='ignore')

async def _process_word_document(filename: str, file_content: bytes, user_id: str, processing_method: str) -> str:
    """Process Word documents using either marker or pandoc."""
    file_size = len(file_content) / (1024 * 1024)
    
    if processing_method == "marker" and file_size <= 1:
        try:
            return await _convert_with_marker(filename, file_content, user_id)
        except Exception as e:
            logger.warning(f"Marker processing failed for {filename}: {e}, falling back to pandoc")
            return await _convert_with_pandoc(filename, file_content)
    else:
        try:
            return await _convert_with_pandoc(filename, file_content)
        except Exception as e:
            if gpu_usage:
                logger.warning(f"Pandoc processing failed for {filename}: {e}, falling back to marker")
                return await _convert_with_marker(filename, file_content, user_id)
            else:
                logger.info(f"GPU usage disabled, re-raising pandoc error for {filename}")
                raise e

async def _process_pdf_document(filename: str, file_content: bytes, user_id: str, processing_method: str) -> str:
    """Process PDF documents using either marker or pandoc."""
    file_size = len(file_content) / (1024 * 1024)

    if processing_method == "marker" and file_size <= 1:
        try:
            return await _convert_with_marker(filename, file_content, user_id)
        except Exception as e:
            logger.warning(f"Marker processing failed for {filename}: {e}, falling back to pandoc")
            return await _convert_pdf_with_pandoc(filename, file_content)
    else:
        try:
            return await _convert_pdf_with_pandoc(filename, file_content)
        except Exception as e:
            if gpu_usage:
                logger.warning(f"Pandoc processing failed for {filename}: {e}, falling back to marker")
                return await _convert_with_marker(filename, file_content, user_id)
            else:
                logger.info(f"GPU usage disabled, re-raising pandoc error for {filename}")
                raise e

async def _convert_with_marker(filename: str, file_content: bytes, user_id: str) -> str:
    """Convert document using marker tool."""
    
    temp_result = await template_repository.upload_temp_template(
        user_id=user_id,
        template_content=file_content,
        filename=filename
    )
    try:
        text = await process_document(temp_result["presigned_url"])
        return text
    finally:
        template_repository.cleanup_temp_template(temp_result["temp_key"])

async def _convert_with_pandoc(filename: str, file_content: bytes) -> str:
    """
    FEATURE DISABLED: Pandoc conversion has been removed.
    """
    raise NotImplementedError(
        "Document conversion feature has been removed. "
        "PDF/DOCX processing is no longer supported. "
        "Only .xlsx file uploads are supported."
    )

async def _convert_pdf_with_pandoc(filename: str, file_content: bytes) -> str:
    """
    FEATURE DISABLED: PDF conversion has been removed.
    """
    raise NotImplementedError(
        "PDF processing feature has been removed. "
        "Only .xlsx file uploads are supported."
    )