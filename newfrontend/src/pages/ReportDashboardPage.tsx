import { useState } from "react";
import MainLayout from "@/components/MainLayout";
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface Report {
  id: string;
  title: string;
  generatedDate: Date;
  status: "complete" | "processing" | "error";
  anomalyCount: number;
}

const ReportDashboardPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");

  const [reports, setReports] = useState<Report[]>([
    {
      id: "1",
      title: "System Logs January 2024",
      generatedDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
      status: "complete",
      anomalyCount: 47,
    },
    {
      id: "2",
      title: "Network Traffic Analysis",
      generatedDate: new Date(Date.now() - 1000 * 60 * 60 * 48),
      status: "complete",
      anomalyCount: 23,
    },
    {
      id: "3",
      title: "Application Logs Q1",
      generatedDate: new Date(Date.now() - 1000 * 60 * 60 * 12),
      status: "processing",
      anomalyCount: 0,
    },
    {
      id: "4",
      title: "Security Events December",
      generatedDate: new Date(Date.now() - 1000 * 60 * 60 * 72),
      status: "complete",
      anomalyCount: 89,
    },
    {
      id: "5",
      title: "Database Activity Logs",
      generatedDate: new Date(Date.now() - 1000 * 60 * 60 * 36),
      status: "complete",
      anomalyCount: 12,
    },
    {
      id: "6",
      title: "API Request Patterns",
      generatedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      status: "complete",
      anomalyCount: 31,
    },
  ]);

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

  const handleDelete = (id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    toast({
      title: "Report Deleted",
      description: "The report has been successfully deleted",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <MainLayout>
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

          <Button size="lg" onClick={() => navigate("/home")}>
            <Plus size={20} />
            Generate New Report
          </Button>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <Card
              key={report.id}
              className="p-6 hover-lift border-2 hover:border-primary cursor-pointer transition-all"
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

              {report.status === "complete" && (
                <div className="flex items-center gap-2 mb-6">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                  <span className="text-lg font-semibold text-primary">
                    {report.anomalyCount} Anomalies
                  </span>
                </div>
              )}

              {report.status === "complete" && (
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
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast({
                        title: "Exporting Report",
                        description: "Your report is being exported...",
                      });
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
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
      </div>
    </MainLayout>
  );
};

export default ReportDashboardPage;
