import { useState, useEffect } from "react";
import {
  Card,
  Upload,
  Button,
  Typography,
  Space,
  message,
  Divider,
  Alert,
  Row,
  Col,
  List,
  Select,
  Tooltip,
} from "antd";
import {
  UploadOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  FilePdfOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

export const TemplateUploadGenerator = ({
  token,
  triggerProcessingData,
  isDarkMode,
  onTemplateGenerated,
  editMode,
}) => {
  const [uploadedTemplate, setUploadedTemplate] = useState(null);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processingMethod, setProcessingMethod] = useState("pandoc");

  // Progress tracking state
  const [progressId, setProgressId] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const isMobile = window.innerWidth <= 768;

  const handleTemplateUpload = {
    name: "template",
    multiple: false,
    accept: ".docx,.doc,.txt,.pdf",
    beforeUpload: (file) => {
      const isValidType =
        [
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "application/pdf",
        ].includes(file.type) ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".docx") ||
        file.name.endsWith(".pdf");

      if (!isValidType) {
        message.error(
          "Please upload a valid template file (.docx, .txt, .pdf)"
        );
        return false;
      }

      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error("Template file must be smaller than 10MB!");
        return false;
      }

      setUploadedTemplate(file);
      message.success(`${file.name} template uploaded successfully`);
      return false;
    },
    onRemove: () => {
      setUploadedTemplate(null);
    },
  };

  const handleDocumentsUpload = {
    name: "documents",
    multiple: true,
    accept: ".docx,.doc,.txt,.pdf",
    beforeUpload: (file, fileList) => {
      const isValidType =
        [
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "application/pdf",
        ].includes(file.type) ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".docx") ||
        file.name.endsWith(".pdf");

      if (!isValidType) {
        message.error(
          `${file.name}: Please upload a valid document file (.docx, .txt, .pdf)`
        );
        return false;
      }

      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error(`${file.name}: File must be smaller than 10MB!`);
        return false;
      }

      setUploadedDocuments((prev) => {
        const exists = prev.find(
          (doc) => doc.name === file.name && doc.size === file.size
        );
        if (exists) {
          message.warning(`${file.name} is already uploaded`);
          return prev;
        }
        const newDocs = [...prev, file];
        message.success(
          `${file.name} uploaded successfully (${newDocs.length} document${
            newDocs.length > 1 ? "s" : ""
          } total)`
        );
        return newDocs;
      });

      return false;
    },
    onRemove: (file) => {
      setUploadedDocuments((prev) => {
        const filtered = prev.filter(
          (doc) => !(doc.name === file.name && doc.size === file.size)
        );
        message.info(`${file.name} removed`);
        return filtered;
      });
    },
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
            message.success("Template generation completed successfully!");
            setUploading(false);
            // Extract template data from root level
            if (data.template) {
              const template = JSON.parse(data.template);
              onTemplateGenerated(template);
            } else {
              console.error("Template name not found in response:", data);
              message.error(
                "Template generated but name not found in response"
              );
            }
            clearInterval(interval);
          } else if (data.status === "error") {
            message.error(
              `Template generation failed: ${data.error || "Unknown error"}`
            );
            setUploading(false);
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
  }, [progressId, progressData, token, onTemplateGenerated]);

  const handleGenerateContent = async () => {
    if (!uploadedTemplate) {
      message.error("Please upload a template file first");
      return;
    }

    setUploading(true);
    setProgressData({
      status: "initializing",
      progress: 0,
      message: "Starting template generation...",
    });

    try {
      const formData = new FormData();
      formData.append("template", uploadedTemplate);
      formData.append("processing_method", processingMethod);

      uploadedDocuments.forEach((doc, index) => {
        formData.append(`document_${index}`, doc);
      });

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/custom/documents/custom-format`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 200) {
        const result = response.data;
        setProgressId(result.progress_id);
        setProgressData({
          status: "processing",
          progress: 5,
          message: "Template generation started...",
        });
        triggerProcessingData();
        message.info(
          "Template generation started. This may take a few minutes..."
        );
      } else {
        message.error("Failed to start template generation");
        setUploading(false);
      }
    } catch (error) {
      console.error("Error generating custom format:", error);
      if (error.response?.data?.detail) {
        message.error(error.response.data.detail);
      } else {
        message.error("An error occurred while generating content");
      }
      setUploading(false);
      setProgressData(null);
    }
  };

  if (editMode) {
    return null;
  }

  return (
    <Card
      title={
        <Row justify="space-between" align="middle" style={{ width: "100%" }}>
          <Col>
            <Space>
              <FileTextOutlined />
              <span>Upload Files</span>
              {uploading && (
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  (Processing in background...)
                </Text>
              )}
            </Space>
          </Col>
          {import.meta.env.VITE_GPU_USAGE === "true" && (
            <Col>
              <Space>
                <Text
                  strong
                  style={{
                    fontSize: "14px",
                    color: isDarkMode ? "#ffffff" : "#000000",
                  }}
                >
                  Processing Method:
                </Text>
                <Select
                  value={processingMethod}
                  onChange={setProcessingMethod}
                  style={{ width: 120 }}
                  size="small"
                  disabled={uploading}
                >
                  <Option value="pandoc">Pandoc</Option>
                  <Option value="marker">Marker</Option>
                </Select>
                <Tooltip
                  title={
                    <div>
                      <div style={{ marginBottom: "8px" }}>
                        <Text strong style={{ color: "#fff" }}>
                          Pandoc:
                        </Text>
                        <div>• Fast and reliable document conversion</div>
                        <div>• Best for standard document formats</div>
                        <div>• Preserves basic formatting and structure</div>
                      </div>
                      <div>
                        <Text strong style={{ color: "#fff" }}>
                          Marker:
                        </Text>
                        <div>• Advanced AI-powered document parsing</div>
                        <div>• Better for complex layouts and tables</div>
                        <div>• Slower but more accurate for PDFs</div>
                      </div>
                    </div>
                  }
                  placement="bottomRight"
                  overlayStyle={{ maxWidth: "300px" }}
                >
                  <QuestionCircleOutlined
                    style={{
                      color: isDarkMode ? "#ffffff" : "#666666",
                      cursor: "help",
                      fontSize: "14px",
                    }}
                  />
                </Tooltip>
              </Space>
            </Col>
          )}
        </Row>
      }
      className="upload-card"
    >
      {uploading && progressData && (
        <Alert
          message={`Status: ${progressData.message || "Processing..."}`}
          description="Template generation is running in the background. You will be notified when it's complete."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[24, 24]}>
        {/* Template Upload Section */}
        <Col xs={24} md={12}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Title
              level={5}
              style={{ margin: 0, color: isDarkMode ? "#ffffff" : "#000000" }}
            >
              <Space>
                <FileTextOutlined />
                Template File (Required)
              </Space>
            </Title>

            <Alert
              message="Template File Requirements"
              description="Upload a template file that defines the structure and format for your custom content."
              type="info"
              icon={<InfoCircleOutlined />}
              showIcon
              size="small"
            />

            <Dragger
              {...handleTemplateUpload}
              className="template-uploader"
              disabled={uploading}
              style={{ height: "160px" }}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text" style={{ fontSize: "14px" }}>
                Click or drag template file here
              </p>
              <p className="ant-upload-hint" style={{ fontSize: "12px" }}>
                .docx, .doc, .txt, .pdf
              </p>
            </Dragger>

            {uploadedTemplate && (
              <Alert
                message={`Template: ${uploadedTemplate.name}`}
                type="success"
                showIcon
                size="small"
              />
            )}
          </Space>
        </Col>

        {/* Vertical Divider */}
        {!isMobile && (
          <>
            <Col xs={24} md={0}>
              <Divider style={{ margin: "16px 0" }} />
            </Col>
            <Col
              xs={0}
              md={1}
              style={{ display: "flex", justifyContent: "center" }}
            >
              <Divider
                type="vertical"
                style={{ height: "100%", minHeight: "300px" }}
              />
            </Col>
          </>
        )}

        {/* Supporting Documents Upload Section */}
        <Col xs={24} md={11}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Title
              level={5}
              style={{ margin: 0, color: isDarkMode ? "#ffffff" : "#000000" }}
            >
              <Space>
                <FilePdfOutlined />
                Supporting Documents (Optional)
              </Space>
            </Title>

            <Alert
              message="Supporting Documents"
              description="Upload additional documents containing content to be formatted according to your template."
              type="info"
              icon={<InfoCircleOutlined />}
              showIcon
              size="small"
            />

            <Dragger
              {...handleDocumentsUpload}
              className="documents-uploader"
              disabled={uploading}
              style={{ height: "160px" }}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text" style={{ fontSize: "14px" }}>
                Click or drag documents here
              </p>
              <p className="ant-upload-hint" style={{ fontSize: "12px" }}>
                .docx, .doc, .txt, .pdf
              </p>
            </Dragger>

            {uploadedDocuments.length > 0 && (
              <div>
                <Text strong style={{ fontSize: "12px" }}>
                  Uploaded ({uploadedDocuments.length}):
                </Text>
                <List
                  size="small"
                  dataSource={uploadedDocuments}
                  renderItem={(doc) => (
                    <List.Item style={{ padding: "4px 0" }}>
                      <Space>
                        <FileTextOutlined style={{ fontSize: "12px" }} />
                        <Text style={{ fontSize: "12px" }}>{doc.name}</Text>
                        <Text type="secondary" style={{ fontSize: "10px" }}>
                          ({(doc.size / 1024 / 1024).toFixed(2)} MB)
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                  style={{
                    maxHeight: 120,
                    overflowY: "auto",
                    backgroundColor: isDarkMode ? "#1f1f1f" : "#fafafa",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: `1px solid ${isDarkMode ? "#303030" : "#d9d9d9"}`,
                  }}
                />
              </div>
            )}
          </Space>
        </Col>
      </Row>

      <Divider />

      <Button
        type="primary"
        size="large"
        onClick={handleGenerateContent}
        loading={uploading}
        disabled={!uploadedTemplate || uploading}
        style={{ width: "100%" }}
      >
        {uploading
          ? "Generating Template..."
          : "Generate Custom Format Content"}
      </Button>
    </Card>
  );
};
