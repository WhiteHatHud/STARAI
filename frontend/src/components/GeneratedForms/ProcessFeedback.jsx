import { useState, useEffect } from "react";
import { Input, Button, notification } from "antd";
import {
  LoadingOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  TextContent,
  ListContent,
  TableContent,
} from "./EditableSectionContent";
import axios from "axios";

const ProcessFeedback = ({
  sectionId,
  reportId,
  token,
  content,
  report,
  isActive,
  onToggle,
  onProgressStart,
  onSectionUpdate,
}) => {
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasReprocessed, setHasReprocessed] = useState(false);
  const [reprocessedSection, setReprocessedSection] = useState(null);

  // Progress tracking state
  const [progressId, setProgressId] = useState(null);
  const [progressData, setProgressData] = useState(null);

  const handleRemarkChange = (value) => {
    setRemarks(value);
  };

  // Progress polling effect
  useEffect(() => {
    let interval;

    if (
      progressId &&
      progressData?.status !== "completed" &&
      progressData?.status !== "error"
    ) {
      interval = setInterval(async () => {
        try {
          const response = await axios.get(
            `${
              import.meta.env.VITE_API_BASE_URL
            }/custom/documents/custom-format/progress/${progressId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          const data = response.data;
          setProgressData(data);

          if (data.status === "completed") {
            notification.success({
              message: "Reprocessing Complete",
              description:
                "Section has been successfully reprocessed with your feedback.",
            });
            setSubmitting(false);

            // Parse and set the reprocessed section
            if (data.template) {
              const parsedTemplate =
                typeof data.template === "string"
                  ? JSON.parse(data.template)
                  : data.template;
              setReprocessedSection(parsedTemplate);
              setHasReprocessed(true);
            } else {
              console.error("Template not found in response:", data);
              notification.error({
                message: "Error",
                description: "Reprocessed content not found in response",
              });
            }
            clearInterval(interval);
          } else if (data.status === "error") {
            notification.error({
              message: "Reprocessing Failed",
              description:
                data.error || "Unknown error occurred during reprocessing",
            });
            setSubmitting(false);
            clearInterval(interval);
          }
        } catch (error) {
          console.error("Error checking progress:", error);
          // Don't clear interval here - might be temporary network issue
        }
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [progressId, progressData, token, reportId]);

  const handleSectionReprocess = async () => {
    setSubmitting(true);
    setProgressData({
      status: "initializing",
      progress: 0,
      message: "Starting section reprocessing...",
    });

    try {
      const response = await axios.post(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/custom-highlight-feedback`,
        {
          remarks: remarks,
          section: JSON.stringify(content),
          report: JSON.stringify(report),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      notification.info({
        message: "Reprocessing Started",
        description:
          "Your feedback has been submitted. Reprocessing may take a few minutes...",
      });

      // Start progress tracking
      setProgressId(response.data.progress_id);
      setProgressData({
        status: "processing",
        progress: 5,
        message: "Section reprocessing started...",
      });

      if (onProgressStart) {
        onProgressStart(response.data.progress_id);
      }
    } catch (error) {
      notification.error({
        message: "Error",
        description: "Failed to submit feedback.",
      });
      setSubmitting(false);
      setProgressData(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.patch(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/${reportId}/sections/${sectionId}`,
        { content: reprocessedSection },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      notification.success({
        message: "Saved",
        description:
          "The reprocessed content has been saved to the case study.",
      });

      if (onSectionUpdate) {
        onSectionUpdate(sectionId, reprocessedSection);
      }

      // Clear feedback and close
      setRemarks("");
      setHasReprocessed(false);
      setReprocessedSection(null);
      setProgressId(null);
      setProgressData(null);
      onToggle(false);
    } catch (error) {
      notification.error({
        message: "Error",
        description: "Failed to save the reprocessed content.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setRemarks("");
    setHasReprocessed(false);
    setReprocessedSection(null);
    setProgressId(null);
    setProgressData(null);
    onToggle(false);
  };

  if (!isActive) return null;

  return (
    <div style={{ marginTop: 12, marginBottom: 12 }}>
      {!hasReprocessed && (
        <Input.TextArea
          rows={3}
          value={remarks}
          onChange={(e) => handleRemarkChange(e.target.value)}
          placeholder="Describe what you want improved or changed in this section..."
          autoFocus
          disabled={submitting}
        />
      )}

      {submitting && progressData && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            backgroundColor: "#f0f2f5",
            borderRadius: 4,
            fontSize: "12px",
          }}
        >
          <LoadingOutlined spin style={{ marginRight: 8 }} />
          {progressData.message || "Processing your feedback..."}
        </div>
      )}

      {hasReprocessed && reprocessedSection && (
        <div
          style={{
            marginTop: 12,
            marginBottom: 12,
            padding: 12,
            border: "1px solid #52c41a",
            borderRadius: 6,
            backgroundColor: "#f6ffed",
          }}
        >
          <div
            style={{
              marginBottom: 8,
              fontSize: "12px",
              color: "#52c41a",
              fontWeight: "bold",
            }}
          >
            ✓ Reprocessed Content:
          </div>
          {(() => {
            try {
              const parsedContent =
                typeof reprocessedSection === "string"
                  ? JSON.parse(reprocessedSection)
                  : reprocessedSection;

              if (parsedContent.textdata) {
                return (
                  <TextContent
                    textData={parsedContent.textdata}
                    isDarkMode={false}
                    isEdit={false}
                  />
                );
              }

              if (
                parsedContent.listdata &&
                Array.isArray(parsedContent.listdata)
              ) {
                return (
                  <ListContent
                    listData={parsedContent.listdata}
                    isDarkMode={false}
                    isEdit={false}
                  />
                );
              }

              if (
                parsedContent.tabledata &&
                Array.isArray(parsedContent.tabledata)
              ) {
                return (
                  <TableContent
                    tableData={parsedContent.tabledata}
                    isDarkMode={false}
                    isEdit={false}
                  />
                );
              }

              return (
                <div>
                  Reprocessed content: {JSON.stringify(parsedContent, null, 2)}
                </div>
              );
            } catch (e) {
              return <div>Reprocessed content: {reprocessedSection}</div>;
            }
          })()}
        </div>
      )}

      <div style={{ marginTop: 8, textAlign: "right" }}>
        {hasReprocessed && (
          <Button
            type="primary"
            icon={saving ? <LoadingOutlined /> : <SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            size="small"
            style={{ marginRight: 8 }}
          >
            {saving ? "Saving..." : "Accept & Save"}
          </Button>
        )}
        {!hasReprocessed && (
          <Button
            type="primary"
            icon={submitting ? <LoadingOutlined /> : <ReloadOutlined />}
            loading={submitting}
            disabled={!remarks || remarks.trim() === "" || hasReprocessed}
            onClick={handleSectionReprocess}
            size="small"
            style={{ marginRight: 8 }}
          >
            {submitting ? "Reprocessing..." : "Reprocess with AI"}
          </Button>
        )}
        <Button onClick={handleCancel} size="small">
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ProcessFeedback;
