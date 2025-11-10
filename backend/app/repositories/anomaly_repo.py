# app/repositories/anomaly_repo.py
"""
Repository layer for anomaly detection data access.
Handles CRUD operations for datasets, anomalies, triage reports, and analysis sessions.
"""

from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException
import logging

from app.database.connection import (
    datasets_collection,
    anomalies_collection,
    anomaly_reports_collection,
    analysis_sessions_collection,
    llm_explanations_collection
)
from app.models.anomaly_models import (
    DatasetModel,
    DatasetStatus,
    DetectedAnomaly,
    AnomalyStatus,
    AnomalyReport,
    ReportStatus,
    AnomalyReportUpdate,
    AnalysisSession,
    SessionStatus,
    SessionProgressUpdate,
    AnomalyReportSummary,
    DatasetSummary,
    SeverityLevel,
    LLMExplanation
)
from app.models.models import User

logger = logging.getLogger(__name__)


# ============================================================================
# DATASET REPOSITORY
# ============================================================================

async def create_dataset(
    user_id: str,
    filename: str,
    original_filename: str,
    s3_key: str,
    file_size: int,
    content_type: str
) -> DatasetModel:
    """Create a new dataset record after Excel upload"""
    dataset = DatasetModel(
        user_id=user_id,
        filename=filename,
        original_filename=original_filename,
        s3_key=s3_key,
        file_size=file_size,
        content_type=content_type,
        status=DatasetStatus.UPLOADED
    )

    # Prepare document for insertion
    dataset_dict = dataset.model_dump(by_alias=True)

    # CRITICAL FIX: Convert _id from string to ObjectId for MongoDB
    # PyObjectId is defined as a string type, but MongoDB needs actual ObjectId
    if "_id" in dataset_dict and isinstance(dataset_dict["_id"], str):
        dataset_dict["_id"] = ObjectId(dataset_dict["_id"])

    result = datasets_collection.insert_one(dataset_dict)
    dataset.id = str(result.inserted_id)

    logger.info(f"Created dataset {dataset.id} for user {user_id}")
    return dataset


async def get_dataset(dataset_id: str, current_user: User) -> DatasetModel:
    """Get a specific dataset by ID"""
    try:
        query = {"_id": ObjectId(dataset_id)}
    except Exception as e:
        logger.error(f"Invalid dataset ID format: {dataset_id}")
        raise HTTPException(status_code=400, detail=f"Invalid dataset ID format: {dataset_id}")

    # Non-admin users can only access their own datasets
    is_admin = getattr(current_user, "is_admin", False)

    if not is_admin:
        query["user_id"] = str(current_user.id)

    dataset_doc = datasets_collection.find_one(query)

    if not dataset_doc:
        logger.warning(f"Dataset {dataset_id} not found for user {current_user.id}")
        raise HTTPException(status_code=404, detail=f"Dataset not found or access denied")

    return DatasetModel.model_validate(dataset_doc)


async def get_user_datasets(
    current_user: User,
    status: Optional[DatasetStatus] = None,
    limit: int = 50
) -> List[DatasetSummary]:
    """Get all datasets for a user with optional status filter"""
    try:
        query = {"user_id": str(current_user.id)}
        logger.debug(f"Querying datasets with: {query}")

        if status:
            query["status"] = status.value

        cursor = datasets_collection.find(query).sort("uploaded_at", -1).limit(limit)
        datasets = list(cursor)
        logger.debug(f"Found {len(datasets)} datasets")

        # Build summaries with anomaly counts
        summaries = []
        for doc in datasets:
            try:
                dataset_id = str(doc["_id"])

                # Count anomalies for this dataset
                anomaly_count = anomalies_collection.count_documents({"dataset_id": dataset_id})

                summary = DatasetSummary(
                    id=dataset_id,
                    filename=doc.get("filename", "Unknown"),
                    total_rows=doc.get("total_rows", 0),
                    sheet_count=doc.get("sheet_count", 0),
                    status=doc.get("status", "uploaded"),
                    uploaded_at=doc.get("uploaded_at", datetime.now(timezone.utc)),
                    anomalies_detected=anomaly_count
                )
                summaries.append(summary)
            except Exception as e:
                logger.error(f"Error processing dataset {doc.get('_id')}: {str(e)}")
                # Skip this dataset and continue
                continue

        logger.info(f"Returning {len(summaries)} dataset summaries")
        return summaries

    except Exception as e:
        logger.error(f"Error in get_user_datasets: {str(e)}", exc_info=True)
        raise


async def update_dataset(
    dataset_id: str,
    updates: dict
) -> DatasetModel:
    """Update dataset with arbitrary fields"""
    datasets_collection.update_one(
        {"_id": ObjectId(dataset_id)},
        {"$set": updates}
    )

    logger.info(f"Updated dataset {dataset_id} with fields: {list(updates.keys())}")

    # Return updated document
    updated_doc = datasets_collection.find_one({"_id": ObjectId(dataset_id)})
    return DatasetModel.model_validate(updated_doc)


async def update_dataset_status(
    dataset_id: str,
    status: DatasetStatus,
    parsed_data: Optional[dict] = None,
    sheet_count: Optional[int] = None,
    total_rows: Optional[int] = None
) -> DatasetModel:
    """Update dataset status and parsed data"""
    update_data = {"status": status.value}

    if status == DatasetStatus.PARSED:
        update_data["parsed_at"] = datetime.now(timezone.utc)

    if parsed_data:
        update_data["parsed_data"] = parsed_data
    if sheet_count is not None:
        update_data["sheet_count"] = sheet_count
    if total_rows is not None:
        update_data["total_rows"] = total_rows

    datasets_collection.update_one(
        {"_id": ObjectId(dataset_id)},
        {"$set": update_data}
    )

    logger.info(f"Updated dataset {dataset_id} status to {status.value}")

    # Return updated document
    updated_doc = datasets_collection.find_one({"_id": ObjectId(dataset_id)})
    return DatasetModel.model_validate(updated_doc)


async def delete_dataset(dataset_id: str, current_user: User) -> bool:
    """Delete a dataset and all associated anomalies/reports, including S3 file"""
    # Verify ownership and get dataset info
    dataset = await get_dataset(dataset_id, current_user)

    # Delete S3 file
    try:
        from app.core.s3_manager import s3_manager
        s3_manager.delete_file(dataset.s3_key)
        logger.info(f"Deleted S3 file: {dataset.s3_key}")
    except Exception as e:
        logger.error(f"Error deleting S3 file {dataset.s3_key}: {str(e)}")
        # Continue with database deletion even if S3 deletion fails

    # Delete associated data
    anomalies_collection.delete_many({"dataset_id": dataset_id})
    anomaly_reports_collection.delete_many({"dataset_id": dataset_id})
    analysis_sessions_collection.delete_many({"dataset_id": dataset_id})

    # Delete dataset
    result = datasets_collection.delete_one({"_id": ObjectId(dataset_id)})

    logger.info(f"Deleted dataset {dataset_id} and associated data")
    return result.deleted_count > 0


async def delete_all_user_datasets(current_user: User) -> dict:
    """Delete ALL datasets for a user, including all S3 files and associated data"""
    from app.core.s3_manager import s3_manager

    # Get all user datasets directly from DB
    query = {"user_id": str(current_user.id)}
    cursor = datasets_collection.find(query)
    datasets = list(cursor)

    deleted_count = 0
    failed_count = 0

    for doc in datasets:
        dataset_id = None
        try:
            dataset_id = str(doc["_id"])
            s3_key = doc.get("s3_key")

            # Delete S3 file
            if s3_key:
                try:
                    s3_manager.delete_file(s3_key)
                    logger.info(f"Deleted S3 file: {s3_key}")
                except Exception as e:
                    logger.error(f"Error deleting S3 file {s3_key}: {str(e)}")
                    # Continue with database deletion even if S3 deletion fails

            # Delete associated data
            anomalies_collection.delete_many({"dataset_id": dataset_id})
            anomaly_reports_collection.delete_many({"dataset_id": dataset_id})
            analysis_sessions_collection.delete_many({"dataset_id": dataset_id})

            # Delete dataset
            result = datasets_collection.delete_one({"_id": doc["_id"]})
            if result.deleted_count > 0:
                deleted_count += 1
            else:
                failed_count += 1

        except Exception as e:
            logger.error(f"Error deleting dataset {dataset_id}: {str(e)}")
            failed_count += 1

    logger.info(f"Deleted {deleted_count} datasets for user {current_user.username}, {failed_count} failed")

    return {
        "deleted_count": deleted_count,
        "failed_count": failed_count,
        "total_processed": deleted_count + failed_count
    }


# ============================================================================
# ANOMALY REPOSITORY
# ============================================================================

async def create_anomaly(
    dataset_id: str,
    user_id: str,
    anomaly_score: float,
    row_index: int,
    sheet_name: str,
    raw_data: dict,
    anomalous_features: list
) -> DetectedAnomaly:
    """Create a detected anomaly record"""
    anomaly = DetectedAnomaly(
        dataset_id=dataset_id,
        user_id=user_id,
        anomaly_score=anomaly_score,
        row_index=row_index,
        sheet_name=sheet_name,
        raw_data=raw_data,
        anomalous_features=anomalous_features,
        status=AnomalyStatus.DETECTED
    )

    anomaly_dict = anomaly.model_dump(by_alias=True)

    # Convert _id from string to ObjectId
    if "_id" in anomaly_dict and isinstance(anomaly_dict["_id"], str):
        anomaly_dict["_id"] = ObjectId(anomaly_dict["_id"])

    result = anomalies_collection.insert_one(anomaly_dict)
    anomaly.id = str(result.inserted_id)

    logger.info(f"Created anomaly {anomaly.id} for dataset {dataset_id}")
    return anomaly


async def get_anomaly(anomaly_id: str, current_user: User) -> DetectedAnomaly:
    """Get a specific anomaly by ID"""
    query = {"_id": ObjectId(anomaly_id)}

    if not getattr(current_user, "is_admin", False):
        query["user_id"] = str(current_user.id)

    anomaly_doc = anomalies_collection.find_one(query)

    if not anomaly_doc:
        raise HTTPException(status_code=404, detail="Anomaly not found")

    return DetectedAnomaly.model_validate(anomaly_doc)


async def get_dataset_anomalies(
    dataset_id: str,
    current_user: User,
    status: Optional[AnomalyStatus] = None,
    min_score: Optional[float] = None
) -> List[DetectedAnomaly]:
    """Get all anomalies for a dataset"""
    # Verify dataset ownership
    await get_dataset(dataset_id, current_user)

    query = {"dataset_id": dataset_id}

    if status:
        query["status"] = status.value
    if min_score:
        query["anomaly_score"] = {"$gte": min_score}

    cursor = anomalies_collection.find(query).sort("anomaly_score", -1)
    anomalies = [DetectedAnomaly.model_validate(doc) for doc in cursor]

    return anomalies


async def update_anomaly_status(
    anomaly_id: str,
    status: AnomalyStatus
) -> DetectedAnomaly:
    """Update anomaly status"""
    update_data = {"status": status.value}

    if status == AnomalyStatus.TRIAGED:
        update_data["triaged_at"] = datetime.now(timezone.utc)

    anomalies_collection.update_one(
        {"_id": ObjectId(anomaly_id)},
        {"$set": update_data}
    )

    updated_doc = anomalies_collection.find_one({"_id": ObjectId(anomaly_id)})
    return DetectedAnomaly.model_validate(updated_doc)


# ============================================================================
# ANOMALY REPORT REPOSITORY
# ============================================================================

async def create_anomaly_report(
    user_id: str,
    dataset_id: str,
    anomaly_id: str
) -> AnomalyReport:
    """Create a new anomaly report"""
    report = AnomalyReport(
        user_id=user_id,
        dataset_id=dataset_id,
        anomaly_id=anomaly_id,
        status=ReportStatus.PENDING_TRIAGE
    )

    report_dict = report.model_dump(by_alias=True)

    # Convert _id from string to ObjectId
    if "_id" in report_dict and isinstance(report_dict["_id"], str):
        report_dict["_id"] = ObjectId(report_dict["_id"])

    result = anomaly_reports_collection.insert_one(report_dict)
    report.id = str(result.inserted_id)

    logger.info(f"Created anomaly report {report.id} for anomaly {anomaly_id}")
    return report


async def get_anomaly_report(report_id: str, current_user: User) -> AnomalyReport:
    """Get a specific anomaly report by ID"""
    query = {"_id": ObjectId(report_id)}

    if not getattr(current_user, "is_admin", False):
        query["user_id"] = str(current_user.id)

    report_doc = anomaly_reports_collection.find_one(query)

    if not report_doc:
        raise HTTPException(status_code=404, detail="Anomaly report not found")

    return AnomalyReport.model_validate(report_doc)


async def get_anomaly_report_by_anomaly_id(
    anomaly_id: str,
    current_user: User
) -> Optional[AnomalyReport]:
    """Get report for a specific anomaly"""
    query = {"anomaly_id": anomaly_id}

    if not getattr(current_user, "is_admin", False):
        query["user_id"] = str(current_user.id)

    report_doc = anomaly_reports_collection.find_one(query)

    if not report_doc:
        return None

    return AnomalyReport.model_validate(report_doc)


async def get_user_reports(
    current_user: User,
    status: Optional[ReportStatus] = None,
    dataset_id: Optional[str] = None,
    limit: int = 100
) -> List[AnomalyReportSummary]:
    """Get all anomaly reports for a user with optional filters"""
    query = {"user_id": str(current_user.id)}

    if status:
        query["status"] = status.value
    if dataset_id:
        query["dataset_id"] = dataset_id

    cursor = anomaly_reports_collection.find(query).sort("created_at", -1).limit(limit)

    summaries = []
    for report_doc in cursor:
        # Get associated anomaly and dataset info
        anomaly_doc = anomalies_collection.find_one({"_id": ObjectId(report_doc["anomaly_id"])})
        dataset_doc = datasets_collection.find_one({"_id": ObjectId(report_doc["dataset_id"])})

        if not anomaly_doc or not dataset_doc:
            continue

        # Extract severity and threat type from triage if available
        severity = None
        threat_type = None
        if report_doc.get("triage"):
            severity = report_doc["triage"].get("severity")
            if report_doc["triage"].get("threat_context"):
                threat_type = report_doc["triage"]["threat_context"].get("threat_type")

        summaries.append(AnomalyReportSummary(
            id=str(report_doc["_id"]),
            dataset_filename=dataset_doc["filename"],
            severity=severity,
            anomaly_score=anomaly_doc["anomaly_score"],
            status=report_doc["status"],
            created_at=report_doc["created_at"],
            threat_type=threat_type
        ))

    return summaries


async def update_anomaly_report(
    report_id: str,
    current_user: User,
    update_data: AnomalyReportUpdate
) -> AnomalyReport:
    """Update anomaly report (user actions)"""
    # Verify ownership
    await get_anomaly_report(report_id, current_user)

    update_dict = {}

    if update_data.status:
        update_dict["status"] = update_data.status.value

        if update_data.status == ReportStatus.UNDER_REVIEW:
            update_dict["reviewed_at"] = datetime.now(timezone.utc)
        elif update_data.status == ReportStatus.RESOLVED:
            update_dict["resolved_at"] = datetime.now(timezone.utc)

    if update_data.assigned_to:
        update_dict["assigned_to"] = update_data.assigned_to
    if update_data.resolution_notes:
        update_dict["resolution_notes"] = update_data.resolution_notes
    if update_data.user_feedback:
        update_dict["user_feedback"] = update_data.user_feedback

    if update_dict:
        anomaly_reports_collection.update_one(
            {"_id": ObjectId(report_id)},
            {"$set": update_dict}
        )

    return await get_anomaly_report(report_id, current_user)


async def add_triage_to_report(
    report_id: str,
    triage_data: dict
) -> AnomalyReport:
    """Add triage analysis to report (called by ML pipeline)"""
    update_data = {
        "triage": triage_data,
        "status": ReportStatus.TRIAGED.value,
        "triaged_at": datetime.now(timezone.utc)
    }

    anomaly_reports_collection.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": update_data}
    )

    logger.info(f"Added triage analysis to report {report_id}")

    updated_doc = anomaly_reports_collection.find_one({"_id": ObjectId(report_id)})
    return AnomalyReport.model_validate(updated_doc)


async def delete_anomaly_report(report_id: str, current_user: User) -> bool:
    """Delete an anomaly report"""
    # Verify ownership
    await get_anomaly_report(report_id, current_user)

    result = anomaly_reports_collection.delete_one({"_id": ObjectId(report_id)})

    logger.info(f"Deleted anomaly report {report_id}")
    return result.deleted_count > 0


# ============================================================================
# ANALYSIS SESSION REPOSITORY
# ============================================================================

async def create_analysis_session(
    user_id: str,
    dataset_id: str
) -> AnalysisSession:
    """Create a new analysis session"""
    session = AnalysisSession(
        user_id=user_id,
        dataset_id=dataset_id,
        status=SessionStatus.INITIALIZING,
        progress=0,
        current_step="Initializing analysis..."
    )

    session_dict = session.model_dump(by_alias=True)

    # Convert _id from string to ObjectId
    if "_id" in session_dict and isinstance(session_dict["_id"], str):
        session_dict["_id"] = ObjectId(session_dict["_id"])

    result = analysis_sessions_collection.insert_one(session_dict)
    session.id = str(result.inserted_id)

    logger.info(f"Created analysis session {session.id} for dataset {dataset_id}")
    return session


async def get_analysis_session(session_id: str, current_user: User) -> AnalysisSession:
    """Get analysis session by ID"""
    query = {"_id": ObjectId(session_id)}

    if not getattr(current_user, "is_admin", False):
        query["user_id"] = str(current_user.id)

    session_doc = analysis_sessions_collection.find_one(query)

    if not session_doc:
        raise HTTPException(status_code=404, detail="Analysis session not found")

    return AnalysisSession.model_validate(session_doc)


async def get_session_by_dataset(dataset_id: str, current_user: User) -> Optional[AnalysisSession]:
    """Get analysis session for a dataset"""
    query = {"dataset_id": dataset_id, "user_id": str(current_user.id)}

    session_doc = analysis_sessions_collection.find_one(query)

    if not session_doc:
        return None

    return AnalysisSession.model_validate(session_doc)


async def update_session_progress(
    session_id: str,
    status: SessionStatus,
    progress: int,
    current_step: str,
    anomalies_detected: Optional[int] = None,
    error_message: Optional[str] = None
) -> AnalysisSession:
    """Update session progress (called by async worker)"""
    update_data = {
        "status": status.value,
        "progress": progress,
        "current_step": current_step
    }

    if anomalies_detected is not None:
        update_data["anomalies_detected"] = anomalies_detected

    if error_message:
        update_data["error_message"] = error_message

    if status == SessionStatus.COMPLETED:
        now = datetime.now(timezone.utc)
        update_data["completed_at"] = now

        # Calculate processing time
        session_doc = analysis_sessions_collection.find_one({"_id": ObjectId(session_id)})
        if session_doc and "started_at" in session_doc:
            started = session_doc["started_at"]
            processing_time = (now - started).total_seconds()
            update_data["processing_time_seconds"] = processing_time

    analysis_sessions_collection.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": update_data}
    )

    updated_doc = analysis_sessions_collection.find_one({"_id": ObjectId(session_id)})
    return AnalysisSession.model_validate(updated_doc)


# ============================================================================
# STATISTICS AND ANALYTICS
# ============================================================================

async def get_user_statistics(current_user: User) -> dict:
    """Get summary statistics for user's anomaly detection activity"""
    user_id = str(current_user.id)

    total_datasets = datasets_collection.count_documents({"user_id": user_id})
    total_anomalies = anomalies_collection.count_documents({"user_id": user_id})
    total_reports = anomaly_reports_collection.count_documents({"user_id": user_id})

    # Count by severity
    pipeline = [
        {"$match": {"user_id": user_id, "triage": {"$exists": True}}},
        {"$group": {
            "_id": "$triage.severity",
            "count": {"$sum": 1}
        }}
    ]
    severity_counts = {doc["_id"]: doc["count"] for doc in anomaly_reports_collection.aggregate(pipeline)}

    # Count by status
    status_counts = {}
    for status in ReportStatus:
        count = anomaly_reports_collection.count_documents({
            "user_id": user_id,
            "status": status.value
        })
        status_counts[status.value] = count

    return {
        "total_datasets": total_datasets,
        "total_anomalies": total_anomalies,
        "total_reports": total_reports,
        "by_severity": severity_counts,
        "by_status": status_counts
    }


# ============================================================================
# LLM EXPLANATION REPOSITORY
# ============================================================================

async def create_llm_explanation(
    explanation_data: dict
) -> LLMExplanation:
    """
    Store an LLM-generated explanation for an anomaly.

    Args:
        explanation_data: Dictionary containing the LLM analysis

    Returns:
        LLMExplanation model instance
    """
    # Ensure timestamps are set
    if "_created_at" not in explanation_data:
        explanation_data["_created_at"] = datetime.now(timezone.utc)

    # Convert _id from string to ObjectId if present
    if "_id" in explanation_data and isinstance(explanation_data["_id"], str):
        explanation_data["_id"] = ObjectId(explanation_data["_id"])

    result = llm_explanations_collection.insert_one(explanation_data)
    explanation_data["_id"] = str(result.inserted_id)

    logger.info(f"Created LLM explanation for anomaly {explanation_data.get('anomaly_id')}")
    return LLMExplanation.model_validate(explanation_data)


async def get_llm_explanation_by_anomaly_id(
    anomaly_id: str
) -> Optional[LLMExplanation]:
    """
    Get LLM explanation for a specific anomaly.

    Args:
        anomaly_id: Anomaly ID

    Returns:
        LLMExplanation if found, None otherwise
    """
    doc = llm_explanations_collection.find_one({"anomaly_id": anomaly_id})

    if not doc:
        return None

    return LLMExplanation.model_validate(doc)


async def get_llm_explanations_by_dataset(
    dataset_id: str,
    verdict: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 100
) -> List[LLMExplanation]:
    """
    Get all LLM explanations for a dataset.

    Args:
        dataset_id: Dataset ID
        verdict: Optional filter by verdict (suspicious/likely_malicious/unclear)
        severity: Optional filter by severity (low/medium/high/critical)
        limit: Maximum number of explanations to return

    Returns:
        List of LLMExplanation instances
    """
    query = {"dataset_id": dataset_id}

    if verdict:
        query["verdict"] = verdict
    if severity:
        query["severity"] = severity

    cursor = llm_explanations_collection.find(query).sort("created_at", -1).limit(limit)
    explanations = [LLMExplanation.model_validate(doc) for doc in cursor]

    return explanations


async def update_llm_explanation_status(
    explanation_id: str,
    status: str,
    owner: Optional[str] = None
) -> LLMExplanation:
    """
    Update the status of an LLM explanation.

    Args:
        explanation_id: Explanation ID
        status: New status (new/reviewed/escalated/resolved/false_positive)
        owner: Optional owner assignment

    Returns:
        Updated LLMExplanation
    """
    update_data = {"status": status}

    if owner:
        update_data["owner"] = owner

    llm_explanations_collection.update_one(
        {"_id": ObjectId(explanation_id)},
        {"$set": update_data}
    )

    updated_doc = llm_explanations_collection.find_one({"_id": ObjectId(explanation_id)})
    return LLMExplanation.model_validate(updated_doc)


async def delete_llm_explanations_by_dataset(dataset_id: str) -> int:
    """
    Delete all LLM explanations for a dataset.

    Args:
        dataset_id: Dataset ID

    Returns:
        Number of explanations deleted
    """
    result = llm_explanations_collection.delete_many({"dataset_id": dataset_id})
    logger.info(f"Deleted {result.deleted_count} LLM explanations for dataset {dataset_id}")
    return result.deleted_count
