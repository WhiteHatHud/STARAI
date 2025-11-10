import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Table,
  Tag,
  Typography,
  Space,
  Statistic,
  Row,
  Col,
  Alert,
  Spin,
  Empty,
  message,
  Descriptions,
  Progress,
  Divider,
  theme,
} from "antd";
import {
  ArrowLeftOutlined,
  RocketOutlined,
  DownloadOutlined,
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import useStore from "../../store";

const { Title, Text } = Typography;

const DatasetDetailPage = () => {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const { token } = useStore();
  const { token: themeToken } = theme.useToken();

  const [dataset, setDataset] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analyzingLLM, setAnalyzingLLM] = useState(false);
  const [llmAnalysisResult, setLlmAnalysisResult] = useState(null);

  // Fetch dataset details
  const fetchDataset = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/anomaly/datasets/${datasetId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDataset(response.data);
    } catch (error) {
      console.error("Error fetching dataset:", error);
      message.error("Failed to load dataset");
    }
  };

  // Fetch anomalies
  const fetchAnomalies = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/anomaly/datasets/${datasetId}/anomalies`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnomalies(response.data);
    } catch (error) {
      console.error("Error fetching anomalies:", error);
      // Don't show error if dataset hasn't been analyzed yet
      if (error.response?.status !== 404) {
        message.error("Failed to load anomalies");
      }
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchDataset();
      await fetchAnomalies();
      setLoading(false);
    };

    loadData();
  }, [datasetId]);

  // Trigger analysis
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisProgress(0);

    // Simulate progress (since backend doesn't provide real-time progress)
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => Math.min(prev + 5, 90));
    }, 1000);

    try {
      message.info("Starting anomaly detection analysis...");

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/anomaly/datasets/${datasetId}/analyze-test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      message.success(
        `Analysis complete! Detected ${response.data.anomalies_detected} anomalies.`
      );

      // Refresh data
      await fetchDataset();
      await fetchAnomalies();
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Analysis error:", error);
      message.error(
        error.response?.data?.detail || "Analysis failed. Please try again."
      );
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  // Trigger LLM Analysis (only top 2 anomalies)
  const handleLLMAnalysis = async (maxAnomalies = 2) => {
    setAnalyzingLLM(true);
    setLlmAnalysisResult(null);

    try {
      message.info(`Analyzing top ${maxAnomalies} anomalies with AI...`);

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/anomaly/datasets/${datasetId}/analyze-with-llm?max_anomalies=${maxAnomalies}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setLlmAnalysisResult(response.data);

      message.success(
        `LLM Analysis complete! Generated ${response.data.explanations_created} explanations.`
      );

      // Refresh anomalies to show updated data
      await fetchAnomalies();
    } catch (error) {
      console.error("LLM Analysis error:", error);
      message.error(
        error.response?.data?.detail || "LLM Analysis failed. Please check Azure OpenAI configuration."
      );
    } finally {
      setAnalyzingLLM(false);
    }
  };

  // Table columns for anomalies
  const columns = [
    {
      title: "Row",
      dataIndex: "row_index",
      key: "row_index",
      width: 80,
      sorter: (a, b) => a.row_index - b.row_index,
    },
    {
      title: "Anomaly Score",
      dataIndex: "anomaly_score",
      key: "anomaly_score",
      width: 150,
      render: (score) => (
        <Tag color={score > 0.2 ? "red" : score > 0.1 ? "orange" : "gold"}>
          {score.toFixed(4)}
        </Tag>
      ),
      sorter: (a, b) => b.anomaly_score - a.anomaly_score,
      defaultSortOrder: "descend",
    },
    {
      title: "Suspicious Features",
      dataIndex: "anomalous_features",
      key: "anomalous_features",
      render: (features) => (
        <Space direction="vertical" size="small">
          {features.slice(0, 3).map((feature, idx) => (
            <Text key={idx} style={{ fontSize: "12px" }}>
              <strong>{feature.feature_name}</strong>:{" "}
              {typeof feature.actual_value === "number"
                ? feature.actual_value.toFixed(2)
                : feature.actual_value}
              <Text type="secondary" style={{ marginLeft: 8 }}>
                (error: {feature.reconstruction_error.toFixed(3)})
              </Text>
            </Text>
          ))}
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status) => {
        const statusConfig = {
          detected: { color: "orange", text: "Detected" },
          investigating: { color: "blue", text: "Investigating" },
          resolved: { color: "green", text: "Resolved" },
          false_positive: { color: "default", text: "False Positive" },
        };
        const config = statusConfig[status] || statusConfig.detected;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: "Detected At",
      dataIndex: "detected_at",
      key: "detected_at",
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
  ];

  // Render status badge
  const renderStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: "default", icon: <ClockCircleOutlined />, text: "Pending" },
      processing: { color: "blue", icon: <Spin size="small" />, text: "Processing" },
      completed: { color: "green", icon: <CheckCircleOutlined />, text: "Completed" },
      failed: { color: "red", icon: <WarningOutlined />, text: "Failed" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Tag icon={config.icon} color={config.color}>
        {config.text}
      </Tag>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <Spin size="large" tip="Loading dataset..." />
      </div>
    );
  }

  if (!dataset) {
    return (
      <Empty
        description="Dataset not found"
        extra={
          <Button type="primary" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        }
      />
    );
  }

  const needsAnalysis = dataset.status === "pending" || dataset.status === "failed";
  const isAnalyzed = dataset.status === "completed";

  return (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/")}>
          Back
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          {dataset.filename}
        </Title>
        {renderStatusBadge(dataset.status)}
      </Space>

      {/* Dataset Info Card */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="File Size"
              value={dataset.file_size}
              suffix="bytes"
              formatter={(value) => `${(value / 1024).toFixed(2)} KB`}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Anomalies Detected"
              value={dataset.anomaly_count || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: dataset.anomaly_count > 0 ? "#cf1322" : "#999" }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Uploaded"
              value={new Date(dataset.uploaded_at).toLocaleDateString()}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Status"
              value={dataset.status}
              valueStyle={{
                color:
                  dataset.status === "completed"
                    ? "#3f8600"
                    : dataset.status === "failed"
                    ? "#cf1322"
                    : "#1890ff",
              }}
            />
          </Col>
        </Row>

        <Divider />

        <Descriptions column={2}>
          <Descriptions.Item label="Original Filename">
            {dataset.original_filename}
          </Descriptions.Item>
          <Descriptions.Item label="Content Type">
            {dataset.content_type}
          </Descriptions.Item>
          <Descriptions.Item label="S3 Key">
            <Text code style={{ fontSize: "12px" }}>
              {dataset.s3_key}
            </Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Analysis Controls */}
      {needsAnalysis && !analyzing && (
        <Alert
          message="Dataset not analyzed yet"
          description="Click the button below to start anomaly detection analysis. This may take a few minutes depending on the dataset size."
          type="info"
          showIcon
          action={
            <Button
              type="primary"
              size="large"
              icon={<RocketOutlined />}
              onClick={handleAnalyze}
            >
              Start Analysis
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      {analyzing && (
        <Card style={{ marginBottom: 24 }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Text strong>Analyzing dataset...</Text>
            <Progress percent={analysisProgress} status="active" />
            <Text type="secondary">
              This may take a few minutes. The autoencoder is learning patterns in your data.
            </Text>
          </Space>
        </Card>
      )}

      {/* LLM Analysis Button - Shows after autoencoder completes */}
      {isAnalyzed && anomalies.length > 0 && !analyzingLLM && (
        <Alert
          message="🤖 AI Triage Analysis Available"
          description={
            <Space direction="vertical" size="small">
              <Text>
                Run AI-powered security analysis on the top {Math.min(2, anomalies.length)} highest-scoring anomalies.
              </Text>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                This will use Azure OpenAI to generate detailed security insights, MITRE ATT&CK mappings, and triage recommendations.
              </Text>
              {llmAnalysisResult && (
                <Text type="success" strong>
                  ✓ Last analysis: {llmAnalysisResult.explanations_created} explanations created
                  ({llmAnalysisResult.total_anomalies_detected} total anomalies detected)
                </Text>
              )}
            </Space>
          }
          type="info"
          showIcon
          action={
            <Space direction="vertical">
              <Button
                type="primary"
                size="large"
                icon={<RocketOutlined />}
                onClick={() => handleLLMAnalysis(2)}
                loading={analyzingLLM}
              >
                Analyze Top 2 with AI
              </Button>
              <Button
                size="small"
                onClick={() => handleLLMAnalysis(10)}
                loading={analyzingLLM}
              >
                Analyze Top 10
              </Button>
            </Space>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      {/* LLM Analysis Progress */}
      {analyzingLLM && (
        <Card style={{ marginBottom: 24 }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Text strong>🤖 Running AI Triage Analysis...</Text>
            <Spin size="large" />
            <Text type="secondary">
              Sending anomalies to Azure OpenAI for security analysis. This usually takes 10-30 seconds.
            </Text>
          </Space>
        </Card>
      )}

      {/* Anomalies Table */}
      {isAnalyzed && (
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: themeToken.colorError }} />
              <Text strong>Detected Anomalies ({anomalies.length})</Text>
            </Space>
          }
          extra={
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchAnomalies()}
              >
                Refresh
              </Button>
              <Button icon={<DownloadOutlined />} disabled>
                Export
              </Button>
            </Space>
          }
        >
          {anomalies.length === 0 ? (
            <Empty description="No anomalies detected in this dataset" />
          ) : (
            <Table
              dataSource={anomalies}
              columns={columns}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} anomalies`,
              }}
              scroll={{ x: 1000 }}
            />
          )}
        </Card>
      )}

      {/* Failed state */}
      {dataset.status === "failed" && (
        <Alert
          message="Analysis Failed"
          description="The analysis failed. Please try again or contact support if the issue persists."
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}
    </div>
  );
};

export default DatasetDetailPage;
