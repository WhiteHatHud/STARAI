import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  Eye,
  Download,
  Trash2,
  AlertTriangle,
  Plus,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { createClient } from "@/lib/api-client";
import useStore from "@/store";
import axios from "@/lib/axios";

interface SeverityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface Report {
  id: string;
  title: string;
  generatedDate: Date;
  status: "complete" | "processing" | "error";
  anomalyCount: number;
  severityBreakdown?: SeverityBreakdown;
}

const ReportDashboardPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useStore();

  // Create API client
  const apiClient = useMemo(() => {
    return createClient({
      baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
      getToken: () => token,
    });
  }, [token]);

  // Fetch datasets and filter for those with LLM analysis complete
  useEffect(() => {
    const fetchReports = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const datasets = await apiClient.datasets.list();
        console.log("Fetched datasets:", datasets);

        // Map datasets to reports format, only include those with completed analysis
        const mappedReportsPromises = datasets
          .filter((dataset: any) => {
            // Only show datasets that have been analyzed or are in progress
            return ["analyzed", "triaging", "completed", "error"].includes(dataset.status);
          })
          .map(async (dataset: any) => {
            let status: Report["status"] = "processing";

            if (dataset.status === "completed") {
              status = "complete";
            } else if (dataset.status === "error") {
              status = "error";
            } else if (["analyzed", "triaging"].includes(dataset.status)) {
              status = "processing";
            }

            // Fetch LLM explanations to calculate severity breakdown
            let severityBreakdown: SeverityBreakdown | undefined;

            if (dataset.status === "completed") {
              try {
                const explanations = await apiClient.datasets.getLLMExplanations(dataset.id);

                if (explanations && explanations.length > 0) {
                  severityBreakdown = {
                    critical: explanations.filter((e: any) => e.severity === "critical").length,
                    high: explanations.filter((e: any) => e.severity === "high").length,
                    medium: explanations.filter((e: any) => e.severity === "medium").length,
                    low: explanations.filter((e: any) => e.severity === "low").length,
                  };
                }
              } catch (error) {
                console.error(`Error fetching explanations for dataset ${dataset.id}:`, error);
              }
            }

            return {
              id: dataset.id,
              title: dataset.original_filename || dataset.filename || "Untitled Report",
              generatedDate: new Date(dataset.triaged_at || dataset.analyzed_at || dataset.uploaded_at),
              status,
              anomalyCount: dataset.llm_explanations_count || dataset.anomaly_count || 0,
              severityBreakdown,
            };
          });

        const mappedReports = await Promise.all(mappedReportsPromises);
        setReports(mappedReports);
      } catch (error) {
        console.error("Error fetching reports:", error);
        toast({
          title: "Error",
          description: "Failed to load reports",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [apiClient, token]);

  const filteredReports = reports
    .filter((report) =>
      report.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "date":
          return b.generatedDate.getTime() - a.generatedDate.getTime();
        case "anomalies":
          return b.anomalyCount - a.anomalyCount;
        case "status":
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

  const handleDelete = async (id: string) => {
    try {
      await apiClient.datasets.delete(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast({
        title: "Report Deleted",
        description: "The report has been successfully deleted",
      });
    } catch (error) {
      console.error("Error deleting report:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete the report",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async (reportId: string) => {
    try {
      toast({
        title: "Generating PDF",
        description: "Creating your report PDF. This may take a moment...",
      });

      // Call the PDF export endpoint
      const response = await axios.get(
        `/anomaly/datasets/${reportId}/export-pdf?include_recommendations=true&include_mitre=true`,
        {
          responseType: 'blob', // Important for binary data
        }
      );

      // Create a download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `anomaly_report_${reportId}.pdf`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: "Your report has been downloaded successfully.",
      });

    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF report",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="container max-w-7xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            Reports Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">
            View and manage all anomaly detection reports
          </p>
        </div>

        {/* Top Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-[50px] text-lg"
            />
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-[250px] h-[50px] text-lg">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Sort by Date</SelectItem>
              <SelectItem value="anomalies">Sort by Anomaly Count</SelectItem>
              <SelectItem value="status">Sort by Status</SelectItem>
            </SelectContent>
          </Select>

          <Button size="lg" onClick={() => navigate("/home")} className="button-hover-grow">
            <Plus size={20} />
            Generate New Report
          </Button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg text-muted-foreground">Loading reports...</p>
          </div>
        ) : (
          <>
            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReports.map((report) => (
            <Card
              key={report.id}
              className="p-6 interactive-card card-hover-bg border-2"
              onClick={() => navigate(`/reports/${report.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <FileText className="w-10 h-10 text-primary" />
                {report.status === "complete" && (
                  <Badge
                    variant="secondary"
                    className="bg-success/20 text-success"
                  >
                    Complete
                  </Badge>
                )}
                {report.status === "processing" && (
                  <Badge
                    variant="secondary"
                    className="bg-warning/20 text-warning"
                  >
                    Processing
                  </Badge>
                )}
                {report.status === "error" && (
                  <Badge variant="secondary" className="bg-danger/20 text-danger">
                    Error
                  </Badge>
                )}
              </div>

              <h3 className="text-xl font-bold mb-2 line-clamp-2">
                {report.title}
              </h3>
              <p className="text-base text-muted-foreground mb-4">
                {formatDate(report.generatedDate)}
              </p>

              {/* Show anomaly count for both processing and complete statuses */}
              {(report.status === "complete" || report.status === "processing") && report.anomalyCount > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-primary" />
                    <span className="text-lg font-semibold text-primary">
                      {report.anomalyCount} Anomalies Detected
                    </span>
                  </div>
                  {report.status === "processing" && (
                    <p className="text-sm text-muted-foreground mt-1 ml-7">
                      Run LLM analysis to get detailed severity breakdown
                    </p>
                  )}
                </div>
              )}

              {/* Show severity breakdown only for completed reports */}
              {report.status === "complete" && report.severityBreakdown && (
                <div className="mb-6 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Severity Breakdown:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {report.severityBreakdown.critical > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full bg-danger"></div>
                        <span className="font-medium">Critical:</span>
                        <span className="text-danger font-bold">
                          {report.severityBreakdown.critical}
                        </span>
                      </div>
                    )}
                    {report.severityBreakdown.high > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span className="font-medium">High:</span>
                        <span className="text-orange-500 font-bold">
                          {report.severityBreakdown.high}
                        </span>
                      </div>
                    )}
                    {report.severityBreakdown.medium > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full bg-warning"></div>
                        <span className="font-medium">Medium:</span>
                        <span className="text-warning font-bold">
                          {report.severityBreakdown.medium}
                        </span>
                      </div>
                    )}
                    {report.severityBreakdown.low > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full bg-info"></div>
                        <span className="font-medium">Low:</span>
                        <span className="text-info font-bold">
                          {report.severityBreakdown.low}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(report.status === "complete" || report.status === "processing") && (
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/reports/${report.id}`);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    {report.status === "processing" ? "View Progress" : "View"}
                  </Button>
                  {report.status === "complete" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportPDF(report.id);
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(report.id);
                    }}
                    className="text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </Card>
              ))}
            </div>

            {filteredReports.length === 0 && (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-xl text-muted-foreground">No reports found</p>
              </div>
            )}
          </>
        )}
      </div>
  );
};

export default ReportDashboardPage;
