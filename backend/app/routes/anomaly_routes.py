# app/routes/anomaly_routes.py
"""
API routes for anomaly detection system.
Handles dataset upload, anomaly retrieval, triage reports, and exports.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse, FileResponse
from typing import List, Optional
import logging
import io
from datetime import datetime

from app.models.models import User
from app.models.anomaly_models import (
    DatasetModel,
    DatasetSummary,
    DatasetStatus,
    DetectedAnomaly,
    AnomalyStatus,
    AnomalyReport,
    AnomalyReportCreate,
    AnomalyReportUpdate,
    AnomalyReportSummary,
    ReportStatus,
    AnalysisSession,
    SessionStatus,
    SeverityLevel
)
from app.repositories import anomaly_repo
from app.core.auth import get_current_user
from app.tools.excel_parser import validate_xlsx_file, parse_xlsx_to_json
from app.core.s3_manager import upload_to_s3, s3_manager
import pandas as pd

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# DATASET ROUTES
# ============================================================================

@router.post("/datasets/upload", response_model=DatasetModel, status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload Excel dataset for anomaly detection.

    - Validates .xlsx file format
    - Uploads to S3
    - Creates dataset record
    - Returns dataset metadata
    """
    try:
        # Validate file
        validate_xlsx_file(file.content_type, file.filename)

        # Read file content
        file_content = await file.read()

        if not file_content:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        # Generate unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_filename = file.filename.replace(" ", "_")
        unique_filename = f"{current_user.username}_{timestamp}_{safe_filename}"

        # Upload to S3
        s3_key = f"datasets/{current_user.id}/{unique_filename}"
        upload_success = await upload_to_s3(
            file_content=file_content,
            s3_key=s3_key,
            content_type=file.content_type
        )

        if not upload_success:
            raise HTTPException(status_code=500, detail="Failed to upload file to S3")

        # Create dataset record
        dataset = await anomaly_repo.create_dataset(
            user_id=str(current_user.id),
            filename=unique_filename,
            original_filename=file.filename,
            s3_key=s3_key,
            file_size=len(file_content),
            content_type=file.content_type
        )

        logger.info(f"Dataset {dataset.id} uploaded by user {current_user.username}")

        # TODO: Trigger async analysis pipeline (Celery task)
        # analyze_dataset_task.delay(dataset.id)

        return dataset

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error uploading dataset: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload dataset: {str(e)}")


@router.get("/datasets", response_model=List[DatasetSummary])
async def get_user_datasets(
    status: Optional[DatasetStatus] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of datasets to return"),
    current_user: User = Depends(get_current_user)
):
    """
    Get all datasets for the current user.

    - Optional status filter
    - Includes anomaly counts
    - Sorted by upload date (newest first)
    """
    try:
        datasets = await anomaly_repo.get_user_datasets(
            current_user=current_user,
            status=status,
            limit=limit
        )
        return datasets
    except Exception as e:
        logger.error(f"Error retrieving datasets: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve datasets")


@router.get("/datasets/{dataset_id}", response_model=DatasetModel)
async def get_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed information about a specific dataset"""
    try:
        dataset = await anomaly_repo.get_dataset(dataset_id, current_user)
        return dataset
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving dataset {dataset_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve dataset")


@router.delete("/datasets/delete-all")
async def delete_all_datasets(
    current_user: User = Depends(get_current_user)
):
    """
    Delete ALL datasets for the current user.

    - Deletes all dataset records from database
    - Removes all S3 files
    - Cascades deletion to all anomalies, reports, and sessions
    - Returns summary of deletion operation
    """
    try:
        result = await anomaly_repo.delete_all_user_datasets(current_user)

        logger.info(
            f"Deleted all datasets for user {current_user.username}: "
            f"{result['deleted_count']} deleted, {result['failed_count']} failed"
        )

        return result

    except Exception as e:
        logger.error(f"Error deleting all datasets: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete all datasets")


@router.delete("/datasets/{dataset_id}", status_code=204)
async def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a dataset and all associated anomalies/reports.

    - Verifies ownership
    - Deletes S3 file
    - Cascades deletion to anomalies, reports, and sessions
    """
    try:
        success = await anomaly_repo.delete_dataset(dataset_id, current_user)
        if not success:
            raise HTTPException(status_code=404, detail="Dataset not found")

        logger.info(f"Dataset {dataset_id} deleted by user {current_user.username}")
        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting dataset {dataset_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete dataset")


@router.post("/datasets/{dataset_id}/analyze-test")
async def analyze_dataset_test(
    dataset_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    TEST ENDPOINT: Analyze dataset for anomalies (synchronous).

    This is for testing only. In production, use async Celery tasks.

    - Downloads Excel from S3
    - Trains autoencoder on the data
    - Detects anomalies
    - Stores results in database
    - Returns summary
    """
    try:
        from app.utils.anomaly_detector import detect_anomalies_in_excel, TF_AVAILABLE

        if not TF_AVAILABLE:
            raise HTTPException(
                status_code=500,
                detail="TensorFlow not available. Please install: pip install tensorflow>=2.13.0"
            )

        # Get dataset
        dataset = await anomaly_repo.get_dataset(dataset_id, current_user)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")

        logger.info(f"Starting TEST analysis for dataset {dataset_id}")

        # Update status
        await anomaly_repo.update_dataset(dataset_id, {"status": "processing"})

        # Download Excel from S3
        logger.info(f"Downloading from S3: {dataset.s3_key}")
        file_stream = s3_manager.get_object_stream(dataset.s3_key)

        # Parse Excel to DataFrame
        df = pd.read_excel(file_stream, sheet_name=0)
        logger.info(f"Parsed Excel: {len(df)} rows, {len(df.columns)} columns")

        # Detect anomalies
        logger.info("Running anomaly detection...")
        anomalies, detector = detect_anomalies_in_excel(
            df=df,
            model_path=None,  # Train a new model
            train_if_needed=True
        )

        logger.info(f"Detected {len(anomalies)} anomalies")

        # Store anomalies in database
        stored_count = 0
        for anomaly in anomalies:
            try:
                await anomaly_repo.create_anomaly(
                    dataset_id=dataset_id,
                    user_id=str(current_user.id),
                    anomaly_score=anomaly["anomaly_score"],
                    row_index=anomaly["row_index"],
                    sheet_name="Sheet1",
                    raw_data=anomaly["raw_data"],
                    anomalous_features=anomaly["anomalous_features"]
                )
                stored_count += 1
            except Exception as e:
                logger.error(f"Error storing anomaly at row {anomaly['row_index']}: {str(e)}")

        # Update dataset status
        await anomaly_repo.update_dataset(
            dataset_id=dataset_id,
            updates={
                "status": "completed",
                "anomaly_count": stored_count
            }
        )

        logger.info(f"Analysis complete: {stored_count} anomalies stored")

        return {
            "dataset_id": dataset_id,
            "status": "completed",
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "anomalies_detected": len(anomalies),
            "anomalies_stored": stored_count,
            "anomaly_percentage": f"{(len(anomalies) / len(df) * 100):.2f}%",
            "threshold_used": float(detector.threshold),
            "columns_analyzed": df.columns.tolist()[:10]  # First 10 columns
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing dataset {dataset_id}: {str(e)}", exc_info=True)
        # Update dataset status to failed
        try:
            await anomaly_repo.update_dataset(
                dataset_id=dataset_id,
                updates={"status": "failed"}
            )
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ============================================================================
# ANOMALY ROUTES
# ============================================================================

@router.get("/datasets/{dataset_id}/anomalies", response_model=List[DetectedAnomaly])
async def get_dataset_anomalies(
    dataset_id: str,
    status: Optional[AnomalyStatus] = Query(None, description="Filter by status"),
    min_score: Optional[float] = Query(None, ge=0, le=1, description="Minimum anomaly score"),
    current_user: User = Depends(get_current_user)
):
    """
    Get all detected anomalies for a dataset.

    - Optional filters: status, minimum anomaly score
    - Sorted by anomaly score (highest first)
    """
    try:
        anomalies = await anomaly_repo.get_dataset_anomalies(
            dataset_id=dataset_id,
            current_user=current_user,
            status=status,
            min_score=min_score
        )
        return anomalies
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving anomalies for dataset {dataset_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve anomalies")


@router.get("/anomalies/{anomaly_id}", response_model=DetectedAnomaly)
async def get_anomaly(
    anomaly_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed information about a specific anomaly"""
    try:
        anomaly = await anomaly_repo.get_anomaly(anomaly_id, current_user)
        return anomaly
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving anomaly {anomaly_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve anomaly")


# ============================================================================
# ANOMALY REPORT ROUTES
# ============================================================================

@router.get("/anomaly-reports", response_model=List[AnomalyReportSummary])
async def get_user_reports(
    status: Optional[ReportStatus] = Query(None, description="Filter by status"),
    dataset_id: Optional[str] = Query(None, description="Filter by dataset"),
    severity: Optional[SeverityLevel] = Query(None, description="Filter by severity"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of reports"),
    current_user: User = Depends(get_current_user)
):
    """
    Get all anomaly reports for the current user.

    - Optional filters: status, dataset, severity
    - Returns lightweight summaries for list view
    - Sorted by creation date (newest first)
    """
    try:
        reports = await anomaly_repo.get_user_reports(
            current_user=current_user,
            status=status,
            dataset_id=dataset_id,
            limit=limit
        )

        # Filter by severity if requested (done in-memory since it's in nested triage object)
        if severity:
            reports = [r for r in reports if r.severity == severity]

        return reports
    except Exception as e:
        logger.error(f"Error retrieving anomaly reports: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve reports")


@router.get("/anomaly-reports/{report_id}", response_model=AnomalyReport)
async def get_anomaly_report(
    report_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed anomaly report including full triage analysis.

    Returns:
    - Severity and threat classification
    - Business impact assessment
    - Mitigation recommendations (immediate/short-term/long-term)
    - Confidence metrics
    - Forensic data preservation instructions
    """
    try:
        report = await anomaly_repo.get_anomaly_report(report_id, current_user)
        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving report {report_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve report")


@router.post("/anomaly-reports", response_model=AnomalyReport, status_code=201)
async def create_anomaly_report(
    data: AnomalyReportCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Manually create an anomaly report for a detected anomaly.

    (Note: Normally created automatically by analysis pipeline)
    """
    try:
        # Verify anomaly exists and belongs to user
        anomaly = await anomaly_repo.get_anomaly(data.anomaly_id, current_user)

        # Check if report already exists
        existing_report = await anomaly_repo.get_anomaly_report_by_anomaly_id(
            data.anomaly_id,
            current_user
        )

        if existing_report:
            raise HTTPException(
                status_code=409,
                detail="Report already exists for this anomaly"
            )

        # Create report
        report = await anomaly_repo.create_anomaly_report(
            user_id=str(current_user.id),
            dataset_id=data.dataset_id,
            anomaly_id=data.anomaly_id
        )

        logger.info(f"Anomaly report {report.id} created by user {current_user.username}")

        # TODO: Trigger async triage analysis
        # triage_anomaly_task.delay(report.id)

        return report

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating anomaly report: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create report")


@router.patch("/anomaly-reports/{report_id}", response_model=AnomalyReport)
async def update_anomaly_report(
    report_id: str,
    update_data: AnomalyReportUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Update anomaly report status and user actions.

    Allows users to:
    - Change status (under_review, resolved, false_positive)
    - Assign to team member
    - Add resolution notes
    - Provide feedback on false positives
    """
    try:
        report = await anomaly_repo.update_anomaly_report(
            report_id=report_id,
            current_user=current_user,
            update_data=update_data
        )

        logger.info(f"Anomaly report {report_id} updated by user {current_user.username}")
        return report

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating report {report_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update report")


@router.delete("/anomaly-reports/{report_id}", status_code=204)
async def delete_anomaly_report(
    report_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an anomaly report"""
    try:
        success = await anomaly_repo.delete_anomaly_report(report_id, current_user)
        if not success:
            raise HTTPException(status_code=404, detail="Report not found")

        logger.info(f"Anomaly report {report_id} deleted by user {current_user.username}")
        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting report {report_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete report")


@router.get("/anomaly-reports/{report_id}/export")
async def export_anomaly_report(
    report_id: str,
    format: str = Query("pdf", regex="^(pdf|excel|json)$", description="Export format"),
    current_user: User = Depends(get_current_user)
):
    """
    Export anomaly report to PDF, Excel, or JSON.

    Formats:
    - pdf: Professional report with all triage details
    - excel: Tabular format for further analysis
    - json: Raw data for integration
    """
    try:
        # Get report
        report = await anomaly_repo.get_anomaly_report(report_id, current_user)

        # Get associated anomaly
        anomaly = await anomaly_repo.get_anomaly(report.anomaly_id, current_user)

        # Get dataset info
        dataset = await anomaly_repo.get_dataset(report.dataset_id, current_user)

        if format == "json":
            # Return JSON directly
            import json
            from fastapi.responses import Response

            export_data = {
                "report": report.model_dump(mode='json'),
                "anomaly": anomaly.model_dump(mode='json'),
                "dataset": {
                    "filename": dataset.filename,
                    "uploaded_at": dataset.uploaded_at.isoformat()
                }
            }

            return Response(
                content=json.dumps(export_data, indent=2, default=str),
                media_type="application/json",
                headers={
                    "Content-Disposition": f"attachment; filename=anomaly_report_{report_id}.json"
                }
            )

        elif format == "pdf":
            # TODO: Generate PDF using reportlab
            # For now, return placeholder
            raise HTTPException(
                status_code=501,
                detail="PDF export not yet implemented. Use 'json' format for now."
            )

        elif format == "excel":
            # TODO: Generate Excel using openpyxl
            raise HTTPException(
                status_code=501,
                detail="Excel export not yet implemented. Use 'json' format for now."
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting report {report_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export report")


# ============================================================================
# ANALYSIS SESSION ROUTES
# ============================================================================

@router.get("/analysis-sessions/{session_id}", response_model=AnalysisSession)
async def get_analysis_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get analysis session details for progress tracking.

    Returns:
    - Current status and progress percentage
    - Number of anomalies detected so far
    - Current processing step
    - Error message if failed
    """
    try:
        session = await anomaly_repo.get_analysis_session(session_id, current_user)
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve session")


@router.get("/datasets/{dataset_id}/session", response_model=AnalysisSession)
async def get_dataset_session(
    dataset_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get analysis session for a specific dataset.

    Useful for polling progress during analysis.
    """
    try:
        session = await anomaly_repo.get_session_by_dataset(dataset_id, current_user)

        if not session:
            raise HTTPException(
                status_code=404,
                detail="No analysis session found for this dataset"
            )

        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving session for dataset {dataset_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve session")


# ============================================================================
# STATISTICS & ANALYTICS ROUTES
# ============================================================================

@router.get("/statistics")
async def get_user_statistics(
    current_user: User = Depends(get_current_user)
):
    """
    Get summary statistics for user's anomaly detection activity.

    Returns:
    - Total datasets, anomalies, reports
    - Breakdown by severity (low/medium/high/critical)
    - Breakdown by status (pending/triaged/resolved/etc)
    """
    try:
        stats = await anomaly_repo.get_user_statistics(current_user)
        return stats
    except Exception as e:
        logger.error(f"Error retrieving statistics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check endpoint for anomaly detection system"""
    return {
        "status": "healthy",
        "service": "anomaly-detection",
        "timestamp": datetime.utcnow().isoformat()
    }
