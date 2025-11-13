"""
PDF Export Service for Anomaly Detection Reports

This service generates professional PDF reports from LLM-analyzed anomaly data
using WeasyPrint for HTML to PDF conversion.

Usage:
    from service.ExportPdf import generate_pdf_report

    pdf_bytes = generate_pdf_report(
        dataset_id="abc123",
        dataset_info=dataset_dict,
        explanations=llm_explanations_list
    )
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from io import BytesIO
from weasyprint import HTML, CSS
import logging

logger = logging.getLogger(__name__)


def generate_pdf_report(
    dataset_id: str,
    dataset_info: Dict[str, Any],
    explanations: List[Dict[str, Any]],
    include_recommendations: bool = True,
    include_mitre: bool = True
) -> bytes:
    """
    Generate a PDF report from anomaly detection results.

    Args:
        dataset_id: Unique identifier for the dataset
        dataset_info: Dataset metadata (filename, upload date, etc.)
        explanations: List of LLM explanation objects
        include_recommendations: Whether to include triage recommendations
        include_mitre: Whether to include MITRE ATT&CK mappings

    Returns:
        bytes: PDF file content as bytes
    """
    try:
        # Generate HTML content
        html_content = _generate_html_report(
            dataset_id=dataset_id,
            dataset_info=dataset_info,
            explanations=explanations,
            include_recommendations=include_recommendations,
            include_mitre=include_mitre
        )

        # Convert HTML to PDF using WeasyPrint
        pdf_file = BytesIO()
        HTML(string=html_content).write_pdf(
            pdf_file,
            stylesheets=[CSS(string=_get_pdf_styles())]
        )

        pdf_bytes = pdf_file.getvalue()
        logger.info(f"Successfully generated PDF report for dataset {dataset_id} ({len(pdf_bytes)} bytes)")

        return pdf_bytes

    except Exception as e:
        logger.error(f"Error generating PDF report: {str(e)}", exc_info=True)
        raise


def _generate_html_report(
    dataset_id: str,
    dataset_info: Dict[str, Any],
    explanations: List[Dict[str, Any]],
    include_recommendations: bool = True,
    include_mitre: bool = True
) -> str:
    """Generate HTML content for the PDF report."""

    # Calculate severity breakdown
    severity_counts = {
        "critical": sum(1 for e in explanations if e.get("severity") == "critical"),
        "high": sum(1 for e in explanations if e.get("severity") == "high"),
        "medium": sum(1 for e in explanations if e.get("severity") == "medium"),
        "low": sum(1 for e in explanations if e.get("severity") == "low"),
    }

    # Calculate verdict breakdown
    verdict_counts = {
        "malicious": sum(1 for e in explanations if e.get("verdict") == "malicious"),
        "likely_malicious": sum(1 for e in explanations if e.get("verdict") == "likely_malicious"),
        "suspicious": sum(1 for e in explanations if e.get("verdict") == "suspicious"),
        "benign": sum(1 for e in explanations if e.get("verdict") == "benign"),
        "unclear": sum(1 for e in explanations if e.get("verdict") == "unclear"),
    }

    # Get current timestamp
    from datetime import timezone
    generated_at = datetime.now(timezone.utc).strftime("%B %d, %Y at %H:%M UTC")

    # Build HTML
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Anomaly Detection Report - {dataset_info.get('filename', 'Unknown')}</title>
    </head>
    <body>
        <!-- Cover Page -->
        <div class="cover-page">
            <div class="cover-header">
                <h1>Anomaly Detection Report</h1>
                <div class="cover-subtitle">{dataset_info.get('original_filename', dataset_info.get('filename', 'Untitled'))}</div>
            </div>

            <div class="cover-metadata">
                <div class="metadata-item">
                    <span class="label">Dataset ID:</span>
                    <span class="value">{dataset_id}</span>
                </div>
                <div class="metadata-item">
                    <span class="label">Generated:</span>
                    <span class="value">{generated_at}</span>
                </div>
                <div class="metadata-item">
                    <span class="label">Total Anomalies:</span>
                    <span class="value">{len(explanations)}</span>
                </div>
                <div class="metadata-item">
                    <span class="label">Critical/High Severity:</span>
                    <span class="value severity-critical">{severity_counts['critical'] + severity_counts['high']}</span>
                </div>
            </div>

            <div class="cover-footer">
                <p>Generated with StarAI Anomaly Detection System</p>
                <p class="ai-notice">🤖 Analyzed with Claude AI</p>
            </div>
        </div>

        <!-- Executive Summary -->
        <div class="section page-break-before">
            <h2 class="section-title">Executive Summary</h2>

            <p class="summary-text">
                This report presents the results of automated anomaly detection and AI-powered security triage
                analysis performed on the dataset <strong>{dataset_info.get('filename', 'Unknown')}</strong>.
                The analysis identified <strong>{len(explanations)}</strong> suspicious anomalies,
                each evaluated for security implications using advanced AI models.
            </p>

            <div class="metrics-grid">
                <div class="metric-card severity-critical">
                    <div class="metric-value">{severity_counts['critical']}</div>
                    <div class="metric-label">Critical</div>
                </div>
                <div class="metric-card severity-high">
                    <div class="metric-value">{severity_counts['high']}</div>
                    <div class="metric-label">High</div>
                </div>
                <div class="metric-card severity-medium">
                    <div class="metric-value">{severity_counts['medium']}</div>
                    <div class="metric-label">Medium</div>
                </div>
                <div class="metric-card severity-low">
                    <div class="metric-value">{severity_counts['low']}</div>
                    <div class="metric-label">Low</div>
                </div>
            </div>

            <h3 class="subsection-title">Verdict Distribution</h3>
            <div class="verdict-table">
                <table>
                    <thead>
                        <tr>
                            <th>Verdict</th>
                            <th>Count</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Malicious</td>
                            <td>{verdict_counts['malicious']}</td>
                            <td>{(verdict_counts['malicious'] / len(explanations) * 100) if explanations else 0:.1f}%</td>
                        </tr>
                        <tr>
                            <td>Likely Malicious</td>
                            <td>{verdict_counts['likely_malicious']}</td>
                            <td>{(verdict_counts['likely_malicious'] / len(explanations) * 100) if explanations else 0:.1f}%</td>
                        </tr>
                        <tr>
                            <td>Suspicious</td>
                            <td>{verdict_counts['suspicious']}</td>
                            <td>{(verdict_counts['suspicious'] / len(explanations) * 100) if explanations else 0:.1f}%</td>
                        </tr>
                        <tr>
                            <td>Benign</td>
                            <td>{verdict_counts['benign']}</td>
                            <td>{(verdict_counts['benign'] / len(explanations) * 100) if explanations else 0:.1f}%</td>
                        </tr>
                        <tr>
                            <td>Unclear</td>
                            <td>{verdict_counts['unclear']}</td>
                            <td>{(verdict_counts['unclear'] / len(explanations) * 100) if explanations else 0:.1f}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Detailed Findings -->
        <div class="page-break-before">
            <h2 class="section-title">Detailed Findings</h2>
            {_generate_anomaly_details(explanations, include_mitre, include_recommendations)}
        </div>

        <!-- Footer on all pages -->
        <div class="footer">
            <div class="footer-left">StarAI Anomaly Detection Report</div>
            <div class="footer-center">{dataset_info.get('filename', 'Unknown')}</div>
            <div class="footer-right">Page <span class="page-number"></span></div>
        </div>
    </body>
    </html>
    """

    return html


def _generate_anomaly_details(
    explanations: List[Dict[str, Any]],
    include_mitre: bool = True,
    include_recommendations: bool = True
) -> str:
    """Generate HTML for individual anomaly details."""

    # Sort by severity (critical first)
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_explanations = sorted(
        explanations,
        key=lambda x: severity_order.get(x.get("severity", "low"), 4)
    )

    html_parts = []

    for idx, explanation in enumerate(sorted_explanations, 1):
        # Extract data
        anomaly_id = explanation.get("anomaly_id", "Unknown")
        verdict = explanation.get("verdict", "unclear").replace("_", " ").title()
        severity = explanation.get("severity", "low").upper()
        confidence = explanation.get("confidence_score", 0) * 100
        confidence_label = explanation.get("confidence_label", "medium").upper()
        event_name = explanation.get("event", {}).get("name", "Unknown Event")
        notes = explanation.get("notes", "No additional notes provided.")
        key_indicators = explanation.get("key_indicators", [])
        mitre_techniques = explanation.get("mitre", [])
        actors = explanation.get("actors", {})
        host = explanation.get("host", {})
        triage = explanation.get("triage", {})

        # Severity color class
        severity_class = f"severity-{severity.lower()}"

        # Only add page break for anomalies after the first one
        page_break_class = "page-break-before" if idx > 1 else ""

        anomaly_html = f"""
        <div class="anomaly-section {page_break_class}">
            <div class="anomaly-header">
                <h3 class="anomaly-title">Anomaly #{idx}: {event_name}</h3>
                <div class="anomaly-badges">
                    <span class="badge verdict-badge">{verdict}</span>
                    <span class="badge {severity_class}">{severity}</span>
                </div>
            </div>

            <div class="anomaly-metadata">
                <div class="metadata-row">
                    <span class="label">Anomaly ID:</span>
                    <span class="value monospace">{anomaly_id}</span>
                </div>
                <div class="metadata-row">
                    <span class="label">Confidence:</span>
                    <span class="value">{confidence:.1f}% ({confidence_label})</span>
                </div>
        """

        # Add event context if available
        if actors.get("process_name") or actors.get("user_id") or host.get("hostname"):
            anomaly_html += """
                <div class="metadata-row">
                    <span class="label">Context:</span>
                    <span class="value">
            """
            context_parts = []
            if actors.get("process_name"):
                context_parts.append(f"Process: {actors['process_name']}")
            if actors.get("user_id"):
                context_parts.append(f"User: {actors['user_id']}")
            if host.get("hostname"):
                context_parts.append(f"Host: {host['hostname']}")

            anomaly_html += " | ".join(context_parts)
            anomaly_html += """
                    </span>
                </div>
            """

        anomaly_html += """
            </div>
        """

        # Analysis Notes
        anomaly_html += f"""
            <div class="anomaly-content">
                <h4>Analysis</h4>
                <p class="notes-text">{notes}</p>
            </div>
        """

        # Key Indicators
        if key_indicators:
            anomaly_html += """
                <div class="anomaly-content">
                    <h4>Key Indicators</h4>
                    <ul class="indicators-list">
            """
            for indicator in key_indicators:
                anomaly_html += f"<li>{indicator}</li>"

            anomaly_html += """
                    </ul>
                </div>
            """

        # MITRE ATT&CK Techniques
        if include_mitre and mitre_techniques:
            anomaly_html += """
                <div class="anomaly-content">
                    <h4>MITRE ATT&CK Techniques</h4>
                    <div class="mitre-list">
            """
            for technique in mitre_techniques:
                tech_id = technique.get("id", "Unknown")
                tech_name = technique.get("name", "Unknown Technique")
                tech_confidence = technique.get("confidence", 0) * 100
                tech_rationale = technique.get("rationale", "")

                anomaly_html += f"""
                    <div class="mitre-item">
                        <div class="mitre-header">
                            <span class="mitre-id">{tech_id}</span>
                            <span class="mitre-name">{tech_name}</span>
                            <span class="mitre-confidence">{tech_confidence:.0f}%</span>
                        </div>
                """

                if tech_rationale:
                    anomaly_html += f"""
                        <div class="mitre-rationale">{tech_rationale}</div>
                    """

                anomaly_html += """
                    </div>
                """

            anomaly_html += """
                    </div>
                </div>
            """

        # Triage Recommendations
        if include_recommendations and triage:
            immediate = triage.get("immediate_actions", [])
            short_term = triage.get("short_term", [])
            long_term = triage.get("long_term", [])

            if immediate or short_term or long_term:
                anomaly_html += """
                    <div class="anomaly-content">
                        <h4>Recommended Actions</h4>
                """

                if immediate:
                    anomaly_html += """
                        <div class="recommendations-section">
                            <h5 class="rec-title critical">⚠️ Immediate Actions</h5>
                            <ul class="recommendations-list">
                    """
                    for action in immediate:
                        anomaly_html += f"<li>{action}</li>"
                    anomaly_html += """
                            </ul>
                        </div>
                    """

                if short_term:
                    anomaly_html += """
                        <div class="recommendations-section">
                            <h5 class="rec-title warning">⏱️ Short-term Actions</h5>
                            <ul class="recommendations-list">
                    """
                    for action in short_term:
                        anomaly_html += f"<li>{action}</li>"
                    anomaly_html += """
                            </ul>
                        </div>
                    """

                if long_term:
                    anomaly_html += """
                        <div class="recommendations-section">
                            <h5 class="rec-title info">📈 Long-term Actions</h5>
                            <ul class="recommendations-list">
                    """
                    for action in long_term:
                        anomaly_html += f"<li>{action}</li>"
                    anomaly_html += """
                            </ul>
                        </div>
                    """

                anomaly_html += """
                    </div>
                """

        anomaly_html += """
        </div>
        """

        html_parts.append(anomaly_html)

    return "\n".join(html_parts)


def _get_pdf_styles() -> str:
    """Return CSS styles for the PDF."""
    return """
        @page {
            size: A4;
            margin: 2cm 1.5cm;

            @bottom-left {
                content: "StarAI Anomaly Detection Report";
                font-size: 9pt;
                color: #666;
            }

            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 9pt;
                color: #666;
            }
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            orphans: 3;
            widows: 3;
        }

        /* Cover Page */
        .cover-page {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            page-break-after: always;
        }

        .cover-header h1 {
            font-size: 48pt;
            margin-bottom: 20px;
            font-weight: 300;
        }

        .cover-subtitle {
            font-size: 24pt;
            margin-bottom: 60px;
            opacity: 0.9;
        }

        .cover-metadata {
            background: rgba(255, 255, 255, 0.1);
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 60px;
            backdrop-filter: blur(10px);
        }

        .metadata-item {
            margin: 15px 0;
            font-size: 14pt;
        }

        .metadata-item .label {
            font-weight: 600;
            margin-right: 10px;
        }

        .metadata-item .value {
            font-family: monospace;
        }

        .severity-critical {
            color: #ff4444 !important;
            font-weight: bold;
        }

        .cover-footer {
            position: absolute;
            bottom: 50px;
            font-size: 12pt;
        }

        .ai-notice {
            margin-top: 10px;
            opacity: 0.8;
        }

        /* Page Break */
        .page-break-before {
            page-break-before: always;
        }

        /* Sections */
        .section {
            margin-bottom: 30px;
        }

        .section-title {
            font-size: 24pt;
            margin-bottom: 20px;
            color: #667eea;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }

        .subsection-title {
            font-size: 16pt;
            margin: 25px 0 15px 0;
            color: #555;
        }

        .summary-text {
            margin-bottom: 25px;
            text-align: justify;
            line-height: 1.8;
        }

        /* Metrics Grid */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin: 30px 0;
            page-break-inside: avoid;
        }

        .metric-card {
            background: #f5f5f5;
            padding: 25px;
            border-radius: 8px;
            text-align: center;
            border-left: 5px solid #ccc;
        }

        .metric-card.severity-critical {
            border-left-color: #dc2626;
            background: #fee;
        }

        .metric-card.severity-high {
            border-left-color: #ea580c;
            background: #ffedd5;
        }

        .metric-card.severity-medium {
            border-left-color: #f59e0b;
            background: #fef3c7;
        }

        .metric-card.severity-low {
            border-left-color: #3b82f6;
            background: #dbeafe;
        }

        .metric-value {
            font-size: 36pt;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .metric-label {
            font-size: 12pt;
            color: #666;
        }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            page-break-inside: avoid;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e5e5;
        }

        th {
            background: #f5f5f5;
            font-weight: 600;
            color: #555;
        }

        tr:hover {
            background: #fafafa;
        }

        /* Anomaly Sections */
        .anomaly-section {
            margin-bottom: 30px;
            border: 2px solid #e5e5e5;
            border-radius: 8px;
            padding: 25px;
            page-break-inside: avoid;
            orphans: 3;
            widows: 3;
        }

        .anomaly-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e5e5;
        }

        .anomaly-title {
            font-size: 18pt;
            color: #333;
        }

        .anomaly-badges {
            display: flex;
            gap: 10px;
        }

        .badge {
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 10pt;
            font-weight: 600;
            text-transform: uppercase;
        }

        .verdict-badge {
            background: #e0e7ff;
            color: #4338ca;
        }

        .badge.severity-critical {
            background: #dc2626;
            color: white;
        }

        .badge.severity-high {
            background: #ea580c;
            color: white;
        }

        .badge.severity-medium {
            background: #f59e0b;
            color: white;
        }

        .badge.severity-low {
            background: #3b82f6;
            color: white;
        }

        .anomaly-metadata {
            background: #fafafa;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
        }

        .metadata-row {
            margin: 8px 0;
        }

        .metadata-row .label {
            font-weight: 600;
            color: #555;
            margin-right: 10px;
        }

        .monospace {
            font-family: 'Courier New', monospace;
            font-size: 9pt;
        }

        .anomaly-content {
            margin: 20px 0;
            page-break-inside: avoid;
        }

        .anomaly-content h4 {
            font-size: 14pt;
            color: #667eea;
            margin-bottom: 12px;
            page-break-after: avoid;
        }

        .notes-text {
            line-height: 1.8;
            text-align: justify;
        }

        .indicators-list {
            list-style: none;
            padding-left: 0;
        }

        .indicators-list li {
            padding: 8px 0 8px 25px;
            position: relative;
            line-height: 1.6;
        }

        .indicators-list li:before {
            content: "▪";
            position: absolute;
            left: 0;
            color: #667eea;
            font-weight: bold;
        }

        /* MITRE Techniques */
        .mitre-list {
            margin-top: 15px;
        }

        .mitre-item {
            background: #f0f4ff;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 12px;
            border-left: 4px solid #667eea;
            page-break-inside: avoid;
        }

        .mitre-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 8px;
        }

        .mitre-id {
            background: #667eea;
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 10pt;
            font-weight: bold;
        }

        .mitre-name {
            flex: 1;
            font-weight: 600;
        }

        .mitre-confidence {
            color: #666;
            font-size: 10pt;
        }

        .mitre-rationale {
            color: #555;
            font-size: 10pt;
            line-height: 1.6;
            margin-top: 8px;
        }

        /* Recommendations */
        .recommendations-section {
            margin: 20px 0;
            page-break-inside: avoid;
        }

        .rec-title {
            font-size: 12pt;
            margin-bottom: 10px;
            padding: 8px 12px;
            border-radius: 4px;
        }

        .rec-title.critical {
            background: #fee;
            color: #dc2626;
            border-left: 4px solid #dc2626;
        }

        .rec-title.warning {
            background: #fef3c7;
            color: #f59e0b;
            border-left: 4px solid #f59e0b;
        }

        .rec-title.info {
            background: #dbeafe;
            color: #3b82f6;
            border-left: 4px solid #3b82f6;
        }

        .recommendations-list {
            list-style: decimal;
            padding-left: 25px;
        }

        .recommendations-list li {
            margin: 8px 0;
            line-height: 1.6;
        }
    """
