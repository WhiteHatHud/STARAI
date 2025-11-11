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
import asyncio
from datetime import datetime
from pymongo.errors import DuplicateKeyError
from bson import ObjectId

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
        logger.info(f"Fetching datasets for user {current_user.id}, status={status}, limit={limit}")
        datasets = await anomaly_repo.get_user_datasets(
            current_user=current_user,
            status=status,
            limit=limit
        )
        logger.info(f"Successfully retrieved {len(datasets)} datasets for user {current_user.id}")
        return datasets
    except Exception as e:
        logger.error(f"Error retrieving datasets for user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve datasets: {str(e)}")


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


@router.post("/datasets/{dataset_id}/analyze", status_code=202)
async def start_analysis(
    dataset_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Start autoencoder analysis on uploaded dataset (single active session).

    Returns immediately with session_id while analysis runs in background.
    Poll /datasets/{dataset_id}/status for progress.
    """
    try:
        # Get dataset and verify ownership
        dataset = await anomaly_repo.get_dataset(dataset_id, current_user)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Check for existing active session (reuse if exists)
        from app.database.connection import analysis_sessions_collection
        existing = analysis_sessions_collection.find_one({
            "dataset_id": dataset_id,
            "status": {"$in": ["initializing", "parsing", "detecting"]}
        })

        if existing:
            logger.info(f"Reusing existing session {existing['_id']} for dataset {dataset_id}")
            return {"session_id": str(existing["_id"]), "reused": True}

        # Create new session
        try:
            session_doc = {
                "dataset_id": dataset_id,
                "user_id": str(current_user.id),
                "status": "initializing",  # Changed from "pending" to "initializing"
                "progress": 0,
                "created_at": datetime.utcnow()
            }
            result = analysis_sessions_collection.insert_one(session_doc)
            session_id = str(result.inserted_id)
        except DuplicateKeyError:
            # Race condition - another request created it first
            existing = analysis_sessions_collection.find_one({
                "dataset_id": dataset_id,
                "status": {"$in": ["initializing", "parsing", "detecting"]}
            })
            if existing:
                return {"session_id": str(existing["_id"]), "reused": True}
            raise HTTPException(status_code=409, detail="Session conflict")

        # Update dataset status to processing
        await anomaly_repo.update_dataset(
            dataset_id=dataset_id,
            updates={"status": "analyzing", "progress": 0}
        )

        # Kick off background task
        asyncio.create_task(run_autoencoder_background(dataset_id, str(current_user.id)))

        logger.info(f"Started analysis session {session_id} for dataset {dataset_id}")
        return {"session_id": session_id, "reused": False}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting analysis for dataset {dataset_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start analysis: {str(e)}")


async def run_autoencoder_background(dataset_id: str, user_id: str):
    """Background task to run autoencoder analysis using AutoEncodeFinal.py"""
    try:
        from app.database.connection import datasets_collection
        import sys
        from pathlib import Path
        import tempfile
        import os

        logger.info(f"Starting background analysis for dataset {dataset_id}")

        # Add service directory to path to import AutoEncodeFinal
        # In Docker: /app/backend/service, Local: ../service relative to this file
        service_dir_docker = Path("/app/backend/service")
        service_dir_local = Path(__file__).resolve().parent.parent.parent / "service"

        if service_dir_docker.exists():
            service_dir = service_dir_docker
        else:
            service_dir = service_dir_local

        sys.path.insert(0, str(service_dir))

        logger.info(f"Added service directory to path: {service_dir}")

        try:
            from AutoEncodeFinal import run_anomaly_detection
            logger.info("Successfully imported AutoEncodeFinal")
        except Exception as import_error:
            logger.error(f"Failed to import AutoEncodeFinal: {str(import_error)}", exc_info=True)
            raise

        # Get dataset info
        dataset_doc = datasets_collection.find_one({"_id": ObjectId(dataset_id)})
        if not dataset_doc:
            logger.error(f"Dataset {dataset_id} not found")
            return

        # Update progress: downloading
        await anomaly_repo.update_dataset(
            dataset_id=dataset_id,
            updates={"status": "analyzing", "progress": 10}
        )

        # Download file from S3 and save locally
        logger.info(f"Downloading dataset {dataset_id} from S3: {dataset_doc['s3_key']}")
        file_content = s3_manager.get_object_stream(dataset_doc['s3_key']).read()

        # Save to temp directory
        temp_dir = tempfile.gettempdir()
        dataset_filename = f"dataset_{dataset_id}.csv"
        dataset_path = os.path.join(temp_dir, dataset_filename)

        # Write file to disk
        await anomaly_repo.update_dataset(
            dataset_id=dataset_id,
            updates={"progress": 20}
        )

        is_csv = dataset_doc['filename'].lower().endswith('.csv')
        if is_csv:
            with open(dataset_path, 'wb') as f:
                f.write(file_content)
        else:
            # Convert Excel to CSV
            from io import BytesIO
            df = pd.read_excel(BytesIO(file_content), sheet_name=0)
            df.to_csv(dataset_path, index=False)

        logger.info(f"Saved dataset to: {dataset_path}")

        # Update progress: running analysis
        await anomaly_repo.update_dataset(
            dataset_id=dataset_id,
            updates={"progress": 30}
        )

        # Determine model directory path
        # In Docker: /app/Model/AutoEncoder, Local: ../../Model/AutoEncoder from service
        model_dir_docker = Path("/app/Model/AutoEncoder")
        model_dir_local = service_dir.parent.parent / "Model" / "AutoEncoder"

        if model_dir_docker.exists():
            model_dir = model_dir_docker
        else:
            model_dir = model_dir_local

        logger.info(f"Using model directory: {model_dir}")

        # Create output directory for results
        output_dir = os.path.join(temp_dir, f"results_{dataset_id}")
        os.makedirs(output_dir, exist_ok=True)

        # Run AutoEncodeFinal analysis
        logger.info("Running AutoEncodeFinal anomaly detection...")
        results = run_anomaly_detection(
            dataset_path=dataset_path,
            model_dir=str(model_dir),
            output_dir=output_dir
        )

        logger.info(f"Analysis complete: {results['anomaly_count']} anomalies found")

        # Update progress: storing results
        await anomaly_repo.update_dataset(
            dataset_id=dataset_id,
            updates={"progress": 70}
        )

        # Read top 2 critical anomalies and store in database
        stored_count = 0
        top_2_path = results.get('top_2_path')

        if top_2_path and os.path.exists(top_2_path):
            logger.info(f"Reading top 2 critical anomalies from: {top_2_path}")
            top_2_df = pd.read_csv(top_2_path)

            # Get normalization values from results
            max_error = results.get('max_reconstruction_error', top_2_df['reconstruction_error'].max())
            mean_error = results.get('mean_reconstruction_error', top_2_df['reconstruction_error'].mean())
            threshold = 2.62  # From AutoEncodeFinal.py

            for _, row in top_2_df.iterrows():
                try:
                    reconstruction_error = float(row['reconstruction_error'])

                    # Normalize reconstruction error to 0-1 range for database schema
                    # Use max_error as upper bound
                    normalized_score = min(reconstruction_error / max_error, 1.0) if max_error > 0 else 0.0

                    # Extract relevant columns for storage (keep raw error for forensics)
                    raw_data = {k: v for k, v in row.to_dict().items()
                               if k not in ['sequence_index', 'priority']}
                    # Preserve raw reconstruction error in raw_data
                    raw_data['reconstruction_error'] = reconstruction_error
                    raw_data['priority'] = str(row.get('priority', 'UNKNOWN'))

                    # Calculate deviation description
                    if mean_error > 0:
                        deviation_multiplier = reconstruction_error / mean_error
                        if deviation_multiplier >= threshold:
                            deviation = f"+{deviation_multiplier:.1f}x above mean (threshold: {threshold})"
                        else:
                            deviation = f"{deviation_multiplier:.1f}x mean"
                    else:
                        deviation = f"error: {reconstruction_error:.2f}"

                    await anomaly_repo.create_anomaly(
                        dataset_id=dataset_id,
                        user_id=user_id,
                        anomaly_score=normalized_score,  # Normalized to 0-1
                        row_index=int(row.get('sequence_index', 0)),
                        sheet_name="Sheet1",
                        raw_data=raw_data,
                        anomalous_features=[
                            {
                                "feature_name": "reconstruction_error",
                                "actual_value": reconstruction_error,
                                "expected_value": mean_error,
                                "deviation": deviation,
                                "contribution_score": normalized_score  # Same as anomaly_score
                            }
                        ]
                    )
                    stored_count += 1
                except Exception as e:
                    logger.error(f"Error storing anomaly: {str(e)}")

        # Update progress: finalizing
        await anomaly_repo.update_dataset(
            dataset_id=dataset_id,
            updates={"progress": 90}
        )

        # Mark as analyzed (ready for LLM)
        await anomaly_repo.update_dataset(
            dataset_id=dataset_id,
            updates={
                "status": "analyzed",
                "progress": 100,
                "anomaly_count": results['anomaly_count'],
                "analyzed_at": datetime.utcnow(),
                "top_2_critical_path": top_2_path,
                "full_results_path": results.get('full_results_path'),
                "precision": results.get('precision'),
                "recall": results.get('recall'),
                "f1_score": results.get('f1_score')
            }
        )

        logger.info(f"Analysis complete for dataset {dataset_id}: {stored_count} top anomalies stored (Total: {results['anomaly_count']})")

        # Cleanup temp dataset file
        try:
            if os.path.exists(dataset_path):
                os.remove(dataset_path)
                logger.info(f"Cleaned up temp file: {dataset_path}")
        except Exception as e:
            logger.warning(f"Failed to cleanup temp file: {str(e)}")

    except Exception as e:
        logger.error(f"Error in background autoencoder task: {str(e)}", exc_info=True)
        try:
            await anomaly_repo.update_dataset(
                dataset_id=dataset_id,
                updates={"status": "error", "error": str(e), "progress": 0}
            )
        except:
            pass

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


@router.get("/datasets/{dataset_id}/status")
async def get_dataset_status(
    dataset_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get dataset status for polling during analysis.

    Returns:
    - status: Current dataset status
    - progress: Progress percentage (0-100)
    - error: Error message if failed
    """
    try:
        dataset = await anomaly_repo.get_dataset(dataset_id, current_user)

        return {
            "status": dataset.status,
            "progress": getattr(dataset, 'progress', 0),
            "error": getattr(dataset, 'error', None),
            "anomaly_count": dataset.anomaly_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving status for dataset {dataset_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve dataset status")


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


# ============================================================================
# LLM TRIAGE ANALYSIS ROUTES
# ============================================================================

@router.post("/datasets/{dataset_id}/start-llm-analysis")
async def start_llm_triage_analysis(
    dataset_id: str,
    max_anomalies: int = Query(default=2, ge=1, le=500, description="Maximum number of anomalies to analyze (default: 2 for faster testing)"),
    current_user: User = Depends(get_current_user)
):
    """
    STEP 3: Start LLM triage analysis on detected anomalies.

    This endpoint:
    1. Verifies dataset has status 'analyzed' (autoencoder completed)
    2. Fetches all detected anomalies for the dataset
    3. Sorts anomalies by score (highest/most suspicious first)
    4. Sends top N anomalies to Azure OpenAI GPT-5-mini for triage analysis
    5. Stores the LLM explanations in the database
    6. Updates dataset status to 'completed'
    7. Returns summary of analysis

    By default, only analyzes top 2 anomalies for faster testing and lower token usage.
    Increase max_anomalies parameter for production use.

    Call this AFTER /datasets/{dataset_id}/start-autoencoder completes.

    Requires Azure OpenAI to be configured in environment variables.
    """
    try:
        from app.utils.llm_triage import analyze_anomaly_with_llm, AZURE_CONFIGURED

        if not AZURE_CONFIGURED:
            raise HTTPException(
                status_code=500,
                detail="Azure OpenAI is not configured. Please set AZURE_OPENAI_ENDPOINT, "
                       "AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, and AZURE_OPENAI_API_VERSION "
                       "environment variables."
            )

        # Get dataset and verify ownership
        dataset = await anomaly_repo.get_dataset(dataset_id, current_user)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Verify dataset has been analyzed (autoencoder completed)
        if dataset.status != DatasetStatus.ANALYZED:
            raise HTTPException(
                status_code=400,
                detail=f"Dataset must be analyzed first. Current status: {dataset.status}. "
                       f"Call /datasets/{dataset_id}/start-autoencoder first."
            )

        # Update status to 'triaging'
        await anomaly_repo.update_dataset(
            dataset_id=dataset_id,
            updates={"status": "triaging"}
        )

        logger.info(f"Starting LLM triage analysis for dataset {dataset_id}")

        # Get all anomalies for this dataset
        anomalies = await anomaly_repo.get_dataset_anomalies(
            dataset_id=dataset_id,
            current_user=current_user
        )

        if not anomalies:
            raise HTTPException(
                status_code=404,
                detail="No anomalies found for this dataset. Run anomaly detection first."
            )

        # Sort anomalies by score (highest/most suspicious first)
        anomalies_sorted = sorted(anomalies, key=lambda x: x.anomaly_score, reverse=True)
        logger.info(f"Found {len(anomalies_sorted)} anomalies. Scores range: {anomalies_sorted[0].anomaly_score:.4f} to {anomalies_sorted[-1].anomaly_score:.4f}")

        # Limit to top N anomalies for LLM analysis
        if len(anomalies_sorted) > max_anomalies:
            logger.info(f"Limiting LLM analysis to top {max_anomalies} highest-scoring anomalies (total: {len(anomalies_sorted)})")
            anomalies_to_analyze = anomalies_sorted[:max_anomalies]
        else:
            anomalies_to_analyze = anomalies_sorted

        logger.info(f"Analyzing {len(anomalies_to_analyze)} anomalies with LLM (scores: {[f'{a.anomaly_score:.4f}' for a in anomalies_to_analyze]})")

        # Process each anomaly
        explanations_created = 0
        explanations_skipped = 0
        errors = []

        for anomaly in anomalies_to_analyze:
            try:
                # Check if explanation already exists
                existing_explanation = await anomaly_repo.get_llm_explanation_by_anomaly_id(anomaly.id)

                if existing_explanation:
                    logger.debug(f"Skipping anomaly {anomaly.id} - explanation already exists")
                    explanations_skipped += 1
                    continue

                # Prepare anomaly data for LLM
                anomaly_data = {
                    "timestamp": anomaly.detected_at.isoformat() if anomaly.detected_at else None,
                    "anomaly_score": anomaly.anomaly_score,
                    "row_index": anomaly.row_index,
                    "sheet_name": anomaly.sheet_name,
                    "raw_data": anomaly.raw_data,
                    "anomalous_features": [f.model_dump() for f in anomaly.anomalous_features] if anomaly.anomalous_features else [],
                }

                # Call LLM
                explanation_data = analyze_anomaly_with_llm(
                    anomaly_data=anomaly_data,
                    dataset_id=dataset_id,
                    anomaly_id=anomaly.id,
                    session_id=None
                )

                # Store explanation
                await anomaly_repo.create_llm_explanation(explanation_data)
                explanations_created += 1

                if explanations_created % 10 == 0:
                    logger.info(f"Processed {explanations_created}/{len(anomalies_to_analyze)} anomalies")

            except Exception as e:
                error_msg = f"Error analyzing anomaly {anomaly.id}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                # Continue with next anomaly

        logger.info(f"LLM analysis complete: {explanations_created} created, {explanations_skipped} skipped, {len(errors)} errors")

        # Update dataset status to COMPLETED
        await anomaly_repo.update_dataset(
            dataset_id=dataset_id,
            updates={
                "status": "completed",
                "triaged_at": datetime.utcnow()
            }
        )

        return {
            "dataset_id": dataset_id,
            "total_anomalies_detected": len(anomalies_sorted),
            "anomalies_analyzed_by_llm": len(anomalies_to_analyze),
            "explanations_created": explanations_created,
            "explanations_skipped": explanations_skipped,
            "errors": errors[:10],  # Limit errors in response
            "status": "completed" if len(errors) == 0 else "completed_with_errors",
            "note": f"Analyzed top {len(anomalies_to_analyze)} highest-scoring anomalies out of {len(anomalies_sorted)} total"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during LLM analysis for dataset {dataset_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"LLM analysis failed: {str(e)}")


@router.get("/datasets/{dataset_id}/llm-explanations")
async def get_dataset_llm_explanations(
    dataset_id: str,
    verdict: Optional[str] = Query(None, description="Filter by verdict (suspicious/likely_malicious/unclear)"),
    severity: Optional[str] = Query(None, description="Filter by severity (low/medium/high/critical)"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of explanations"),
    current_user: User = Depends(get_current_user)
):
    """
    Get all LLM explanations for a dataset.

    Returns detailed triage analysis including:
    - Verdict and severity
    - MITRE ATT&CK technique mappings
    - Key indicators
    - Triage recommendations (immediate/short-term/long-term)
    - Confidence scores
    """
    try:
        # Verify dataset ownership
        dataset = await anomaly_repo.get_dataset(dataset_id, current_user)

        explanations = await anomaly_repo.get_llm_explanations_by_dataset(
            dataset_id=dataset_id,
            verdict=verdict,
            severity=severity,
            limit=limit
        )

        return explanations

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving LLM explanations for dataset {dataset_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve LLM explanations")


@router.get("/llm-explanations/{explanation_id}")
async def get_llm_explanation(
    explanation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific LLM explanation by ID"""
    try:
        from bson import ObjectId

        doc = await anomaly_repo.llm_explanations_collection.find_one({"_id": ObjectId(explanation_id)})

        if not doc:
            raise HTTPException(status_code=404, detail="LLM explanation not found")

        # Verify ownership through dataset
        dataset = await anomaly_repo.get_dataset(doc["dataset_id"], current_user)

        from app.models.anomaly_models import LLMExplanation
        return LLMExplanation.model_validate(doc)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving LLM explanation {explanation_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve LLM explanation")
