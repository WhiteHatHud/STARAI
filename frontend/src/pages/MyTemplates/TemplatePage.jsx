import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Flex,
  Skeleton,
  Typography,
  Button,
  Space,
  Input,
  Row,
  Col,
  Card,
  Pagination,
  Divider,
  App,
} from "antd";
import {
  SnippetsOutlined,
  PlusOutlined,
  ImportOutlined,
} from "@ant-design/icons";
import useStore from "../../store";
import { TemplateManager, TemplateUploadGenerator } from "./index";
import TemplateCard from "../../components/MyTemplates/TemplateCard";
import { GenerateModal } from "../../components/global/GenerateModal";
import { BackButton } from "../../components/global/BackButton";
import PublicTemplateCard from "../../components/MyTemplates/PublicTemplateCard";
import "./TemplatePage.css";

const { Title, Text } = Typography;
export const TemplatePage = ({
  token,
  isDarkMode,
  triggerProcessingData,
  setCurrentProgressId,
}) => {
  const { message, modal, notification } = App.useApp();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  // publicTemplates is a dictionary/object keyed by id/name from the API
  const [publicTemplates, setPublicTemplates] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Template creation/editing state
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [generatedTemplate, setGeneratedTemplate] = useState(null);
  const [templateName, setTemplateName] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const { currentCase } = useStore();
  const isMobile = window.innerWidth <= 768;

  // Pagination
  const cardsPerPage = 4;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(cardsPerPage);

  // Generate document
  const [isGenerateModalVisible, setIsGenerateModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const parseResponseData = (data) => {
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error("Failed to parse response:", e);
        return {};
      }
    }
    return data;
  };

  const fetchTemplates = useCallback(async () => {
    if (!token) {
      setTemplates([]);
      setPublicTemplates({});
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setIsLoading(true);

    try {
      const base = import.meta.env.VITE_API_BASE_URL;
      const [tResp, pResp] = await Promise.all([
        axios.get(`${base}/custom/documents/templates`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
          signal: controller.signal,
        }),
        axios.get(`${base}/custom/documents/templates/public`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
          signal: controller.signal,
        }),
      ]);

      if (cancelled) return;

      const tData = parseResponseData(tResp.data);
      const pData = parseResponseData(pResp.data);

      // Check if the template belongs to the public list
      const publicTemplatesDict = pData.templates || {};

      const publicTemplateNames = Object.values(publicTemplatesDict).map(
        (t) => t.template_name
      );

      const enrichedTemplates = (tData.templates || []).map((tpl) => ({
        ...tpl,
        isPublic: publicTemplateNames.includes(tpl.template_name),
      }));

      setTemplates(enrichedTemplates);
      setPublicTemplates(publicTemplatesDict);
    } catch (err) {
      if (err.name === "CanceledError" || err?.message === "canceled") {
        return;
      }
      console.error("Error fetching templates:", err);
      message.error("Failed to load templates");
    } finally {
      if (!cancelled) setIsLoading(false);
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, message]);

  const fetchTemplateData = async (template) => {
    try {
      const base = import.meta.env.VITE_API_BASE_URL;
      const resp = await axios.get(
        `${base}/custom/documents/templates/${encodeURIComponent(
          template.template_name
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );
      const data = parseResponseData(resp.data);
      return data;
    } catch (error) {
      console.error(
        `Failed to fetch template data for ${template.template_name}: ${error}`
      );
      message.error("Failed to load template");
    }
  };

  const fetchPublicTemplateData = async (template) => {
    try {
      const base = import.meta.env.VITE_API_BASE_URL;
      const resp = await axios.get(
        `${base}/custom/documents/templates/public/${encodeURIComponent(
          template.template_name
        )}/content`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = parseResponseData(resp.data);
      return data;
    } catch (error) {
      console.error(
        `Failed to fetch template data for ${template.template_name}: ${error}`
      );
      message.error("Failed to load template");
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleTemplateSelect = async (template, editMode = false) => {
    const templateData = await fetchTemplateData(template);
    // Set up editing mode with the fetched template data
    setEditingTemplate(templateData);
    setGeneratedTemplate(
      templateData.content ? JSON.parse(templateData.content) : templateData
    );
    setTemplateName(templateData.template_name);
    setIsEditing(editMode);
    setShowCreateTemplate(true);
  };

  const handleImportViaCode = () => {
    let shareCode = "";

    modal.confirm({
      className: isDarkMode ? "programmatic-modal-dark" : "programmatic-modal",
      title: "Import Template via Code",
      content: (
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">
            Enter the share code to import a template:
          </Text>
          <Input
            placeholder="Enter share code here..."
            style={{ marginTop: 12 }}
            onChange={(e) => {
              shareCode = e.target.value;
            }}
          />
        </div>
      ),
      okText: "Import Template",
      cancelText: "Cancel",
      onOk: async () => {
        if (!shareCode.trim()) {
          message.error("Please enter a share code");
          return;
        }

        try {
          const base = import.meta.env.VITE_API_BASE_URL;
          await axios.post(
            `${base}/custom/documents/templates/import/${encodeURIComponent(
              shareCode.trim()
            )}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000,
            }
          );

          message.success("Template imported successfully!");
          fetchTemplates(); // Refresh the templates list
        } catch (err) {
          console.error("Failed to import template:", err);
          message.error("Invalid or expired share code");
        }
      },
    });
  };

  const handleCreateNewTemplate = () => {
    setShowCreateTemplate(true);
    setEditingTemplate(null);
    setGeneratedTemplate(null);
    setTemplateName(null);
    setIsEditing(false);
  };

  const handleBackToList = () => {
    setShowCreateTemplate(false);
    setEditingTemplate(null);
    setGeneratedTemplate(null);
    setTemplateName(null);
    setIsEditing(false);
    fetchTemplates();
  };

  const handleTemplateGenerated = (template, name) => {
    setGeneratedTemplate(template);
    setTemplateName(name);
    fetchTemplates();
  };

  const handlePublicTemplateView = async (template, e) => {
    e?.stopPropagation();
    try {
      const base = import.meta.env.VITE_API_BASE_URL;
      const resp = await axios.get(
        `${base}/custom/documents/templates/public/${encodeURIComponent(
          template.template_identifier
        )}/content`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );
      const data = parseResponseData(resp.data);

      // Set up viewing mode with the fetched template data
      setEditingTemplate(data);
      setGeneratedTemplate(data.content ? JSON.parse(data.content) : data);
      setTemplateName(data.template_name);
      setIsEditing(false);
      setShowCreateTemplate(true);
    } catch (err) {
      console.error("Failed to fetch template for view:", err);
      message.error("Failed to load template");
    }
  };

  const handleTogglePublic = async (template) => {
    // Optimistically update the UI
    setTemplates((prev) =>
      prev.map((tpl) =>
        tpl.template_name === template.template_name
          ? { ...tpl, isPublic: !tpl.isPublic }
          : tpl
      )
    );
    try {
      const base = import.meta.env.VITE_API_BASE_URL;
      await axios.post(
        `${base}/custom/documents/templates/${encodeURIComponent(
          template.template_name
        )}/toggle-public`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );
      fetchTemplates();
    } catch (error) {
      // Rollback if API fails
      setTemplates((prev) =>
        prev.map((tpl) =>
          tpl.template_name === template.template_name
            ? { ...tpl, isPublic: template.isPublic } // revert
            : tpl
        )
      );
      message.error("Failed to toggle public status. Please try again.");
      console.error("Error toggling public status:", error);
    }
  };

  const handleTemplateDelete = (template, e) => {
    e?.domEvent?.stopPropagation();
    modal.confirm({
      className: isDarkMode ? "programmatic-modal-dark" : "programmatic-modal",
      title: "Delete Template",
      content: `Delete "${
        template.report_metadata?.report_type || template.template_name
      }"? This cannot be undone.`,
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          const base = import.meta.env.VITE_API_BASE_URL;
          await axios.delete(
            `${base}/custom/documents/templates/${encodeURIComponent(
              template.template_name
            )}`,
            { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
          );
          fetchTemplates();
          message.success("Template deleted");
        } catch (err) {
          console.error("Failed to delete template:", err);
          message.error("Failed to delete template");
        }
      },
    });
  };

  const handleShareCode = async (template, e) => {
    e?.domEvent?.stopPropagation();

    try {
      const base = import.meta.env.VITE_API_BASE_URL;
      const resp = await axios.post(
        `${base}/custom/documents/templates/${encodeURIComponent(
          template.template_name
        )}/share`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );

      const shareCode = resp.data.share_code;

      // Show the share code in a new modal
      modal.info({
        className: isDarkMode
          ? "programmatic-modal-dark"
          : "programmatic-modal",
        title: "Share Code Generated",
        width: 500,
        content: (
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              Share this code with others to let them import your template:
            </Text>
            <Flex justify="space-between" align="center" gap="small">
              <Input
                value={shareCode}
                readOnly
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  borderRadius: 6,
                }}
                addonAfter={
                  <Button
                    type="text"
                    icon={<SnippetsOutlined />}
                    style={{
                      borderRadius: 8,
                      color: isDarkMode ? "#bbb" : "#555",
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText(shareCode);
                      message.success("Share code copied to clipboard!");
                    }}
                  />
                }
              />
            </Flex>
          </div>
        ),
        okText: "Close",
      });
    } catch (err) {
      console.error("Failed to generate share code:", err);
      message.error("Failed to generate share code");
    }
  };

  const generateCustomStudy = async (title) => {
    setIsSubmitting(true);

    const templateData = selectedTemplate.isPublic
      ? await fetchPublicTemplateData(selectedTemplate)
      : await fetchTemplateData(selectedTemplate);

    const requestBody = {
      report_data: {
        title: title,
        case_id: currentCase.id,
        document_ids: selectedDocuments,
        template_name: selectedTemplate.template_name,
      },
      report_structure: templateData?.content,
    };
    try {
      const response = await axios.post(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/generate/customstyle`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const { progress_id } = response.data;
      setCurrentProgressId(progress_id);
      triggerProcessingData();
    } catch (error) {
      notification.error({
        message: "Error",
        description: "Failed to start custom case study generation",
      });
    } finally {
      setIsGenerateModalVisible(false);
      setIsSubmitting(false);
      navigate("/progress");
    }
  };

  // CREATE TEMPLATE UI
  if (showCreateTemplate) {
    return (
      <Flex vertical gap="middle" style={{ height: "100%" }}>
        <BackButton
          onClick={handleBackToList}
          style={{ marginRight: "auto", marginBottom: 0 }}
        />

        <div style={{ height: "100%" }}>
          {!generatedTemplate && (
            <TemplateUploadGenerator
              token={token}
              triggerProcessingData={triggerProcessingData}
              isDarkMode={isDarkMode}
              onTemplateGenerated={handleTemplateGenerated}
              editMode={!!editingTemplate}
            />
          )}
          {generatedTemplate && (
            <TemplateManager
              token={token}
              generatedTemplate={generatedTemplate}
              setGeneratedTemplate={setGeneratedTemplate}
              templateName={templateName}
              isDarkMode={isDarkMode}
              isEditMode={isEditing}
            />
          )}
        </div>
      </Flex>
    );
  }

  const paginatedTemplates = templates.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const lastPage = Math.ceil(templates.length / pageSize);
  const isRenderCreateCard =
    templates.length !== cardsPerPage &&
    (currentPage === lastPage || templates.length === 0);

  //   TEMPLATE LIST UI
  return (
    <Flex
      vertical
      gap="middle"
      style={{ padding: isMobile ? "0 16px" : "0 48px", height: "100%" }}
    >
      {isLoading ? (
        <Skeleton active />
      ) : (
        <>
          {/* PRIVATE TEMPLATES LIST */}
          {/* HEADER CONTENT */}
          <Flex vertical={isMobile} justify="space-between" gap="middle">
            <Title level={3} style={{ margin: 0 }}>
              My Templates
            </Title>
            <Space
              size="small"
              direction={isMobile ? "vertical" : "horizontal"}
              style={{ width: isMobile ? "100%" : "auto" }}
            >
              <Button
                icon={<ImportOutlined />}
                shape="round"
                onClick={handleImportViaCode}
                block={isMobile}
              >
                Import Template
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                shape="round"
                onClick={handleCreateNewTemplate}
                block={isMobile}
              >
                New Template
              </Button>
            </Space>
          </Flex>

          {/* TEMPLATES GRID */}
          <Row gutter={[16, 16]}>
            {paginatedTemplates.length > 0 &&
              paginatedTemplates.map((template) => (
                <Col
                  key={template.filename}
                  xs={{ flex: "100%" }}
                  sm={{ flex: "100%" }}
                  md={{ flex: "50%" }}
                  lg={{ flex: "33%" }}
                  xl={{ flex: "25%" }}
                  style={{ display: "flex" }}
                >
                  <TemplateCard
                    setSelectedTemplate={setSelectedTemplate}
                    template={template}
                    onSelect={handleTemplateSelect}
                    onTogglePublic={handleTogglePublic}
                    onShareCode={handleShareCode}
                    onDelete={handleTemplateDelete}
                    onGenerate={() => setIsGenerateModalVisible(true)}
                  />
                </Col>
              ))}
            {/* CREATE NEW TEMPLATE CARD */}
            {isRenderCreateCard && (
              <Col
                xs={{ flex: "100%" }}
                sm={{ flex: "100%" }}
                md={{ flex: "50%" }}
                lg={{ flex: "33%" }}
                xl={{ flex: "25%" }}
                style={{ display: "flex" }}
              >
                <Card
                  bordered={false}
                  className="create-template-card"
                  onClick={handleCreateNewTemplate}
                >
                  <Space direction="vertical" align="center">
                    <PlusOutlined
                      style={{ fontSize: 24 }}
                      className="create-template-card"
                    />
                    <Title level={4} type="secondary" style={{ margin: 0 }}>
                      Create New Template
                    </Title>
                    <Text type="secondary">
                      Start from scratch or upload a file to create a new custom
                      template.
                    </Text>
                  </Space>
                </Card>
              </Col>
            )}
          </Row>

          {/* PAGINATION CONTROL */}
          {templates.length > cardsPerPage && (
            <Pagination
              align="end"
              current={currentPage}
              pageSize={pageSize}
              total={templates.length}
              onChange={(page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              }}
            />
          )}

          <Divider />

          {/* PUBLIC TEMPLATES LIST */}
          {/* HEADER CONTENT */}
          <Title level={3} style={{ margin: 0 }}>
            Public Templates
          </Title>

          {/* PUBLIC TEMPLATES GRID */}
          <Row gutter={[16, 16]}>
            {Object.entries(publicTemplates).length > 0 &&
              Object.entries(publicTemplates).map(([key, template]) => (
                <Col
                  key={key}
                  xs={{ flex: "100%" }}
                  sm={{ flex: "100%" }}
                  md={{ flex: "50%" }}
                  lg={{ flex: "33%" }}
                  xl={{ flex: "25%" }}
                  style={{ display: "flex" }}
                >
                  <PublicTemplateCard
                    setSelectedTemplate={setSelectedTemplate}
                    template={template}
                    onView={handlePublicTemplateView}
                    onGenerate={() => setIsGenerateModalVisible(true)}
                  />
                </Col>
              ))}
          </Row>
          <GenerateModal
            visible={isGenerateModalVisible}
            onCancel={() => setIsGenerateModalVisible(false)}
            onSubmit={generateCustomStudy}
            loading={isSubmitting}
            reportStyle={"style_custom"}
            token={token}
            selectedDocuments={selectedDocuments}
            setSelectedDocuments={setSelectedDocuments}
            redirectTo={navigate}
          />
        </>
      )}
    </Flex>
  );
};
