import { Card } from "@/components/ui/card";
import {
  Upload,
  Zap,
  FileText,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

const InstructionsPage = () => {
  return (
    <div className="container max-w-5xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            User Instructions
          </h1>
          <p className="text-lg text-muted-foreground">
            Learn how to use the Anomaly Detection Platform effectively
          </p>
        </div>

        <div className="space-y-8">
          {/* Getting Started */}
          <Card className="p-8">
            <h2 className="text-3xl font-semibold mb-4">Getting Started</h2>
            <p className="text-lg leading-relaxed">
              Welcome to the Anomaly Detection Platform. This tool helps you
              identify unusual patterns and potential issues in your system logs,
              network traffic, and application data. You can analyze historical
              data or monitor systems in real-time.
            </p>
          </Card>

          {/* Static Detection */}
          <Card className="p-8">
            <div className="flex items-start gap-4 mb-4">
              <Upload className="w-10 h-10 text-primary shrink-0" />
              <div>
                <h2 className="text-3xl font-semibold mb-2">Static Detection</h2>
                <p className="text-lg leading-relaxed mb-4">
                  Upload historical log files for analysis:
                </p>
                <ol className="list-decimal list-inside space-y-3 text-lg">
                  <li>Navigate to the Homepage</li>
                  <li>
                    Drag and drop your .xlsx or .csv files into the upload zone,
                    or click "Browse Files"
                  </li>
                  <li>Wait for the file to be processed (typically 1-3 minutes)</li>
                  <li>
                    Once complete, click "View Report" to see detected anomalies
                  </li>
                </ol>
              </div>
            </div>
          </Card>

          {/* Active Detection */}
          <Card className="p-8">
            <div className="flex items-start gap-4 mb-4">
              <Zap className="w-10 h-10 text-primary shrink-0" />
              <div>
                <h2 className="text-3xl font-semibold mb-2">Active Detection</h2>
                <p className="text-lg leading-relaxed mb-4">
                  Monitor your systems in real-time:
                </p>
                <ol className="list-decimal list-inside space-y-3 text-lg">
                  <li>Click "Run Active Anomaly Detection" on the Homepage</li>
                  <li>
                    The system will begin monitoring configured data sources
                  </li>
                  <li>
                    Anomalies are detected automatically and added to your
                    dashboard
                  </li>
                  <li>
                    You'll receive notifications for high-severity anomalies
                  </li>
                </ol>
              </div>
            </div>
          </Card>

          {/* Reports */}
          <Card className="p-8">
            <div className="flex items-start gap-4 mb-4">
              <FileText className="w-10 h-10 text-primary shrink-0" />
              <div>
                <h2 className="text-3xl font-semibold mb-2">
                  Managing Reports
                </h2>
                <p className="text-lg leading-relaxed mb-4">
                  Access and manage your detection reports:
                </p>
                <ul className="list-disc list-inside space-y-3 text-lg">
                  <li>
                    View all reports in the Reports Dashboard
                  </li>
                  <li>
                    Click on any report to see detailed findings
                  </li>
                  <li>
                    Export reports as PDF or Excel for sharing
                  </li>
                  <li>
                    Use the search and filter options to find specific reports
                  </li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Understanding Severity */}
          <Card className="p-8">
            <div className="flex items-start gap-4 mb-4">
              <AlertTriangle className="w-10 h-10 text-primary shrink-0" />
              <div>
                <h2 className="text-3xl font-semibold mb-2">
                  Understanding Severity Levels
                </h2>
                <div className="space-y-4 mt-4">
                  <div>
                    <h3 className="text-xl font-semibold text-danger mb-2">
                      High Severity
                    </h3>
                    <p className="text-lg">
                      Critical issues requiring immediate attention. May indicate
                      security threats, system failures, or data breaches.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-warning mb-2">
                      Medium Severity
                    </h3>
                    <p className="text-lg">
                      Significant anomalies that should be investigated soon.
                      May affect system performance or indicate emerging issues.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-info mb-2">
                      Low Severity
                    </h3>
                    <p className="text-lg">
                      Minor anomalies that may be worth noting but don't require
                      urgent action. Useful for identifying patterns over time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Best Practices */}
          <Card className="p-8">
            <div className="flex items-start gap-4 mb-4">
              <CheckCircle className="w-10 h-10 text-success shrink-0" />
              <div>
                <h2 className="text-3xl font-semibold mb-2">Best Practices</h2>
                <ul className="list-disc list-inside space-y-3 text-lg">
                  <li>
                    Upload logs regularly to maintain a comprehensive view of
                    your system health
                  </li>
                  <li>
                    Review high-severity anomalies within 24 hours of detection
                  </li>
                  <li>
                    Use the export feature to share reports with your security
                    team
                  </li>
                  <li>
                    Configure active detection for critical systems that require
                    continuous monitoring
                  </li>
                  <li>
                    Archive older reports to keep your dashboard organized
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
  );
};

export default InstructionsPage;
