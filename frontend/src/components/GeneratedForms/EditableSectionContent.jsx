import { useState, useEffect } from "react";
import { Typography, List, Input, Button, notification } from "antd";
import { SaveOutlined, CloseOutlined } from "@ant-design/icons";
import axios from "axios";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// Helper function to highlight specific text
const highlightText = (text) => {
  const targetText = "<Not enough information>";
  const regex = new RegExp(
    `(${targetText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );

  return text.split(regex).map((part, index) => {
    if (part.toLowerCase() === targetText.toLowerCase()) {
      return (
        <span key={index} style={{ backgroundColor: "yellow", color: "black" }}>
          {part}
        </span>
      );
    }
    return part;
  });
};

const TextContent = ({ textData, isDarkMode, isEdit, onContentChange }) => {
  const [editableText, setEditableText] = useState(textData);

  useEffect(() => {
    setEditableText(textData);
  }, [textData]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setEditableText(newValue);
    if (onContentChange) {
      onContentChange({ textdata: newValue });
    }
  };

  if (isEdit) {
    return (
      <TextArea
        value={editableText}
        onChange={handleChange}
        autoSize={{ minRows: 4 }}
        placeholder="Enter text content..."
        style={{
          marginBottom: "16px",
          backgroundColor: isDarkMode ? "#1f1f1f" : "#fff",
          color: isDarkMode ? "#fff" : "#000",
        }}
      />
    );
  }

  const paragraphs = textData.split("\n\n").filter((p) => p.trim());
  return paragraphs.map((paragraph, index) => (
    <Paragraph
      key={index}
      className={isDarkMode ? "text-light" : ""}
      style={{ marginBottom: "16px", lineHeight: "1.8" }}
    >
      {highlightText(paragraph.trim())}
    </Paragraph>
  ));
};

const ListContent = ({ listData, isDarkMode, isEdit, onContentChange }) => {
  const handleItemChange = (index, newValue) => {
    const newList = [...listData];
    newList[index] = newValue;
    if (onContentChange) {
      onContentChange({ listdata: newList });
    }
  };

  if (isEdit) {
    return (
      <div style={{ marginBottom: "16px" }}>
        {listData.map((item, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <Text
              style={{
                marginRight: "8px",
                color: isDarkMode ? "#fff" : "#000",
              }}
            >
              •
            </Text>
            <Input
              value={item}
              onChange={(e) => handleItemChange(index, e.target.value)}
              placeholder={`List item ${index + 1}`}
              style={{
                flex: 1,
                backgroundColor: isDarkMode ? "#1f1f1f" : "#fff",
                color: isDarkMode ? "#fff" : "#000",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <List
      size="small"
      dataSource={listData}
      renderItem={(item) => (
        <List.Item>
          <Text className={isDarkMode ? "text-light" : ""}>
            • {highlightText(item)}
          </Text>
        </List.Item>
      )}
      style={{ marginBottom: "16px" }}
    />
  );
};

const TableContent = ({ tableData, isDarkMode, isEdit, onContentChange }) => {
  const handleCellChange = (rowIndex, colIndex, newValue) => {
    const newTable = [...tableData];
    const newRow = [...newTable[rowIndex]];
    newRow[colIndex] = newValue;
    newTable[rowIndex] = newRow;
    if (onContentChange) {
      onContentChange({ tabledata: newTable });
    }
  };

  if (tableData.length === 0) {
    return <Text type="secondary">No table data available</Text>;
  }

  if (isEdit) {
    return (
      <div style={{ marginBottom: "16px" }}>
        {tableData.map((row, rowIndex) => {
          const colCount = row.length;
          return (
            <div
              key={rowIndex}
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                border: "1px solid #d9d9d9",
                borderBottom:
                  rowIndex === tableData.length - 1
                    ? "1px solid #d9d9d9"
                    : "none",
              }}
            >
              {row.map((cell, colIndex) => (
                <div
                  key={colIndex}
                  style={{
                    borderRight:
                      colIndex === colCount - 1 ? "none" : "1px solid #d9d9d9",
                    padding: "4px",
                    background: isDarkMode ? "#1f1f1f" : "#fff",
                  }}
                >
                  <TextArea
                    value={cell || ""}
                    onChange={(e) =>
                      handleCellChange(rowIndex, colIndex, e.target.value)
                    }
                    autoSize={{ minRows: 1 }}
                    placeholder="Cell content"
                    style={{
                      border: "none",
                      padding: "0",
                      boxShadow: "none",
                      resize: "none",
                      backgroundColor: "transparent",
                      color: isDarkMode ? "#fff" : "#000",
                    }}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "16px" }}>
      {tableData.map((row, rowIndex) => {
        const colCount = row.length;
        return (
          <div
            key={rowIndex}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${colCount}, 1fr)`,
              border: "1px solid #d9d9d9",
              borderBottom:
                rowIndex === tableData.length - 1
                  ? "1px solid #d9d9d9"
                  : "none",
            }}
          >
            {row.map((cell, colIndex) => (
              <div
                key={colIndex}
                style={{
                  borderRight:
                    colIndex === colCount - 1 ? "none" : "1px solid #d9d9d9",
                  padding: "4px 8px",
                  background: isDarkMode ? "#1f1f1f" : "#fff",
                  color: isDarkMode ? "#fff" : "#000",
                }}
              >
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {String(cell || "")
                    .split("\n")
                    .map((line, lineIndex, array) => (
                      <span key={lineIndex}>
                        {highlightText(line)}
                        {lineIndex < array.length - 1 && <br />}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

const PlainTextContent = ({ content, isDarkMode, isEdit, onContentChange }) => {
  const [editableContent, setEditableContent] = useState(content);

  useEffect(() => {
    setEditableContent(content);
  }, [content]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setEditableContent(newValue);
    if (onContentChange) {
      onContentChange(newValue);
    }
  };

  if (isEdit) {
    return (
      <TextArea
        value={editableContent}
        onChange={handleChange}
        autoSize={{ minRows: 4 }}
        placeholder="Enter content..."
        style={{
          marginBottom: "16px",
          backgroundColor: isDarkMode ? "#1f1f1f" : "#fff",
          color: isDarkMode ? "#fff" : "#000",
        }}
      />
    );
  }

  const paragraphs = content.split("\n\n").filter((p) => p.trim());
  return paragraphs.map((paragraph, index) => (
    <Paragraph
      key={index}
      className={isDarkMode ? "text-light" : ""}
      style={{ marginBottom: "16px", lineHeight: "1.8" }}
    >
      {paragraph.trim()}
    </Paragraph>
  ));
};

const FallbackContent = ({
  parsedContent,
  isDarkMode,
  isEdit,
  onContentChange,
}) => {
  const [editableContent, setEditableContent] = useState(
    JSON.stringify(parsedContent, null, 2)
  );

  useEffect(() => {
    setEditableContent(JSON.stringify(parsedContent, null, 2));
  }, [parsedContent]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setEditableContent(newValue);
    if (onContentChange) {
      try {
        const parsed = JSON.parse(newValue);
        onContentChange(parsed);
      } catch (error) {
        // Invalid JSON, don't update
      }
    }
  };

  if (isEdit) {
    return (
      <TextArea
        value={editableContent}
        onChange={handleChange}
        autoSize={{ minRows: 6 }}
        placeholder="Enter JSON content..."
        style={{
          marginBottom: "16px",
          backgroundColor: isDarkMode ? "#1f1f1f" : "#f5f5f5",
          color: isDarkMode ? "#fff" : "#000",
          fontFamily: "monospace",
        }}
      />
    );
  }

  return (
    <div style={{ marginBottom: "16px" }}>
      <Text className={isDarkMode ? "text-light" : ""}>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            backgroundColor: isDarkMode ? "#1f1f1f" : "#f5f5f5",
            padding: "12px",
            borderRadius: "4px",
            fontSize: "12px",
          }}
        >
          {JSON.stringify(parsedContent, null, 2)}
        </pre>
      </Text>
    </div>
  );
};

const EditableSectionContent = ({
  content,
  isDarkMode,
  isEdit = false,
  onContentChange,
  reportId,
  sectionId,
  token,
  onEditToggle,
  onSectionUpdate,
}) => {
  const [editableContent, setEditableContent] = useState(content);
  const [originalContent, setOriginalContent] = useState(content);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditableContent(content);
    setOriginalContent(content);
  }, [content]);

  const handleContentChange = (newContent) => {
    setEditableContent(newContent);
    if (onContentChange) {
      onContentChange(newContent);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.patch(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/${reportId}/sections/${sectionId}`,
        { content: editableContent },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setOriginalContent(editableContent);
      if (onSectionUpdate) {
        onSectionUpdate(sectionId, editableContent);
      }
      if (onEditToggle) {
        onEditToggle(false);
      }
      notification.success({ message: "Section updated!" });
    } catch (err) {
      notification.error({ message: "Failed to update section." });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditableContent(originalContent);
    if (onEditToggle) {
      onEditToggle(false);
    }
  };

  const renderSectionContent = (content) => {
    if (!content) return <Text type="secondary">No content available</Text>;

    let parsedContent;

    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      return (
        <PlainTextContent
          content={content}
          isDarkMode={isDarkMode}
          isEdit={isEdit}
          onContentChange={handleContentChange}
        />
      );
    }

    const handleStructuredChange = (newData) => {
      const jsonString = JSON.stringify(newData);
      handleContentChange(jsonString);
    };

    // Handle text_data
    if (parsedContent.textdata) {
      return (
        <TextContent
          textData={parsedContent.textdata}
          isDarkMode={isDarkMode}
          isEdit={isEdit}
          onContentChange={handleStructuredChange}
        />
      );
    }

    // Handle list_data
    if (parsedContent.listdata && Array.isArray(parsedContent.listdata)) {
      return (
        <ListContent
          listData={parsedContent.listdata}
          isDarkMode={isDarkMode}
          isEdit={isEdit}
          onContentChange={handleStructuredChange}
        />
      );
    }

    // Handle table_data
    if (parsedContent.tabledata && Array.isArray(parsedContent.tabledata)) {
      return (
        <TableContent
          tableData={parsedContent.tabledata}
          isDarkMode={isDarkMode}
          isEdit={isEdit}
          onContentChange={handleStructuredChange}
        />
      );
    }

    // Fallback for any other JSON structure
    return (
      <FallbackContent
        parsedContent={parsedContent}
        isDarkMode={isDarkMode}
        isEdit={isEdit}
        onContentChange={(newParsed) => {
          const jsonString = JSON.stringify(newParsed);
          handleContentChange(jsonString);
        }}
      />
    );
  };

  const hasChanges = editableContent !== originalContent;

  return (
    <div className="section-content">
      {renderSectionContent(editableContent)}

      {isEdit && (
        <div style={{ marginTop: 8 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!hasChanges}
            onClick={handleSave}
            style={{ marginRight: 8 }}
          >
            Save
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};

export { TextContent, ListContent, TableContent };

export default EditableSectionContent;
