import { useState, useRef, useEffect } from "react";
import {
  Button,
  Input,
  Space,
  Typography,
  Alert,
  notification,
  Card,
  theme,
  Flex,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
  ReloadOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import axios from "axios";
import ComparisonModal from "./ComparisonModal";

const { Text } = Typography;
const { TextArea } = Input;

export const CaseEditLine = ({
  sectionContent,
  sectionId,
  sectionTitle,
  reportId,
  token,
  onContentUpdate,
  isDarkMode = false,
}) => {
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [popover, setPopover] = useState({ show: false, x: 0, y: 0, text: "" });
  const [popoverComment, setPopoverComment] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingComment, setEditingComment] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hoveredFeedbackId, setHoveredFeedbackId] = useState(null);

  // Modal state for comparison
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [regeneratedContent, setRegeneratedContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");

  const contentRef = useRef(null);
  const popoverInputRef = useRef(null);
  const editInputRef = useRef(null);
  const popoverRef = useRef(null);
  const { token: themeToken } = theme.useToken();
  const isMobile = window.innerWidth <= 768;

  // Auto-focus popover input when it appears
  useEffect(() => {
    if (popover.show && popoverInputRef.current) {
      popoverInputRef.current.focus();
    }
  }, [popover.show]);

  // Auto-focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  // Handle click outside popover to dismiss it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popover.show &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target)
      ) {
        // User clicked outside the popover, dismiss it
        setPopover({ show: false, x: 0, y: 0, text: "" });
        setPopoverComment("");
        window.getSelection().removeAllRanges();
      }
    };

    if (popover.show) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [popover.show]);

  // Handle hover highlighting effect
  useEffect(() => {
    if (!contentRef.current) return;

    // Remove glow from all highlighted elements
    const allHighlighted = contentRef.current.querySelectorAll(".highlighted");
    allHighlighted.forEach((el) => el.classList.remove("glow"));

    // Add glow to the hovered feedback's highlighted element
    if (hoveredFeedbackId) {
      const targetElement = contentRef.current.querySelector(
        `[data-comment-id="${hoveredFeedbackId}"]`
      );
      if (targetElement) {
        targetElement.classList.add("glow");
      }
    }
  }, [hoveredFeedbackId]);

  // Handle text selection
  const handleSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length === 0) return;

    // Check if selection is already inside a highlighted span
    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer;
    let parent =
      startContainer.nodeType === Node.TEXT_NODE
        ? startContainer.parentNode
        : startContainer;

    while (parent && parent !== contentRef.current) {
      if (parent.classList && parent.classList.contains("highlighted")) {
        notification.warning({
          message: "Already Highlighted",
          description:
            "This text is already highlighted. Please select different text.",
        });
        selection.removeAllRanges();
        return;
      }
      parent = parent.parentNode;
    }

    // Get selection position for popover
    const rect = range.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();

    setPopover({
      show: true,
      x: (rect.left + rect.right) / 2 - contentRect.left,
      y: rect.bottom - contentRect.top + 15,
      text: selectedText,
      range: range.cloneRange(),
    });
    setPopoverComment("");
  };

  // Save feedback and highlight text
  const saveFeedback = () => {
    if (!popoverComment.trim()) return;

    const commentId = Date.now().toString();
    const newFeedback = {
      id: commentId,
      text: popover.text,
      comment: popoverComment.trim(),
    };

    // Wrap the selected text in a highlighted span
    const span = document.createElement("span");
    span.className = "highlighted";
    span.setAttribute("data-comment-id", commentId);

    try {
      popover.range.surroundContents(span);

      // Add to feedback items
      setFeedbackItems((prev) => [...prev, newFeedback]);

      notification.success({
        message: "Feedback Added",
        description: "Text highlighted and feedback saved.",
      });
    } catch (error) {
      notification.error({
        message: "Highlight Failed",
        description:
          "Could not highlight the selected text. Please try selecting again.",
      });
    }

    // Close popover and clear selection
    setPopover({ show: false, x: 0, y: 0, text: "" });
    setPopoverComment("");
    window.getSelection().removeAllRanges();
  };

  // Cancel popover
  const cancelPopover = () => {
    setPopover({ show: false, x: 0, y: 0, text: "" });
    setPopoverComment("");
    window.getSelection().removeAllRanges();
  };

  // Delete feedback and unwrap highlight
  const deleteFeedback = (feedbackId) => {
    // Remove from state
    setFeedbackItems((prev) => prev.filter((item) => item.id !== feedbackId));

    // Find and unwrap the highlighted span
    const span = contentRef.current.querySelector(
      `[data-comment-id="${feedbackId}"]`
    );
    if (span) {
      const parent = span.parentNode;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    }

    notification.info({
      message: "Feedback Deleted",
      description: "Highlight removed and feedback deleted.",
    });
  };

  // Start editing feedback comment
  const startEditing = (feedbackId, currentComment) => {
    setEditingId(feedbackId);
    setEditingComment(currentComment);
  };

  // Save edited comment
  const saveEdit = () => {
    if (!editingComment.trim()) return;

    setFeedbackItems((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? { ...item, comment: editingComment.trim() }
          : item
      )
    );

    setEditingId(null);
    setEditingComment("");

    notification.success({
      message: "Comment Updated",
      description: "Feedback comment has been updated.",
    });
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditingComment("");
  };

  // Handle Enter key in popover
  const handlePopoverKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveFeedback();
    }
  };

  // Handle Enter key in edit mode
  const handleEditKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
  };

  // Regenerate section with feedback
  const handleRegenerateSection = async () => {
    if (feedbackItems.length === 0) {
      notification.warning({
        message: "No Feedback",
        description:
          "Please add at least one feedback item before regenerating.",
      });
      return;
    }

    setIsRegenerating(true);

    try {
      const response = await axios.post(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/${reportId}/regenerate-with-feedback/${sectionId}`,
        {
          feedback_items: feedbackItems.map((item) => ({
            highlighted_text: item.text,
            feedback: item.comment,
          })),
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = response.data;

      if (result.updated_content) {
        // Store original and regenerated content for comparison
        setOriginalContent(sectionContent);
        setRegeneratedContent(result.updated_content);
        setShowComparisonModal(true);
      }
    } catch (error) {
      console.error("Regeneration error:", error);
      notification.error({
        message: "Regeneration Failed",
        description: "Failed to regenerate section. Please try again.",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  // Handle comparison modal confirm
  const handleComparisonConfirm = () => {
    if (onContentUpdate) {
      onContentUpdate(regeneratedContent);
      notification.success({
        message: "Section Updated",
        description: "Section has been updated with the regenerated content!",
      });

      // Reset feedback items and clear highlights
      setFeedbackItems([]);
      // Clear all highlights from the content
      if (contentRef.current) {
        const highlights = contentRef.current.querySelectorAll(".highlighted");
        highlights.forEach((span) => {
          const parent = span.parentNode;
          while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
          }
          parent.removeChild(span);
        });
      }
    }
    setShowComparisonModal(false);
    setRegeneratedContent("");
    setOriginalContent("");
  };

  // Handle comparison modal cancel
  const handleComparisonCancel = () => {
    setShowComparisonModal(false);
    setRegeneratedContent("");
    setOriginalContent("");
    notification.info({
      message: "Original Content Kept",
      description: "The original content has been kept unchanged.",
    });
  };

  // Cancel all feedback
  const handleCancelFeedback = () => {
    // Clear all highlights from the content
    if (contentRef.current) {
      const highlights = contentRef.current.querySelectorAll(".highlighted");
      highlights.forEach((span) => {
        const parent = span.parentNode;
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
      });
    }

    // Clear feedback items
    setFeedbackItems([]);

    notification.info({
      message: "Feedback Cleared",
      description: "All feedback items and highlights have been cleared.",
    });
  };

  return (
    <Flex vertical={isMobile} gap="small">
      <style>
        {`
          .highlighted {
            background: ${isDarkMode ? "#facc15" : "#fde047"};
            border-radius: 3px;
            padding: 0 2px;
            color: ${isDarkMode ? "#1f2937" : "#111827"};
            font-weight: 600;
            transition: all 0.3s ease;
          }
          
          .highlighted.glow {
            background: ${isDarkMode ? "#f59e0b" : "#fef08a"}; 
            box-shadow: 0 0 12px ${
              isDarkMode ? "rgba(250, 204, 21, 0.9)" : "rgba(250, 204, 21, 0.7)"
            };
            color: ${isDarkMode ? "#1f2937" : "#000000"}; 
          }
        `}
      </style>

      {/* Main Content Area */}
      <div style={{ flex: 1 }}>
        <Alert
          message="Select any text to add feedback comments"
          type="info"
          showIcon
          style={{ marginBottom: "12px" }}
        />

        <Card
          size="small"
          style={{
            marginBottom: "12px",
            backgroundColor: themeToken.colorBgElevated,
          }}
        >
          <div
            ref={contentRef}
            style={{
              lineHeight: "1.6",
              userSelect: "text",
              cursor: "text",
              position: "relative",
              minHeight: "200px",
              padding: "8px",
            }}
            onMouseUp={handleSelection}
            dangerouslySetInnerHTML={{
              __html: sectionContent.replace(/\n/g, "<br>"),
            }}
          />

          {/* Popover for adding feedback */}
          {popover.show && (
            <div
              ref={popoverRef}
              style={{
                position: "absolute",
                left: popover.x,
                top: popover.y,
                zIndex: 1000,
                backgroundColor: themeToken.colorBgContainer,
                border: `1px solid ${themeToken.colorBorder}`,
                borderRadius: "6px",
                padding: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                minWidth: "250px",
              }}
            >
              <div style={{ marginBottom: "8px" }}>
                <Text
                  strong
                  style={{
                    fontSize: "12px",
                  }}
                >
                  Selected:{" "}
                </Text>
                <Text
                  style={{
                    fontSize: "12px",
                    fontStyle: "italic",
                  }}
                >
                  "
                  {popover.text.length > 500
                    ? popover.text.substring(0, 500) + "..."
                    : popover.text}
                  "
                </Text>
              </div>
              <TextArea
                ref={popoverInputRef}
                rows={2}
                value={popoverComment}
                onChange={(e) => setPopoverComment(e.target.value)}
                onKeyPress={handlePopoverKeyPress}
                placeholder="Type your feedback and press Enter..."
                style={{
                  marginBottom: "8px",
                  backgroundColor: themeToken.colorBgElevated,
                  borderColor: themeToken.colorBorder,
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Space>
                  <Button size="small" onClick={cancelPopover}>
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    onClick={saveFeedback}
                    disabled={!popoverComment.trim()}
                  >
                    Save
                  </Button>
                </Space>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Sidebar for feedback items */}
      <Flex vertical style={{ width: isMobile ? "100%" : "300px" }} gap="small">
        <div
          style={{
            border: `1px solid ${themeToken.colorBorder}`,
            borderRadius: "6px",
            padding: "12px",
            backgroundColor: themeToken.colorBgContainer,
            maxHeight: "500px",
            overflowY: "auto",
          }}
        >
          <Text
            strong
            style={{ fontSize: "16px", marginBottom: "12px", display: "block" }}
          >
            Feedback ({feedbackItems.length})
          </Text>

          {feedbackItems.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "20px 0",
                fontSize: "14px",
              }}
            >
              <Text type="secondary">
                No feedback yet. <br />
                Select text to add comments.
              </Text>
            </div>
          ) : (
            <Space direction="vertical" style={{ width: "100%" }} size="small">
              {feedbackItems.map((item) => (
                <Card
                  key={item.id}
                  size="small"
                  style={{
                    backgroundColor: themeToken.colorBgElevated,
                    border: `1px solid ${themeToken.colorBorder}`,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={() => setHoveredFeedbackId(item.id)}
                  onMouseLeave={() => setHoveredFeedbackId(null)}
                >
                  <div style={{ marginBottom: "8px" }}>
                    <Text strong style={{ fontSize: "12px" }}>
                      Text:
                    </Text>
                    <div
                      style={{
                        fontSize: "11px",
                        fontStyle: "italic",
                        marginTop: "2px",
                        padding: "4px",
                        backgroundColor: themeToken.colorBgElevated,
                        borderRadius: "3px",
                      }}
                    >
                      "
                      {item.text.length > 200
                        ? item.text.substring(0, 200) + "..."
                        : item.text}
                      "
                    </div>
                  </div>

                  <div style={{ marginBottom: "8px" }}>
                    <Text strong style={{ fontSize: "12px" }}>
                      Comment:
                    </Text>
                    {editingId === item.id ? (
                      <div style={{ marginTop: "4px" }}>
                        <TextArea
                          ref={editInputRef}
                          rows={2}
                          value={editingComment}
                          onChange={(e) => setEditingComment(e.target.value)}
                          onKeyPress={handleEditKeyPress}
                          style={{ fontSize: "11px" }}
                        />
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            marginTop: "4px",
                          }}
                        >
                          <Space>
                            <Button
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="small"
                              type="primary"
                              icon={<SaveOutlined />}
                              onClick={saveEdit}
                              disabled={!editingComment.trim()}
                            >
                              Save
                            </Button>
                          </Space>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: "11px",
                          marginTop: "2px",
                          padding: "4px",
                          backgroundColor: isDarkMode ? "#4b5563" : "#f3f4f6",
                          borderRadius: "3px",
                        }}
                      >
                        {item.comment}
                      </div>
                    )}
                  </div>

                  {editingId !== item.id && (
                    <div
                      style={{ display: "flex", justifyContent: "flex-end" }}
                    >
                      <Space>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => startEditing(item.id, item.comment)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => deleteFeedback(item.id)}
                        >
                          Delete
                        </Button>
                      </Space>
                    </div>
                  )}
                </Card>
              ))}
            </Space>
          )}
        </div>

        {/* Regenerate and Cancel buttons - Outside the scrollable area */}
        <div style={{ marginTop: "12px" }}>
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
          >
            <Button onClick={handleCancelFeedback} disabled={isRegenerating}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={isRegenerating ? <LoadingOutlined /> : <ReloadOutlined />}
              loading={isRegenerating}
              onClick={handleRegenerateSection}
              disabled={feedbackItems.length === 0 || isRegenerating}
            >
              {isRegenerating ? "Regenerating..." : "Regenerate"}
            </Button>
          </div>
        </div>
      </Flex>

      {/* Comparison Modal */}
      <ComparisonModal
        visible={showComparisonModal}
        onConfirm={handleComparisonConfirm}
        onCancel={handleComparisonCancel}
        sectionTitle={sectionTitle}
        originalContent={originalContent}
        regeneratedContent={regeneratedContent}
        isDarkMode={isDarkMode}
        loading={false}
      />
    </Flex>
  );
};
