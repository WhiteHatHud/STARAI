// CustomReportViewer.jsx
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Card,
  Typography,
  Button,
  Spin,
  Alert,
  Empty,
  Space,
  Divider,
  Tag,
  Tooltip,
  Progress,
  Dropdown,
  App,
} from "antd";
import {
  InfoCircleOutlined,
  EyeOutlined,
  LoadingOutlined,
  EditOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FormOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import axios from "axios";
import "./CustomReportViewer.css";
import ReportMetricsDisplay from "../../components/GeneratedForms/ReportMetricsDisplay";
import EditableSectionContent from "../../components/GeneratedForms/EditableSectionContent";
import ProcessFeedback from "../../components/GeneratedForms/ProcessFeedback";
import { BackButton } from "../../components/global";

const { Title, Text } = Typography;

export const CustomReportViewer = ({
  reportId,
  token,
  isDarkMode = false,
  showBackButton = true,
  className = "",
  style = {},
}) => {
  const { notification } = App.useApp();
  const location = useLocation();
  const readOnly = location.pathname.includes("/admin");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editSections, setEditSections] = useState({});
  const [progressId, setProgressId] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [progressError, setProgressError] = useState(null);
  const [editingSection, setEditingSection] = useState({});
  const [isDownloading, setIsDownloading] = useState(false);
  const canDownload = report?.status === "published";

  //Use effect to handle reprocessing
  useEffect(() => {
    if (!progressId) return;
    let intervalId;

    const fetchProgress = async () => {
      try {
        const response = await axios.get(
          `${
            import.meta.env.VITE_API_BASE_URL
          }/reports/progress/by-id/${progressId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        setProgressData(response.data);

        if (response.data.status === "completed") {
          setProgressId(null);
          setProgressData(null);
        }
        if (response.data.status === "error") {
          setProgressError(response.data.message || "Reprocessing failed");
          setProgressId(null);
        }
      } catch (err) {
        setProgressError("Failed to fetch progress");
        setProgressId(null);
      }
    };

    intervalId = setInterval(fetchProgress, 1500);
    fetchProgress();

    return () => clearInterval(intervalId);
  }, [progressId, token, reportId]);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/reports/${reportId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setReport(response.data);
    } catch (err) {
      console.error("Error fetching case study:", err);

      if (err.response?.status === 404) {
        setError("Case study not found");
      } else if (err.response?.status === 403) {
        setError("You do not have permission to view this case study");
      } else if (err.response?.status === 401) {
        setError("Authentication required. Please log in again.");
      } else {
        setError(err.response?.data?.detail || "Failed to load case study");
      }
    } finally {
      setLoading(false);
    }
  }, [reportId, token]);

  // Fetch case study data
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleMarkAsPublished = async () => {
    try {
      await axios.patch(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/${reportId}/toggle-status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      await fetchReport();
    } catch (error) {
      console.error("Error toggling case study status:", error);
    }
  };

  // Render confidence indicator
  const renderConfidence = (confidence) => {
    if (!confidence && confidence !== 0) return null;

    let color = "#ff4d4f"; // red
    let status = "Low";

    if (confidence >= 4) {
      color = "#52c41a"; // green
      status = "High";
    } else if (confidence >= 3) {
      color = "#1890ff"; // blue
      status = "Medium";
    } else if (confidence >= 2) {
      color = "#faad14"; // orange
      status = "Fair";
    }

    return (
      <Tooltip title={`AI Confidence Score: ${confidence.toFixed(1)}/5.0`}>
        <Tag color={color.replace("#", "")} icon={<InfoCircleOutlined />}>
          {status} ({confidence.toFixed(1)})
        </Tag>
      </Tooltip>
    );
  };

  // Toggle edit mode for a section
  const handleHighlightClick = (sectionId) => {
    setEditSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleDownload = async (format = "pdf") => {
    if (!report || !reportId) {
      notification.error({
        message: "Download Failed",
        description: "Cannot download case study: invalid data",
      });
      return;
    }

    try {
      setIsDownloading(true);

      notification.info({
        message: "Preparing Download",
        description: `Your case study is being prepared for download in ${format.toUpperCase()} format...`,
      });

      // Make API request to download endpoint
      const response = await axios({
        url: `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/${reportId}/download-custom?format=${format}`,
        method: "GET",
        responseType: "blob",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Create a download link and trigger it
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${report.title || "Report"}.${format}`
      );
      document.body.appendChild(link);
      link.click();
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      notification.success({
        message: "Download Complete",
        description: `Case study has been downloaded successfully in ${format.toUpperCase()} format.`,
      });
    } catch (error) {
      console.error(`Error downloading ${format} case study:`, error);
      notification.error({
        message: "Download Failed",
        description: `Unable to download the case study in ${format.toUpperCase()} format. Please try again later.`,
      });
    } finally {
      setIsDownloading(false);
    }
  };
  const downloadMenuItems = [
    {
      key: "pdf",
      icon: <FilePdfOutlined />,
      label: "Download as PDF",
      onClick: () => handleDownload("pdf"),
      disabled: isDownloading,
    },
    {
      key: "docx",
      icon: <FileWordOutlined />,
      label: "Download as Word Document (Recommended)",
      onClick: () => handleDownload("docx"),
      disabled: isDownloading,
    },
  ];
  // Loading state
  if (loading) {
    return (
      <Card
        className={`report-viewer ${isDarkMode ? "dark" : ""} ${className}`}
        style={style}
      >
        <div className="loading-container">
          <Spin size="large" />
          <Text
            className={isDarkMode ? "text-light" : ""}
            style={{ marginTop: "16px" }}
          >
            Loading case study...
          </Text>
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card
        className={`report-viewer ${isDarkMode ? "dark" : ""} ${className}`}
        style={style}
      >
        {showBackButton && <BackButton />}
        <Alert
          message="Error Loading Report"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
        />
      </Card>
    );
  }

  // Empty state
  if (!report) {
    return (
      <Card
        className={`report-viewer ${isDarkMode ? "dark" : ""} ${className}`}
        style={style}
      >
        {showBackButton && <BackButton />}
        <Empty
          description={
            <Text className={isDarkMode ? "text-light" : ""}>
              No case study data available
            </Text>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  // Main content render
  return (
    <Card
      className={`report-viewer ${isDarkMode ? "dark" : ""} ${className}`}
      style={style}
    >
      {/* Header with back button */}
      {showBackButton && <BackButton />}

      <div className="report-header">
        <Title
          level={1}
          className={isDarkMode ? "text-light" : ""}
          style={{ marginBottom: "16px" }}
        >
          {report.title}
        </Title>

        <Space style={{ marginBottom: 40 }}>
          {!canDownload && (
            <Button
              icon={<CheckOutlined />}
              type="primary"
              onClick={handleMarkAsPublished}
            >
              Mark as Published
            </Button>
          )}
          <Tooltip
            title={canDownload ? "" : "Report must be published to download"}
          >
            <Dropdown
              menu={{ items: downloadMenuItems }}
              trigger={["click"]}
              disabled={isDownloading || !canDownload}
            >
              <Button
                icon={
                  isDownloading ? (
                    <DownloadOutlined spin />
                  ) : (
                    <DownloadOutlined />
                  )
                }
                loading={isDownloading}
              >
                {isDownloading ? "Downloading..." : "Download"}
              </Button>
            </Dropdown>
          </Tooltip>
        </Space>

        {progressId && progressData && (
          <div style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>
                <LoadingOutlined spin style={{ marginRight: 8 }} />
                Reprocessing: {progressData.message}
              </Text>
              <Progress
                percent={progressData.progress || 0}
                status={progressData.progress === 100 ? "success" : "active"}
                showInfo
              />
            </Space>
          </div>
        )}
        {progressError && (
          <Alert
            message="Reprocessing Error"
            description={progressError}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {report.confidence && (
          <div style={{ marginTop: "16px" }}>
            <Text strong className={isDarkMode ? "text-light" : ""}>
              Overall Quality:
            </Text>
            <span style={{ marginLeft: "8px" }}>
              {renderConfidence(report.confidence)}
            </span>
          </div>
        )}
      </div>

      <Divider className={isDarkMode ? "divider-dark" : ""} />
      <ReportMetricsDisplay report={report} isDarkMode={isDarkMode} />

      {report.sections && report.sections.length > 0 ? (
        <div className="report-sections">
          <Title
            level={3}
            className={isDarkMode ? "text-light" : ""}
            style={{ marginBottom: "24px" }}
          >
            <EyeOutlined style={{ marginRight: "8px" }} />
            Content Sections ({report.sections.length})
          </Title>

          {report.sections.map((section, index) => (
            <div
              key={section.section_id || index}
              className="section-container"
            >
              <Card
                className={`section-card ${isDarkMode ? "dark" : ""}`}
                title={
                  <Space>
                    <Text strong className={isDarkMode ? "text-light" : ""}>
                      {section.title}
                    </Text>
                    <Tooltip
                      title={
                        readOnly
                          ? "Read-only (admin view)"
                          : "Reprocess with feedback"
                      }
                    >
                      <Button
                        icon={
                          <FormOutlined
                            style={{
                              color: editSections[section.section_id]
                                ? "#faad14"
                                : undefined,
                            }}
                          />
                        }
                        type={
                          editSections[section.section_id]
                            ? "primary"
                            : "default"
                        }
                        size="small"
                        onClick={() => {
                          if (readOnly) return;
                          setEditingSection((prev) => ({
                            ...prev,
                            [section.section_id]: false,
                          }));
                          handleHighlightClick(section.section_id);
                        }}
                        disabled={readOnly}
                      />
                    </Tooltip>
                    <Tooltip
                      title={
                        readOnly
                          ? "Read-only (admin view)"
                          : "Edit section content"
                      }
                    >
                      <Button
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => {
                          if (readOnly) return;
                          setEditSections((prev) => ({
                            ...prev,
                            [section.section_id]: false,
                          }));
                          setEditingSection((prev) => ({
                            ...prev,
                            [section.section_id]: true,
                          }));
                        }}
                        type={
                          editingSection[section.section_id]
                            ? "primary"
                            : "default"
                        }
                        disabled={readOnly}
                      />
                    </Tooltip>
                  </Space>
                }
                size="small"
                style={{ marginBottom: "24px" }}
              >
                <EditableSectionContent
                  content={section.content}
                  isDarkMode={isDarkMode}
                  isEdit={editingSection[section.section_id]}
                  reportId={reportId}
                  sectionId={section.section_id}
                  token={token}
                  onEditToggle={(isEditing) => {
                    setEditingSection((prev) => ({
                      ...prev,
                      [section.section_id]: isEditing,
                    }));
                  }}
                  onSectionUpdate={(sectionId, newContent) => {
                    setReport((cs) => ({
                      ...cs,
                      sections: cs.sections.map((s) =>
                        s.section_id === sectionId
                          ? { ...s, content: newContent }
                          : s
                      ),
                    }));
                  }}
                />

                <ProcessFeedback
                  sectionId={section.section_id}
                  reportId={reportId}
                  token={token}
                  content={section.content}
                  report={report}
                  isActive={editSections[section.section_id]}
                  onToggle={(isActive) => {
                    setEditSections((prev) => ({
                      ...prev,
                      [section.section_id]: isActive,
                    }));
                  }}
                  onSectionUpdate={(sectionId, newContent) => {
                    setReport((cs) => ({
                      ...cs,
                      sections: cs.sections.map((s) =>
                        s.section_id === sectionId
                          ? { ...s, content: newContent }
                          : s
                      ),
                    }));
                  }}
                  onProgressStart={(progressId) => {
                    setProgressId(progressId);
                    setProgressData({
                      progress: 0,
                      message: "Starting reprocessing...",
                    });
                    setProgressError(null);
                  }}
                />
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          description={
            <Text className={isDarkMode ? "text-light" : ""}>
              No content sections available
            </Text>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Card>
  );
};
