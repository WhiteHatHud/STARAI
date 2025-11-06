import { useState } from "react";
import axios from "axios";
import {
  Button,
  Modal,
  Upload,
  Space,
  Alert,
  Divider,
  App,
  Select,
  Row,
  Col,
} from "antd";
import {
  UploadOutlined,
  DownloadOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import templateCsv from "./template.csv?raw";

const { Dragger } = Upload;
const { Option } = Select;

const CreateBatch = ({ updateUsers, setSelectedUser }) => {
  const { message } = App.useApp();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resultBlob, setResultBlob] = useState(null);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const showModal = () => {
    console.log("CreateBatch: Modal opened");
    setIsModalVisible(true);
    fetchTemplates();
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      console.log("CreateBatch: Fetching available templates");
      const controller = new AbortController();
      const token = localStorage.getItem("token");
      const base = import.meta.env.VITE_API_BASE_URL;

      const response = await axios.get(`${base}/custom/documents/templates`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
        signal: controller.signal,
      });

      console.log("CreateBatch: Templates fetched successfully", response.data);

      // Extract templates from the nested structure
      const templatesData = Array.isArray(response.data?.templates)
        ? response.data.templates
        : [];
      setTemplates(templatesData);
    } catch (error) {
      console.error("CreateBatch: Error fetching templates:", error);
      message.error("Failed to fetch templates");
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleCancel = () => {
    if (isProcessingComplete && !hasDownloaded) {
      message.warning("Please download the results before closing");
      return;
    }

    console.log("CreateBatch: Modal cancelled, resetting state");
    resetModalState();
  };

  const resetModalState = () => {
    setSelectedFile(null);
    setResultBlob(null);
    setHasDownloaded(false);
    setIsProcessingComplete(false);
    setSelectedTemplates([]);
    setTemplates([]);
    setIsModalVisible(false);
  };

  const handleDownloadTemplate = () => {
    console.log("CreateBatch: Template download initiated");
    try {
      // Create a link to download the template.csv file
      const link = document.createElement("a");
      link.href = templateCsv;
      link.download = "template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log("CreateBatch: Template downloaded successfully");
      message.success("CSV template has been downloaded");
    } catch (error) {
      console.error("CreateBatch: Template download failed:", error);
      message.error("Failed to download template");
    }
  };

  const handleDownloadResults = () => {
    if (!resultBlob) {
      message.error("No results available to download");
      return;
    }

    try {
      const url = window.URL.createObjectURL(resultBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "mass_create_results.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setHasDownloaded(true);
      console.log("CreateBatch: Results CSV downloaded successfully");
      message.success(
        "Results downloaded successfully. Modal will close automatically."
      );

      // Automatically close modal after download
      setTimeout(() => {
        resetModalState();
      }, 1500); // 1.5 second delay to show the success message
    } catch (error) {
      console.error("CreateBatch: Results download failed:", error);
      message.error("Failed to download results");
    }
  };

  const uploadProps = {
    name: "file",
    multiple: false,
    accept: ".csv",
    beforeUpload: (file) => {
      console.log("CreateBatch: File selected for upload:", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      if (!file.name.endsWith(".csv")) {
        console.warn("CreateBatch: Invalid file type selected:", file.name);
        message.error("Please select a CSV file");
        return false;
      }

      setSelectedFile(file);
      console.log("CreateBatch: File validated and set successfully");
      message.success(`${file.name} file selected successfully`);
      return false; // Prevent automatic upload
    },
    onRemove: () => {
      console.log("CreateBatch: File removed from upload");
      setSelectedFile(null);
    },
    fileList: selectedFile ? [selectedFile] : [],
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      console.warn("CreateBatch: Submit attempted without file selection");
      message.warning("Please select a CSV file to upload");
      return;
    }

    console.log("CreateBatch: Starting batch user creation", {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      selectedTemplates: selectedTemplates,
    });

    setIsLoading(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("csv_file", selectedFile);
      formData.append("template_ids", JSON.stringify(selectedTemplates));

      console.log("CreateBatch: Sending API request to mass-create endpoint");
      const startTime = Date.now();

      // API request to create batch users
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/admin/users/mass-create`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          responseType: "blob",
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log("CreateBatch: API request successful", {
        duration: `${duration}ms`,
        responseSize: response.data.size,
        responseType: response.headers["content-type"],
      });

      // Store the result blob for later download instead of auto-downloading
      const blob = new Blob([response.data], { type: "text/csv" });
      setResultBlob(blob);
      setIsProcessingComplete(true);

      console.log("CreateBatch: Results ready for download");
      message.success(
        "Users have been created successfully! Please download the results."
      );

      // Update users list
      updateUsers();
    } catch (error) {
      console.error("CreateBatch: Error during batch creation:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      let errorMessage = "Failed to create batch users";

      if (error.response?.data) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData.detail || errorMessage;
          console.error("CreateBatch: Server error details:", errorData);
        } catch (parseError) {
          console.error(
            "CreateBatch: Could not parse error response:",
            parseError
          );
          errorMessage = error.response?.statusText || errorMessage;
        }
      }

      message.error(errorMessage);
    } finally {
      setIsLoading(false);
      setSelectedUser(null);
      console.log("CreateBatch: Request completed, loading state reset");
    }
  };

  const handleTemplateChange = (values) => {
    console.log("CreateBatch: Template selection changed:", values);
    setSelectedTemplates(values);
  };

  return (
    <>
      <Button
        type="primary"
        icon={<UploadOutlined />}
        onClick={showModal}
        size="middle"
      >
        Create Batch
      </Button>

      <Modal
        title="Create Batch Users"
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={900} // Increased width from 720 to 900
        centered
        destroyOnClose={false}
        closable={!isProcessingComplete || hasDownloaded}
        maskClosable={!isProcessingComplete || hasDownloaded}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {!isProcessingComplete && (
            <>
              {/* Two-column layout */}
              <Row gutter={24} style={{ marginBottom: "16px" }}>
                {" "}
                {/* Increased gutter from 16 to 24 */}
                {/* Left Column - Download Template & Select Templates */}
                <Col xs={24} sm={12}>
                  <Space
                    direction="vertical"
                    style={{ width: "100%" }}
                    size="middle"
                  >
                    <Alert
                      message="Step 1: Download Template"
                      description="Get the CSV template with the correct format"
                      type="info"
                      showIcon
                      size="small"
                    />
                    <Button
                      type="default"
                      icon={<DownloadOutlined />}
                      onClick={handleDownloadTemplate}
                      style={{
                        width: "100%",
                        borderRadius: "20px",
                        height: "40px",
                      }}
                    >
                      Download CSV Template
                    </Button>

                    <Divider style={{ margin: "16px 0" }} />

                    {/* Template Selection Section */}
                    <Alert
                      message="Step 2: Select Templates"
                      description="Select template to assign to users"
                      type="info"
                      showIcon
                      icon={<FileTextOutlined />}
                      size="small"
                    />

                    <Select
                      mode="multiple"
                      placeholder={
                        templates.length === 0
                          ? "No templates available"
                          : "Select templates to assign to users"
                      }
                      value={selectedTemplates}
                      onChange={handleTemplateChange}
                      loading={loadingTemplates}
                      disabled={templates.length === 0 || loadingTemplates}
                      style={{ width: "100%" }}
                      size="large"
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        option?.children
                          ?.toLowerCase()
                          .includes(input.toLowerCase())
                      }
                      notFoundContent={
                        loadingTemplates
                          ? "Loading..."
                          : "No templates available"
                      }
                    >
                      {Array.isArray(templates) && templates.length > 0
                        ? templates.map((template) => (
                            <Option
                              key={template.filename}
                              value={template.filename}
                            >
                              {template.report_metadata.report_type}
                            </Option>
                          ))
                        : !loadingTemplates && (
                            <Option disabled value="no-templates">
                              No templates available
                            </Option>
                          )}
                    </Select>
                  </Space>
                </Col>
                {/* Right Column - Upload File */}
                <Col xs={24} sm={12}>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Alert
                      message="Step 3: Upload File"
                      description="Select your CSV file with user emails"
                      type="warning"
                      showIcon
                      size="small"
                    />
                    <Dragger
                      {...uploadProps}
                      style={{
                        padding: "16px", // Increased padding for better visual balance
                        minHeight: "200px", // Increased height to match left column
                        height: "200px",
                      }}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined
                          style={{ fontSize: "32px", color: "#1890ff" }}
                        />
                      </p>
                      <p
                        className="ant-upload-text"
                        style={{ fontSize: "14px", margin: "8px 0" }}
                      >
                        Click or drag CSV file here
                      </p>
                      <p
                        className="ant-upload-hint"
                        style={{ fontSize: "12px", margin: "0" }}
                      >
                        Only CSV files supported
                      </p>
                    </Dragger>
                  </Space>
                </Col>
              </Row>

              <Button
                type="primary"
                loading={isLoading}
                onClick={handleSubmit}
                disabled={!selectedFile}
                style={{
                  width: "100%",
                  borderRadius: "20px",
                  height: "40px",
                  marginTop: "16px",
                }}
              >
                Create Users
              </Button>
            </>
          )}

          {isProcessingComplete && (
            <>
              <Alert
                message="Processing Complete!"
                description="The batch user creation has been completed successfully. Click download to get the results and close this modal."
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
              />

              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadResults}
                disabled={hasDownloaded}
                style={{
                  width: "100%",
                  borderRadius: "20px",
                  height: "40px",
                  backgroundColor: hasDownloaded ? "#52c41a" : undefined,
                  borderColor: hasDownloaded ? "#52c41a" : undefined,
                }}
              >
                {hasDownloaded
                  ? "Downloaded ✓ Closing..."
                  : "Download Results & Close"}
              </Button>
            </>
          )}
        </Space>
      </Modal>
    </>
  );
};

export default CreateBatch;
