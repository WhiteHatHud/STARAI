import { useState, useRef } from "react";
import {
  Modal,
  Button,
  notification,
  List,
  Tag,
  Tooltip,
  Skeleton,
  Flex,
  Typography,
  Spin,
  theme,
} from "antd";
import {
  DeleteOutlined,
  FileTextOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import InfiniteScroll from "react-infinite-scroll-component";
import styles from "./DocumentList.module.css";
import axios from "axios";

// Logos
import audioIcon from "../../assets/images/audio-logo.png";
import documentHelpers from "../../utils/documentHelpers";
import {
  formatMilliseconds,
  formatProcessingDuration,
} from "../../utils/timeUtils";

const { Text } = Typography;

export const DocumentList = ({
  documents = [],
  setDocuments,
  setSelectedNotes,
  token,
  hasProcessingDocuments,
  setSelectedDocumentIds = () => {},
  scrollableTargetId = "scrollableDiv",
  canDelete = true,
}) => {
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [mediaData, setMediaData] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const audioRef = useRef(null);
  const { token: themeToken } = theme.useToken();

  // Document type helpers
  const { getFileExtension, getDocumentLogo } = documentHelpers();

  // Normalize documents to ensure consistent structure
  const normalizedDocuments = documents
    .map((doc) => ({
      ...doc,
      id: doc.id || doc._id || "",
      case_id: doc.case_id || "",
      name: doc.name || "Unnamed Document",
      content: doc.content || "",
      content_type: doc.content_type || "text/plain",
      summary_points: doc.summary_points || [],
      processing_status: doc.processing_status || "completed",
    }))
    .filter((doc) => doc.id && doc.case_id);

  const fetchPresignedUrl = async (caseId, docId) => {
    try {
      const response = await axios.get(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/cases/${caseId}/documents/${docId}/url`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.presigned_url;
    } catch (error) {
      console.error("Error fetching presigned URL:", error);
      notification.error({
        message: "Error",
        description: "Failed to get document access URL.",
      });
      throw error;
    }
  };

  const fetchMediaData = async (presignedUrl, type) => {
    setMediaLoading(true);
    try {
      if (!presignedUrl) {
        console.error("Cannot fetch media data: URL is empty");
        return;
      }

      let finalUrl;

      // For Word documents, we'll use the Office Online viewer
      if (type === "word") {
        // Encode the presigned URL for use in the Office Online viewer
        const encodedUrl = encodeURIComponent(presignedUrl);
        finalUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
      } else {
        // For other types, just use the presigned URL directly
        finalUrl = presignedUrl;
      }

      setMediaData(finalUrl);
      setMediaType(type);

      return { url: finalUrl, type };
    } catch (error) {
      console.error(`Error setting ${type} data:`, error);
      notification.error({
        message: "Error",
        description: `Failed to load ${type} data.`,
      });
      return null;
    } finally {
      setMediaLoading(false);
    }
  };

  // Handlers for user interaction
  const handleViewDocument = async (doc) => {
    setSelectedDocument(doc);
    setIsModalVisible(true);

    if (doc?.content_type) {
      try {
        const presignedUrl = await fetchPresignedUrl(doc.case_id, doc.id);
        const extension = getFileExtension(doc.name);

        if (doc.content_type.startsWith("image")) {
          await fetchMediaData(presignedUrl, "image");
          setActiveTab("media");
        } else if (doc.content_type.startsWith("audio")) {
          await fetchMediaData(presignedUrl, "audio");
          setActiveTab("media");
        } else if (doc.content_type.startsWith("video")) {
          await fetchMediaData(presignedUrl, "video");
          setActiveTab("media");
        } else if (
          ["doc", "docx"].includes(extension) ||
          doc.content_type.includes("word") ||
          doc.content_type.includes("msword")
        ) {
          await fetchMediaData(presignedUrl, "word");
          setActiveTab("media");
        } else if (
          ["pdf"].includes(extension) ||
          doc.content_type.includes("pdf") ||
          doc.content_type.includes("application/pdf")
        ) {
          await fetchMediaData(presignedUrl, "pdf");
          setActiveTab("media");
        } else {
          setActiveTab("fullText");
        }
      } catch (error) {
        console.error("Error handling document click:", error);
        setActiveTab("fullText");
      }
    } else {
      setActiveTab("fullText");
    }
  };

  const handleDownload = async (doc) => {
    try {
      notification.info({
        message: "Preparing Download",
        description: "Your file is being prepared for download...",
      });

      // Get the presigned URL for the document
      const presignedUrl = await fetchPresignedUrl(doc.case_id, doc.id);

      // Fetch the file data
      const response = await fetch(presignedUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the file as a blob
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Set the filename
      link.download = doc.name || `document_${doc.id}`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      notification.success({
        message: "Download Complete",
        description: `${doc.name} has been downloaded successfully.`,
      });
    } catch (error) {
      console.error("Download failed:", error);
      notification.error({
        message: "Download Failed",
        description: `Unable to download ${doc.name}. Please try again.`,
      });
    }
  };

  const handleModalClose = () => {
    setMediaData(null);
    setMediaType(null);
    setMediaLoading(false);

    if (audioRef.current) audioRef.current.pause();

    setSelectedDocument(null);
    setIsModalVisible(false);
  };

  // Validation helper
  const isValidMongoId = (id) => {
    return id && typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
  };

  const deleteDocument = async (docId) => {
    // Validate the document ID before proceeding
    if (!isValidMongoId(docId)) {
      notification.error({
        message: "Error",
        description: "Cannot delete document: Invalid document ID",
      });
      return;
    }

    const documentToDelete = normalizedDocuments.find(
      (doc) => doc.id === docId
    );
    if (!documentToDelete?.case_id) {
      notification.error({
        message: "Error",
        description: "Cannot delete: Document information is missing",
      });
      return;
    }

    Modal.confirm({
      title: "Delete Confirmation",
      content:
        "Are you sure you want to delete this document? This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          const response = await axios.delete(
            `${import.meta.env.VITE_API_BASE_URL}/cases/${
              documentToDelete.case_id
            }/documents/${docId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (response.status === 200) {
            // Update all relevant state with the actual filtered arrays
            setSelectedDocumentIds((prevIds) =>
              prevIds.filter((id) => id !== docId)
            );

            const updatedNotes = documents.filter(
              (doc) => doc.id !== docId && doc._id !== docId
            );
            setSelectedNotes(updatedNotes);
            setDocuments(updatedNotes);

            notification.success({
              message: "Document Deleted",
              description: "The document was successfully deleted.",
            });
          }
        } catch (error) {
          console.error("Failed to delete document:", error);
          notification.error({
            message: "Delete Failed",
            description:
              error.response?.status === 404
                ? "Document not found or already deleted"
                : `Failed to delete the document: ${error.message}`,
          });
        }
      },
    });
  };

  const renderModalTabs = (document) => {
    if (!document) return null;

    const contentType = document.content_type || "";
    const extension = getFileExtension(document.name);
    const tabs = [];

    // Add media tab for media content types
    if (
      contentType.startsWith("image") ||
      contentType.startsWith("audio") ||
      contentType.startsWith("video") ||
      contentType.startsWith("document") ||
      ["doc", "docx", "pdf"].includes(extension) ||
      contentType.includes("pdf") ||
      contentType.includes("application/pdf") ||
      contentType.includes("word") ||
      contentType.includes("msword")
    ) {
      const mediaLabel = contentType.startsWith("image")
        ? "Image"
        : contentType.startsWith("audio")
        ? "Audio"
        : contentType.startsWith("video")
        ? "Video"
        : contentType.startsWith("pdf")
        ? "PDF"
        : "Document";

      tabs.push(
        <Button
          key="media"
          type={activeTab === "media" ? "primary" : "default"}
          onClick={() => setActiveTab("media")}
        >
          {mediaLabel}
        </Button>
      );
    }

    // Text content tab label changes based on content type
    const fullTextLabel =
      contentType.startsWith("audio") || contentType.startsWith("video")
        ? "Transcription"
        : "Full Text";

    tabs.push(
      <Button
        key="fullText"
        type={activeTab === "fullText" ? "primary" : "default"}
        onClick={() => setActiveTab("fullText")}
      >
        {fullTextLabel}
      </Button>
    );

    tabs.push(
      <Button
        key="metadata"
        type={activeTab === "metadata" ? "primary" : "default"}
        onClick={() => setActiveTab("metadata")}
      >
        Metadata
      </Button>
    );

    return <div className={styles.modalTabs}>{tabs}</div>;
  };

  const renderMediaContent = (document) => {
    if (!mediaType || !mediaData) {
      return (
        <div
          className={styles.debugInfo}
          style={{ padding: "20px", border: "1px solid #ddd" }}
        >
          <h3>Debug Information:</h3>
          <pre>mediaType: {JSON.stringify(mediaType)}</pre>
          <pre>mediaData: {JSON.stringify(mediaData)}</pre>
          <pre>activeTab: {activeTab}</pre>
          <p>
            The "No media content available" message is shown because either
            mediaType or mediaData is not set.
          </p>
        </div>
      );
    }

    switch (mediaType) {
      case "image":
        return mediaLoading ? (
          <Skeleton.Image active />
        ) : (
          <img
            src={mediaData}
            alt={document.name}
            className={styles.documentImage}
          />
        );
      case "audio":
        return mediaLoading ? (
          <Skeleton.Node active size="large" />
        ) : (
          <div className={styles.audioPlayer}>
            <Flex vertical align="center" style={{ width: "100%" }}>
              <img
                src={audioIcon}
                alt="Audio"
                style={{ width: "100px", height: "100px" }}
              />

              {/* Audio controls */}
              <div style={{ width: "100%", height: "100%" }}>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    marginBottom: "10px",
                    textAlign: "center",
                  }}
                >
                  {document.name}
                </div>
                <audio
                  ref={audioRef}
                  src={mediaData}
                  controls
                  preload="metadata"
                  style={{
                    width: "100%",
                    minHeight: "54px",
                    outline: "none",
                  }}
                ></audio>
              </div>
            </Flex>
          </div>
        );
      case "video":
        return mediaLoading ? (
          <Skeleton.Node active size="large" />
        ) : (
          <iframe
            src={mediaData}
            title={document.name}
            className={styles.videoPlayer}
            style={{ border: "none", width: "100%", height: "500px" }}
            sandbox="allow-same-origin"
          />
        );
      case "pdf":
        return mediaLoading ? (
          <Skeleton active />
        ) : (
          <div className={styles.pdfContainer}>
            <iframe
              src={mediaData}
              title={document.name}
              style={{ border: "none" }}
              allowFullScreen
              width="100%"
              height="100%"
            >
              <p>
                Your browser does not support embedded PDFs.{" "}
                <a href={mediaData} target="_blank" rel="noreferrer">
                  Download PDF
                </a>
              </p>
            </iframe>
          </div>
        );
      case "word":
        return mediaLoading ? (
          <Skeleton active />
        ) : (
          <iframe
            src={mediaData}
            title={document.name}
            className={styles.wordFrame}
            style={{ border: "none", width: "100%", height: "500px" }}
          >
            This is an embedded{" "}
            <a target="_blank" href="http://office.com" rel="noreferrer">
              Microsoft Office
            </a>{" "}
            document, powered by{" "}
            <a
              target="_blank"
              href="http://office.com/webapps"
              rel="noreferrer"
            >
              Office Online
            </a>
            .
          </iframe>
        );
      default:
        return mediaLoading ? (
          <Skeleton.Node active size="large" />
        ) : (
          <div>No media content available for this document type.</div>
        );
    }
  };

  const renderModalContent = (document) => {
    if (!document) return null;

    switch (activeTab) {
      case "media":
        const mediaContent = renderMediaContent(document);
        return (
          <div className={styles.mediaContainer}>
            {mediaContent || (
              <div>
                No media content available (renderMediaContent returned
                null/undefined)
              </div>
            )}
          </div>
        );

      case "fullText":
        return <div className={styles.fullText}>{document.content}</div>;

      case "metadata":
        return (
          <div className={styles.metadataContainer}>
            <List bordered itemLayout="horizontal">
              {[
                { title: "Document Name", value: document.name },
                { title: "Content Type", value: document.content_type },
                { title: "Document ID", value: document.id || document._id },
                { title: "Case ID", value: document.case_id },
                {
                  title: "Processing Status",
                  value: (
                    <Tag
                      color={
                        document.processing_status === "completed"
                          ? "success"
                          : document.processing_status === "processing"
                          ? "processing"
                          : "error"
                      }
                    >
                      {document.processing_status || "unknown"}
                    </Tag>
                  ),
                },
                ...(document.created_at
                  ? [
                      {
                        title: "Created At",
                        value: new Date(document.created_at).toLocaleString(),
                      },
                    ]
                  : []),
                ...(document.updated_at
                  ? [
                      {
                        title: "Updated At",
                        value: new Date(document.updated_at).toLocaleString(),
                      },
                    ]
                  : []),
                // Show processing duration if both timestamps exist
                ...(document.created_at && document.updated_at
                  ? [
                      {
                        title: "Processing Duration",
                        value: (() => {
                          try {
                            const start = Date.parse(document.created_at);
                            const end = Date.parse(document.updated_at);
                            if (Number.isNaN(start) || Number.isNaN(end))
                              return "N/A";
                            const ms = Math.max(0, end - start);
                            return formatMilliseconds(ms);
                          } catch (err) {
                            return "N/A";
                          }
                        })(),
                      },
                    ]
                  : []),
                ...(document.file_size
                  ? [
                      {
                        title: "File Size",
                        value: `${Math.round(document.file_size / 1024)} KB`,
                      },
                    ]
                  : []),
              ].map((item) => (
                <List.Item key={item.title}>
                  <List.Item.Meta title={item.title} description={item.value} />
                </List.Item>
              ))}
            </List>
          </div>
        );

      default:
        return <div>No content available</div>;
    }
  };

  // Empty state
  if (!normalizedDocuments?.length && !hasProcessingDocuments) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "20px",
          border: "1px dashed #ccc",
          borderRadius: "8px",
          marginBottom: "20px",
          color: themeToken.colorTextSecondary,
          backgroundColor: themeToken.colorBgElevated,
        }}
      >
        <FileTextOutlined
          style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }}
        />
        <h3>No documents available</h3>
        <p>Upload your first document to get started.</p>
      </div>
    );
  }

  return (
    <div
      id={scrollableTargetId}
      style={{
        maxHeight: "65vh",
        overflow: "auto",
        padding: "0 16px",
        border: "1px solid rgba(140, 140, 140, 0.35)",
        borderRadius: "8px",
      }}
    >
      <InfiniteScroll
        dataLength={normalizedDocuments.length}
        loader={<Skeleton avatar paragraph={{ rows: 1 }} active />}
        scrollableTarget={scrollableTargetId}
      >
        <Spin spinning={hasProcessingDocuments} tip="Processing...">
          <List
            dataSource={normalizedDocuments}
            renderItem={(item) => (
              <List.Item
                key={item.id}
                onClick={() => handleViewDocument(item)}
                style={{ cursor: "pointer" }}
              >
                <List.Item.Meta
                  avatar={getDocumentLogo(item.name)}
                  title={
                    <Text ellipsis={{ tooltip: item.name }} strong>
                      {item.name}
                    </Text>
                  }
                  description={formatProcessingDuration(item)}
                />
                <Flex gap="small" align="center">
                  <Tooltip title="View Details" key="view">
                    <Button
                      type="text"
                      icon={<FileTextOutlined />}
                      onClick={() => handleViewDocument(item)}
                    />
                  </Tooltip>
                  <Tooltip title="Download Document" key="download">
                    <Button
                      type="text"
                      icon={<DownloadOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(item);
                      }}
                    />
                  </Tooltip>
                  {/* Only allow deletion if the signed-in user is NOT an admin */}
                  {canDelete && (
                    <Tooltip title="Delete Document" key="delete">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDocument(item.id);
                        }}
                      />
                    </Tooltip>
                  )}
                </Flex>
              </List.Item>
            )}
          />
        </Spin>
      </InfiniteScroll>
      <Modal
        title={
          <div className={styles.modalHeader}>
            <h3>{selectedDocument?.name}</h3>
            {renderModalTabs(selectedDocument)}
          </div>
        }
        open={isModalVisible}
        onCancel={handleModalClose}
        width="90vw"
        style={{ maxWidth: "1200px" }}
        footer={null}
      >
        {selectedDocument && (
          <div className={styles.modalContent}>
            {renderModalContent(selectedDocument)}
          </div>
        )}
      </Modal>
    </div>
  );
};
