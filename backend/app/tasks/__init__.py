"""
Tasks package for StarAI backend.

This package contains Celery tasks for background processing,
including case study generation and other long-running operations.
"""

from app.tasks.report_tasks import process_report_task
from app.tasks.template_tasks import process_custom_format_task
from app.tasks.document_tasks import upload_document_task

__all__ = ['process_report_task', 'process_custom_format_task', 'upload_document_task']