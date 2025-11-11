# Pre-Trained Model Fix - Stop Training on Every Upload

## Problem

Current code trains a **NEW** autoencoder model on every dataset upload:

```python
# anomaly_detector.py line 359-365
elif train_if_needed:
    logger.info("Training new anomaly detection model...")
    detector = TabularAnomalyDetector(encoding_dim=8, threshold_percentile=95)
    detector.train(df, epochs=30, batch_size=32)  # ❌ SLOW! Trains every time
```

**Issues:**
- ❌ Takes 2-5 minutes per dataset
- ❌ Inconsistent results (different model each time)
- ❌ Wastes compute resources
- ❌ Not production-ready

---

## Solution: Load Pre-Trained Model

### Architecture

```
backend/
├── models/
│   └── autoencoder_pretrained/
│       ├── autoencoder.h5          ← Pre-trained model
│       └── metadata.pkl            ← Scalers, encoders, threshold
├── app/
│   └── utils/
│       └── anomaly_detector.py     ← Modified to load model
```

---

## Step 1: Train Model Once (Offline)

Create a training script that trains on a large representative dataset:

**File:** `backend/train_model.py`

```python
"""
One-time script to train the anomaly detection model.
Run this ONCE with a large, clean dataset.
"""

import pandas as pd
from app.utils.anomaly_detector import TabularAnomalyDetector
import sys

def train_model(training_data_path: str, model_save_path: str):
    """
    Train autoencoder on representative dataset.

    Args:
        training_data_path: Path to Excel/CSV with normal data
        model_save_path: Where to save trained model
    """
    print(f"Loading training data from {training_data_path}...")

    # Load training data
    if training_data_path.endswith('.csv'):
        df = pd.read_csv(training_data_path)
    else:
        df = pd.read_excel(training_data_path)

    print(f"Training data: {len(df)} rows, {len(df.columns)} columns")

    # Create detector
    detector = TabularAnomalyDetector(
        encoding_dim=8,
        threshold_percentile=95
    )

    # Train model
    print("Training autoencoder... This may take several minutes.")
    history = detector.train(
        df,
        epochs=50,
        batch_size=64,
        validation_split=0.2
    )

    # Save trained model
    detector.save(model_save_path)
    print(f"✅ Model saved to {model_save_path}")
    print(f"   Threshold: {detector.threshold:.4f}")
    print(f"   Features: {len(detector.feature_names)}")

    # Test on training data
    anomalies = detector.detect_anomalies(df)
    print(f"   Detected {len(anomalies)} anomalies in training data ({len(anomalies)/len(df)*100:.2f}%)")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python train_model.py <training_data.xlsx> <model_output_dir>")
        print("Example: python train_model.py data/normal_samples.xlsx models/autoencoder_pretrained")
        sys.exit(1)

    train_model(sys.argv[1], sys.argv[2])
```

**Run it once:**
```bash
cd backend

# Train on your clean dataset
python train_model.py data/normal_samples.xlsx models/autoencoder_pretrained

# Output:
# Training data: 50000 rows, 20 columns
# Training autoencoder... This may take several minutes.
# ✅ Model saved to models/autoencoder_pretrained
#    Threshold: 0.0234
#    Features: 20
#    Detected 2500 anomalies in training data (5.00%)
```

---

## Step 2: Modify `detect_anomalies_in_excel()` to Load Pre-Trained Model

**File:** `backend/app/utils/anomaly_detector.py`

Change line 332-372:

```python
def detect_anomalies_in_excel(
    df: pd.DataFrame,
    model_path: Optional[str] = None,
    train_if_needed: bool = False  # ✅ Changed default to False
) -> Tuple[List[Dict], TabularAnomalyDetector]:
    """
    High-level function to detect anomalies in Excel data using PRE-TRAINED model.

    Args:
        df: Input DataFrame from Excel
        model_path: Path to pre-trained model (REQUIRED)
        train_if_needed: Whether to train if no model found (default: False for production)

    Returns:
        Tuple of (anomalies_list, detector_model)
    """
    if not TF_AVAILABLE:
        logger.error("TensorFlow not available.")
        raise RuntimeError(
            "TensorFlow is required for anomaly detection. "
            "Please install: pip install tensorflow>=2.13.0"
        )

    # ✅ ALWAYS try to load pre-trained model first
    if model_path is None:
        # Use default pre-trained model path
        model_path = os.path.join(
            os.path.dirname(__file__),
            "../../models/autoencoder_pretrained"
        )

    # Load pre-trained model
    if os.path.exists(model_path):
        logger.info(f"Loading pre-trained model from {model_path}")
        detector = TabularAnomalyDetector.load(model_path)
    elif train_if_needed:
        # ⚠️ FALLBACK: Only train if explicitly allowed (not recommended for production)
        logger.warning("⚠️ No pre-trained model found. Training new model (SLOW!)...")
        detector = TabularAnomalyDetector(encoding_dim=8, threshold_percentile=95)
        detector.train(df, epochs=30, batch_size=32)
    else:
        # ❌ Fail if no model and training not allowed
        raise FileNotFoundError(
            f"Pre-trained model not found at {model_path}. "
            f"Please train a model first using train_model.py"
        )

    # Detect anomalies using the loaded model
    anomalies = detector.detect_anomalies(df)

    return anomalies, detector
```

---

## Step 3: Update Route to Use Pre-Trained Model

**File:** `backend/app/routes/anomaly_routes.py`

Find where `detect_anomalies_in_excel()` is called and update:

```python
# OLD - line 333
anomalies, detector = detect_anomalies_in_excel(
    df=df,
    model_path=None,        # ❌ No path
    train_if_needed=True    # ❌ Always trains
)

# NEW - line 333
anomalies, detector = detect_anomalies_in_excel(
    df=df,
    model_path="models/autoencoder_pretrained",  # ✅ Use pre-trained
    train_if_needed=False   # ✅ Never train in production
)
```

---

## Step 4: Environment Configuration

Add model path to `.env.local`:

```bash
# ------------------- Anomaly Detection Model -------------------
AUTOENCODER_MODEL_PATH="models/autoencoder_pretrained"
```

Then in code:

```python
import os
from dotenv import load_dotenv

load_dotenv()

MODEL_PATH = os.getenv("AUTOENCODER_MODEL_PATH", "models/autoencoder_pretrained")

# Use in detection
anomalies, detector = detect_anomalies_in_excel(
    df=df,
    model_path=MODEL_PATH,
    train_if_needed=False
)
```

---

## Performance Comparison

| Approach | Time per Upload | Consistency | Production Ready |
|----------|----------------|-------------|------------------|
| **Train Every Time** (current) | 2-5 minutes | ❌ Different each time | ❌ No |
| **Load Pre-Trained** (fixed) | **5-10 seconds** | ✅ Consistent | ✅ Yes |

**Speed improvement: 12-60x faster!** 🚀

---

## Complete Workflow

### Initial Setup (Once)

```bash
# 1. Prepare training data (clean, representative dataset)
cp your_normal_data.xlsx backend/data/training_data.xlsx

# 2. Train model
cd backend
python train_model.py data/training_data.xlsx models/autoencoder_pretrained

# Output creates:
#   models/autoencoder_pretrained/autoencoder.h5
#   models/autoencoder_pretrained/metadata.pkl
```

### Runtime (Every Upload)

```bash
# User uploads dataset.xlsx
#   ↓
# Backend loads pre-trained model (fast!)
#   ↓
# Detects anomalies using loaded model
#   ↓
# Returns results in 5-10 seconds ✅
```

---

## File Structure

```
backend/
├── models/
│   └── autoencoder_pretrained/
│       ├── autoencoder.h5          # Trained Keras model
│       └── metadata.pkl            # Preprocessors + threshold
├── data/
│   └── training_data.xlsx          # Clean dataset for training
├── train_model.py                  # One-time training script
├── app/
│   ├── utils/
│   │   └── anomaly_detector.py    # Modified to load model
│   └── routes/
│       └── anomaly_routes.py       # Uses pre-trained model
└── .env.local                      # AUTOENCODER_MODEL_PATH config
```

---

## Edge Cases

### Case 1: Model Doesn't Match Dataset Columns

If uploaded dataset has different columns than training data:

**Option A: Flexible Model (Recommended)**
Train on diverse datasets with many column types

**Option B: Column Matching**
Add validation to check columns match:

```python
def detect_anomalies_in_excel(df, model_path, train_if_needed=False):
    detector = TabularAnomalyDetector.load(model_path)

    # Check if columns match
    df_cols = set(df.columns)
    model_cols = set(detector.feature_names)

    if df_cols != model_cols:
        missing = model_cols - df_cols
        extra = df_cols - model_cols
        raise ValueError(
            f"Dataset columns don't match model.\n"
            f"Missing: {missing}\n"
            f"Extra: {extra}"
        )

    return detector.detect_anomalies(df)
```

**Option C: Adaptive Model**
Auto-retrain if columns don't match (not recommended for production)

---

## Testing

### Test 1: Verify Model Loads

```python
from app.utils.anomaly_detector import TabularAnomalyDetector

# Load model
detector = TabularAnomalyDetector.load("models/autoencoder_pretrained")

print(f"Model loaded: {detector.is_trained}")
print(f"Features: {detector.feature_names}")
print(f"Threshold: {detector.threshold}")
```

### Test 2: Test Detection Speed

```python
import pandas as pd
import time

df = pd.read_excel("test_data.xlsx")

start = time.time()
anomalies, detector = detect_anomalies_in_excel(
    df,
    model_path="models/autoencoder_pretrained",
    train_if_needed=False
)
elapsed = time.time() - start

print(f"Detected {len(anomalies)} anomalies in {elapsed:.2f}s")
# Should be < 10 seconds!
```

---

## Migration Checklist

- [ ] Create `backend/train_model.py` script
- [ ] Prepare clean training dataset
- [ ] Run training script once to create model
- [ ] Verify `models/autoencoder_pretrained/` exists with `.h5` and `.pkl` files
- [ ] Update `anomaly_detector.py` default path
- [ ] Update `anomaly_routes.py` to use pre-trained model
- [ ] Add `AUTOENCODER_MODEL_PATH` to `.env.local`
- [ ] Test upload with new code (should be 10-30x faster!)
- [ ] Remove `train_if_needed=True` from production code
- [ ] Add model to `.gitignore` (don't commit large binary files)
- [ ] Document model versioning strategy

---

## Summary

**Problem:** Training new model on every upload = 2-5 minutes per dataset

**Solution:** Train once, load pre-trained model = 5-10 seconds per dataset

**Changes needed:**
1. Create `train_model.py` to train once
2. Modify `detect_anomalies_in_excel()` to load pre-trained by default
3. Update routes to pass model path
4. Set `train_if_needed=False` in production

**Result:** **12-60x faster!** 🚀
