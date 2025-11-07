import { useState, useCallback, useEffect, useRef } from "react";
import MainLayout from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import axios from "@/lib/axios";
import useStore from "@/store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Dataset {
  id: string;
  filename: string;
  uploaded_at: string;
  status?: string;
  analysis_status?: "pending" | "processing" | "completed" | "failed";
  analyzed_at?: string;
  anomaly_count?: number;
  file_size?: number;
}

const HomePage = () => {
  const navigate = useNavigate();
  const { user, token } = useStore();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const dataFetchedRef = useRef(false);

  // Fetch all uploaded datasets
  const fetchDatasets = useCallback(async () => {
    if (dataFetchedRef.current) return;

    setLoading(true);
    try {
      const response = await axios.get("/anomaly/datasets/");

      // Sort by upload date (newest first)
      const sortedDatasets = (response.data || []).sort(
        (a: Dataset, b: Dataset) =>
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      );

      setDatasets(sortedDatasets);
      dataFetchedRef.current = true;
    } catch (error) {
      console.error("Error fetching datasets:", error);
      toast({
        title: "Error",
        description: "Failed to load uploaded datasets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

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
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file: File) => {
    // Validate .xlsx and .csv only
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
    const isCsv = file.name.toLowerCase().endsWith(".csv");

    if (!isXlsx && !isCsv) {
      toast({
        title: "Invalid File Type",
        description:
          "Only .xlsx and .csv files are supported. PDFs, images, and other formats are not allowed.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await axios.post("/anomaly/datasets/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast({
        title: "Upload Successful",
        description: `${file.name} has been uploaded successfully`,
      });

      // Extract dataset ID (try both 'id' and '_id' fields)
      const datasetId = uploadResponse.data.id || uploadResponse.data._id;

      console.log("Upload response:", uploadResponse.data);
      console.log("Dataset ID:", datasetId);

      if (!datasetId) {
        console.error("No dataset ID in response:", uploadResponse.data);
        toast({
          title: "Upload Warning",
          description: "File uploaded but analysis cannot start (no dataset ID)",
          variant: "destructive",
        });
        // Refresh the dataset list
        dataFetchedRef.current = false;
        fetchDatasets();
        return;
      }

      // Immediately trigger analysis
      toast({
        title: "Analysis Started",
        description: "Running autoencoder anomaly detection...",
      });

      // Trigger analysis in the background
      axios
        .post(`/anomaly/datasets/${datasetId}/analyze-test`, {})
        .then((analysisResponse) => {
          toast({
            title: "Analysis Complete",
            description: `Detected ${analysisResponse.data.anomalies_detected || 0} anomalies`,
          });
          // Refresh the dataset list to show updated status
          dataFetchedRef.current = false;
          fetchDatasets();
        })
        .catch((error) => {
          console.error("Analysis error:", error);
          toast({
            title: "Analysis Failed",
            description: error.response?.data?.detail || "Failed to analyze dataset",
            variant: "destructive",
          });
          // Refresh anyway to show failed status
          dataFetchedRef.current = false;
          fetchDatasets();
        });

      // Refresh the dataset list immediately to show "Processing" status
      dataFetchedRef.current = false;
      fetchDatasets();
    } catch (error: any) {
      console.error("Upload error:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to upload file. Please try again.";
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${kb.toFixed(2)} KB`;
  };

  const getStatusBadge = (dataset: Dataset) => {
    // If analyzed_at exists, it's completed
    if (dataset.analyzed_at) {
      return {
        label: "Ready",
        variant: "default" as const,
        icon: CheckCircle,
      };
    }

    // Check analysis_status if it exists
    if (dataset.analysis_status === "processing") {
      return {
        label: "Processing",
        variant: "secondary" as const,
        icon: Loader2,
      };
    }

    if (dataset.analysis_status === "failed") {
      return {
        label: "Failed",
        variant: "destructive" as const,
        icon: AlertCircle,
      };
    }

    // Default to processing if just uploaded
    return {
      label: "Processing",
      variant: "secondary" as const,
      icon: Loader2,
    };
  };

  const handleActiveDetection = () => {
    toast({
      title: "Active Detection Started",
      description: "Monitoring system logs for anomalies in real-time...",
    });
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      // Call API to delete all datasets
      await axios.delete("/anomaly/datasets/delete-all");

      toast({
        title: "All Data Deleted",
        description: "All datasets and S3 files have been permanently deleted",
      });

      // Clear the datasets list
      setDatasets([]);
      dataFetchedRef.current = false;
    } catch (error: any) {
      console.error("Delete all error:", error);
      toast({
        title: "Delete Failed",
        description: error.response?.data?.detail || "Failed to delete all datasets",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">
          Welcome back, {user?.username || "User"}! 👋
        </h1>
        <p className="text-xl text-muted-foreground">
          Upload your dataset to begin anomaly detection analysis
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Upload & Active Detection */}
        <div className="space-y-8">
          {/* Upload Section */}
          <Card className="p-8">
        <div
          className={`border-2 border-dashed rounded-xl p-12 transition-all duration-200 ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="p-6 rounded-full bg-primary/10">
              {uploading ? (
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
              ) : (
                <Upload className="w-16 h-16 text-primary" />
              )}
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-2xl font-semibold text-foreground">
                {uploading ? "Uploading..." : "Upload Dataset"}
              </h3>
              <p className="text-muted-foreground">
                Drag and drop your file here, or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                Supported formats: .xlsx, .csv
              </p>
            </div>

            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept=".xlsx,.csv"
              onChange={handleFileInput}
              disabled={uploading}
            />
            <Button
              size="lg"
              disabled={uploading}
              onClick={() => document.getElementById("file-upload")?.click()}
              type="button"
            >
              <FileSpreadsheet className="mr-2 h-5 w-5" />
              {uploading ? "Uploading..." : "Select File"}
            </Button>
          </div>
        </div>
      </Card>

          {/* Active Detection Section */}
          <Card className="p-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-foreground">
                  Active Detection
                </h3>
                <p className="text-muted-foreground">
                  Monitor system logs in real-time for anomalies and suspicious activity
                </p>
              </div>

              <div className="flex flex-col items-center justify-center space-y-4 p-8 border-2 border-dashed border-border rounded-xl">
                <div className="p-6 rounded-full bg-primary/10">
                  <AlertCircle className="w-12 h-12 text-primary" />
                </div>
                <p className="text-center text-muted-foreground">
                  Real-time anomaly detection for live system monitoring
                </p>
                <Button size="lg" variant="default" onClick={handleActiveDetection}>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Detect Now
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Uploaded Files Section */}
        <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Your Datasets</h2>
          <div className="flex items-center space-x-3">
            <Badge variant="secondary" className="text-base px-4 py-2">
              {datasets.length} {datasets.length === 1 ? "file" : "files"}
            </Badge>

            {datasets.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleting}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete All
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all{" "}
                      <span className="font-semibold">{datasets.length}</span> dataset
                      {datasets.length === 1 ? "" : "s"} from the database and remove all
                      associated files from S3 storage.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete All Datasets
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {loading ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-muted-foreground">Loading datasets...</p>
            </div>
          </Card>
        ) : datasets.length === 0 ? (
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
          <div className="grid gap-4">
            {datasets.map((dataset) => (
              <Card
                key={dataset.id}
                className="p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
                onClick={() => navigate(`/datasets/${dataset.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <FileSpreadsheet className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">
                        {dataset.filename}
                      </h3>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-muted-foreground">
                          Uploaded {formatTime(dataset.uploaded_at)}
                        </span>
                        {dataset.file_size && (
                          <span className="text-sm text-muted-foreground">
                            {formatFileSize(dataset.file_size)}
                          </span>
                        )}
                        {dataset.anomaly_count !== undefined && dataset.analyzed_at && (
                          <span className="text-sm font-semibold text-orange-600">
                            {dataset.anomaly_count} anomalies detected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {(() => {
                      const status = getStatusBadge(dataset);
                      const StatusIcon = status.icon;
                      return (
                        <Badge variant={status.variant} className="flex items-center space-x-1">
                          <StatusIcon className={`w-4 h-4 ${status.label === "Processing" ? "animate-spin" : ""}`} />
                          <span>{status.label}</span>
                        </Badge>
                      );
                    })()}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!dataset.analyzed_at}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
