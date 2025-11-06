import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Flex,
  Button,
  Space,
  Card,
  Input,
  message,
  Spin,
  Upload,
  Typography,
} from "antd";
import {
  SearchOutlined,
  UploadOutlined,
  FormOutlined,
} from "@ant-design/icons";
import useStore from "../../store";
import { BackButton, DocumentList } from "../../components/global";
import axios from "axios";
import {
  computeProcessingDurationMs,
  formatMilliseconds,
} from "../../utils/timeUtils";

const { Text } = Typography;

const projectVariant = import.meta.env.VITE_PROJECT_VARIANT;
export const UploadManager = ({
  redirectTo,
  token,
  triggerProcessingData,
  processingContent,
}) => {
  const { currentCase, setCurrentCase } = useStore();
  const [documents, setDocuments] = useState(currentCase?.documents || []);
  const [filteredDocuments, setFilteredDocuments] = useState(documents);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isUploadProcessing, setIsUploadProcessing] = useState(false);
  const [totalUploadDurationMs, setTotalUploadDurationMs] = useState(null);
  const isMobile = window.innerWidth <= 768;

  const dataFetchedRef = useRef(false);

  const hasActiveUploads = processingContent?.some(
    (item) => item?.doc_id === currentCase?.id
  );

  // === Fetch documents ===
  const fetchDocuments = useCallback(async () => {
    if (dataFetchedRef.current || !currentCase?.id) return;

    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/cases/${
          currentCase.id
        }/documents/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const docs = response.data || [];
      setDocuments(docs);
      setFilteredDocuments(docs);
      dataFetchedRef.current = true;
    } catch (err) {
      console.error("UploadManager: Error fetching documents:", err);
      setError("Failed to load documents");
      setDocuments([]);
      setFilteredDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [currentCase?.id, token]);

  useEffect(() => {
    dataFetchedRef.current = false;
  }, [currentCase?.id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (hasActiveUploads) {
      // Set spinner for upload portion - documents are being processed
      setIsUploadProcessing(true);
    } else {
      // No active uploads, check for completed uploads to update documents
      setIsUploadProcessing(false);
      dataFetchedRef.current = false;
      fetchDocuments();
    }
  }, [processingContent, fetchDocuments, hasActiveUploads]);

  useEffect(() => {
    if (!documents || documents.length === 0) {
      setTotalUploadDurationMs(null);
      return;
    }

    let sum = 0;
    documents.forEach((doc) => {
      const ms = computeProcessingDurationMs(doc);
      if (ms) sum += ms;
    });

    if (sum > 0) {
      setTotalUploadDurationMs(sum);
    }
  }, [documents]);

  // === Upload logic ===
  const processFile = useCallback(
    async (file) => {
      if (!currentCase?.id) {
        console.error("UploadManager: Cannot upload - no case selected");
        message.error("Cannot upload: Invalid case selected");
        return false;
      }

      const tempId = `temp_${Date.now()}_${file.name.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}`;

      const tempDocument = {
        id: tempId,
        name: file.name,
        case_id: currentCase.id,
        content: "",
        content_type: file.type,
        summary_points: [],
        processing_status: "processing",
      };
      setDocuments((prev) => [...prev, tempDocument]);
      setFilteredDocuments((prev) => [...prev, tempDocument]);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const createdAtIso = new Date().toISOString();
        formData.append("created_at", createdAtIso);

        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/cases/${
            currentCase.id
          }/documents/`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (err) {
        console.error(`UploadManager: Upload failed for ${file.name}:`, err);
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === tempId ? { ...doc, processing_status: "failed" } : doc
          )
        );
        setFilteredDocuments((prev) =>
          prev.map((doc) =>
            doc.id === tempId ? { ...doc, processing_status: "failed" } : doc
          )
        );
        message.error(`${file.name} failed to upload`);
      }
    },
    [currentCase?.id, token]
  );

  const handleUpload = useCallback(
    async ({ file, onSuccess }) => {
      setIsUploadProcessing(true);
      await processFile(file);
      triggerProcessingData();

      onSuccess("ok");
    },
    [processFile, triggerProcessingData]
  );

  const uploadProps = useMemo(
    () => ({
      accept:
        import.meta.env.VITE_GPU_USAGE === "true"
          ? ".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp3,.wav,.m4a,.mp4"
          : ".pdf,.docx",
      customRequest: handleUpload,
      multiple: true,
      showUploadList: false,
    }),
    [handleUpload]
  );

  // === Document updates ===
  const handleDocumentsUpdate = useCallback((updatedDocs) => {
    setDocuments(updatedDocs);
    setFilteredDocuments(updatedDocs);
  }, []);

  const isDocumentsEmpty = documents.length === 0;

  // === Generate content ===
  const handleGenerateContent = useCallback(() => {
    setCurrentCase(currentCase);
    switch (projectVariant) {
      case "custom":
        redirectTo("/templates");
        break;
      case "slide":
        redirectTo("/slides/create");
        break;
      default:
        redirectTo("/content-bridge");
    }
  }, [currentCase, setCurrentCase, redirectTo]);

  // === Document list renderer ===
  const documentListDisplay = useMemo(() => {
    if (error) return <div style={{ color: "red" }}>{error}</div>;
    if (loading) return <Spin />;

    const finalDocuments = filteredDocuments?.filter((doc) =>
      doc.name.toLowerCase().includes(searchTerm)
    );
    return (
      <DocumentList
        documents={finalDocuments}
        setDocuments={handleDocumentsUpdate}
        token={token}
        selectedDocumentIds={[]} // wire selection if needed
        setSelectedDocumentIds={() => {}}
        setSelectedNotes={() => {}}
        isDarkMode={false}
        hasProcessingDocuments={isUploadProcessing}
      />
    );
  }, [
    filteredDocuments,
    error,
    loading,
    handleDocumentsUpdate,
    token,
    isUploadProcessing,
    searchTerm,
  ]);

  return (
    <Flex vertical align="center" style={{ height: "100%" }}>
      <Flex vertical gap="middle" style={{ height: "100%", width: "90%" }}>
        <Space>
          <BackButton />
        </Space>
        <Card
          title={currentCase?.name || "No Case Selected"}
          style={{ height: "100%" }}
        >
          <Flex vertical gap="middle">
            <Flex
              vertical={isMobile ? true : false}
              justify="space-between"
              gap="small"
            >
              <Flex
                gap="small"
                style={{ width: "100%" }}
                justify="space-between"
              >
                <Input
                  placeholder="Search"
                  suffix={<SearchOutlined />}
                  style={{
                    maxWidth: isMobile ? "100%" : "60%",
                    borderRadius: "24px",
                  }}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {/* Upload Button */}
                <Upload {...uploadProps}>
                  <Button
                    shape="round"
                    icon={<UploadOutlined />}
                    disabled={isUploadProcessing}
                  >
                    Upload
                  </Button>
                </Upload>
              </Flex>

              {/* Generate Content Button */}
              <Button
                shape="round"
                type="primary"
                icon={<FormOutlined />}
                onClick={handleGenerateContent}
                disabled={error || isUploadProcessing || isDocumentsEmpty}
                title={
                  isUploadProcessing
                    ? "Please wait for all documents to finish processing"
                    : "Generate Content"
                }
              >
                Generate
                {isUploadProcessing && (
                  <Spin size="small" style={{ marginLeft: 8 }} />
                )}
              </Button>
            </Flex>

            {/* Upload Duration */}
            {!hasActiveUploads && totalUploadDurationMs !== null && (
              <Text
                strong
                style={{ textAlign: isMobile ? "center" : "end" }}
              >{`Total Upload Time: ${formatMilliseconds(
                totalUploadDurationMs
              )}`}</Text>
            )}

            {/* DocumentList */}
            {documentListDisplay}
          </Flex>
        </Card>
      </Flex>
    </Flex>
  );
};
