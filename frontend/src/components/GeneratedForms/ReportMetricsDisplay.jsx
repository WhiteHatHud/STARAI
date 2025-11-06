// components/ReportMetrics/ReportMetricsDisplay.jsx
import { Space, Typography, Card, Row, Col, Statistic, Tag } from "antd";
import {
  ClockCircleOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  TagOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

const ReportMetricsDisplay = ({ report, isDarkMode = false }) => {
  const formatProcessingTime = (seconds) => {
    if (!seconds) return "N/A";
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else if (seconds < 3600) {
      const minutes = seconds / 60;
      return `${minutes.toFixed(1)}m`;
    } else {
      const hours = seconds / 3600;
      return `${hours.toFixed(1)}h`;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "published":
        return "#52c41a";
      case "processing":
        return "#1890ff";
      case "draft":
        return "#faad14";
      case "pending_review":
        return "#722ed1";
      case "error":
        return "#ff4d4f";
      default:
        return "#d9d9d9";
    }
  };

  // Render study type tag
  const renderStudyTypeTag = (studyType) => {
    const typeConfig = {
      stylea: { color: "blue", label: "Style A" },
      stylec: { color: "green", label: "Style C" },
      styleb: { color: "purple", label: "Style B" },
    };

    const config = typeConfig[studyType] || {
      color: "default",
      label: studyType,
    };

    return (
      <Tag
        color={config.color}
        style={{ fontSize: "11px", padding: "2px 6px" }}
      >
        {config.label}
      </Tag>
    );
  };

  return (
    <Card
      className={`metrics-card ${isDarkMode ? "dark" : ""}`}
      style={{ marginBottom: "24px" }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6} md={4}>
          <Statistic
            title={
              <Space>
                <FileTextOutlined style={{ color: "#1890ff" }} />
                <Text
                  className={isDarkMode ? "text-light" : ""}
                  style={{ fontSize: "12px" }}
                >
                  Sections
                </Text>
              </Space>
            }
            value={report.sections ? report.sections.length : 0}
            className={isDarkMode ? "stat-dark" : ""}
            valueStyle={{ fontSize: "20px" }}
          />
        </Col>

        <Col xs={12} sm={6} md={4}>
          <Statistic
            title={
              <Space>
                <CheckCircleOutlined
                  style={{ color: getStatusColor(report.status) }}
                />
                <Text
                  className={isDarkMode ? "text-light" : ""}
                  style={{ fontSize: "12px" }}
                >
                  Status
                </Text>
              </Space>
            }
            value={report.status || "Unknown"}
            className={isDarkMode ? "stat-dark" : ""}
            valueStyle={{ fontSize: "16px", textTransform: "capitalize" }}
          />
        </Col>

        {report.processing_time && (
          <Col xs={12} sm={6} md={4}>
            <Statistic
              title={
                <Space>
                  <ClockCircleOutlined style={{ color: "#722ed1" }} />
                  <Text
                    className={isDarkMode ? "text-light" : ""}
                    style={{ fontSize: "12px" }}
                  >
                    Processing Time
                  </Text>
                </Space>
              }
              value={formatProcessingTime(report.processing_time)}
              className={isDarkMode ? "stat-dark" : ""}
              valueStyle={{ fontSize: "16px" }}
            />
          </Col>
        )}

        <Col xs={12} sm={6} md={4}>
          <Statistic
            title={
              <Space>
                <CalendarOutlined style={{ color: "#52c41a" }} />
                <Text
                  className={isDarkMode ? "text-light" : ""}
                  style={{ fontSize: "12px" }}
                >
                  Created
                </Text>
              </Space>
            }
            value={new Date(report.created_at).toLocaleDateString()}
            className={isDarkMode ? "stat-dark" : ""}
            valueStyle={{ fontSize: "14px" }}
          />
        </Col>

        <Col xs={12} sm={6} md={4}>
          <div style={{ textAlign: "left" }}>
            <div style={{ marginBottom: "8px" }}>
              <Space>
                <TagOutlined style={{ color: "#1890ff" }} />
                <Text
                  className={isDarkMode ? "text-light" : ""}
                  style={{ fontSize: "12px" }}
                >
                  Type
                </Text>
              </Space>
            </div>
            <div>{renderStudyTypeTag(report.study_type)}</div>
          </div>
        </Col>
      </Row>
    </Card>
  );
};

export default ReportMetricsDisplay;
