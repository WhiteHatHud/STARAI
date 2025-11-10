import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  FileDown,
  Share2,
  Trash2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Activity,
  Loader2,
  Brain,
  RefreshCw,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import axios from "@/lib/axios";

interface MitreTechnique {
  id: string;
  name: string;
  confidence: number;
  rationale?: string;
}

interface Actor {
  user_id: string | null;
  username: string | null;
  process_name: string | null;
  pid: number | null;
  ppid: number | null;
}

interface Host {
  hostname: string | null;
  mount_ns: string | null;
}

interface EventArg {
  name: string;
  type: string;
  value: number | string;
}

interface Event {
  name: string;
  timestamp: string | null;
  args: EventArg[];
}

interface Feature {
  name: string;
  value: number;
  z: number | null;
}

interface EvidenceRef {
  type: string;
  row_index: number | null;
  sheet: string | null;
  s3_key: string | null;
}

interface Triage {
  immediate_actions: string[];
  short_term: string[];
  long_term: string[];
}

interface Provenance {
  model_name: string;
  model_version: string;
  prompt_id: string;
  temperature: number;
  tokens_prompt: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
}

interface LLMExplanation {
  _id?: string;
  schema_version: string;
  dataset_id: string;
  anomaly_id: string;
  session_id: string | null;
  verdict: "malicious" | "likely_malicious" | "benign" | "unclear" | "suspicious";
  severity: "high" | "medium" | "low" | "critical";
  confidence_label: "high" | "medium" | "low";
  confidence_score: number;
  mitre: MitreTechnique[];
  actors: Actor;
  host: Host;
  event: Event;
  features: Feature[];
  evidence_refs: EvidenceRef[];
  key_indicators: string[];
  triage: Triage;
  notes: string;
  status: string;
  owner: string | null;
  provenance: Provenance;
  created_at?: string;
  _created_at?: string;
  hash: string | null;
  _llm_timestamp_utc?: string;
}

interface Dataset {
  id: string;
  filename: string;
  uploaded_at: string;
  analyzed_at?: string;
  anomaly_count?: number;
}

const ReportEditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [explanations, setExplanations] = useState<LLMExplanation[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState("Anomaly Analysis Report");

  // Fetch dataset and LLM explanations
  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError("No dataset ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch dataset info
        const datasetResponse = await axios.get(`/anomaly/datasets/${id}`);
        const datasetData = datasetResponse.data;
        setDataset(datasetData);
        setReportTitle(datasetData.filename || "Anomaly Analysis Report");

        // Fetch LLM explanations
        const explanationsResponse = await axios.get(
          `/anomaly/datasets/${id}/llm-explanations`
        );
        setExplanations(explanationsResponse.data || []);

      } catch (err: any) {
        console.error("Error fetching data:", err);
        const errorMsg = err.response?.data?.detail || "Failed to load report data";
        setError(errorMsg);
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Trigger LLM analysis
  const handleAnalyzeWithLLM = async () => {
    if (!id) return;

    try {
      setAnalyzing(true);
      toast({
        title: "Analysis Started",
        description: "Running LLM triage analysis on detected anomalies...",
      });

      const response = await axios.post(
        `/anomaly/datasets/${id}/analyze-with-llm?max_anomalies=100`
      );

      const result = response.data;

      toast({
        title: "Analysis Complete",
        description: `Created ${result.explanations_created} explanations, skipped ${result.explanations_skipped}`,
      });

      // Refresh explanations
      const explanationsResponse = await axios.get(
        `/anomaly/datasets/${id}/llm-explanations`
      );
      setExplanations(explanationsResponse.data || []);

    } catch (err: any) {
      console.error("Error analyzing with LLM:", err);
      const errorMsg = err.response?.data?.detail || "LLM analysis failed";
      toast({
        title: "Analysis Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

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

  const handleDelete = async () => {
    if (!id) return;

    try {
      await axios.delete(`/anomaly/datasets/${id}`);
      toast({
        title: "Dataset Deleted",
        description: "The dataset and all associated data have been deleted",
      });
      navigate("/");
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.response?.data?.detail || "Failed to delete dataset",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return "bg-danger/20 text-danger border-danger";
      case "medium":
        return "bg-warning/20 text-warning border-warning";
      case "low":
        return "bg-info/20 text-info border-info";
      default:
        return "";
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "malicious":
      case "likely_malicious":
        return "bg-danger/20 text-danger border-danger";
      case "suspicious":
        return "bg-warning/20 text-warning border-warning";
      case "benign":
        return "bg-success/20 text-success border-success";
      case "unclear":
        return "bg-info/20 text-info border-info";
      default:
        return "";
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "text-success";
      case "medium":
        return "text-warning";
      case "low":
        return "text-danger";
      default:
        return "";
    }
  };

  const severityCount = {
    critical: explanations.filter((e) => e.severity === "critical").length,
    high: explanations.filter((e) => e.severity === "high").length,
    medium: explanations.filter((e) => e.severity === "medium").length,
    low: explanations.filter((e) => e.severity === "low").length,
  };

  // Loading state
  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto p-6 md:p-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-lg text-muted-foreground">Loading report data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container max-w-7xl mx-auto p-6 md:p-8">
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertTriangle className="w-16 h-16 text-danger" />
            <h2 className="text-2xl font-bold">Error Loading Report</h2>
            <p className="text-lg text-muted-foreground text-center">{error}</p>
            <Button onClick={() => navigate("/")}>Return to Home</Button>
          </div>
        </Card>
      </div>
    );
  }

  // No explanations yet - show prompt to analyze
  if (explanations.length === 0) {
    return (
      <div className="container max-w-7xl mx-auto p-6 md:p-8">
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center space-y-6 min-h-[400px]">
            <Brain className="w-20 h-20 text-primary" />
            <h2 className="text-3xl font-bold text-center">LLM Analysis Not Run</h2>
            <p className="text-lg text-muted-foreground text-center max-w-2xl">
              This dataset has {dataset?.anomaly_count || 0} detected anomalies, but they haven't been analyzed by the LLM yet.
              Run LLM triage analysis to generate security insights, MITRE ATT&CK mappings, and recommendations.
            </p>
            <Button
              size="lg"
              onClick={handleAnalyzeWithLLM}
              disabled={analyzing || (dataset?.anomaly_count || 0) === 0}
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5 mr-2" />
                  Run LLM Analysis
                </>
              )}
            </Button>
            {(dataset?.anomaly_count || 0) === 0 && (
              <p className="text-sm text-danger">
                No anomalies detected in this dataset. Run anomaly detection first.
              </p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
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
            <span>
              Generated: {dataset?.analyzed_at
                ? new Date(dataset.analyzed_at).toLocaleString()
                : new Date().toLocaleString()}
            </span>
          </div>
          <Badge variant="secondary" className="bg-success/20 text-success">
            Complete
          </Badge>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <span className="text-lg font-semibold">
              {explanations.length} Anomalies Analyzed
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            onClick={handleAnalyzeWithLLM}
            disabled={analyzing}
            variant="outline"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Re-analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                Re-analyze with LLM
              </>
            )}
          </Button>
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
        <TabsList className="grid w-full grid-cols-3 mb-8 h-[60px]">
          <TabsTrigger value="summary" className="text-lg">
            Summary
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
            <p className="text-lg leading-relaxed text-foreground mb-6">
              Analysis identified {explanations.length} suspicious anomalies
              {explanations.length > 0 && explanations[0].host.hostname &&
                ` on host ${explanations[0].host.hostname}`}.
              The LLM triage system analyzed each event for potential security threats,
              mapped them to MITRE ATT&CK techniques, and provided actionable recommendations.
              {severityCount.critical + severityCount.high > 0 &&
                ` Immediate attention is recommended for ${severityCount.critical + severityCount.high}
                high-severity anomalies.`}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6 border-2 border-primary">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-medium text-muted-foreground">
                    Total Anomalies
                  </span>
                  <Activity className="w-6 h-6 text-primary" />
                </div>
                <p className="text-4xl font-bold text-primary">
                  {explanations.length}
                </p>
              </Card>

              <Card className="p-6 border-2 border-danger">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-medium text-muted-foreground">
                    Critical/High
                  </span>
                  <AlertTriangle className="w-6 h-6 text-danger" />
                </div>
                <p className="text-4xl font-bold text-danger">
                  {severityCount.critical + severityCount.high}
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
          </Card>

          {/* Individual Anomaly Cards */}
          {explanations.map((explanation, index) => (
            <Card key={explanation.anomaly_id} className="p-8 border-2 border-warning">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold">
                  Anomaly #{index + 1}: {explanation.event.name}
                </h3>
                <Badge
                  variant="secondary"
                  className={`${getVerdictColor(explanation.verdict)} text-lg px-4 py-2`}
                >
                  {explanation.verdict.toUpperCase().replace('_', ' ')}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <p className="text-base text-muted-foreground mb-2">Anomaly ID</p>
                  <p className="text-sm font-medium font-mono break-all">
                    {explanation.anomaly_id}
                  </p>
                </div>
                <div>
                  <p className="text-base text-muted-foreground mb-2">Severity</p>
                  <Badge
                    variant="secondary"
                    className={`${getSeverityColor(explanation.severity)} text-lg px-4 py-2`}
                  >
                    {explanation.severity.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-base text-muted-foreground mb-2">Confidence</p>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={explanation.confidence_score * 100}
                      className="w-32 h-3"
                    />
                    <span className={`text-lg font-semibold ${getConfidenceColor(explanation.confidence_label)}`}>
                      {Math.round(explanation.confidence_score * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* MITRE Techniques */}
                {explanation.mitre && explanation.mitre.length > 0 && (
                  <div className="border-t pt-6">
                    <h4 className="text-xl font-semibold mb-4">MITRE ATT&CK Techniques</h4>
                    <div className="space-y-3">
                      {explanation.mitre.map((technique, idx) => (
                        <div
                          key={idx}
                          className="border border-border rounded-lg p-4 bg-muted/30"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="text-base font-mono">
                                {technique.id}
                              </Badge>
                              <span className="text-lg font-semibold">{technique.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={technique.confidence * 100}
                                className="w-24 h-3"
                              />
                              <span className="text-base font-medium">
                                {Math.round(technique.confidence * 100)}%
                              </span>
                            </div>
                          </div>
                          {technique.rationale && (
                            <p className="text-base text-muted-foreground mt-2">
                              {technique.rationale}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Indicators */}
                {explanation.key_indicators && explanation.key_indicators.length > 0 && (
                  <div className="border-t pt-6">
                    <h4 className="text-xl font-semibold mb-4">Key Indicators</h4>
                    <ul className="space-y-2">
                      {explanation.key_indicators.map((indicator, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                          <span className="text-base font-mono text-sm">{indicator}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notes */}
                {explanation.notes && (
                  <div className="border-t pt-6">
                    <h4 className="text-xl font-semibold mb-2">Analysis Notes</h4>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      {explanation.notes}
                    </p>
                  </div>
                )}

                {/* Event Details */}
                {explanation.actors && (
                  <div className="border-t pt-6">
                    <h4 className="text-xl font-semibold mb-4">Event Context</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {explanation.actors.process_name && (
                        <div>
                          <p className="text-sm text-muted-foreground">Process</p>
                          <p className="text-base font-mono">{explanation.actors.process_name}</p>
                        </div>
                      )}
                      {explanation.actors.pid && (
                        <div>
                          <p className="text-sm text-muted-foreground">PID</p>
                          <p className="text-base font-mono">{explanation.actors.pid}</p>
                        </div>
                      )}
                      {explanation.actors.user_id && (
                        <div>
                          <p className="text-sm text-muted-foreground">User ID</p>
                          <p className="text-base font-mono">{explanation.actors.user_id}</p>
                        </div>
                      )}
                      {explanation.host.hostname && (
                        <div>
                          <p className="text-sm text-muted-foreground">Hostname</p>
                          <p className="text-base font-mono">{explanation.host.hostname}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Visualizations Tab */}
        <TabsContent value="visualizations">
          <Card className="p-8">
            <h3 className="text-2xl font-semibold mb-4">
              Anomaly Distribution
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-3xl font-bold text-danger">
                  {severityCount.critical}
                </p>
                <p className="text-sm text-muted-foreground">Critical</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-3xl font-bold text-danger">
                  {severityCount.high}
                </p>
                <p className="text-sm text-muted-foreground">High</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-3xl font-bold text-warning">
                  {severityCount.medium}
                </p>
                <p className="text-sm text-muted-foreground">Medium</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-3xl font-bold text-info">
                  {severityCount.low}
                </p>
                <p className="text-sm text-muted-foreground">Low</p>
              </div>
            </div>
            <p className="text-lg text-muted-foreground">
              Advanced visualization charts coming soon
            </p>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations">
          {explanations.length > 0 && (
            <Card className="p-8">
              <h3 className="text-2xl font-semibold mb-6">
                Triage & Recommended Actions
              </h3>
              <div className="space-y-8">
                {/* Aggregate all triage actions from all explanations */}
                {explanations.map((explanation, idx) => (
                  <div key={idx} className="space-y-6">
                    <h4 className="text-xl font-bold border-b pb-2">
                      Anomaly #{idx + 1}: {explanation.event.name}
                    </h4>

                    {/* Immediate Actions */}
                    {explanation.triage.immediate_actions.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <AlertTriangle className="w-6 h-6 text-danger" />
                          <h5 className="text-lg font-semibold text-danger">
                            Immediate Actions
                          </h5>
                        </div>
                        <div className="space-y-3">
                          {explanation.triage.immediate_actions.map((action, actionIdx) => (
                            <div
                              key={actionIdx}
                              className="border-l-4 border-danger pl-6 py-3 bg-danger/5 rounded-r-lg"
                            >
                              <p className="text-base text-foreground">{action}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Short-term Actions */}
                    {explanation.triage.short_term.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <Clock className="w-6 h-6 text-warning" />
                          <h5 className="text-lg font-semibold text-warning">
                            Short-term Actions
                          </h5>
                        </div>
                        <div className="space-y-3">
                          {explanation.triage.short_term.map((action, actionIdx) => (
                            <div
                              key={actionIdx}
                              className="border-l-4 border-warning pl-6 py-3 bg-warning/5 rounded-r-lg"
                            >
                              <p className="text-base text-foreground">{action}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Long-term Actions */}
                    {explanation.triage.long_term.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <TrendingUp className="w-6 h-6 text-info" />
                          <h5 className="text-lg font-semibold text-info">
                            Long-term Actions
                          </h5>
                        </div>
                        <div className="space-y-3">
                          {explanation.triage.long_term.map((action, actionIdx) => (
                            <div
                              key={actionIdx}
                              className="border-l-4 border-info pl-6 py-3 bg-info/5 rounded-r-lg"
                            >
                              <p className="text-base text-foreground">{action}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportEditorPage;
