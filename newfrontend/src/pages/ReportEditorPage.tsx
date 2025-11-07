import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MainLayout from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  FileDown,
  Share2,
  Trash2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Activity,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Anomaly {
  id: string;
  timestamp: string;
  logEntry: string;
  severity: "high" | "medium" | "low";
  anomalyScore: number;
  details: string;
}

const ReportEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reportTitle, setReportTitle] = useState("System Logs January 2024");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const mockAnomalies: Anomaly[] = [
    {
      id: "1",
      timestamp: "2024-01-15 14:32:11",
      logEntry: "Unusual database query pattern detected",
      severity: "high",
      anomalyScore: 94,
      details: "Multiple SELECT queries with UNION statements from unfamiliar IP address",
    },
    {
      id: "2",
      timestamp: "2024-01-15 15:01:43",
      logEntry: "Failed authentication attempts from 192.168.1.105",
      severity: "high",
      anomalyScore: 89,
      details: "15 consecutive failed login attempts within 2 minutes",
    },
    {
      id: "3",
      timestamp: "2024-01-15 16:22:07",
      logEntry: "Abnormal memory usage spike in service worker",
      severity: "medium",
      anomalyScore: 72,
      details: "Memory consumption increased from 2GB to 8GB in 30 seconds",
    },
    {
      id: "4",
      timestamp: "2024-01-15 17:45:29",
      logEntry: "Unexpected API endpoint access pattern",
      severity: "medium",
      anomalyScore: 68,
      details: "API endpoint /admin/users accessed outside normal hours",
    },
    {
      id: "5",
      timestamp: "2024-01-15 18:10:55",
      logEntry: "Configuration file modified",
      severity: "low",
      anomalyScore: 45,
      details: "System config.yml modified by non-admin user",
    },
  ];

  const handleExportPDF = () => {
    toast({
      title: "Exporting PDF",
      description: "Your report is being exported as PDF...",
    });
  };

  const handleExportExcel = () => {
    toast({
      title: "Exporting Excel",
      description: "Your report is being exported as Excel...",
    });
  };

  const handleShare = () => {
    toast({
      title: "Share Report",
      description: "Share functionality coming soon",
    });
  };

  const handleDelete = () => {
    toast({
      title: "Report Deleted",
      description: "The report has been deleted",
      variant: "destructive",
    });
    navigate("/reports/dashboard");
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-danger/20 text-danger";
      case "medium":
        return "bg-warning/20 text-warning";
      case "low":
        return "bg-info/20 text-info";
      default:
        return "";
    }
  };

  const severityCount = {
    high: mockAnomalies.filter((a) => a.severity === "high").length,
    medium: mockAnomalies.filter((a) => a.severity === "medium").length,
    low: mockAnomalies.filter((a) => a.severity === "low").length,
  };

  return (
    <MainLayout>
      <div className="container max-w-7xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <Input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            className="text-4xl font-bold border-none p-0 h-auto mb-4 focus-visible:ring-0"
          />
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2 text-base text-muted-foreground">
              <Clock className="w-5 h-5" />
              <span>Generated: Jan 15, 2024</span>
            </div>
            <Badge variant="secondary" className="bg-success/20 text-success">
              Complete
            </Badge>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold">
                {mockAnomalies.length} Anomalies Detected
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={handleExportPDF}>
              <FileDown className="w-5 h-5 mr-2" />
              Export PDF
            </Button>
            <Button size="lg" variant="outline" onClick={handleExportExcel}>
              <FileDown className="w-5 h-5 mr-2" />
              Export Excel
            </Button>
            <Button size="lg" variant="outline" onClick={handleShare}>
              <Share2 className="w-5 h-5 mr-2" />
              Share
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={handleDelete}
              className="text-danger hover:bg-danger/10 ml-auto"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 h-[60px]">
            <TabsTrigger value="summary" className="text-lg">
              Summary
            </TabsTrigger>
            <TabsTrigger value="findings" className="text-lg">
              Detailed Findings
            </TabsTrigger>
            <TabsTrigger value="visualizations" className="text-lg">
              Visualizations
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="text-lg">
              Recommendations
            </TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-8">
            <Card className="p-8">
              <h3 className="text-2xl font-semibold mb-4">Executive Summary</h3>
              <p className="text-lg leading-relaxed text-foreground">
                Analysis of system logs from January 2024 revealed {mockAnomalies.length} anomalies
                across various severity levels. The detection system identified unusual patterns
                in database queries, authentication attempts, and system resource usage. Immediate
                attention is recommended for {severityCount.high} high-severity anomalies that
                may indicate potential security threats or system instabilities.
              </p>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6 border-2 border-primary">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-medium text-muted-foreground">
                    Total Anomalies
                  </span>
                  <Activity className="w-6 h-6 text-primary" />
                </div>
                <p className="text-4xl font-bold text-primary">
                  {mockAnomalies.length}
                </p>
              </Card>

              <Card className="p-6 border-2 border-danger">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-medium text-muted-foreground">
                    High Severity
                  </span>
                  <AlertTriangle className="w-6 h-6 text-danger" />
                </div>
                <p className="text-4xl font-bold text-danger">
                  {severityCount.high}
                </p>
              </Card>

              <Card className="p-6 border-2 border-warning">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-medium text-muted-foreground">
                    Medium Severity
                  </span>
                  <TrendingUp className="w-6 h-6 text-warning" />
                </div>
                <p className="text-4xl font-bold text-warning">
                  {severityCount.medium}
                </p>
              </Card>

              <Card className="p-6 border-2 border-info">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-medium text-muted-foreground">
                    Low Severity
                  </span>
                  <Activity className="w-6 h-6 text-info" />
                </div>
                <p className="text-4xl font-bold text-info">
                  {severityCount.low}
                </p>
              </Card>
            </div>
          </TabsContent>

          {/* Detailed Findings Tab */}
          <TabsContent value="findings">
            <Card className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-lg w-12"></TableHead>
                    <TableHead className="text-lg">Timestamp</TableHead>
                    <TableHead className="text-lg">Log Entry</TableHead>
                    <TableHead className="text-lg">Severity</TableHead>
                    <TableHead className="text-lg">Anomaly Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockAnomalies.map((anomaly) => (
                    <>
                      <TableRow
                        key={anomaly.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          setExpandedRow(
                            expandedRow === anomaly.id ? null : anomaly.id
                          )
                        }
                      >
                        <TableCell>
                          {expandedRow === anomaly.id ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </TableCell>
                        <TableCell className="text-base">
                          {anomaly.timestamp}
                        </TableCell>
                        <TableCell className="text-base">
                          {anomaly.logEntry}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={getSeverityColor(anomaly.severity)}
                          >
                            {anomaly.severity.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Progress
                              value={anomaly.anomalyScore}
                              className="w-24 h-3"
                            />
                            <span className="text-base font-semibold">
                              {anomaly.anomalyScore}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedRow === anomaly.id && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/50">
                            <div className="p-4">
                              <p className="text-base font-semibold mb-2">
                                Details:
                              </p>
                              <p className="text-base text-foreground">
                                {anomaly.details}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Visualizations Tab */}
          <TabsContent value="visualizations">
            <Card className="p-8">
              <h3 className="text-2xl font-semibold mb-4">
                Anomaly Distribution
              </h3>
              <p className="text-lg text-muted-foreground">
                Visualization charts will be displayed here
              </p>
            </Card>
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations">
            <Card className="p-8">
              <h3 className="text-2xl font-semibold mb-6">
                Action Items & Recommendations
              </h3>
              <div className="space-y-6">
                <div className="border-l-4 border-danger pl-6 py-2">
                  <h4 className="text-xl font-semibold mb-2 text-danger">
                    Critical: Investigate Database Query Patterns
                  </h4>
                  <p className="text-lg text-foreground">
                    Review and block suspicious IP addresses attempting SQL injection
                    attacks. Implement additional query validation and monitoring.
                  </p>
                </div>
                <div className="border-l-4 border-danger pl-6 py-2">
                  <h4 className="text-xl font-semibold mb-2 text-danger">
                    Critical: Strengthen Authentication Security
                  </h4>
                  <p className="text-lg text-foreground">
                    Implement rate limiting on authentication endpoints and consider
                    adding CAPTCHA after multiple failed attempts.
                  </p>
                </div>
                <div className="border-l-4 border-warning pl-6 py-2">
                  <h4 className="text-xl font-semibold mb-2 text-warning">
                    Medium Priority: Monitor Resource Usage
                  </h4>
                  <p className="text-lg text-foreground">
                    Set up alerts for abnormal memory consumption patterns and
                    investigate the service worker memory leak.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default ReportEditorPage;
