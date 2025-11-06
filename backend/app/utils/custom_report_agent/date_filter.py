from typing import List, Optional
from datetime import datetime, timedelta
from app.models.report_models import ReportModel
import logging

logger = logging.getLogger(__name__)

def apply_date_filter(reports: List[ReportModel], start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[ReportModel]:
    """Apply date filtering to case studies using Singapore timezone (+8 UTC)"""
    if not start_date and not end_date:
        return reports
    
    filtered_studies = []
    
    for study in reports:
        study_date = study.created_at if hasattr(study, 'created_at') else None
        if not study_date:
            continue
        
        # Convert study date to Singapore time by adding 8 hours to UTC
        if isinstance(study_date, str):
            study_dt = datetime.fromisoformat(study_date.replace('Z', '+00:00'))
        else:
            study_dt = study_date
        
        # Convert UTC to Singapore time (+8 hours)
        study_singapore = study_dt + timedelta(hours=8)
        
        # Apply filters
        include_study = True
        
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                start_singapore = start_dt + timedelta(hours=8)
                if study_singapore < start_singapore:
                    include_study = False
                    logger.info(f"Excluding study - before start date: {study_singapore.date()} < {start_singapore.date()}")
            except ValueError as e:
                logger.error(f"Invalid start_date format: {start_date}, error: {e}")
                continue
                
        if end_date and include_study:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                end_singapore = end_dt + timedelta(hours=8)
                # Set to end of day (23:59:59)
                end_with_time = end_singapore.replace(hour=23, minute=59, second=59, microsecond=999999)
                if study_singapore > end_with_time:
                    include_study = False
                    logger.info(f"Excluding study - after end date: {study_singapore.date()} > {end_with_time.date()}")
            except ValueError as e:
                logger.error(f"Invalid end_date format: {end_date}, error: {e}")
                continue
                
        if include_study:
            filtered_studies.append(study)
    
    logger.info(f"Date filtering: {len(reports)} → {len(filtered_studies)} case studies")
    return filtered_studies
