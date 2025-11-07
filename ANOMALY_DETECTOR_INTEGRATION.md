# Anomaly Detector Integration Guide

## Overview

The `anomaly_detector.py` adapts the autoencoder model from `Model/AutoEncoder/` for generic Excel tabular data. It provides a simple API for detecting anomalies in uploaded datasets.

---

## Architecture

```
User uploads Excel → Parse with pandas → anomaly_detector.py → Detected anomalies → Store in DB → Foundation-Sec-8B triage
```

### Key Components

1. **`TabularAnomalyDetector`**: Main class for training and detecting anomalies
2. **`detect_anomalies_in_excel()`**: High-level function for simple integration

---

## How It Works

### 1. Preprocessing
- **Automatic column detection**: Identifies numeric and categorical columns
- **Encoding**: Label encodes categorical features
- **Scaling**: StandardScaler for numeric features
- **Missing values**: Imputed with mean strategy

### 2. Autoencoder Architecture
```
Input (n_features) → Dense(64) → Dense(32) → Latent(8) → Dense(32) → Dense(64) → Output (n_features)
```
- Trains on **reconstruction task** (input = output)
- Anomalies have **higher reconstruction error**
- Threshold set at 95th percentile of training errors

### 3. Anomaly Detection
- Calculates per-row reconstruction error
- Flags rows exceeding threshold
- Identifies top 3 anomalous features per row

---

## Integration with Backend

### Step 1: Install Dependencies

The backend `requirements.txt` has been updated with:
```
scikit-learn>=1.3.0
tensorflow>=2.13.0
keras>=2.13.0
h5py>=3.9.0
```

**Rebuild the backend container:**
```bash
cd backend
docker-compose up --build -d backend
```

---

### Step 2: Usage in `anomaly_routes.py`

After a dataset is uploaded, trigger anomaly detection:

```python
from app.utils.anomaly_detector import detect_anomalies_in_excel
import pandas as pd
from app.core.s3_manager import s3_manager

@router.post("/datasets/{dataset_id}/analyze")
async def analyze_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user)
):
    """Trigger anomaly detection on uploaded dataset"""

    # 1. Get dataset from DB
    dataset = await anomaly_repo.get_dataset_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # 2. Download Excel from S3
    file_stream = s3_manager.get_object_stream(dataset.s3_key)

    # 3. Parse Excel to DataFrame
    df = pd.read_excel(file_stream, sheet_name=0)

    # 4. Detect anomalies
    anomalies, detector = detect_anomalies_in_excel(
        df=df,
        model_path=None,  # Will train a new model
        train_if_needed=True
    )

    # 5. Store anomalies in database
    for anomaly in anomalies:
        await anomaly_repo.create_anomaly(
            dataset_id=dataset_id,
            user_id=str(current_user.id),
            anomaly_score=anomaly["anomaly_score"],
            row_index=anomaly["row_index"],
            sheet_name="Sheet1",
            raw_data=anomaly["raw_data"],
            anomalous_features=anomaly["anomalous_features"]
        )

    # 6. Update dataset status
    await anomaly_repo.update_dataset(
        dataset_id=dataset_id,
        updates={"status": "completed", "anomaly_count": len(anomalies)}
    )

    return {
        "dataset_id": dataset_id,
        "anomalies_detected": len(anomalies),
        "total_rows": len(df)
    }
```

---

### Step 3: Create Celery Task for Async Processing

Create `app/tasks/anomaly_tasks.py`:

```python
from app.core.celery_manager import celery_app
from app.utils.anomaly_detector import detect_anomalies_in_excel
from app.repositories import anomaly_repo
from app.core.s3_manager import s3_manager
import pandas as pd
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True)
def analyze_dataset_task(self, dataset_id: str, user_id: str):
    """
    Celery task to analyze dataset for anomalies.

    Args:
        dataset_id: Dataset ID
        user_id: User ID
    """
    try:
        # Update status to processing
        anomaly_repo.update_dataset_sync(
            dataset_id=dataset_id,
            updates={"status": "processing"}
        )

        # Get dataset
        dataset = anomaly_repo.get_dataset_by_id_sync(dataset_id)

        # Download from S3
        file_stream = s3_manager.get_object_stream(dataset["s3_key"])
        df = pd.read_excel(file_stream, sheet_name=0)

        logger.info(f"Analyzing {len(df)} rows from dataset {dataset_id}")

        # Detect anomalies
        anomalies, detector = detect_anomalies_in_excel(
            df=df,
            model_path=None,
            train_if_needed=True
        )

        # Store anomalies
        for anomaly in anomalies:
            anomaly_repo.create_anomaly_sync(
                dataset_id=dataset_id,
                user_id=user_id,
                anomaly_score=anomaly["anomaly_score"],
                row_index=anomaly["row_index"],
                sheet_name="Sheet1",
                raw_data=anomaly["raw_data"],
                anomalous_features=anomaly["anomalous_features"]
            )

        # Update dataset
        anomaly_repo.update_dataset_sync(
            dataset_id=dataset_id,
            updates={
                "status": "completed",
                "anomaly_count": len(anomalies)
            }
        )

        logger.info(f"Analysis complete: {len(anomalies)} anomalies detected")

        return {
            "dataset_id": dataset_id,
            "anomalies_detected": len(anomalies),
            "total_rows": len(df)
        }

    except Exception as e:
        logger.error(f"Error analyzing dataset {dataset_id}: {str(e)}")
        anomaly_repo.update_dataset_sync(
            dataset_id=dataset_id,
            updates={"status": "failed", "error_message": str(e)}
        )
        raise
```

---

### Step 4: Trigger Analysis on Upload

Update `anomaly_routes.py` upload endpoint:

```python
@router.post("/datasets/upload", response_model=DatasetModel, status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload Excel dataset and trigger anomaly detection"""

    # ... existing upload code ...

    # After successful upload, trigger async analysis
    from app.tasks.anomaly_tasks import analyze_dataset_task
    analyze_dataset_task.delay(str(dataset.id), str(current_user.id))

    return dataset
```

---

## API Usage Examples

### 1. Simple Detection (Synchronous)

```python
import pandas as pd
from app.utils.anomaly_detector import detect_anomalies_in_excel

# Load Excel data
df = pd.read_excel("data.xlsx")

# Detect anomalies
anomalies, detector = detect_anomalies_in_excel(df)

# Review results
for anomaly in anomalies:
    print(f"Row {anomaly['row_index']}: Score = {anomaly['anomaly_score']:.3f}")
    print(f"  Anomalous features: {[f['feature_name'] for f in anomaly['anomalous_features']]}")
```

### 2. Train Once, Use Many Times

```python
from app.utils.anomaly_detector import TabularAnomalyDetector

# Train on clean dataset
detector = TabularAnomalyDetector(encoding_dim=8, threshold_percentile=95)
detector.train(clean_df, epochs=50)

# Save model
detector.save("models/my_detector/")

# Later, load and use
detector = TabularAnomalyDetector.load("models/my_detector/")
anomalies = detector.detect_anomalies(new_df)
```

---

## Output Format

Each anomaly is a dictionary:

```python
{
    "row_index": 42,                    # Row number in DataFrame (0-indexed)
    "anomaly_score": 15.3456,           # Reconstruction error (MSE)
    "anomalous_features": [             # Top 3 suspicious features
        {
            "feature_name": "transaction_amount",
            "actual_value": 999999.0,
            "reconstruction_error": 8.234
        },
        {
            "feature_name": "user_age",
            "actual_value": -5.0,
            "reconstruction_error": 5.123
        },
        ...
    ],
    "raw_data": {                       # Full row data
        "transaction_amount": 999999.0,
        "user_age": -5.0,
        "status": "active",
        ...
    }
}
```

---

## Configuration

### Tuning Parameters

```python
detector = TabularAnomalyDetector(
    encoding_dim=8,           # Latent dimension (smaller = more compression)
    threshold_percentile=95   # Anomaly threshold (95 = top 5% are anomalies)
)

detector.train(
    df,
    epochs=50,               # Training epochs
    batch_size=32,           # Batch size
    validation_split=0.2     # Validation split
)
```

**Recommendations:**
- **Highly imbalanced data**: `threshold_percentile=99` (fewer false positives)
- **Security/fraud detection**: `threshold_percentile=90` (more sensitive)
- **Large datasets (>10K rows)**: `batch_size=256`
- **Small datasets (<1K rows)**: `encoding_dim=4`, `epochs=30`

---

## Fallback Without TensorFlow

If TensorFlow is not available, the code will log a warning and raise an error. For production, consider:

1. **Pre-train models offline** and load them at runtime
2. **Use Isolation Forest** as a lightweight fallback:

```python
from sklearn.ensemble import IsolationForest

def detect_with_isolation_forest(df):
    # Preprocess
    X = df.select_dtypes(include=[np.number]).fillna(0).values

    # Train
    clf = IsolationForest(contamination=0.05, random_state=42)
    predictions = clf.fit_predict(X)

    # Get anomalies (predictions == -1)
    anomaly_indices = np.where(predictions == -1)[0]

    return anomaly_indices
```

---

## Next Steps

1. **Rebuild backend** with new dependencies
2. **Create Celery task** for async processing
3. **Test with sample Excel file**
4. **Integrate Foundation-Sec-8B** triage for detected anomalies
5. **Build frontend dashboard** to view anomalies

---

## Differences from Original Model

| Original (BETH) | Adapted (Excel) |
|-----------------|-----------------|
| System call sequences | Tabular rows |
| Temporal patterns | Static features |
| Sequence length: 50 | Row-by-row |
| Specific columns | Auto-detect columns |
| Trained on benign logs | Train on full dataset |

---

## Testing

```bash
# Install dependencies
docker-compose exec backend pip install scikit-learn tensorflow keras h5py

# Test in Python shell
docker-compose exec backend python
>>> from app.utils.anomaly_detector import TabularAnomalyDetector, TF_AVAILABLE
>>> print("TensorFlow available:", TF_AVAILABLE)
```

If TensorFlow is available, you're ready to use the anomaly detector! 🚀
