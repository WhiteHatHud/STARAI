import { useEffect, useRef, useState } from "react";
import { stripMarkdownText } from "../../utils";
import {
  Card,
  Flex,
  Typography,
  Collapse,
  Tag,
  Space,
  Input,
  Button,
  App,
} from "antd";
import {
  LoadingOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
} from "@ant-design/icons";

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

// OutlineItem Component using only Ant Design
export const OutlineItem = ({
  index,
  slideOutline,
  isStreaming,
  isActiveStreaming,
  isStableStreaming,
  editedOutline,
  setEditedOutline,
  dragProps = {},
}) => {
  const [strippedContent, setStrippedContent] = useState("");
  const [isHoveredOn, setIsHoveredOn] = useState(false);
  const [localContent, setLocalContent] = useState(
    editedOutline ? editedOutline[index - 1]?.content || "" : ""
  );
  const [localSpeakerNotes, setLocalSpeakerNotes] = useState(
    editedOutline ? editedOutline[index - 1]?.speaker_notes || "" : ""
  );
  const throttleRef = useRef(null);
  const { modal } = App.useApp();

  // Auto-scroll to active streaming item
  useEffect(() => {
    if (isStreaming && slideOutline && isActiveStreaming) {
      const outlineItem = document.getElementById(`outline-item-${index}`);
      if (outlineItem) {
        outlineItem.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }
    }
  }, [isStreaming, slideOutline, isActiveStreaming, index]);

  // Throttled rendering for streaming content (both active and stable)
  useEffect(() => {
    if (!isStreaming) {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
      const content = slideOutline?.content || "";
      setStrippedContent(stripMarkdownText(content));
      return;
    }

    // During streaming, update content for both active and stable streaming items
    if (isActiveStreaming || isStableStreaming) {
      const content = slideOutline?.content || "";

      // For active streaming, update immediately every time content changes
      if (isActiveStreaming && content) {
        const newHtml = stripMarkdownText(content);
        if (newHtml !== strippedContent) {
          setStrippedContent(newHtml);
        }
      }

      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }

      // Use very short throttle for smooth real-time streaming
      const throttleDelay = isActiveStreaming ? 50 : 100;

      throttleRef.current = setTimeout(() => {
        try {
          const newHtml = stripMarkdownText(content);
          if (newHtml !== strippedContent) {
            setStrippedContent(newHtml);
          }
        } catch {
          setStrippedContent("");
        }
      }, throttleDelay);
    }

    return () => {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
    };
  }, [
    isStreaming,
    isActiveStreaming,
    isStableStreaming,
    slideOutline?.content,
    strippedContent,
  ]);

  // Sync local state with global state
  useEffect(() => {
    if (editedOutline && editedOutline[index - 1]) {
      setLocalContent(editedOutline[index - 1].content || "");
      setLocalSpeakerNotes(editedOutline[index - 1].speaker_notes || "");
    }
  }, [editedOutline, index]);

  const handleTitleChange = (value) => {
    setEditedOutline((prev) => {
      const updated = [...prev];
      updated[index - 1] = {
        ...updated[index - 1],
        title: value,
      };
      return updated;
    });
  };

  const handleContentChange = (value) => {
    setEditedOutline((prev) => {
      const updated = [...prev];
      updated[index - 1] = {
        ...updated[index - 1],
        content: value,
      };
      return updated;
    });
  };

  const handleSpeakerNotesChange = (value) => {
    setEditedOutline((prev) => {
      const updated = [...prev];
      updated[index - 1] = {
        ...updated[index - 1],
        speaker_notes: value,
      };
      return updated;
    });
  };

  const handleDeleteOutlineItem = () => {
    modal.confirm({
      title: "Are you sure you want to delete?",
      icon: <ExclamationCircleFilled />,
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk() {
        setEditedOutline((prev) => {
          const updated = prev.filter((_, i) => i !== index - 1);
          return updated;
        });
      },
    });
  };

  return (
    <Card
      id={`outline-item-${index}`}
      size="small"
      className={isActiveStreaming ? "outline-card-active" : "outline-card"}
      onMouseEnter={() => setIsHoveredOn(true)}
      onMouseLeave={() => setIsHoveredOn(false)}
      hoverable
    >
      <Flex
        vertical
        gap="middle"
        justify="space-between"
        style={{ width: "100%" }}
      >
        {/* Status */}
        <Flex style={{ justifyContent: "flex-end" }}>
          {isActiveStreaming && (
            <Tag className="outline-generating-tag" icon={<LoadingOutlined />}>
              Generating...
            </Tag>
          )}
        </Flex>

        {/* Main Content */}
        <Flex style={{ width: "100%" }}>
          {/* Slide Number */}
          <Flex
            align="center"
            justify="center"
            style={{
              width: "25%",
              cursor: dragProps.listeners ? "move" : "default",
            }}
            ref={dragProps.setActivatorNodeRef}
            {...(dragProps.attributes || {})}
            {...(dragProps.listeners || {})}
            className="outline-slide-number-container"
          >
            <Title
              style={{
                width: "100%",
                textAlign: "center",
                fontSize: 80,
                margin: "auto 0px",
              }}
            >
              {index}
            </Title>
          </Flex>

          {/* Content Area */}
          <Flex vertical style={{ width: "100%", padding: "0px 16px" }}>
            {isStreaming ? (
              // Streaming Content
              <Space direction="vertical">
                <Title level={4} style={{ margin: 0 }}>
                  {slideOutline.title}
                </Title>
                {isActiveStreaming ? (
                  <>
                    <Paragraph
                      style={{
                        whiteSpace: "pre-wrap",
                        textAlign: "justify",
                      }}
                    >
                      {strippedContent}
                    </Paragraph>
                    <span className="typing-cursor">|</span>
                  </>
                ) : (
                  <Paragraph
                    style={{ whiteSpace: "pre-wrap", textAlign: "justify" }}
                  >
                    {strippedContent}
                  </Paragraph>
                )}
              </Space>
            ) : (
              editedOutline && (
                // Completed Content
                <Space direction="vertical" style={{ margin: "16px 0px" }}>
                  <Flex
                    justify="space-between"
                    align="center"
                    style={{ width: "100%" }}
                  >
                    {/* SLIDE TITLE */}
                    <Title
                      level={4}
                      style={{ margin: 0, width: "90%", cursor: "text" }}
                      editable={{
                        onChange: (value) => handleTitleChange(value),
                        triggerType: "text",
                      }}
                    >
                      {editedOutline[index - 1].title}
                    </Title>

                    {/* DELETE BUTTON */}
                    <Button
                      type="text"
                      shape="circle"
                      icon={<DeleteOutlined />}
                      danger
                      className={
                        isHoveredOn
                          ? "delete-button-visible"
                          : "delete-button-hidden"
                      }
                      onClick={handleDeleteOutlineItem}
                    />
                  </Flex>
                  <TextArea
                    name={`outline-content-${index}`}
                    value={localContent}
                    onChange={(e) => setLocalContent(e.target.value)}
                    onBlur={() => handleContentChange(localContent)}
                    style={{
                      whiteSpace: "pre-wrap",
                      textAlign: "left",
                      resize: "none",
                    }}
                    autoSize={true}
                    variant="borderless"
                    spellCheck={false}
                  />

                  {editedOutline[index - 1].speaker_notes && (
                    <Collapse
                      items={[
                        {
                          key: index,
                          label: "View Speaker Notes",
                          children: (
                            <TextArea
                              name={`outline-speaker-notes-${index}`}
                              value={localSpeakerNotes}
                              onChange={(e) =>
                                setLocalSpeakerNotes(e.target.value)
                              }
                              onBlur={() =>
                                handleSpeakerNotesChange(localSpeakerNotes)
                              }
                              style={{
                                whiteSpace: "pre-wrap",
                                textAlign: "left",
                                resize: "none",
                              }}
                              autoSize={true}
                              variant="borderless"
                              spellCheck={false}
                            />
                          ),
                        },
                      ]}
                      size="small"
                    />
                  )}
                </Space>
              )
            )}
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
};
