import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  Modal,
  Typography,
  Card,
  theme,
  Flex,
  Row,
  Col,
  App,
  Skeleton,
} from "antd";
import {
  PlusOutlined,
  FolderOpenFilled,
  FolderOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import useStore from "../../store";
import axios from "axios";

const { Title, Text } = Typography;

export const FolderManager = ({ token }) => {
  const { token: themeToken } = theme.useToken();
  const {
    cases: folders,
    setCases,
    addCase,
    deleteCaseById,
    setCurrentCase: setStoreCurrentCase,
  } = useStore();
  const { modal, notification } = App.useApp();
  const navigate = useNavigate();
  const isMobile = window.innerWidth <= 768;

  const [currentCase, setCurrentCase] = useState(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newCaseName, setNewCaseName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [serverError, setServerError] = useState(null);
  const dataFetchedRef = useRef(false);

  const fetchCases = useCallback(async () => {
    if (dataFetchedRef.current) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/cases/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const casesData = response.data;

      if (response.status === 204 || !Array.isArray(casesData)) {
        setCases([]);
      } else {
        const casesWithDocuments = await Promise.all(
          casesData.map(async (caseItem) => {
            let documentsForCase = [];
            try {
              const docsResponse = await axios.get(
                `${import.meta.env.VITE_API_BASE_URL}/cases/${
                  caseItem.id
                }/documents/`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (
                docsResponse.status !== 204 &&
                Array.isArray(docsResponse.data)
              ) {
                documentsForCase = docsResponse.data;
              }
            } catch (error) {
              console.error(
                `Error fetching documents for case ${caseItem.id}:`,
                error
              );
            }
            return {
              ...caseItem,
              documents: documentsForCase,
            };
          })
        );
        setCases(casesWithDocuments);
      }

      dataFetchedRef.current = true;
    } catch (error) {
      console.error("Error fetching cases:", error);

      if (error.response) {
        if (error.response.status === 204) {
          setCases([]);
        } else {
          notification.error({
            message: `Error ${error.response.status}`,
            description:
              error.response.data?.detail ||
              "Failed to fetch cases. Please try again.",
          });
          setCases([]);
        }
      } else {
        // For non-HTTP errors (e.g., network issues)
        notification.error({
          message: "Error",
          description: "Failed to fetch cases. Please try again.",
        });
        setCases([]);
      }
    } finally {
      setLoading(false);
    }
  }, [token, setCases, notification]);
  // This effect only runs when token or fetchCases changes
  useEffect(() => {
    if (token) {
      fetchCases();
    }

    return () => {
      dataFetchedRef.current = false;
    };
  }, [token, fetchCases]);

  const showModal = () => {
    setIsCreateModalVisible(true);
  };

  const handleCreateNewCase = async () => {
    if (newCaseName.trim() === "") {
      notification.error({
        message: "Error",
        description: "Case name cannot be empty",
      });
      return;
    }
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/cases/`,
        { name: newCaseName },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newCaseDataFromApi = response.data;

      const newCase = {
        ...newCaseDataFromApi,
        documents: [],
      };

      addCase(newCase);
      setNewCaseName("");
      setIsCreateModalVisible(false);
      notification.success({
        message: "Success",
        description: "Case created successfully",
      });

      // Auto-select the newly created case (which now also has the documents property)
      selectCurrentCase(newCase);
      setServerError(null);
    } catch (error) {
      setServerError(error);
      console.error("Error creating case:", error);

      notification.error({
        message: "Error",
        description:
          error.status === 409
            ? "Case name already exists. Please use a different name."
            : "Failed to create case. Please try again.",
      });
    }
  };

  const handleDeleteCase = (caseId) => {
    if (!caseId) {
      console.error("Attempted to delete invalid case ID");
      return;
    }

    modal.confirm({
      title: "Delete Case",
      icon: <ExclamationCircleOutlined />,
      content:
        "Are you sure you want to delete this case? This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await axios.delete(
            `${import.meta.env.VITE_API_BASE_URL}/cases/${caseId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          deleteCaseById(caseId);

          if (currentCase && currentCase.id === caseId) {
            setCurrentCase(null);
            setStoreCurrentCase(null);
          }

          notification.success({
            message: "Case Deleted",
            description: "The case has been deleted successfully.",
          });
        } catch (error) {
          console.error("Error deleting case:", error);
          notification.error({
            message: "Error",
            description: "Failed to delete case. Please try again.",
          });
        }
      },
    });
  };

  const handleCancelCreateCase = () => {
    setNewCaseName("");
    setIsCreateModalVisible(false);
  };

  const filteredFolders = folders?.filter((folder) =>
    folder.name.toLowerCase().includes(searchTerm)
  );

  const selectCurrentCase = (selectedCase) => {
    if (!selectedCase || !selectedCase.id) {
      console.error("Attempted to select invalid case:", selectedCase);
      notification.error({
        message: "Error",
        description: "Cannot select this case. Invalid case data.",
      });
      return;
    }
    const caseWithDocs = {
      ...selectedCase,
      documents: selectedCase.documents || [],
    };

    setCurrentCase(caseWithDocs);
    setStoreCurrentCase(caseWithDocs);
    navigate("/folders/upload");
  };

  // Keep currentCase in sync with cases store
  useEffect(() => {
    if (currentCase) {
      const updatedCase = folders.find((c) => c.id === currentCase.id);
      if (updatedCase) {
        if (JSON.stringify(updatedCase) !== JSON.stringify(currentCase)) {
          setCurrentCase(updatedCase);
        }
      } else {
        setCurrentCase(null);
      }
    }
  }, [folders, currentCase]);

  if (loading) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  return (
    <Flex vertical gap="middle" style={{ padding: 24 }}>
      <Flex gap="small" style={{ width: "100%" }}>
        <Input
          placeholder="Search"
          suffix={<SearchOutlined />}
          style={{ maxWidth: isMobile ? "100%" : "40%", borderRadius: "24px" }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button
          type="primary"
          shape="round"
          icon={
            <PlusOutlined
              style={{
                color: "#ffffff",
              }}
            />
          }
          onClick={showModal}
          size="middle"
        >
          New Folder
        </Button>
      </Flex>
      {filteredFolders?.length > 0 && (
        <Row gutter={[16, 16]}>
          {filteredFolders.map((folder) => (
            <Col
              key={folder.id}
              xs={{ flex: "100%" }}
              sm={{ flex: "100%" }}
              md={{ flex: "50%" }}
              lg={{ flex: "33%" }}
              xl={{ flex: "25%" }}
            >
              {/* FOLDER CARD */}
              <Card
                hoverable
                onClick={() => {
                  selectCurrentCase(folder);
                }}
              >
                <Flex align="center" justify="space-between">
                  <Flex align="center" gap="middle">
                    <FolderOpenFilled
                      style={{ paddingTop: 12, fontSize: 40 }}
                    />
                    <Flex vertical style={{ maxWidth: "200px" }}>
                      <Title
                        level={4}
                        ellipsis={{ rows: 1, tooltip: folder.name }}
                        style={{ margin: 0 }}
                      >
                        {folder.name}
                      </Title>
                      <Text type="secondary" className="secondary-text">
                        {folder.documents.length > 0
                          ? folder.documents.length === 1
                            ? "1 Document"
                            : `${folder.documents.length} Documents`
                          : "0 Document"}
                      </Text>
                    </Flex>
                  </Flex>
                  <Button
                    key="delete"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCase(folder.id);
                    }}
                  />
                </Flex>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* CREATE NEW CASE STUDY FOLDER */}
      <Modal
        title={
          <Flex gap="small">
            <PlusOutlined />
            <span>Create New Case</span>
          </Flex>
        }
        open={isCreateModalVisible}
        onOk={handleCreateNewCase}
        onCancel={handleCancelCreateCase}
        okText="Create"
        cancelText="Cancel"
        centered
        destroyOnClose
      >
        <div style={{ marginTop: "16px" }}>
          <Text>Enter a name for your new case:</Text>
          <Input
            placeholder="Case name"
            status={serverError ? "error" : null}
            value={newCaseName}
            onChange={(e) => setNewCaseName(e.target.value)}
            onPressEnter={handleCreateNewCase}
            style={{ marginTop: "8px" }}
            autoFocus
            maxLength={100}
            prefix={
              serverError ? (
                <ClockCircleOutlined />
              ) : (
                <FolderOutlined style={{ color: themeToken.colorPrimary }} />
              )
            }
          />
        </div>
      </Modal>
    </Flex>
  );
};
