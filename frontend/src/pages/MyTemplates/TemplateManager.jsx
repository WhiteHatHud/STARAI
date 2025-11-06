import {
  Flex,
  Card,
  Typography,
  Space,
  theme,
  FloatButton,
  Alert,
  Form,
  Input,
  Select,
  Button,
  Segmented,
  InputNumber,
  Collapse,
  Tooltip,
  message,
} from "antd";
import {
  ArrowUpOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  QuestionCircleOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  DeleteOutlined,
  CopyOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import TemplatePreview from "../../components/MyTemplates/TemplatePreview";
import "./TemplatePage.css";
import { useEffect, useState } from "react";
import TemplateGenericExampleEditor from "../../components/MyTemplates/TemplateGenericExampleEditor";
import axios from "axios";
import { TemplateViewer } from "./index";

const { Title, Text } = Typography;
const { TextArea } = Input;

// deep clone helper - prefer structuredClone when available
const deepClone = (obj) =>
  obj == null
    ? obj
    : typeof structuredClone === "function"
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));

const DEFAULT_DIVIDER_LENGTH = 20;

const defaultGenericExampleByType = (type) => {
  switch (type) {
    case "title":
    case "text":
      return "";
    case "list":
      return []; // empty list
    case "table":
      return [[""]]; // 1 row, 1 col starter table
    case "horizontal_rule":
      return "_".repeat(DEFAULT_DIVIDER_LENGTH);
    default:
      return "";
  }
};

export const TemplateManager = ({
  token,
  generatedTemplate,
  templateName,
  isDarkMode,
  isEditMode,
  setGeneratedTemplate,
}) => {
  const { token: themeToken } = theme.useToken();
  const [messageApi, contextHolder] = message.useMessage();

  const [selectedSectionIndex, setSelectedSectionIndex] = useState(null);
  const [hoveredSectionIndex, setHoveredSectionIndex] = useState(null);
  const [selectedHeaderFooterIndex, setSelectedHeaderFooterIndex] =
    useState(null);
  const [hoveredHeaderFooterIndex, setHoveredHeaderFooterIndex] =
    useState(null);
  const [editedTemplate, setEditedTemplate] = useState(
    () => deepClone(generatedTemplate) || null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [form] = Form.useForm();
  const minWordCount = 1;
  const maxWordCount = 1000;

  useEffect(() => {
    setEditedTemplate(deepClone(generatedTemplate));
  }, [generatedTemplate]);

  const toggleTextStyle = (style) => {
    if (selectedSectionIndex === null) return;
    setEditedTemplate((prev) => {
      if (!prev) return prev;
      const next = { ...prev, sections: [...prev.sections] };
      const section = { ...next.sections[selectedSectionIndex] };
      const current = section.text_formatting || [];
      section.text_formatting = current.includes(style)
        ? current.filter((fmt) => fmt !== style)
        : [...current, style];
      next.sections[selectedSectionIndex] = section;
      return next;
    });
  };

  const setAlignment = (align) => {
    if (selectedSectionIndex === null) return;
    // compute next formatting based on current snapshot
    const current =
      editedTemplate?.sections?.[selectedSectionIndex]?.text_formatting || [];
    const withoutAlign = current.filter(
      (f) => f !== "center" && f !== "right" && f !== "left" && f !== ""
    );
    const nextFormatting =
      align === "left" ? withoutAlign : [...withoutAlign, align];

    setEditedTemplate((prev) => {
      if (!prev) return prev;
      const next = { ...prev, sections: [...prev.sections] };
      const section = { ...next.sections[selectedSectionIndex] };
      section.text_formatting = nextFormatting;
      next.sections[selectedSectionIndex] = section;
      return next;
    });

    form.setFieldValue("text_formatting", nextFormatting);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const response = await axios.put(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/custom/documents/templates/${encodeURIComponent(templateName)}`,
        {
          template_name: templateName,
          updated_template: JSON.stringify(editedTemplate),
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        messageApi.open({
          type: "success",
          content: "Template saved successfully!",
        });
        setGeneratedTemplate(editedTemplate); // Optimistic update
      }
    } catch (error) {
      console.error("Error saving template:", error);
      messageApi.open({
        type: "error",
        content:
          "There was an issue saving the template. Please try again later.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMaxWordsChange = (value) => {
    setEditedTemplate((prev) => {
      const next = { ...prev, sections: [...prev.sections] };
      next.sections[selectedSectionIndex].max_words = value;
      return next;
    });
  };

  const handleSectionTitleChange = (value) => {
    if (selectedSectionIndex === null) return;
    setEditedTemplate((prev) => {
      if (!prev) return prev;
      const next = { ...prev, sections: [...prev.sections] };
      next.sections[selectedSectionIndex] = {
        ...next.sections[selectedSectionIndex],
        title: value,
      };
      return next;
    });
  };

  const handleSectionDescriptionChange = (value) => {
    if (selectedSectionIndex === null) return;
    setEditedTemplate((prev) => {
      if (!prev) return prev;
      const next = { ...prev, sections: [...prev.sections] };
      next.sections[selectedSectionIndex] = {
        ...next.sections[selectedSectionIndex],
        description: value,
      };
      return next;
    });
  };

  const handleElementTypeChange = (newType) => {
    if (selectedSectionIndex == null) return;
    setEditedTemplate((prev) => {
      const next = { ...prev, sections: [...prev.sections] };
      const section = { ...next.sections[selectedSectionIndex] };
      if (section.element_type !== newType) {
        section.element_type = newType;
        section.generic_example = defaultGenericExampleByType(newType);

        // Optionally clear formatting for structural/divider
        if (newType === "horizontal_rule") {
          section.text_formatting = [];
          section.max_words = 0;
        }
      }
      next.sections[selectedSectionIndex] = section;
      return next;
    });
  };

  const handleQueryTemplateChange = (queryIndex, value) => {
    setEditedTemplate((prev) => {
      const next = { ...prev, sections: [...prev.sections] };
      const section = { ...next.sections[selectedSectionIndex] };
      const updatedQueries = [...(section.query_templates || [])];
      updatedQueries[queryIndex] = value;
      section.query_templates = updatedQueries;
      next.sections[selectedSectionIndex] = section;
      return next;
    });
  };

  const handleAddQueryTemplate = () => {
    setEditedTemplate((prev) => {
      const next = { ...prev, sections: [...prev.sections] };
      const section = { ...next.sections[selectedSectionIndex] };
      section.query_templates = [...(section.query_templates || []), ""];
      next.sections[selectedSectionIndex] = section;
      return next;
    });
  };

  const handleRemoveQueryTemplate = (queryIndex) => {
    setEditedTemplate((prev) => {
      const next = { ...prev, sections: [...prev.sections] };
      const section = { ...next.sections[selectedSectionIndex] };
      const updatedQueries = [...(section.query_templates || [])];
      updatedQueries.splice(queryIndex, 1);
      section.query_templates = updatedQueries;
      next.sections[selectedSectionIndex] = section;
      return next;
    });
  };

  const handleAddSection = () => {
    const newSection = {
      title: "New Section",
      description: "Description for the new section",
      element_type: "text",
      max_words: 100,
      text_formatting: [],
      generic_example: "",
      query_templates: ["What information should be included in this section?"],
    };

    setEditedTemplate((prev) => {
      const next = { ...prev, sections: [...prev.sections] };
      const insertIndex =
        selectedSectionIndex !== null
          ? selectedSectionIndex + 1
          : next.sections.length;
      next.sections.splice(insertIndex, 0, newSection);
      // select new section immediately
      setSelectedSectionIndex(insertIndex);
      return next;
    });
  };

  const handleDuplicateSection = () => {
    if (selectedSectionIndex === null) return;

    const currentSection = editedTemplate?.sections?.[selectedSectionIndex];
    const duplicatedSection = {
      ...currentSection,
      title: `${currentSection.title} (Copy)`,
      query_templates: [...(currentSection.query_templates || [])],
    };

    setEditedTemplate((prev) => {
      const next = { ...prev, sections: [...prev.sections] };
      next.sections.splice(selectedSectionIndex + 1, 0, duplicatedSection);
      return next;
    });

    // Select the duplicated section
    setSelectedSectionIndex((idx) => idx + 1);
  };

  const handleDeleteSection = () => {
    if (selectedSectionIndex === null) return;
    if (editedTemplate.sections.length <= 1) {
      messageApi.open({
        type: "warning",
        content: "Cannot delete the last remaining section.",
      });
      return;
    }

    setEditedTemplate((prev) => {
      const next = { ...prev, sections: [...prev.sections] };
      next.sections.splice(selectedSectionIndex, 1);
      const newIndex =
        selectedSectionIndex >= next.sections.length
          ? next.sections.length - 1
          : selectedSectionIndex;
      setSelectedSectionIndex(newIndex);
      return next;
    });
  };

  const handleMoveSection = (direction) => {
    if (selectedSectionIndex === null) return;

    const newIndex =
      direction === "up" ? selectedSectionIndex - 1 : selectedSectionIndex + 1;

    if (newIndex < 0) return;

    setEditedTemplate((prev) => {
      if (!prev) return prev;
      if (newIndex >= prev.sections.length) return prev;
      const next = { ...prev, sections: [...prev.sections] };
      const [movedSection] = next.sections.splice(selectedSectionIndex, 1);
      next.sections.splice(newIndex, 0, movedSection);
      setSelectedSectionIndex(newIndex);
      return next;
    });
  };

  const isElementTypeWithExample =
    editedTemplate?.sections?.[selectedSectionIndex]?.element_type !==
    "horizontal_rule";

  useEffect(() => {
    if (selectedSectionIndex === null || !editedTemplate) {
      form.resetFields();
      return;
    }

    const section = editedTemplate.sections[selectedSectionIndex];
    form.setFieldsValue({
      sectionName: section?.title,
      sectionDescription: section?.description,
      element_type: section?.element_type,
      max_words: section?.max_words,
      text_formatting: section?.text_formatting,
      generic_example: section?.generic_example,
    });
  }, [selectedSectionIndex, editedTemplate, form]);

  const currentTextFormatting =
    editedTemplate?.sections?.[selectedSectionIndex]?.text_formatting || [];

  return (
    <Flex style={{ height: "100%" }}>
      {contextHolder}
      <div style={{ width: "100%" }}>
        <TemplatePreview
          generatedTemplate={editedTemplate}
          isDarkMode={isDarkMode}
          textSize={isEditMode ? 16 : 18}
          selectedSectionIndex={selectedSectionIndex}
          setSelectedSectionIndex={setSelectedSectionIndex}
          hoveredSectionIndex={hoveredSectionIndex}
          selectedHeaderFooterIndex={selectedHeaderFooterIndex}
          setSelectedHeaderFooterIndex={setSelectedHeaderFooterIndex}
          hoveredHeaderFooterIndex={hoveredHeaderFooterIndex}
        />
      </div>
      {/* VIEWER */}
      {!isEditMode && (
        <TemplateViewer
          themeToken={themeToken}
          generatedTemplate={editedTemplate}
          setSelectedSectionIndex={setSelectedSectionIndex}
          setSelectedHeaderFooterIndex={setSelectedHeaderFooterIndex}
          setHoveredHeaderFooterIndex={setHoveredHeaderFooterIndex}
          setHoveredSectionIndex={setHoveredSectionIndex}
        />
      )}

      {/* EDITOR */}
      {isEditMode && (
        <Card
          className="template-editor-pane"
          style={{
            width: "100%",
            height: "100vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
          styles={{
            body: {
              padding: 0,
              height: "calc(100vh - 57px)", // Account for card header
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            },
          }}
        >
          {/* Scrollable Content Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px",
              paddingRight: "16px",
            }}
          >
            <Flex vertical gap="middle">
              <Alert
                type="warning"
                message="Hover and click on a section to edit it!"
                showIcon
              />

              {/* Section Management */}
              {selectedHeaderFooterIndex === null && (
                <Card
                  title="Section Management"
                  size="small"
                  styles={{
                    body: { padding: "12px 16px" },
                  }}
                >
                  <Flex vertical gap="middle">
                    <Flex gap="small" wrap>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddSection}
                        size="small"
                      >
                        Add Section
                      </Button>

                      {selectedSectionIndex !== null && (
                        <>
                          <Button
                            icon={<CopyOutlined />}
                            onClick={handleDuplicateSection}
                            size="small"
                          >
                            Duplicate
                          </Button>

                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            onClick={handleDeleteSection}
                            size="small"
                            disabled={editedTemplate.sections.length <= 1}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </Flex>

                    {selectedSectionIndex !== null && (
                      <Flex gap="small" wrap>
                        <Button
                          icon={<ArrowUpOutlined />}
                          onClick={() => handleMoveSection("up")}
                          size="small"
                          disabled={selectedSectionIndex === 0}
                        >
                          Move Up
                        </Button>

                        <Button
                          icon={<ArrowDownOutlined />}
                          onClick={() => handleMoveSection("down")}
                          size="small"
                          disabled={
                            selectedSectionIndex ===
                            editedTemplate.sections.length - 1
                          }
                        >
                          Move Down
                        </Button>
                      </Flex>
                    )}
                  </Flex>
                </Card>
              )}

              {selectedHeaderFooterIndex !== null && (
                <Card
                  title={`Editing ${
                    selectedHeaderFooterIndex.charAt(0).toUpperCase() +
                    selectedHeaderFooterIndex.slice(1)
                  }`}
                  size="small"
                  styles={{
                    body: { padding: "16px" },
                  }}
                >
                  <Form layout="vertical" onFinish={handleSubmit}>
                    <Flex vertical gap="middle">
                      {/* Header/Footer Structure */}
                      <div>
                        <Title level={5} style={{ marginBottom: 16 }}>
                          {selectedHeaderFooterIndex.charAt(0).toUpperCase() +
                            selectedHeaderFooterIndex.slice(1)}{" "}
                          Structure
                        </Title>
                        <Flex vertical gap="middle">
                          <Flex gap="middle" align="start" wrap>
                            <Form.Item
                              label="Type"
                              style={{
                                flex: 1,
                                minWidth: 120,
                                marginBottom: 0,
                              }}
                            >
                              <Select
                                value={
                                  editedTemplate[selectedHeaderFooterIndex]
                                    ?.type || ""
                                }
                                onChange={(value) => {
                                  setEditedTemplate((prev) => ({
                                    ...prev,
                                    [selectedHeaderFooterIndex]: {
                                      ...prev[selectedHeaderFooterIndex],
                                      type: value,
                                      // Clear content and formatting when switching types
                                      content: "",
                                      text_formatting: [],
                                    },
                                  }));
                                }}
                                options={[
                                  { value: "", label: "None" },
                                  { value: "text", label: "Text" },
                                  {
                                    value: "page_number",
                                    label: "Page Number",
                                  },
                                ]}
                              />
                            </Form.Item>
                          </Flex>

                          {/* Only show content field if type is "text" */}
                          {editedTemplate[selectedHeaderFooterIndex]?.type ===
                            "text" && (
                            <Form.Item
                              label="Content"
                              style={{ marginBottom: 0 }}
                            >
                              <TextArea
                                value={
                                  editedTemplate[selectedHeaderFooterIndex]
                                    ?.content || ""
                                }
                                onChange={(e) => {
                                  setEditedTemplate((prev) => ({
                                    ...prev,
                                    [selectedHeaderFooterIndex]: {
                                      ...prev[selectedHeaderFooterIndex],
                                      content: e.target.value,
                                    },
                                  }));
                                }}
                                placeholder={`Enter ${selectedHeaderFooterIndex} content...`}
                                autoSize={{ minRows: 2, maxRows: 4 }}
                              />
                            </Form.Item>
                          )}

                          {/* Only show text formatting if type is "text" or "page_number" */}
                          {editedTemplate[selectedHeaderFooterIndex]?.type &&
                            editedTemplate[selectedHeaderFooterIndex]?.type !==
                              "" && (
                              <Form.Item
                                label="Text Formatting"
                                style={{ marginBottom: 0 }}
                              >
                                <Card
                                  styles={{
                                    body: {
                                      padding: "12px 16px",
                                      backgroundColor:
                                        themeToken.colorFillQuaternary,
                                    },
                                  }}
                                  size="small"
                                >
                                  <Flex align="center" gap="middle" wrap>
                                    {/* TEXT ALIGNMENT */}
                                    <div>
                                      <Text
                                        type="secondary"
                                        style={{
                                          fontSize: 12,
                                          marginBottom: 4,
                                          display: "block",
                                        }}
                                      >
                                        Alignment
                                      </Text>
                                      <Segmented
                                        value={
                                          editedTemplate[
                                            selectedHeaderFooterIndex
                                          ]?.text_formatting?.find((fmt) =>
                                            ["center", "right"].includes(fmt)
                                          ) || "left"
                                        }
                                        onChange={(value) => {
                                          const current =
                                            editedTemplate[
                                              selectedHeaderFooterIndex
                                            ]?.text_formatting || [];
                                          const withoutAlign = current.filter(
                                            (f) =>
                                              f !== "center" &&
                                              f !== "right" &&
                                              f !== "left" &&
                                              f !== ""
                                          );
                                          const next =
                                            value === "left" // left is implicit -> do not store
                                              ? withoutAlign
                                              : [...withoutAlign, value];
                                          setEditedTemplate((prev) => ({
                                            ...prev,
                                            [selectedHeaderFooterIndex]: {
                                              ...prev[
                                                selectedHeaderFooterIndex
                                              ],
                                              text_formatting: next,
                                            },
                                          }));
                                        }}
                                        options={[
                                          {
                                            value: "left",
                                            icon: <AlignLeftOutlined />,
                                          },
                                          {
                                            value: "center",
                                            icon: <AlignCenterOutlined />,
                                          },
                                          {
                                            value: "right",
                                            icon: <AlignRightOutlined />,
                                          },
                                        ]}
                                        size="small"
                                      />
                                    </div>

                                    <div>
                                      <Text
                                        type="secondary"
                                        style={{
                                          fontSize: 12,
                                          marginBottom: 4,
                                          display: "block",
                                        }}
                                      >
                                        Text Style
                                      </Text>
                                      <Space size="small">
                                        <Button
                                          className="text-formatting-button"
                                          shape="round"
                                          size="small"
                                          type={
                                            editedTemplate[
                                              selectedHeaderFooterIndex
                                            ]?.text_formatting?.includes("bold")
                                              ? "primary"
                                              : "text"
                                          }
                                          icon={<BoldOutlined />}
                                          onClick={() => {
                                            const current =
                                              editedTemplate[
                                                selectedHeaderFooterIndex
                                              ]?.text_formatting || [];
                                            const updated = current.includes(
                                              "bold"
                                            )
                                              ? current.filter(
                                                  (fmt) => fmt !== "bold"
                                                )
                                              : [...current, "bold"];
                                            setEditedTemplate((prev) => ({
                                              ...prev,
                                              [selectedHeaderFooterIndex]: {
                                                ...prev[
                                                  selectedHeaderFooterIndex
                                                ],
                                                text_formatting: updated,
                                              },
                                            }));
                                          }}
                                        />
                                        <Button
                                          className="text-formatting-button"
                                          shape="round"
                                          size="small"
                                          type={
                                            editedTemplate[
                                              selectedHeaderFooterIndex
                                            ]?.text_formatting?.includes(
                                              "italic"
                                            )
                                              ? "primary"
                                              : "text"
                                          }
                                          icon={<ItalicOutlined />}
                                          onClick={() => {
                                            const current =
                                              editedTemplate[
                                                selectedHeaderFooterIndex
                                              ]?.text_formatting || [];
                                            const updated = current.includes(
                                              "italic"
                                            )
                                              ? current.filter(
                                                  (fmt) => fmt !== "italic"
                                                )
                                              : [...current, "italic"];
                                            setEditedTemplate((prev) => ({
                                              ...prev,
                                              [selectedHeaderFooterIndex]: {
                                                ...prev[
                                                  selectedHeaderFooterIndex
                                                ],
                                                text_formatting: updated,
                                              },
                                            }));
                                          }}
                                        />
                                        <Button
                                          className="text-formatting-button"
                                          shape="round"
                                          size="small"
                                          type={
                                            editedTemplate[
                                              selectedHeaderFooterIndex
                                            ]?.text_formatting?.includes(
                                              "underline"
                                            )
                                              ? "primary"
                                              : "text"
                                          }
                                          icon={<UnderlineOutlined />}
                                          onClick={() => {
                                            const current =
                                              editedTemplate[
                                                selectedHeaderFooterIndex
                                              ]?.text_formatting || [];
                                            const updated = current.includes(
                                              "underline"
                                            )
                                              ? current.filter(
                                                  (fmt) => fmt !== "underline"
                                                )
                                              : [...current, "underline"];
                                            setEditedTemplate((prev) => ({
                                              ...prev,
                                              [selectedHeaderFooterIndex]: {
                                                ...prev[
                                                  selectedHeaderFooterIndex
                                                ],
                                                text_formatting: updated,
                                              },
                                            }));
                                          }}
                                        />
                                        <Button
                                          className="text-formatting-button"
                                          shape="round"
                                          size="small"
                                          type={
                                            editedTemplate[
                                              selectedHeaderFooterIndex
                                            ]?.text_formatting?.includes(
                                              "strikethrough"
                                            )
                                              ? "primary"
                                              : "text"
                                          }
                                          icon={<StrikethroughOutlined />}
                                          onClick={() => {
                                            const current =
                                              editedTemplate[
                                                selectedHeaderFooterIndex
                                              ]?.text_formatting || [];
                                            const updated = current.includes(
                                              "strikethrough"
                                            )
                                              ? current.filter(
                                                  (fmt) =>
                                                    fmt !== "strikethrough"
                                                )
                                              : [...current, "strikethrough"];
                                            setEditedTemplate((prev) => ({
                                              ...prev,
                                              [selectedHeaderFooterIndex]: {
                                                ...prev[
                                                  selectedHeaderFooterIndex
                                                ],
                                                text_formatting: updated,
                                              },
                                            }));
                                          }}
                                        />
                                      </Space>
                                    </div>
                                  </Flex>
                                </Card>
                              </Form.Item>
                            )}
                        </Flex>
                      </div>
                    </Flex>
                  </Form>
                </Card>
              )}

              {/* Section Editor */}
              {selectedSectionIndex !== null && (
                <Card
                  title={`Editing Section ${selectedSectionIndex + 1}: ${
                    editedTemplate.sections[selectedSectionIndex]?.title ||
                    "Untitled"
                  }`}
                  size="small"
                  styles={{
                    body: { padding: "16px" },
                  }}
                >
                  <Form layout="vertical" form={form} onFinish={handleSubmit}>
                    <Flex vertical gap="middle">
                      {/* Section Information */}
                      <Collapse
                        size="small"
                        bordered={false}
                        defaultActiveKey={[]}
                        expandIconPosition="end"
                        items={[
                          {
                            key: "section-info",
                            label: (
                              <Title
                                level={5}
                                style={{
                                  margin: 0,
                                  fontWeight: 600,
                                }}
                              >
                                Section Information{" "}
                                <Tooltip title="This is metadata for the AI to better understand the section's purpose.">
                                  <QuestionCircleOutlined
                                    style={{ marginLeft: 8 }}
                                  />
                                </Tooltip>
                              </Title>
                            ),
                            children: (
                              <Flex vertical gap="middle">
                                <Form.Item
                                  label="Name"
                                  name="sectionName"
                                  style={{ marginBottom: 0 }}
                                >
                                  <Input
                                    placeholder="Section title"
                                    onChange={(e) =>
                                      handleSectionTitleChange(e.target.value)
                                    }
                                  />
                                </Form.Item>
                                <Form.Item
                                  label="Description"
                                  name="sectionDescription"
                                  style={{ marginBottom: 0 }}
                                >
                                  <TextArea
                                    placeholder="Section description"
                                    autoSize={{ minRows: 2, maxRows: 4 }}
                                    onChange={(e) =>
                                      handleSectionDescriptionChange(
                                        e.target.value
                                      )
                                    }
                                  />
                                </Form.Item>
                              </Flex>
                            ),
                          },
                        ]}
                        style={{ marginBottom: 0 }}
                      />

                      {/* Section Structure */}
                      <div>
                        <Title level={5} style={{ marginBottom: 16 }}>
                          Section Structure
                        </Title>
                        <Flex vertical gap="middle">
                          <Flex gap="middle" align="start" wrap>
                            <Form.Item
                              label="Type"
                              name="element_type"
                              style={{
                                flex: 1,
                                minWidth: 120,
                                marginBottom: 0,
                              }}
                            >
                              <Select
                                onChange={(value) =>
                                  handleElementTypeChange(value)
                                }
                                options={[
                                  {
                                    value: "title",
                                    label: "Heading",
                                  },
                                  {
                                    value: "text",
                                    label: "Paragraph",
                                  },
                                  {
                                    value: "table",
                                    label: "Table",
                                  },
                                  {
                                    value: "list",
                                    label: "List",
                                  },
                                  {
                                    value: "horizontal_rule",
                                    label: "Divider",
                                  },
                                ]}
                              />
                            </Form.Item>

                            {isElementTypeWithExample && (
                              <Form.Item
                                label="Max Words"
                                name="max_words"
                                style={{
                                  flex: 1,
                                  minWidth: 120,
                                  marginBottom: 0,
                                }}
                              >
                                <InputNumber
                                  min={minWordCount}
                                  max={maxWordCount}
                                  placeholder="e.g. 120"
                                  changeOnWheel
                                  onChange={(value) =>
                                    handleMaxWordsChange(value)
                                  }
                                  style={{ width: "100%" }}
                                />
                              </Form.Item>
                            )}
                          </Flex>

                          <Form.Item
                            label="Text Formatting"
                            name="text_formatting"
                            style={{ marginBottom: 0 }}
                          >
                            <Card
                              styles={{
                                body: {
                                  padding: "12px 16px",
                                  backgroundColor:
                                    themeToken.colorFillQuaternary,
                                },
                              }}
                              size="small"
                            >
                              <Flex align="center" gap="middle" wrap>
                                {/* TEXT ALIGNMENT */}
                                <div>
                                  <Text
                                    type="secondary"
                                    style={{
                                      fontSize: 12,
                                      marginBottom: 4,
                                      display: "block",
                                    }}
                                  >
                                    Alignment
                                  </Text>
                                  <Segmented
                                    value={
                                      currentTextFormatting?.find((fmt) =>
                                        ["center", "right"].includes(fmt)
                                      ) || "left"
                                    }
                                    onChange={(value) => setAlignment(value)}
                                    options={[
                                      {
                                        value: "left",
                                        icon: <AlignLeftOutlined />,
                                      },
                                      {
                                        value: "center",
                                        icon: <AlignCenterOutlined />,
                                      },
                                      {
                                        value: "right",
                                        icon: <AlignRightOutlined />,
                                      },
                                    ]}
                                    size="small"
                                  />
                                </div>

                                {isElementTypeWithExample && (
                                  <div>
                                    <Text
                                      type="secondary"
                                      style={{
                                        fontSize: 12,
                                        marginBottom: 4,
                                        display: "block",
                                      }}
                                    >
                                      Text Style
                                    </Text>
                                    <Space size="small">
                                      <Button
                                        className="text-formatting-button"
                                        shape="round"
                                        size="small"
                                        type={
                                          currentTextFormatting?.includes(
                                            "bold"
                                          )
                                            ? "primary"
                                            : "text"
                                        }
                                        icon={<BoldOutlined />}
                                        onClick={() => toggleTextStyle("bold")}
                                      />
                                      <Button
                                        className="text-formatting-button"
                                        shape="round"
                                        size="small"
                                        type={
                                          currentTextFormatting?.includes(
                                            "italic"
                                          )
                                            ? "primary"
                                            : "text"
                                        }
                                        icon={<ItalicOutlined />}
                                        onClick={() =>
                                          toggleTextStyle("italic")
                                        }
                                      />
                                      <Button
                                        className="text-formatting-button"
                                        shape="round"
                                        size="small"
                                        type={
                                          currentTextFormatting?.includes(
                                            "underline"
                                          )
                                            ? "primary"
                                            : "text"
                                        }
                                        icon={<UnderlineOutlined />}
                                        onClick={() =>
                                          toggleTextStyle("underline")
                                        }
                                      />
                                      <Button
                                        className="text-formatting-button"
                                        shape="round"
                                        size="small"
                                        type={
                                          currentTextFormatting?.includes(
                                            "strikethrough"
                                          )
                                            ? "primary"
                                            : "text"
                                        }
                                        icon={<StrikethroughOutlined />}
                                        onClick={() =>
                                          toggleTextStyle("strikethrough")
                                        }
                                      />
                                    </Space>
                                  </div>
                                )}
                              </Flex>
                            </Card>
                          </Form.Item>
                        </Flex>
                      </div>

                      {/* Section Example */}
                      <div>
                        <Title level={5} style={{ marginBottom: 16 }}>
                          Section Example
                        </Title>
                        <Form.Item
                          name="generic_example"
                          style={{ marginBottom: 0 }}
                        >
                          <TemplateGenericExampleEditor
                            selectedSectionIndex={selectedSectionIndex}
                            setEditedTemplate={setEditedTemplate}
                            editedTemplate={editedTemplate}
                            sectionType={
                              editedTemplate.sections[selectedSectionIndex]
                                ?.element_type
                            }
                          />
                        </Form.Item>
                      </div>

                      {/* Guiding Questions */}
                      <div>
                        <Title level={5} style={{ marginBottom: 16 }}>
                          Guiding Questions
                          <Tooltip title="These questions help guide the AI in generating relevant content for this section.">
                            <QuestionCircleOutlined style={{ marginLeft: 8 }} />
                          </Tooltip>
                        </Title>
                        <Form.Item
                          name="query_templates"
                          style={{ marginBottom: 0 }}
                        >
                          <Flex vertical gap="small">
                            {(
                              editedTemplate.sections[selectedSectionIndex]
                                ?.query_templates || []
                            ).map((query, queryIndex) => (
                              <Flex key={queryIndex} gap="small" align="start">
                                <Input
                                  value={query}
                                  onChange={(e) =>
                                    handleQueryTemplateChange(
                                      queryIndex,
                                      e.target.value
                                    )
                                  }
                                  placeholder="Enter a guiding question..."
                                  style={{ flex: 1 }}
                                />
                                <Button
                                  icon={<MinusCircleOutlined />}
                                  danger
                                  type="text"
                                  size="small"
                                  onClick={() =>
                                    handleRemoveQueryTemplate(queryIndex)
                                  }
                                  disabled={
                                    editedTemplate.sections[
                                      selectedSectionIndex
                                    ]?.query_templates?.length <= 1
                                  }
                                />
                              </Flex>
                            ))}
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              onClick={handleAddQueryTemplate}
                              size="small"
                              block
                            >
                              Add Guiding Question
                            </Button>
                          </Flex>
                        </Form.Item>
                      </div>
                    </Flex>
                  </Form>
                </Card>
              )}
            </Flex>
          </div>

          {/* Fixed Save Button at Bottom */}
          <div
            style={{
              borderTop: `1px solid ${themeToken.colorBorder}`,
              padding: "16px 24px",
              backgroundColor: themeToken.colorBgContainer,
            }}
          >
            <Button
              type="primary"
              disabled={
                JSON.stringify(generatedTemplate) ===
                JSON.stringify(editedTemplate)
              }
              onClick={handleSubmit}
              loading={isSaving}
              block
            >
              Save All Changes
            </Button>
          </div>
        </Card>
      )}

      {/* SCROLLBACK TO THE TOP BUTTON */}
      <FloatButton.BackTop
        icon={<ArrowUpOutlined />}
        className="backtop-large"
      />
    </Flex>
  );
};
