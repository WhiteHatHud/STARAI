# Matrix Visualizations - test.py Output

This folder contains comprehensive matrix visualizations generated from the autoencoder anomaly detection model's test results.

## Generated: 2025-11-06

---

## Visualization Files

### 1. confusion_matrix_detailed.png (189 KB)
**Two-panel confusion matrix analysis**

- **Left Panel:** Raw count confusion matrix
  - Shows True Negatives (TN), False Positives (FP), False Negatives (FN), True Positives (TP)
  - Includes percentage of total for each cell
  - Color-coded heatmap (green = good, red = bad)

- **Right Panel:** Normalized confusion matrix
  - Row-normalized percentages
  - Shows detection rate per actual class
  - Helps understand model's behavior for each class

**Use Case:** Quick assessment of model classification performance

---

### 2. metrics_table.png (282 KB)
**Comprehensive metrics summary table**

Contains 10 key performance metrics:
- **Accuracy** - Overall correctness (Green background)
- **Precision** - Positive prediction accuracy (Blue background)
- **Recall (TPR)** - Malicious detection rate (Blue background)
- **F1 Score** - Harmonic mean of precision & recall (Green background)
- **Specificity (TNR)** - Benign detection rate (Blue background)
- **False Positive Rate** - Benign misclassified rate (Red background)
- **True Negatives** - Correctly identified benign (Orange background)
- **False Positives** - Benign flagged as malicious (Orange background)
- **False Negatives** - Malicious missed (Orange background)
- **True Positives** - Correctly identified malicious (Orange background)

Each metric includes:
- Raw value (0-1 scale)
- Percentage
- Description

**Use Case:** Detailed performance report for stakeholders

---

### 3. detection_breakdown.png (272 KB)
**Three-panel detection analysis dashboard**

- **Left Panel:** Pie chart of detection breakdown
  - True Positives, False Negatives, False Positives, True Negatives
  - Shows distribution with percentages

- **Middle Panel:** Stacked bar chart
  - Compares Actual vs Predicted distribution
  - Shows how well predictions match reality

- **Right Panel:** Classification errors
  - Type I Error (False Positive)
  - Type II Error (False Negative)
  - Shows count and percentage of total

**Use Case:** Visual presentation of detection quality

---

### 4. classification_report.png (117 KB)
**Sklearn classification report table**

Detailed per-class metrics:
- **Benign class:** Precision, Recall, F1-Score, Support
- **Malicious class:** Precision, Recall, F1-Score, Support
- **Accuracy:** Overall model accuracy
- **Macro avg:** Unweighted mean per class
- **Weighted avg:** Support-weighted mean per class

Color-coded rows for easy reading:
- Green: Benign class
- Red: Malicious class
- Orange: Macro average
- Blue: Weighted average

**Use Case:** Standard ML performance reporting

---

### 5. comparative_metrics.png (403 KB)
**Three-panel comprehensive metrics comparison**

#### Panel 1: Detection Metrics
- True Positive Rate (Sensitivity)
- True Negative Rate (Specificity)
- False Positive Rate
- False Negative Rate

#### Panel 2: Prediction Metrics
- Positive Predictive Value (Precision)
- Negative Predictive Value
- False Discovery Rate
- False Omission Rate

#### Panel 3: Overall Metrics
- Accuracy
- Balanced Accuracy
- F1 Score
- Matthews Correlation Coefficient

**Features:**
- Horizontal bar charts for easy comparison
- Color-coded by performance (Green ≥ 0.7, Orange ≥ 0.5, Red < 0.5)
- Reference lines at 0.7 (good) and 0.5 (moderate)
- Value labels with percentages

**Use Case:** Complete performance analysis with all relevant metrics

---

### 6. priority_matrix.png (315 KB)
**Four-panel priority distribution analysis**

Based on anomaly detection results with priority levels (CRITICAL, HIGH, MEDIUM, LOW)

- **Top Left:** Anomaly count by priority
  - Bar chart showing distribution
  - Color-coded: Red (CRITICAL), Orange (HIGH), Yellow (MEDIUM), Blue (LOW)

- **Top Right:** Error statistics heatmap
  - Average, Maximum, Minimum reconstruction error per priority
  - Shows relationship between error and priority

- **Bottom Left:** Confirmed malicious by priority
  - How many actual malicious cases in each priority level
  - Validates priority assignment effectiveness

- **Bottom Right:** Priority summary table
  - Complete statistics in tabular format
  - Count, Avg Error, Max Error, Min Error, Actual Malicious

**Use Case:** Cyber triage effectiveness and priority validation

---

## How to Use These Visualizations

### For Executive Reports
1. Start with **detection_breakdown.png** for high-level overview
2. Show **metrics_table.png** for key performance numbers
3. Use **confusion_matrix_detailed.png** to explain model behavior

### For Technical Analysis
1. Review **comparative_metrics.png** for complete metric analysis
2. Examine **classification_report.png** for sklearn standard metrics
3. Check **priority_matrix.png** to validate triage strategy

### For Security Operations
1. Focus on **priority_matrix.png** to understand threat distribution
2. Check **confusion_matrix_detailed.png** for false positive/negative rates
3. Use **detection_breakdown.png** to track Type I and Type II errors

---

## Interpreting the Results

### Good Performance Indicators
✅ **Precision ≥ 0.7** - Low false positive rate
✅ **Recall ≥ 0.7** - High detection rate
✅ **F1 Score ≥ 0.7** - Balanced performance
✅ **Specificity ≥ 0.9** - Benign correctly identified
✅ **FPR < 0.1** - Few false alarms

### Areas for Improvement
⚠️ **Recall < 0.5** - Missing too many malicious processes
⚠️ **Precision < 0.5** - Too many false alarms
⚠️ **FPR > 0.2** - Overwhelming false positives
⚠️ **F1 < 0.5** - Unbalanced or poor performance

---

## Regenerating Visualizations

To regenerate these visualizations:

```bash
# Step 1: Run test.py to generate test results
python test.py
# This creates: y_test.npy, y_pred.npy, test_mse.npy, new_test_results.csv

# Step 2: Generate visualizations from test results
python generate_matrix_visuals.py
# This creates all PNG files in visuals/ folder
```

All visualizations will be saved to the `visuals/` folder.

**Workflow:**
```
test.py → generates .npy files → generate_matrix_visuals.py → creates PNG visualizations
```

---

## Technical Details

**Test Dataset:** 7,324 sequences from labelled_testing_data.csv
**Anomalies Detected:** 6,366 processes flagged
**Threshold:** 3.0 (reconstruction error)
**Model:** Autoencoder neural network
**Framework:** TensorFlow/Keras

---

## File Sizes

| File | Size | Description |
|------|------|-------------|
| confusion_matrix_detailed.png | 189 KB | 2-panel confusion matrix |
| metrics_table.png | 282 KB | Comprehensive metrics table |
| detection_breakdown.png | 272 KB | 3-panel detection dashboard |
| classification_report.png | 117 KB | Sklearn report table |
| comparative_metrics.png | 403 KB | 3-panel metrics comparison |
| priority_matrix.png | 315 KB | 4-panel priority analysis |

**Total:** ~1.56 MB (6 high-resolution visualizations at 300 DPI)

---

**Generated by:** `generate_matrix_visuals.py`
**Last Updated:** 2025-11-06
**Model:** STARAI AutoEncoder Anomaly Detection
