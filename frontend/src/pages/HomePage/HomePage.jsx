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
  const { user, token } = useStore();

  const [uploading, setUploading] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const dataFetchedRef = useRef(false);

  // Fetch all uploaded datasets
  const fetchDatasets = useCallback(async () => {
    if (dataFetchedRef.current) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/anomaly/datasets/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Sort by upload date (newest first)
      const sortedDatasets = (response.data || []).sort(
        (a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)
      );

      setDatasets(sortedDatasets);
      dataFetchedRef.current = true;
    } catch (error) {
      console.error("Error fetching datasets:", error);
      message.error("Failed to load uploaded datasets");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  // Handle file upload
  const handleUpload = async (file) => {
    // Validate .xlsx and .csv only
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
    const isCsv = file.name.toLowerCase().endsWith('.csv');

    if (!isXlsx && !isCsv) {
      message.error('Only .xlsx and .csv files are supported. PDFs, images, and other formats are not allowed.');
      return false;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/anomaly/datasets/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      message.success(`${file.name} uploaded successfully!`);

      // Refresh the datasets list
      dataFetchedRef.current = false;
      fetchDatasets();
    } catch (error) {
      console.error("Upload error:", error);
      const errorMsg = error.response?.data?.detail || "Failed to upload file";
      message.error(errorMsg);
    } finally {
      setUploading(false);
    }

    return false; // Prevent default upload behavior
  };

  // Handle view dataset details
  const handleViewDataset = (dataset) => {
    navigate(`/dataset/${dataset.id}`);
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const uploadProps = {
    name: "file",
    multiple: false,
    accept: ".xlsx,.csv",
    beforeUpload: handleUpload,
    showUploadList: false,
  };

  return (
    <div className="welcome-page-container">
      {/* Header Section */}
      <div style={{ marginBottom: "32px" }}>
        <Title level={2}>Anomaly Detection Dashboard</Title>
        <Paragraph type="secondary">
          Upload .xlsx or .csv datasets to detect anomalies and generate security triage reports
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* LEFT COLUMN - Upload New .xlsx */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Flex align="center" gap="small">
                <FileExcelOutlined style={{ color: themeToken.colorPrimary }} />
                <Text strong>Upload New Dataset</Text>
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
                Drag & drop your <strong>.xlsx</strong> or <strong>.csv</strong> file here
              </p>
              <p className="ant-upload-hint">
                or click to browse
              </p>
              <p className="ant-upload-hint" style={{ marginTop: "16px", color: themeToken.colorTextSecondary }}>
                Excel (.xlsx) and CSV (.csv) files supported
              </p>
            </Dragger>

            {uploading && (
              <Flex justify="center" style={{ marginTop: "16px" }}>
                <Spin tip="Uploading and parsing Excel file..." />
              </Flex>
            )}
          </Card>
        </Col>

        {/* RIGHT COLUMN - Uploaded Datasets */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Flex align="center" gap="small">
                <RocketOutlined style={{ color: themeToken.colorPrimary }} />
                <Text strong>Uploaded Datasets</Text>
              </Flex>
            }
            bordered={false}
            style={{ height: "100%", maxHeight: "600px", overflow: "auto" }}
          >
            {loading ? (
              <Flex justify="center" align="center" style={{ minHeight: "200px" }}>
                <Spin tip="Loading datasets..." />
              </Flex>
            ) : datasets.length === 0 ? (
              <Empty
                description="No datasets yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Text type="secondary">
                  Upload an .xlsx file to get started
                </Text>
              </Empty>
            ) : (
              <List
                dataSource={datasets}
                renderItem={(dataset) => (
                  <List.Item
                    key={dataset.id}
                    actions={[
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        onClick={() => handleViewDataset(dataset)}
                      >
                        {dataset.status === 'pending' ? 'Analyze' : 'View Details'}
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
                          <Text strong>{dataset.filename}</Text>
                          <Tag color={dataset.status === 'completed' ? 'green' : dataset.status === 'processing' ? 'blue' : 'orange'}>
                            {dataset.status}
                          </Tag>
                        </Flex>
                      }
                      description={
                        <Flex vertical gap="4px">
                          <Text type="secondary" style={{ fontSize: "12px" }}>
                            <ClockCircleOutlined /> {formatDate(dataset.uploaded_at)}
                          </Text>
                          {dataset.anomaly_count !== undefined && (
                            <Text type="secondary" style={{ fontSize: "12px" }}>
                              Anomalies detected: {dataset.anomaly_count}
                            </Text>
                          )}
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
          STARAI - Anomaly Detection Platform © {new Date().getFullYear()}
        </Typography.Text>
      </div>
    </div>
  );
};

export default HomePage;
