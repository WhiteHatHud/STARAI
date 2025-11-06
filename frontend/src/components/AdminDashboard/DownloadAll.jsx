import { useState } from "react";
import axios from "axios";
import { Button, Modal, Form, Select, Tabs, notification } from "antd";
import {
  DownloadOutlined,
  FilePdfOutlined,
  FileWordOutlined,
} from "@ant-design/icons";
import useStore from "../../store";

const { Option } = Select;

const DownloadAll = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState("docx");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const { user: currentUser } = useStore();

  const showModal = () => {
    setIsModalVisible(true);
    if (templates.length === 0) {
      fetchTemplates();
    }
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    resetDownloadState();
  };

  const resetDownloadState = () => {
    setSelectedTemplate(null);
    setSelectedStatus(null);
    setDownloadFormat("docx");
  };

  const fetchTemplates = async () => {
    try {
      const [allPrivateResponse, publicResponse] = await Promise.all([
        // Admin endpoint to get templates only from users that exist in database
        axios.get(
          `${
            import.meta.env.VITE_API_BASE_URL
          }/custom/documents/admin/templates/existing-users`,
          {
            headers: {
              Authorization: `Bearer ${currentUser?.token}`,
            },
          }
        ),
        // Get public templates
        axios.get(
          `${
            import.meta.env.VITE_API_BASE_URL
          }/custom/documents/templates/public`,
          {
            headers: {
              Authorization: `Bearer ${currentUser?.token}`,
            },
          }
        ),
      ]);

      const allPrivateTemplates = allPrivateResponse.data?.templates || [];
      const publicTemplatesDict = publicResponse.data?.templates || {};

      const publicTemplates = Object.values(publicTemplatesDict).map(
        (template) => ({
          ...template,
          isPublic: true,
        })
      );

      const markedPrivateTemplates = allPrivateTemplates.map((template) => ({
        ...template,
        isPublic: false,
      }));

      // Create a Set of public template names/identifiers for deduplication
      const publicTemplateIdentifiers = new Set(
        publicTemplates.map(
          (template) => template.template_name || template.template_identifier
        )
      );

      // Filter out private templates that have public equivalents
      const filteredPrivateTemplates = markedPrivateTemplates.filter(
        (template) => {
          const identifier =
            template.template_name || template.template_identifier;
          return !publicTemplateIdentifiers.has(identifier);
        }
      );

      // Combine public templates with filtered private templates
      const allTemplates = [...filteredPrivateTemplates, ...publicTemplates];

      setTemplates(allTemplates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      notification.error({
        message: "Failed to Load Templates",
        description: "Unable to fetch templates for filtering.",
      });
    }
  };

  const handleDownloadAll = async () => {
    console.log("DownloadAll: Starting bulk download", {
      format: downloadFormat,
      template: selectedTemplate,
      status: selectedStatus,
    });

    setIsDownloading(true);

    try {
      notification.info({
        message: "Preparing Download",
        description:
          "Preparing bulk download of case studies for all users. This may take a while...",
      });

      let params = { format: downloadFormat };
      // Add filters if selected
      if (selectedTemplate) {
        params.template_name = selectedTemplate;
      }
      if (selectedStatus) {
        params.status = selectedStatus;
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/reports/admin/bulk-download`,
        {
          headers: {
            Authorization: `Bearer ${currentUser.token}`,
          },
          responseType: "blob",
          params: params,
        }
      );

      // Create blob and download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Extract filename from response headers or create default
      const contentDisposition = response.headers["content-disposition"];
      let filename = `All_Users_Case_Studies_${downloadFormat.toUpperCase()}.zip`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      notification.success({
        message: "Download Complete",
        description: `All case studies have been downloaded successfully as a ZIP file organized by user folders.`,
      });

      // Close modal and reset state
      setIsModalVisible(false);
      resetDownloadState();
    } catch (error) {
      console.error("DownloadAll: Bulk download failed:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      let errorMessage = "Unable to download case studies. Please try again.";

      if (error.response?.data) {
        try {
          // Handle blob error response
          if (error.response.data instanceof Blob) {
            const text = await error.response.data.text();
            const errorData = JSON.parse(text);
            errorMessage = errorData.detail || errorMessage;
            console.error("DownloadAll: Server error details:", errorData);
          } else if (typeof error.response.data === "object") {
            errorMessage = error.response.data.detail || errorMessage;
          }
        } catch (parseError) {
          console.error(
            "DownloadAll: Could not parse error response:",
            parseError
          );
          if (error.response.status === 404) {
            errorMessage =
              "No case studies found matching the selected filters.";
          } else {
            errorMessage = error.response?.statusText || errorMessage;
          }
        }
      } else if (error.response && error.response.status === 404) {
        errorMessage = "No case studies found matching the selected filters.";
      }

      notification.error({
        message: "Download Failed",
        description: errorMessage,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Button icon={<DownloadOutlined />} onClick={showModal} size="middle">
        Download All
      </Button>

      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <DownloadOutlined />
            <span>Download All Reports</span>
          </div>
        }
        open={isModalVisible}
        onOk={handleDownloadAll}
        onCancel={handleCancel}
        okText={isDownloading ? "Downloading..." : "Download"}
        okButtonProps={{ loading: isDownloading }}
        destroyOnClose
        width={600}
        centered
      >
        <Tabs
          activeKey={downloadFormat}
          onChange={setDownloadFormat}
          items={[
            {
              key: "docx",
              label: (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <FileWordOutlined />
                  <span>Word Document</span>
                </div>
              ),
            },
            {
              key: "pdf",
              label: (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <FilePdfOutlined />
                  <span>PDF</span>
                </div>
              ),
            },
          ]}
        />

        <Form layout="vertical">
          <Form.Item
            label="Select Template (Optional)"
            help="Leave empty to include all templates."
          >
            <Select
              showSearch
              placeholder="Select or search for a template (optional)"
              value={selectedTemplate}
              onChange={setSelectedTemplate}
              style={{ width: "100%" }}
              disabled={isDownloading}
              allowClear
              filterOption={(input, option) => {
                const template = templates.find(
                  (template) => template.template_name === option.value
                );
                if (!template) return false;
                const reportType = template.report_metadata?.report_type || "";
                return reportType.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {templates.map((template) => (
                <Option
                  key={template.template_name}
                  value={template.template_name}
                >
                  {template.report_metadata?.report_type ||
                    template.template_name}
                  {template.isPublic ? (
                    <span style={{ color: "#52c41a", marginLeft: "8px" }}>
                      (Public)
                    </span>
                  ) : (
                    <span style={{ color: "#1890ff", marginLeft: "8px" }}>
                      (Private - {template.username || "Unknown"})
                    </span>
                  )}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Select Status (Optional)"
            help="Leave empty to include all status."
          >
            <Select
              placeholder="Select status (optional)"
              value={selectedStatus}
              onChange={setSelectedStatus}
              style={{ width: "100%" }}
              disabled={isDownloading}
              allowClear
            >
              <Option value="published">Published</Option>
              <Option value="pending_review">Pending Review</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default DownloadAll;
