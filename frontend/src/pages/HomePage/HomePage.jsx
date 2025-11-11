import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import useStore from "../../store";
import "./HomePage.css";

// Mock data for uploaded files with different statuses
// UploadedFile structure:
// {
//   id: string,
//   name: string,
//   uploadTime: Date,
//   status: "uploading" | "uploaded" | "autoencoding" | "autoencoded" | "analyzing" | "analyzed" | "failed",
//   progress?: {
//     linesProcessed: number,
//     totalLines: number,
//     timeRemaining: number // in seconds
//   }
// }

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useStore();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([
    {
      id: "1",
      name: "system_logs_2024_01.xlsx",
      uploadTime: new Date(Date.now() - 1000 * 60 * 30),
      status: "analyzed",
    },
    {
      id: "2",
      name: "network_traffic_jan.csv",
      uploadTime: new Date(Date.now() - 1000 * 60 * 60),
      status: "autoencoded",
    },
    {
      id: "3",
      name: "application_logs.xlsx",
      uploadTime: new Date(Date.now() - 1000 * 60 * 5),
      status: "uploading",
    },
  ]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files) => {
    files.forEach((file) => {
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".csv")) {
        // Estimate total lines based on file size (rough estimate)
        const estimatedLines = Math.floor(file.size / 100) + Math.floor(Math.random() * 500) + 500;
        
        const newFile = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          uploadTime: new Date(),
          status: "uploading",
          progress: {
            linesProcessed: 0,
            totalLines: estimatedLines,
            timeRemaining: Math.floor(estimatedLines / 200), // ~200 lines per second
          },
        };

        setUploadedFiles((prev) => [newFile, ...prev]);

        // Show success message (you can replace with your toast implementation)
        console.log(`${file.name} is being processed...`);

        // Simulate progressive line-by-line processing
        const startTime = Date.now();
        const processingDuration = 8000; // 8 seconds total
        const updateInterval = 100; // Update every 100ms

        const progressInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progressPercent = Math.min((elapsed / processingDuration) * 100, 100);
          
          setUploadedFiles((prev) =>
            prev.map((f) => {
              if (f.id === newFile.id && f.progress) {
                const linesProcessed = Math.floor((progressPercent / 100) * f.progress.totalLines);
                const timeRemaining = Math.max(
                  0,
                  Math.floor((processingDuration - elapsed) / 1000)
                );

                return {
                  ...f,
                  progress: {
                    ...f.progress,
                    linesProcessed,
                    timeRemaining,
                  },
                };
              }
              return f;
            })
          );

          if (progressPercent >= 100) {
            clearInterval(progressInterval);
            
            // Mark as complete
            setTimeout(() => {
              setUploadedFiles((prev) =>
                prev.map((f) =>
                  f.id === newFile.id ? { ...f, status: "uploaded", progress: undefined } : f
                )
              );
              console.log(`${file.name} uploaded to S3. Click "Autoencode" to continue.`);
            }, 200);
          }
        }, updateInterval);
      } else {
        console.error("Please upload .xlsx or .csv files only");
      }
    });
  };

  const handleActiveDetection = () => {
    console.log("Active Detection Started - Monitoring system logs for anomalies...");
  };

  const handleAutoencode = (fileId) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: "autoencoding" } : f))
    );
    console.log("Autoencoding Started - Running anomaly detection analysis...");

    // Simulate API call to /api/anomaly/datasets/{dataset_id}/analyze
    setTimeout(() => {
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "autoencoded" } : f))
      );
      console.log("Autoencoding Complete - Click 'Analyze' to generate LLM explanations.");
    }, 3000);
  };

  const handleAnalyze = (fileId) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: "analyzing" } : f))
    );
    console.log("Analysis Started - Generating detailed explanations...");

    // Simulate API call to /api/anomaly/datasets/{dataset_id}/start-llm-analysis
    setTimeout(() => {
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "analyzed" } : f))
      );
      
      // Store mock anomaly data in localStorage for ReportEditor
      const mockAnomalyData = [
        {
          schema_version: "1.0",
          dataset_id: fileId,
          anomaly_id: `${fileId}-132.477656-1407-close`,
          session_id: null,
          verdict: "suspicious",
          severity: "medium",
          confidence_label: "medium",
          confidence_score: 0.6,
          mitre: [
            {
              id: "T1021.001",
              name: "Remote Services: SSH",
              confidence: 0.5,
              rationale: "Event involves the sshd process closing a file descriptor (fd=10), which could be a network socket used for an SSH session; may indicate remote access activity or session teardown.",
            },
          ],
          actors: {
            user_id: "1000",
            username: null,
            process_name: "sshd",
            pid: 1407,
            ppid: null,
          },
          host: {
            hostname: "ip-10-100-1-217",
            mount_ns: "4026531840",
          },
          event: {
            name: "close",
            timestamp: null,
            args: [{ name: "fd", type: "int", value: "10" }],
          },
          features: [
            { name: "sus", value: 1.0, z: null },
            { name: "evil", value: 1.0, z: null },
          ],
          evidence_refs: [{ type: "row", row_index: null, sheet: null, s3_key: null }],
          key_indicators: [
            "processName=sshd — ssh daemon performed the syscall",
            "args.fd=10 — explicit close of file descriptor 10 (likely a socket) at timestamp=132.477656",
            "userId=1000 — non-root user context for the sshd process (unusual if sshd spawning under non-root UID)",
            "hostName=ip-10-100-1-217 and mountNamespace=4026531840 — indicates the specific host and mount namespace for containment/context",
          ],
          triage: {
            immediate_actions: [
              "Collect /var/log/auth.log and sshd logs around the event timestamp",
              "Identify open/closed network sockets for pid 1407 (netstat/ss) and capture current process tree",
              "Snapshot process memory and relevant files for pid 1407 if elevated suspicion",
            ],
            short_term: [
              "Correlate this close event with preceding open/connect syscalls and authentication events to determine session purpose",
              "Search for other anomalous syscalls by pid 1407 or by userId=1000 across timeline",
              "Check for unusual SSH keys, recently added authorized_keys, or login from new remote IPs",
            ],
            long_term: [
              "Harden SSH access (disable password auth, enforce key restrictions, limit allowed users)",
              "Deploy/adjust EDR rules to alert on unusual sshd child processes or sshd performing network/socket lifecycle operations under non-standard UIDs",
              "Increase syscall monitoring and correlate socket open/close sequences with authentication events",
            ],
          },
          notes: "A close syscall by sshd on fd=10 was flagged as anomalous. On its own this is low-fidelity — it may simply be a normal SSH session socket closing. However, because the detector marked 'evil' and the process context (sshd, userId=1000) is unusual, further log correlation and socket/process investigation is recommended. No absolute evidence of compromise from this single event.",
          status: "new",
          owner: null,
          provenance: {
            model_name: "gpt-5-mini",
            model_version: "base",
            prompt_id: "beth-triage-v1",
            temperature: 0.2,
            tokens_prompt: null,
            tokens_output: null,
            latency_ms: null,
          },
          _created_at: new Date().toISOString(),
          hash: null,
          _llm_timestamp_utc: new Date().toISOString(),
        },
        {
          schema_version: "1.0",
          dataset_id: fileId,
          anomaly_id: `${fileId}-1006`,
          session_id: null,
          verdict: "suspicious",
          severity: "medium",
          confidence_label: "medium",
          confidence_score: 0.6,
          mitre: [
            {
              id: "T1070.004",
              name: "Indicator Removal on Host: File Deletion",
              confidence: 0.7,
              rationale: "security_inode_unlink on /tmp/ssh-ITim7SZsmg/agent.1407 indicates deletion of a temporary SSH agent socket or related artifact which may be used to remove traces.",
            },
            {
              id: "T1552",
              name: "Unsecured Credentials",
              confidence: 0.35,
              rationale: "Path references an SSH agent socket under /tmp (args.pathname). If agent forwarding or socket files are abused, credentials could be exposed or cleaned up after compromise.",
            },
          ],
          actors: {
            user_id: "1000",
            username: null,
            process_name: "sshd",
            pid: 1407,
            ppid: null,
          },
          host: {
            hostname: "ip-10-100-1-217",
            mount_ns: "4026531840",
          },
          event: {
            name: "security_inode_unlink",
            timestamp: null,
            args: [{ name: "pathname", type: "const char*", value: "/tmp/ssh-ITim7SZsmg/agent.1407" }],
          },
          features: [
            { name: "sus", value: 1.0, z: null },
            { name: "evil", value: 1.0, z: null },
          ],
          evidence_refs: [{ type: "row", row_index: null, sheet: null, s3_key: null }],
          key_indicators: [
            "eventName=security_inode_unlink: a file unlink operation was recorded",
            "processName=sshd (pid=1407) performed the unlink — sshd removing /tmp/ssh-*/agent.* can be benign cleanup or suspicious cleanup of an agent socket",
            "args.pathname=/tmp/ssh-ITim7SZsmg/agent.1407: path matches SSH agent socket pattern in /tmp",
            "userId=1000: non-root user context for the sshd-related operation",
          ],
          triage: {
            immediate_actions: [
              "Capture process tree and parent for pid 1407 and collect command line /proc/1407/cmdline and open fds",
              "Export /var/log/auth.log or system journal lines around the event timestamp and search for corresponding SSH session start/end",
              "Preserve a memory/process snapshot of sshd pid 1407 if still running and collect current /tmp socket listings",
            ],
            short_term: [
              "Correlate unlink event with SSH session logs to determine if this was normal session teardown (agent forwarding) or unexpected",
              "Search for other security_inode_unlink events touching /tmp/ssh-* on this host and across fleet to detect pattern",
              "Review recent authentication activity for unusual logins or key usage for userId=1000",
            ],
            long_term: [
              "Enable monitoring/alerting for deletion of SSH agent sockets and unusual unlink operations in /tmp",
              "Harden SSH configuration: restrict agent forwarding to necessary users and enforce session logging",
              "Implement host-based integrity monitoring to detect suspicious file deletions and anomalous sshd behavior",
            ],
          },
          notes: "sshd (pid 1407) performed an unlink on /tmp/ssh-ITim7SZsmg/agent.1407, which commonly corresponds to SSH agent socket cleanup on session close. This is often benign but could also indicate cleanup after misuse or an attempt to remove artifacts. Correlate with SSH auth/session logs and other unlink events before escalating.",
          status: "new",
          owner: null,
          provenance: {
            model_name: "gpt-5-mini",
            model_version: "base",
            prompt_id: "beth-triage-v1",
            temperature: 0.2,
            tokens_prompt: null,
            tokens_output: null,
            latency_ms: null,
          },
          _created_at: new Date().toISOString(),
          hash: null,
          _llm_timestamp_utc: new Date().toISOString(),
        },
      ];
      
      localStorage.setItem(`anomaly-data-${fileId}`, JSON.stringify(mockAnomalyData));
      
      console.log("Analysis Complete - Report is ready. Click 'View Report' to see details.");
    }, 4000);
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);

    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
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
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
                }
                cursor-pointer
              `}
            >
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <Upload className="w-16 h-16 text-blue-500" />
                <div>
                  <p className="text-xl font-medium mb-1">
                    Drag & drop files here
                  </p>
                  <p className="text-base text-gray-600">
                    Supports .xlsx and .csv files
                  </p>
                </div>
              </div>
            </div>

            {/* File Browser Button */}
            <label htmlFor="file-input">
              <button
                className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg p-4 text-lg font-medium hover:bg-gray-50 transition-colors"
              >
                <FolderOpen size={24} />
                Browse Files
              </button>
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
            <p className="text-lg text-gray-600 mb-6">
              Automatically detect and analyze system logs
            </p>
            <button
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg p-4 text-lg font-medium hover:bg-blue-700 transition-colors"
              onClick={handleActiveDetection}
            >
              <Zap size={24} />
              Run Active Anomaly Detection
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN - Uploaded Files & Reports */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-semibold">Recent Uploads</h2>
          </div>

          <div className="space-y-4">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="border border-gray-200 rounded-lg p-6 hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <FileSpreadsheet className="w-8 h-8 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold mb-1 truncate">
                      {file.name}
                    </h3>
                    <p className="text-base text-gray-600 mb-3">
                      {formatTime(file.uploadTime)}
                    </p>
                    
                    {/* Uploading Progress */}
                    {file.status === "uploading" && file.progress && (
                      <div className="space-y-3 mb-4">
                        <div className="inline-flex items-center px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading to S3
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">
                              Lines Processed: {file.progress.linesProcessed.toLocaleString()} / {file.progress.totalLines.toLocaleString()}
                            </span>
                            <span className="text-gray-600">
                              {Math.round((file.progress.linesProcessed / file.progress.totalLines) * 100)}%
                            </span>
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className="bg-blue-500 h-3 rounded-full transition-all" 
                              style={{ width: `${(file.progress.linesProcessed / file.progress.totalLines) * 100}%` }}
                            ></div>
                          </div>
                          
                          <div className="flex justify-between items-center text-sm text-gray-600">
                            <span>
                              Analyzing anomaly patterns...
                            </span>
                            <span>
                              ~{file.progress.timeRemaining}s remaining
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Status Badges */}
                    {file.status === "uploaded" && (
                      <div className="mb-4">
                        <div className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Uploaded to S3
                        </div>
                      </div>
                    )}

                    {file.status === "autoencoding" && (
                      <div className="mb-4">
                        <div className="inline-flex items-center px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Autoencoding...
                        </div>
                      </div>
                    )}

                    {file.status === "autoencoded" && (
                      <div className="mb-4">
                        <div className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Autoencoded
                        </div>
                      </div>
                    )}

                    {file.status === "analyzing" && (
                      <div className="mb-4">
                        <div className="inline-flex items-center px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing with LLM...
                        </div>
                      </div>
                    )}

                    {file.status === "analyzed" && (
                      <div className="mb-4">
                        <div className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Analysis Complete
                        </div>
                      </div>
                    )}
                    
                    {file.status === "failed" && (
                      <div className="mb-4">
                        <div className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-800">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Failed
                        </div>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    {file.status === "uploaded" && (
                      <button
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                        onClick={() => handleAutoencode(file.id)}
                      >
                        <Zap className="w-4 h-4" />
                        Autoencode
                      </button>
                    )}

                    {file.status === "autoencoded" && (
                      <button
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                        onClick={() => handleAnalyze(file.id)}
                      >
                        <Loader2 className="w-4 h-4" />
                        Analyze
                      </button>
                    )}

                    {file.status === "analyzed" && (
                      <div className="flex gap-2">
                        <button
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                          onClick={() => navigate(`/reports/${file.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                          View Report
                        </button>
                        <button className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors">
                          <Download className="w-4 h-4" />
                          Export
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className="w-full border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={() => navigate("/reports/dashboard")}
          >
            View All Reports
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
