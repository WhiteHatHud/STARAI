"""
Generate Matrix Visualizations from test.py Output
Creates comprehensive visual matrices and tables for model performance

IMPORTANT: Run test.py FIRST to generate required files:
  - y_test.npy
  - y_pred.npy
  - test_mse.npy
  - new_test_results.csv

Usage:
  1. python test.py          # Generates test results and .npy files
  2. python generate_matrix_visuals.py  # Creates visualizations
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix, classification_report
import json

# Set style
sns.set_style('whitegrid')
plt.rcParams['figure.facecolor'] = 'white'
plt.rcParams['axes.facecolor'] = 'white'

def create_confusion_matrix_visual(y_true, y_pred, save_path='visuals/confusion_matrix_detailed.png'):
    """Create detailed confusion matrix visualization"""
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()

    fig, axes = plt.subplots(1, 2, figsize=(16, 6))

    # Heatmap
    ax1 = axes[0]
    sns.heatmap(cm, annot=True, fmt='d', cmap='RdYlGn_r', ax=ax1,
                cbar_kws={'label': 'Count'},
                xticklabels=['Benign', 'Malicious'],
                yticklabels=['Benign', 'Malicious'],
                linewidths=2, linecolor='black')
    ax1.set_title('Confusion Matrix - Raw Counts', fontsize=14, fontweight='bold', pad=20)
    ax1.set_xlabel('Predicted Label', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Actual Label', fontsize=12, fontweight='bold')

    # Add percentage annotations
    total = cm.sum()
    for i in range(2):
        for j in range(2):
            percentage = (cm[i, j] / total) * 100
            ax1.text(j + 0.5, i + 0.7, f'({percentage:.1f}%)',
                    ha='center', va='center', fontsize=10, color='gray')

    # Normalized heatmap
    ax2 = axes[1]
    cm_normalized = cm.astype('float') / cm.sum(axis=1)[:, np.newaxis]
    sns.heatmap(cm_normalized, annot=True, fmt='.2%', cmap='RdYlGn_r', ax=ax2,
                cbar_kws={'label': 'Percentage'},
                xticklabels=['Benign', 'Malicious'],
                yticklabels=['Benign', 'Malicious'],
                linewidths=2, linecolor='black', vmin=0, vmax=1)
    ax2.set_title('Confusion Matrix - Normalized (Row %)', fontsize=14, fontweight='bold', pad=20)
    ax2.set_xlabel('Predicted Label', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Actual Label', fontsize=12, fontweight='bold')

    plt.suptitle('Confusion Matrix Analysis', fontsize=16, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"✅ Saved: {save_path}")
    plt.close()

    return cm


def create_metrics_table(y_true, y_pred, save_path='visuals/metrics_table.png'):
    """Create comprehensive metrics table"""
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()

    # Calculate all metrics
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    accuracy = (tp + tn) / (tp + tn + fp + fn)
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    tpr = recall  # Same as recall
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0

    # Create metrics dataframe
    metrics_data = {
        'Metric': [
            'Accuracy',
            'Precision',
            'Recall (TPR)',
            'F1 Score',
            'Specificity (TNR)',
            'False Positive Rate',
            'True Negatives',
            'False Positives',
            'False Negatives',
            'True Positives'
        ],
        'Value': [
            f'{accuracy:.4f}',
            f'{precision:.4f}',
            f'{recall:.4f}',
            f'{f1:.4f}',
            f'{specificity:.4f}',
            f'{fpr:.4f}',
            f'{tn}',
            f'{fp}',
            f'{fn}',
            f'{tp}'
        ],
        'Percentage': [
            f'{accuracy*100:.2f}%',
            f'{precision*100:.2f}%',
            f'{recall*100:.2f}%',
            f'{f1*100:.2f}%',
            f'{specificity*100:.2f}%',
            f'{fpr*100:.2f}%',
            f'{tn/(tn+fp+fn+tp)*100:.2f}%',
            f'{fp/(tn+fp+fn+tp)*100:.2f}%',
            f'{fn/(tn+fp+fn+tp)*100:.2f}%',
            f'{tp/(tn+fp+fn+tp)*100:.2f}%'
        ],
        'Description': [
            'Overall correctness',
            'Positive prediction accuracy',
            'Malicious detection rate',
            'Harmonic mean of P & R',
            'Benign detection rate',
            'Benign misclassified rate',
            'Correctly identified benign',
            'Benign flagged as malicious',
            'Malicious missed',
            'Correctly identified malicious'
        ]
    }

    df_metrics = pd.DataFrame(metrics_data)

    # Create table visualization
    fig, ax = plt.subplots(figsize=(14, 8))
    ax.axis('tight')
    ax.axis('off')

    # Color rows based on metric type
    colors = []
    for i, metric in enumerate(df_metrics['Metric']):
        if 'Accuracy' in metric or 'F1' in metric:
            colors.append(['#e8f5e9', '#e8f5e9', '#e8f5e9', '#e8f5e9'])
        elif 'Precision' in metric or 'Recall' in metric or 'Specificity' in metric:
            colors.append(['#e3f2fd', '#e3f2fd', '#e3f2fd', '#e3f2fd'])
        elif 'False' in metric:
            colors.append(['#ffebee', '#ffebee', '#ffebee', '#ffebee'])
        elif 'True' in metric:
            colors.append(['#fff3e0', '#fff3e0', '#fff3e0', '#fff3e0'])
        else:
            colors.append(['white', 'white', 'white', 'white'])

    table = ax.table(cellText=df_metrics.values,
                    colLabels=df_metrics.columns,
                    cellLoc='left',
                    loc='center',
                    cellColours=colors,
                    colColours=['#37474f']*4)

    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 2.5)

    # Style header
    for i in range(4):
        table[(0, i)].set_facecolor('#37474f')
        table[(0, i)].set_text_props(weight='bold', color='white')

    # Bold metric names
    for i in range(1, len(df_metrics) + 1):
        table[(i, 0)].set_text_props(weight='bold')

    plt.title('Performance Metrics Summary', fontsize=16, fontweight='bold', pad=20)
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"✅ Saved: {save_path}")
    plt.close()

    return df_metrics


def create_priority_matrix(results_df, save_path='visuals/priority_matrix.png'):
    """Create priority distribution matrix"""
    if 'priority' not in results_df.columns:
        print("⚠️  No priority column found in results")
        return None

    # Group by priority
    # Check which evil column exists
    evil_col = None
    if 'actual_evil' in results_df.columns:
        evil_col = 'actual_evil'
    elif 'evil' in results_df.columns:
        evil_col = 'evil'

    agg_dict = {
        'processId': 'count',
        'reconstruction_error': ['mean', 'max', 'min']
    }

    if evil_col:
        agg_dict[evil_col] = 'sum'

    priority_summary = results_df.groupby('priority').agg(agg_dict).round(4)

    if evil_col:
        priority_summary.columns = ['Count', 'Avg Error', 'Max Error', 'Min Error', 'Actual Malicious']
    else:
        priority_summary.columns = ['Count', 'Avg Error', 'Max Error', 'Min Error']
    priority_order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    priority_summary = priority_summary.reindex(priority_order)

    # Create visualization
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle('Priority Distribution Matrix', fontsize=16, fontweight='bold')

    # 1. Count by priority (bar chart)
    ax1 = axes[0, 0]
    colors_bar = ['#c62828', '#f57c00', '#fbc02d', '#7cb342']
    priority_summary['Count'].plot(kind='bar', ax=ax1, color=colors_bar)
    ax1.set_title('Anomaly Count by Priority', fontsize=12, fontweight='bold')
    ax1.set_xlabel('Priority Level', fontsize=11)
    ax1.set_ylabel('Count', fontsize=11)
    ax1.set_xticklabels(ax1.get_xticklabels(), rotation=0)
    ax1.grid(alpha=0.3, axis='y')
    for i, v in enumerate(priority_summary['Count']):
        if pd.notna(v):
            ax1.text(i, v + max(priority_summary['Count'])*0.02, str(int(v)),
                    ha='center', fontweight='bold')

    # 2. Error distribution (heatmap)
    ax2 = axes[0, 1]
    error_data = priority_summary[['Avg Error', 'Max Error', 'Min Error']].T
    sns.heatmap(error_data, annot=True, fmt='.4f', cmap='Reds', ax=ax2,
                cbar_kws={'label': 'Reconstruction Error'})
    ax2.set_title('Error Statistics by Priority', fontsize=12, fontweight='bold')
    ax2.set_xlabel('Priority Level', fontsize=11)
    ax2.set_ylabel('Statistic', fontsize=11)

    # 3. Actual malicious by priority
    ax3 = axes[1, 0]
    evil_col = 'actual_evil' if 'actual_evil' in results_df.columns else ('evil' if 'evil' in results_df.columns else None)

    if evil_col and 'Actual Malicious' in priority_summary.columns:
        priority_summary['Actual Malicious'].plot(kind='bar', ax=ax3, color=colors_bar)
        ax3.set_title('Confirmed Malicious by Priority', fontsize=12, fontweight='bold')
        ax3.set_xlabel('Priority Level', fontsize=11)
        ax3.set_ylabel('Count', fontsize=11)
        ax3.set_xticklabels(ax3.get_xticklabels(), rotation=0)
        ax3.grid(alpha=0.3, axis='y')
        for i, v in enumerate(priority_summary['Actual Malicious']):
            if pd.notna(v):
                ax3.text(i, v + max(priority_summary['Actual Malicious'])*0.02, str(int(v)),
                        ha='center', fontweight='bold')
    else:
        ax3.text(0.5, 0.5, 'No evil labels available',
                ha='center', va='center', transform=ax3.transAxes, fontsize=12)
        ax3.axis('off')

    # 4. Summary table
    ax4 = axes[1, 1]
    ax4.axis('tight')
    ax4.axis('off')

    table_data = priority_summary.reset_index()
    table = ax4.table(cellText=table_data.values,
                     colLabels=table_data.columns,
                     cellLoc='center',
                     loc='center',
                     colColours=['#37474f']*len(table_data.columns))

    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 2)

    for i in range(len(table_data.columns)):
        table[(0, i)].set_facecolor('#37474f')
        table[(0, i)].set_text_props(weight='bold', color='white')

    ax4.set_title('Priority Summary Table', fontsize=12, fontweight='bold', pad=20)

    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"✅ Saved: {save_path}")
    plt.close()

    return priority_summary


def create_detection_breakdown(y_true, y_pred, save_path='visuals/detection_breakdown.png'):
    """Create detection breakdown visualization"""
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))

    # 1. Pie chart - Overall detection
    ax1 = axes[0]
    sizes = [tp, fn, fp, tn]
    labels = [f'True Positive\n{tp:,}', f'False Negative\n{fn:,}',
              f'False Positive\n{fp:,}', f'True Negative\n{tn:,}']
    colors = ['#4caf50', '#f44336', '#ff9800', '#9e9e9e']
    explode = (0.1, 0.1, 0.1, 0)

    ax1.pie(sizes, labels=labels, colors=colors, explode=explode,
            autopct='%1.1f%%', startangle=90, textprops={'fontsize': 10, 'weight': 'bold'})
    ax1.set_title('Detection Breakdown', fontsize=12, fontweight='bold')

    # 2. Stacked bar - Actual vs Predicted
    ax2 = axes[1]
    actual_benign = tn + fp
    actual_malicious = tp + fn
    pred_benign = tn + fn
    pred_malicious = tp + fp

    categories = ['Actual', 'Predicted']
    benign_counts = [actual_benign, pred_benign]
    malicious_counts = [actual_malicious, pred_malicious]

    x = np.arange(len(categories))
    width = 0.5

    p1 = ax2.bar(x, benign_counts, width, label='Benign', color='#66bb6a')
    p2 = ax2.bar(x, malicious_counts, width, bottom=benign_counts, label='Malicious', color='#ef5350')

    ax2.set_ylabel('Count', fontsize=11, fontweight='bold')
    ax2.set_title('Actual vs Predicted Distribution', fontsize=12, fontweight='bold')
    ax2.set_xticks(x)
    ax2.set_xticklabels(categories)
    ax2.legend()
    ax2.grid(alpha=0.3, axis='y')

    # Add value labels
    for i, (b, m) in enumerate(zip(benign_counts, malicious_counts)):
        ax2.text(i, b/2, f'{b:,}', ha='center', va='center', fontweight='bold', color='white')
        ax2.text(i, b + m/2, f'{m:,}', ha='center', va='center', fontweight='bold', color='white')

    # 3. Error type breakdown
    ax3 = axes[2]
    error_types = ['Type I\n(False Positive)', 'Type II\n(False Negative)']
    error_counts = [fp, fn]
    error_colors = ['#ff9800', '#f44336']

    bars = ax3.bar(error_types, error_counts, color=error_colors, alpha=0.8)
    ax3.set_ylabel('Count', fontsize=11, fontweight='bold')
    ax3.set_title('Classification Errors', fontsize=12, fontweight='bold')
    ax3.grid(alpha=0.3, axis='y')

    for bar, count in zip(bars, error_counts):
        height = bar.get_height()
        ax3.text(bar.get_x() + bar.get_width()/2., height,
                f'{count:,}\n({count/(tn+fp+fn+tp)*100:.1f}%)',
                ha='center', va='bottom', fontweight='bold')

    plt.suptitle('Detection Analysis Dashboard', fontsize=16, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"✅ Saved: {save_path}")
    plt.close()


def create_classification_report_visual(y_true, y_pred, save_path='visuals/classification_report.png'):
    """Create detailed classification report visualization"""
    from sklearn.metrics import classification_report

    # Get classification report as dict
    report = classification_report(y_true, y_pred,
                                   target_names=['Benign', 'Malicious'],
                                   output_dict=True)

    # Convert to DataFrame
    df_report = pd.DataFrame(report).transpose()
    df_report = df_report.round(4)

    # Create visualization
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.axis('tight')
    ax.axis('off')

    # Prepare table data
    table_data = df_report.reset_index()
    table_data.columns = ['Class', 'Precision', 'Recall', 'F1-Score', 'Support']

    # Format numbers
    for col in ['Precision', 'Recall', 'F1-Score']:
        table_data[col] = table_data[col].apply(lambda x: f'{x:.4f}' if isinstance(x, float) else x)
    table_data['Support'] = table_data['Support'].apply(lambda x: f'{int(x)}' if isinstance(x, (int, float)) else x)

    # Create table
    table = ax.table(cellText=table_data.values,
                    colLabels=table_data.columns,
                    cellLoc='center',
                    loc='center',
                    colColours=['#37474f']*5)

    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 2.5)

    # Style header
    for i in range(5):
        table[(0, i)].set_facecolor('#37474f')
        table[(0, i)].set_text_props(weight='bold', color='white', fontsize=11)

    # Color rows
    row_colors = ['#e8f5e9', '#ffebee', 'white', '#fff3e0', '#e3f2fd']
    for i, color in enumerate(row_colors[:len(table_data)], start=1):
        for j in range(5):
            table[(i, j)].set_facecolor(color)
            if j == 0:  # Bold class names
                table[(i, j)].set_text_props(weight='bold')

    plt.title('Classification Report', fontsize=16, fontweight='bold', pad=20)
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"✅ Saved: {save_path}")
    plt.close()

    return df_report


def create_comparative_metrics_matrix(y_true, y_pred, save_path='visuals/comparative_metrics.png'):
    """Create comparative metrics visualization"""
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()

    # Calculate metrics
    metrics = {
        'Detection Metrics': {
            'True Positive Rate (Sensitivity)': tp / (tp + fn) if (tp + fn) > 0 else 0,
            'True Negative Rate (Specificity)': tn / (tn + fp) if (tn + fp) > 0 else 0,
            'False Positive Rate': fp / (fp + tn) if (fp + tn) > 0 else 0,
            'False Negative Rate': fn / (fn + tp) if (fn + tp) > 0 else 0,
        },
        'Prediction Metrics': {
            'Positive Predictive Value (Precision)': tp / (tp + fp) if (tp + fp) > 0 else 0,
            'Negative Predictive Value': tn / (tn + fn) if (tn + fn) > 0 else 0,
            'False Discovery Rate': fp / (fp + tp) if (fp + tp) > 0 else 0,
            'False Omission Rate': fn / (fn + tn) if (fn + tn) > 0 else 0,
        },
        'Overall Metrics': {
            'Accuracy': (tp + tn) / (tp + tn + fp + fn),
            'Balanced Accuracy': ((tp / (tp + fn) if (tp + fn) > 0 else 0) +
                                 (tn / (tn + fp) if (tn + fp) > 0 else 0)) / 2,
            'F1 Score': 2 * tp / (2 * tp + fp + fn) if (2 * tp + fp + fn) > 0 else 0,
            'Matthews Correlation Coefficient': (tp * tn - fp * fn) / np.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)) if (tp + fp) * (tp + fn) * (tn + fp) * (tn + fn) > 0 else 0,
        }
    }

    # Create visualization
    fig, axes = plt.subplots(3, 1, figsize=(14, 14))
    fig.suptitle('Comprehensive Metrics Comparison Matrix', fontsize=16, fontweight='bold', y=0.995)

    for idx, (category, metrics_dict) in enumerate(metrics.items()):
        ax = axes[idx]

        # Prepare data
        metric_names = list(metrics_dict.keys())
        values = list(metrics_dict.values())

        # Create horizontal bar chart
        colors = ['#4caf50' if v >= 0.7 else '#ff9800' if v >= 0.5 else '#f44336' for v in values]
        bars = ax.barh(metric_names, values, color=colors, alpha=0.8)

        # Styling
        ax.set_xlim([0, 1])
        ax.set_xlabel('Score', fontsize=11, fontweight='bold')
        ax.set_title(category, fontsize=13, fontweight='bold', pad=10)
        ax.axvline(x=0.7, color='green', linestyle='--', alpha=0.4, linewidth=1.5, label='Good (≥0.7)')
        ax.axvline(x=0.5, color='orange', linestyle='--', alpha=0.4, linewidth=1.5, label='Moderate (≥0.5)')
        ax.grid(alpha=0.3, axis='x')
        ax.legend(loc='lower right', fontsize=9)

        # Add value labels
        for i, (bar, val) in enumerate(zip(bars, values)):
            width = bar.get_width()
            ax.text(width + 0.02, bar.get_y() + bar.get_height()/2,
                   f'{val:.4f} ({val*100:.2f}%)',
                   va='center', fontweight='bold', fontsize=9)

    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"✅ Saved: {save_path}")
    plt.close()


def main():
    print("="*80)
    print("GENERATING MATRIX VISUALIZATIONS FROM TEST.PY OUTPUT")
    print("="*80)

    # Load existing test results or run test.py
    print("\n1. Loading test results...")

    try:
        # Try to load saved numpy arrays from test.py
        y_test = np.load('y_test.npy')
        y_pred = np.load('y_pred.npy')
        print(f"   Loaded {len(y_test)} test samples")
    except FileNotFoundError:
        print("   ⚠️  Could not find y_test.npy and y_pred.npy")
        print("   Please run test.py first to generate these files")
        return

    # Load results CSV if available
    results_df = None
    try:
        results_df = pd.read_csv('new_test_results.csv')
        print(f"   Loaded {len(results_df)} anomaly records from new_test_results.csv")
    except FileNotFoundError:
        print("   ⚠️  new_test_results.csv not found - some visualizations will be skipped")

    print("\n2. Generating visualizations...")
    print("-" * 80)

    # Create all visualizations
    create_confusion_matrix_visual(y_test, y_pred)
    create_metrics_table(y_test, y_pred)
    create_detection_breakdown(y_test, y_pred)
    create_classification_report_visual(y_test, y_pred)
    create_comparative_metrics_matrix(y_test, y_pred)

    if results_df is not None:
        create_priority_matrix(results_df)

    print("\n" + "="*80)
    print("✅ ALL VISUALIZATIONS GENERATED SUCCESSFULLY!")
    print("="*80)
    print("\nGenerated files in 'visuals/' folder:")
    print("  1. confusion_matrix_detailed.png - Detailed confusion matrix analysis")
    print("  2. metrics_table.png - Comprehensive metrics summary table")
    print("  3. detection_breakdown.png - Detection analysis dashboard")
    print("  4. classification_report.png - Sklearn classification report")
    print("  5. comparative_metrics.png - Complete metrics comparison")
    if results_df is not None:
        print("  6. priority_matrix.png - Priority distribution analysis")
    print("="*80)


if __name__ == '__main__':
    main()
