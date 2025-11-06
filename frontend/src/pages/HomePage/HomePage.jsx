import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Row,
  Col,
  Card,
  Typography,
  Flex,
  Upload,
  Button,
  List,
  message,
  Spin,
  Tag,
  Empty,
  theme,
} from "antd";
import {
  InboxOutlined,
  FileExcelOutlined,
  RocketOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import useStore from "../../store";
import "./HomePage.css";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const HomePage = () => {
  const { token: themeToken } = theme.useToken();
  const navigate = useNavigate();
  const { user, token, setCurrentCase } = useStore();

  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defaultCaseId, setDefaultCaseId] = useState(null);
  const dataFetchedRef = useRef(false);

  // Fetch or create default "Reports" case
  const ensureDefaultCase = useCallback(async () => {
    try {
      // Get all cases
      const casesResponse = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/cases/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let reportsCase = casesResponse.data?.find(
        (c) => c.name === "Reports"
      );

      // If no "Reports" case exists, create one
      if (!reportsCase) {
        const createResponse = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/cases/`,
          { name: "Reports" },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        reportsCase = createResponse.data;
      }

      setDefaultCaseId(reportsCase.id);
      return reportsCase.id;
    } catch (error) {
      console.error("Error ensuring default case:", error);
      message.error("Failed to initialize upload folder");
      return null;
    }
  }, [token]);

  // Fetch all uploaded documents from all cases
  const fetchUploads = useCallback(async () => {
    if (dataFetchedRef.current) return;

    setLoading(true);
    try {
      // Get all cases
      const casesResponse = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/cases/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const allDocuments = [];

      // Get documents for each case
      for (const caseItem of casesResponse.data || []) {
        try {
          const docsResponse = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL}/cases/${caseItem.id}/documents/`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (docsResponse.data && Array.isArray(docsResponse.data)) {
            docsResponse.data.forEach((doc) => {
              allDocuments.push({
                ...doc,
                caseName: caseItem.name,
                caseId: caseItem.id,
              });
            });
          }
        } catch (error) {
          console.error(`Error fetching documents for case ${caseItem.id}:`, error);
        }
      }

      // Sort by upload date (newest first)
      allDocuments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setUploads(allDocuments);
      dataFetchedRef.current = true;
    } catch (error) {
      console.error("Error fetching uploads:", error);
      message.error("Failed to load uploaded files");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    ensureDefaultCase();
    fetchUploads();
  }, [ensureDefaultCase, fetchUploads]);

  // Handle file upload
  const handleUpload = async (file) => {
    // Validate .xlsx only
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      message.error('Only .xlsx files are supported. PDFs, images, and other formats are not allowed.');
      return false;
    }

    if (!defaultCaseId) {
      message.error("Upload folder not ready. Please try again.");
      return false;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("created_at", new Date().toISOString());

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/cases/${defaultCaseId}/documents/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      message.success(`${file.name} uploaded successfully!`);

      // Refresh the uploads list
      dataFetchedRef.current = false;
      fetchUploads();
    } catch (error) {
      console.error("Upload error:", error);
      const errorMsg = error.response?.data?.detail || "Failed to upload file";
      message.error(errorMsg);
    } finally {
      setUploading(false);
    }

    return false; // Prevent default upload behavior
  };

  // Handle generate report
  const handleGenerateReport = (upload) => {
    // Set current case and navigate to content-bridge
    setCurrentCase({
      id: upload.caseId,
      name: upload.caseName,
      documents: [upload],
    });

    navigate("/content-bridge");
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const uploadProps = {
    name: "file",
    multiple: false,
    accept: ".xlsx",
    beforeUpload: handleUpload,
    showUploadList: false,
  };

  return (
    <div className="welcome-page-container">
      {/* Header Section */}
      <div style={{ marginBottom: "32px" }}>
        <Title level={2}>Excel Report Generator</Title>
        <Paragraph type="secondary">
          Upload .xlsx files and generate professional reports
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* LEFT COLUMN - Upload New .xlsx */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Flex align="center" gap="small">
                <FileExcelOutlined style={{ color: themeToken.colorPrimary }} />
                <Text strong>Create New Report</Text>
              </Flex>
            }
            bordered={false}
            style={{ height: "100%" }}
          >
            <Dragger {...uploadProps} disabled={uploading}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: themeToken.colorPrimary }} />
              </p>
              <p className="ant-upload-text">
                Drag & drop your <strong>.xlsx</strong> file here
              </p>
              <p className="ant-upload-hint">
                or click to browse
              </p>
              <p className="ant-upload-hint" style={{ marginTop: "16px", color: themeToken.colorTextSecondary }}>
                Only Excel .xlsx files are supported
              </p>
            </Dragger>

            {uploading && (
              <Flex justify="center" style={{ marginTop: "16px" }}>
                <Spin tip="Uploading and parsing Excel file..." />
              </Flex>
            )}
          </Card>
        </Col>

        {/* RIGHT COLUMN - Generate from Previous Uploads */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Flex align="center" gap="small">
                <RocketOutlined style={{ color: themeToken.colorPrimary }} />
                <Text strong>Generate Report From Uploaded Files</Text>
              </Flex>
            }
            bordered={false}
            style={{ height: "100%", maxHeight: "600px", overflow: "auto" }}
          >
            {loading ? (
              <Flex justify="center" align="center" style={{ minHeight: "200px" }}>
                <Spin tip="Loading uploads..." />
              </Flex>
            ) : uploads.length === 0 ? (
              <Empty
                description="No uploads yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Text type="secondary">
                  Upload an .xlsx file to get started
                </Text>
              </Empty>
            ) : (
              <List
                dataSource={uploads}
                renderItem={(upload) => (
                  <List.Item
                    key={upload.id}
                    actions={[
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        onClick={() => handleGenerateReport(upload)}
                      >
                        Generate
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <FileExcelOutlined
                          style={{ fontSize: "24px", color: themeToken.colorSuccess }}
                        />
                      }
                      title={
                        <Flex gap="small" wrap="wrap">
                          <Text strong>{upload.name}</Text>
                          <Tag color="blue">{upload.caseName}</Tag>
                        </Flex>
                      }
                      description={
                        <Flex vertical gap="4px">
                          <Text type="secondary" style={{ fontSize: "12px" }}>
                            <ClockCircleOutlined /> {formatDate(upload.created_at)}
                          </Text>
                        </Flex>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          marginTop: "64px",
          paddingBottom: "24px",
        }}
      >
        <Typography.Text type="secondary">
          STARAI - Excel Report Platform © {new Date().getFullYear()}
        </Typography.Text>
      </div>
    </div>
  );
};

export default HomePage;
