# app/utils/report_metrics.py
from datetime import datetime
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class ReportMetrics:
    """Utility class for calculating case study metrics including processing time"""
    
    @staticmethod
    def calculate_processing_time(start_time: datetime, end_time: datetime) -> float:
        """Calculate processing time in seconds"""
        if not start_time or not end_time:
            return 0.0
        return (end_time - start_time).total_seconds()
    
    @staticmethod
    def format_processing_time(seconds: float) -> str:
        """Format processing time for display"""
        if seconds < 60:
            return f"{seconds:.1f} seconds"
        elif seconds < 3600:
            minutes = seconds / 60
            return f"{minutes:.1f} minutes"
        else:
            hours = seconds / 3600
            return f"{hours:.1f} hours"
    
    @staticmethod
    def get_report_metrics(report) -> Dict[str, Any]:
        """Get all metrics for a case study"""
        metrics = {
            "sections_count": len(report.sections) if report.sections else 0,
            "status": report.status,
            "study_type": report.study_type,
            "created_at": report.created_at,
        }
        
        if report.processing_time:
            metrics["processing_time"] = report.processing_time
            metrics["processing_time_formatted"] = ReportMetrics.format_processing_time(report.processing_time)
        
        if report.processing_start_time:
            metrics["processing_start_time"] = report.processing_start_time
            
        if report.processing_end_time:
            metrics["processing_end_time"] = report.processing_end_time
            
        return metrics