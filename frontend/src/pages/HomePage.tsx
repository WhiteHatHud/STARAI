import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FolderOpen,
  Zap,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import useStore from "@/store";
import { createClient } from "@/lib/api-client";

interface UploadedFile {
  id: string;
  name: string;
  uploadTime: Date;
  status: "uploading" | "uploaded" | "autoencoding" | "autoencoded" | "analyzing" | "analyzed" | "failed";
}

const HomePage = () => {
  const navigate = useNavigate();
  const { user, token } = useStore();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);

  // Create API client with token
  const apiClient = useMemo(() => {
    return createClient({
      baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
      getToken: () => token,
    });
  }, [token]);

  // Fetch existing datasets on mount
  useEffect(() => {
    const fetchDatasets = async () => {
      if (!token) {
        setLoadingDatasets(false);
        return;
      }

      try {
        const datasets = await apiClient.datasets.list();
        console.log("Fetched datasets:", datasets);

        // Map backend datasets to UploadedFile format
        const mappedFiles: UploadedFile[] = datasets.map((dataset: any) => {
          // Map backend status to frontend status
          let frontendStatus: UploadedFile["status"] = "uploaded";

          switch (dataset.status) {
            case "uploaded":
              frontendStatus = "uploaded";
              break;
            case "analyzing":
              frontendStatus = "autoencoding";
              break;
            case "analyzed":
              frontendStatus = "autoencoded";
              break;
            case "triaging":
              frontendStatus = "analyzing";
              break;
            case "completed":
              frontendStatus = "analyzed";
              break;
            case "error":
              frontendStatus = "failed";
              break;
            default:
              frontendStatus = "uploaded";
          }

          return {
            id: dataset.id,
            name: dataset.filename || dataset.original_filename || "Unknown",
            uploadTime: new Date(dataset.uploaded_at),
            status: frontendStatus,
          };
        });

        setUploadedFiles(mappedFiles);
      } catch (error) {
        console.error("Error fetching datasets:", error);
        // Don't show error toast on initial load
      } finally {
        setLoadingDatasets(false);
      }
    };

    fetchDatasets();
  }, [apiClient, token]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".csv")) {
        const newFile: UploadedFile = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          uploadTime: new Date(),
          status: "uploading",
        };

        setUploadedFiles((prev) => [newFile, ...prev]);

        toast({
          title: "File Upload Started",
          description: `Uploading ${file.name} to S3...`,
        });

        try {
          // Upload using API client
          const uploadResult = await apiClient.datasets.upload(file);
          console.log("Upload successful:", uploadResult);

          // Extract dataset ID - handle both 'id' and '_id' fields
          const datasetId = uploadResult.id || (uploadResult as any)._id;

          if (!datasetId) {
            throw new Error("No dataset ID returned from server");
          }

          console.log("Dataset ID:", datasetId);

          // Update file with actual dataset ID from backend
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === newFile.id
                ? { ...f, id: datasetId, status: "uploaded" }
                : f
            )
          );

          toast({
            title: "Upload Complete",
            description: `${file.name} uploaded successfully. Click "Autoencode" to continue.`,
          });

        } catch (error) {
          console.error("Error uploading file:", error);
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === newFile.id ? { ...f, status: "failed" } : f
            )
          );
          toast({
            title: "Upload Failed",
            description: error instanceof Error ? error.message : "Unknown error occurred",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please upload .xlsx or .csv files only",
          variant: "destructive",
        });
      }
    }
  };

  const handleActiveDetection = () => {
    toast({
      title: "Active Detection Started",
      description: "Monitoring system logs for anomalies...",
    });
  };

  const handleAutoencode = async (fileId: string) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: "autoencoding" } : f))
    );
    toast({
      title: "Autoencoding Started",
      description: "Running anomaly detection analysis...",
    });

    try {
      // Start analysis using API client
      const data = await apiClient.datasets.analyze(fileId);
      console.log("Analysis started:", data);

      // Start polling for progress
      pollAnalysisProgress(fileId);

    } catch (error) {
      console.error("Error starting analysis:", error);
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "failed" } : f))
      );
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const pollAnalysisProgress = async (datasetId: string) => {
    try {
      const statusData = await apiClient.datasets.status(datasetId);
      console.log("Dataset status:", statusData);

      // Update file status based on API response
      // Backend: "analyzing" → Frontend: "autoencoding"
      // Backend: "analyzed" → Frontend: "autoencoded"
      if (statusData.status === "analyzing") {
        // Continue polling
        setTimeout(() => pollAnalysisProgress(datasetId), 2000);
      } else if (statusData.status === "analyzed") {
        // Analysis complete - ready for LLM analysis
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === datasetId ? { ...f, status: "autoencoded" } : f))
        );
        toast({
          title: "Autoencoding Complete",
          description: `Found ${statusData.anomaly_count || 0} anomalies. Click 'Analyze' to generate LLM explanations.`,
        });
      } else if (statusData.status === "error") {
        // Analysis failed
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === datasetId ? { ...f, status: "failed" } : f))
        );
        toast({
          title: "Analysis Failed",
          description: statusData.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error checking analysis status:", error);
      // Stop polling on error
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === datasetId ? { ...f, status: "failed" } : f))
      );
      toast({
        title: "Status Check Failed",
        description: "Could not check analysis progress",
        variant: "destructive",
      });
    }
  };

  const handleAnalyze = async (fileId: string) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: "analyzing" } : f))
    );
    toast({
      title: "Analysis Started",
      description: "Generating detailed explanations...",
    });

    try {
      // Start LLM analysis using API client
      const data = await apiClient.datasets.startLLMAnalysis(fileId);
      console.log("LLM analysis started:", data);

      // Start polling for LLM analysis completion
      pollLLMAnalysisProgress(fileId);

    } catch (error) {
      console.error("Error starting LLM analysis:", error);
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "failed" } : f))
      );
      toast({
        title: "LLM Analysis Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const pollLLMAnalysisProgress = async (datasetId: string) => {
    try {
      const statusData = await apiClient.datasets.status(datasetId);
      console.log("LLM Analysis status:", statusData);

      // Backend: "triaging" → Frontend: "analyzing"
      // Backend: "completed" → Frontend: "analyzed"
      if (statusData.status === "triaging") {
        // Continue polling
        setTimeout(() => pollLLMAnalysisProgress(datasetId), 3000);
      } else if (statusData.status === "completed") {
        // Analysis complete - fetch the actual explanations
        try {
          const explanations = await apiClient.datasets.getLLMExplanations(datasetId);
          console.log("LLM explanations received:", explanations);

          // Store explanations in localStorage for ReportEditor
          localStorage.setItem(`anomaly-data-${datasetId}`, JSON.stringify(explanations));
        } catch (explError) {
          console.error("Error fetching explanations:", explError);
        }

        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === datasetId ? { ...f, status: "analyzed" } : f))
        );
        toast({
          title: "Analysis Complete",
          description: "Report is ready. Click 'View Report' to see details.",
        });
      } else if (statusData.status === "error") {
        // Analysis failed
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === datasetId ? { ...f, status: "failed" } : f))
        );
        toast({
          title: "LLM Analysis Failed",
          description: statusData.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error checking LLM analysis status:", error);
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === datasetId ? { ...f, status: "failed" } : f))
      );
      toast({
        title: "Status Check Failed",
        description: "Could not check LLM analysis progress",
        variant: "destructive",
      });
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);

    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleDeleteAll = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No Datasets",
        description: "There are no datasets to delete",
        variant: "destructive",
      });
      return;
    }

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete all ${uploadedFiles.length} datasets? This action cannot be undone.`)) {
      return;
    }

    try {
      toast({
        title: "Deleting All Datasets",
        description: "Please wait while we delete all datasets...",
      });

      await apiClient.datasets.deleteAll();

      // Clear the uploaded files list
      setUploadedFiles([]);

      toast({
        title: "All Datasets Deleted",
        description: "Successfully deleted all datasets and associated data",
      });
    } catch (error) {
      console.error("Error deleting all datasets:", error);
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete all datasets",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container max-w-7xl mx-auto p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-2">
          Anomaly Detection Dashboard
        </h1>
        <p className="text-lg text-muted-foreground">
          Upload files or run active detection to identify anomalies
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* LEFT COLUMN - Detection Options */}
        <div className="space-y-8">
          {/* Static Detection */}
          <div>
            <h2 className="text-3xl font-semibold mb-6">Static Detection</h2>

            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-8 mb-4 transition-all duration-200
                ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }
                cursor-pointer
              `}
            >
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <Upload className="w-16 h-16 text-primary" />
                <div>
                  <p className="text-xl font-medium mb-1">
                    Drag & drop files here
                  </p>
                  <p className="text-base text-muted-foreground">
                    Supports .xlsx and .csv files
                  </p>
                </div>
              </div>
            </div>

            {/* File Browser Button */}
            <label htmlFor="file-input">
              <Button variant="outline" size="lg" className="w-full" asChild>
                <span>
                  <FolderOpen size={24} />
                  Browse Files
                </span>
              </Button>
            </label>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.csv"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* Active Detection */}
          <div>
            <h2 className="text-3xl font-semibold mb-4">Active Detection</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Automatically detect and analyze system logs
            </p>
            <Button size="lg" className="w-full" onClick={handleActiveDetection}>
              <Zap size={24} />
              Run Active Anomaly Detection
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN - Uploaded Files & Reports */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-semibold">Recent Uploads</h2>
            {uploadedFiles.length > 0 && (
              <Button
                variant="destructive"
                size="lg"
                onClick={handleDeleteAll}
                className="gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Delete All Datasets
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {loadingDatasets ? (
              <Card className="p-12">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-lg text-muted-foreground">Loading datasets...</p>
                </div>
              </Card>
            ) : uploadedFiles.length === 0 ? (
              <Card className="p-12">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <FileSpreadsheet className="w-16 h-16 text-muted-foreground/50" />
                  <div className="text-center">
                    <p className="text-lg font-medium text-foreground">No datasets yet</p>
                    <p className="text-muted-foreground">
                      Upload your first dataset to get started
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              uploadedFiles.map((file) => (
                <Card
                  key={file.id}
                  className="p-6 hover-lift border-2 hover:border-primary"
                >
                  <div className="flex items-start gap-4">
                    <FileSpreadsheet className="w-8 h-8 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold mb-1 truncate">
                        {file.name}
                      </h3>
                      <p className="text-base text-muted-foreground mb-3">
                        {formatTime(file.uploadTime)}
                      </p>
                      
                      {/* Status Badges */}
                      {file.status === "uploading" && (
                        <div className="mb-4">
                          <Badge
                            variant="secondary"
                            className="bg-warning/20 text-warning"
                          >
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading to S3
                          </Badge>
                        </div>
                      )}
                      
                      {file.status === "uploaded" && (
                        <div className="mb-4">
                          <Badge
                            variant="secondary"
                            className="bg-success/20 text-success"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Uploaded to S3
                          </Badge>
                        </div>
                      )}

                      {file.status === "autoencoding" && (
                        <div className="mb-4">
                          <Badge
                            variant="secondary"
                            className="bg-warning/20 text-warning"
                          >
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Autoencoding...
                          </Badge>
                        </div>
                      )}

                      {file.status === "autoencoded" && (
                        <div className="mb-4">
                          <Badge
                            variant="secondary"
                            className="bg-success/20 text-success"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Autoencoded
                          </Badge>
                        </div>
                      )}

                      {file.status === "analyzing" && (
                        <div className="mb-4">
                          <Badge
                            variant="secondary"
                            className="bg-warning/20 text-warning"
                          >
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing with LLM...
                          </Badge>
                        </div>
                      )}

                      {file.status === "analyzed" && (
                        <div className="mb-4">
                          <Badge
                            variant="secondary"
                            className="bg-success/20 text-success"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Analysis Complete
                          </Badge>
                        </div>
                      )}
                      
                      {file.status === "failed" && (
                        <div className="mb-4">
                          <Badge
                            variant="secondary"
                            className="bg-danger/20 text-danger"
                          >
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Failed
                          </Badge>
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      {file.status === "uploaded" && (
                        <Button
                          size="sm"
                          onClick={() => handleAutoencode(file.id)}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Autoencode
                        </Button>
                      )}

                      {file.status === "autoencoded" && (
                        <Button
                          size="sm"
                          onClick={() => handleAnalyze(file.id)}
                        >
                          <Loader2 className="w-4 h-4 mr-2" />
                          Analyze
                        </Button>
                      )}

                      {file.status === "analyzed" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => navigate(`/reports/${file.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Report
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => navigate("/reports/dashboard")}
          >
            View All Reports
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
