import axios from "axios";
import {
  Card,
  Flex,
  Divider,
  Space,
  Tooltip,
  Input,
  Form,
  Button,
  Typography,
  Tag,
  notification,
} from "antd";
import {
  EditOutlined,
  HighlightOutlined,
  NumberOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { extractWordCount } from "../../utils/wordCountUtils.js";
import { CaseEditLine } from "../global";
import SOFContent from "./SOFContent";

const { Text } = Typography;

const SectionCard = ({
  section,
  editMode,
  selectedSectionOption,
  setEditMode,
  setSelectedSectionOption,
  form,
  saveManualEdit,
  isViewContentAsSections,
  isDarkMode,
  token,
  reportId,
  refreshDataAfterSave,
  readOnly,
}) => {
  const projectVariant = import.meta.env.VITE_PROJECT_VARIANT;

  const isEditingThisSection =
    editMode && selectedSectionOption === section.section_id;

  const handleEditModeToggle = (mode) => {
    if (!isViewContentAsSections) {
      if (selectedSectionOption !== section.section_id) {
        setSelectedSectionOption(section.section_id);
        setEditMode(mode);
      } else {
        setEditMode((prev) => (prev === mode ? "" : mode));
      }
    } else {
      setSelectedSectionOption(section.section_id);
      setEditMode((prev) => (prev === mode ? "" : mode));
    }
  };

  const handleContentUpdate = async (sectionId, newContent) => {
    try {
      await axios.patch(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/${reportId}/sections/${sectionId}`,
        { content: newContent },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      notification.success({
        message: "Content Updated",
        description: "Section content has been successfully updated.",
      });

      refreshDataAfterSave();
    } catch (error) {
      notification.error({
        message: "Update Failed",
        description: "Failed to update section content.",
      });
    }
  };

  return (
    <Card styles={{ body: { padding: 8 } }}>
      <Flex vertical gap="small">
        {/* HEADER */}
        <Flex>
          <Text strong>{section.title}</Text>
          <Divider type="vertical" />
          <Flex gap="small" align="center">
            <Space>
              <Tag icon={<NumberOutlined />}>
                Word Count: {extractWordCount(section.content)}
              </Tag>
              {projectVariant !== "sof" && (
                <>
                  <Tooltip
                    title={
                      readOnly ? "Read-only (admin view)" : "Manual Edit Mode"
                    }
                  >
                    <Button
                      type={
                        editMode === "Manual" &&
                        selectedSectionOption === section.section_id
                          ? "primary"
                          : "default"
                      }
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() =>
                        !readOnly && handleEditModeToggle("Manual")
                      }
                      disabled={readOnly}
                    />
                  </Tooltip>
                  <Tooltip
                    title={
                      readOnly ? "Read-only (admin view)" : "Highlight Mode"
                    }
                  >
                    <Button
                      type={
                        editMode === "Highlight" &&
                        selectedSectionOption === section.section_id
                          ? "primary"
                          : "default"
                      }
                      icon={<HighlightOutlined />}
                      size="small"
                      onClick={() =>
                        !readOnly && handleEditModeToggle("Highlight")
                      }
                      disabled={readOnly}
                    />
                  </Tooltip>
                </>
              )}
            </Space>
          </Flex>
        </Flex>

        <Divider style={{ margin: 0 }} />

        <Flex
          vertical
          style={{
            padding: "16px",
            ...(isViewContentAsSections && {
              maxHeight: "65vh",
              overflow: "auto",
            }),
          }}
        >
          {isEditingThisSection && editMode === "Manual" ? (
            <Form
              form={form}
              onFinish={(value) => saveManualEdit(value.content)}
              initialValues={{ content: section.content }}
              style={{ width: "100%" }}
            >
              <Form.Item name="content">
                <Input.TextArea
                  autoSize
                  autoFocus
                  style={{ textAlign: "justify", whiteSpace: "pre-wrap" }}
                />
              </Form.Item>
              <Form.Item>
                <Flex justify="flex-end">
                  <Button
                    icon={<SaveOutlined />}
                    type="primary"
                    htmlType="submit"
                    disabled={readOnly}
                  >
                    Save
                  </Button>
                </Flex>
              </Form.Item>
            </Form>
          ) : isEditingThisSection && editMode === "Highlight" ? (
            <CaseEditLine
              key={`line-editor-${section.section_id}`}
              sectionContent={section.content}
              sectionId={section.section_id}
              sectionTitle={section.title}
              reportId={reportId}
              token={token}
              onContentUpdate={(newContent) =>
                handleContentUpdate(section.section_id, newContent)
              }
              isDarkMode={isDarkMode}
            />
          ) : projectVariant === "sof" ? (
            <SOFContent content={section.content} isDarkMode={isDarkMode} />
          ) : (
            <Text style={{ textAlign: "justify" }}>
              {section.content?.split("\n").map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </Text>
          )}
        </Flex>
      </Flex>
    </Card>
  );
};

export default SectionCard;
