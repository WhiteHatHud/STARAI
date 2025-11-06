import {
  Input,
  Flex,
  Slider,
  Button,
  Popover,
  Tag,
  Space,
  Tooltip,
} from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useEffect, useState, useRef } from "react";
import ListGenericExampleEditor from "./ListGenericExampleEditor";
import TableGenericExampleEditor from "./TableGenericExampleEditor";

const { TextArea } = Input;

const DEFAULT_DIVIDER_LENGTH = 20;

const TemplateGenericExampleEditor = ({
  selectedSectionIndex,
  setEditedTemplate,
  editedTemplate,
  sectionType,
}) => {
  const section = editedTemplate.sections[selectedSectionIndex] || {};
  const textareaRef = useRef(null);
  const [cursorPos, setCursorPos] = useState(null);
  const [customPlaceholder, setCustomPlaceholder] = useState("");

  // sensible default placeholders for templates - adjust as needed
  const defaultPlaceholders = ["<name>", "<date>", "<address>"];

  const normalizePlaceholder = (raw) => {
    if (!raw || typeof raw !== "string") return "";
    // strip existing angle brackets and whitespace, replace spaces with underscores
    const inner = raw
      .replace(/[<>]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();
    if (!inner) return "";
    return `<${inner}>`;
  };

  // dynamic list of placeholders (user can add/remove)
  const [placeholders, setPlaceholders] = useState(
    defaultPlaceholders.map((p) => normalizePlaceholder(p))
  );

  const updateSectionGeneric = (nextValue) => {
    setEditedTemplate((prev) => {
      const clone = { ...prev, sections: [...prev.sections] };
      clone.sections[selectedSectionIndex] = {
        ...clone.sections[selectedSectionIndex],
        generic_example: nextValue,
      };
      return clone;
    });
  };

  const insertPlaceholderAtCursor = (token) => {
    const current = section.generic_example || "";
    // try to find selectionStart on the underlying textarea
    let pos = cursorPos;
    try {
      const ta =
        textareaRef.current?.resizableTextArea?.textArea || textareaRef.current;
      if (ta && typeof ta.selectionStart === "number") pos = ta.selectionStart;
    } catch (e) {
      // ignore
    }
    if (pos == null) pos = current.length;
    const next = `${current.slice(0, pos)}${token}${current.slice(pos)}`;
    updateSectionGeneric(next);

    // add token to placeholders list if not already present
    try {
      setPlaceholders((prev) =>
        prev.includes(token) ? prev : [token, ...prev]
      );
    } catch (e) {
      // noop
    }

    // restore focus and set caret after inserted token
    setTimeout(() => {
      try {
        const ta =
          textareaRef.current?.resizableTextArea?.textArea ||
          textareaRef.current;
        if (ta) {
          ta.focus();
          const newPos = pos + token.length;
          ta.setSelectionRange(newPos, newPos);
          setCursorPos(newPos);
        }
      } catch (e) {
        // noop
      }
    }, 0);
  };

  // Normalize generic_example shape whenever type changes
  useEffect(() => {
    if (selectedSectionIndex == null) return;
    const val = section.generic_example;

    if (sectionType === "horizontal_rule") {
      if (!val || typeof val !== "string" || val.length === 0) {
        updateSectionGeneric("_".repeat(DEFAULT_DIVIDER_LENGTH));
      }
      return;
    }

    if (sectionType === "text" || sectionType === "title") {
      if (Array.isArray(val)) {
        // Convert list/table arrays to newline string
        const text = Array.isArray(val[0])
          ? val.flat().join("\n")
          : val.join("\n");
        updateSectionGeneric(text);
      } else if (typeof val !== "string") {
        updateSectionGeneric("");
      }
      return;
    }

    if (sectionType === "list") {
      if (
        !Array.isArray(val) ||
        (Array.isArray(val[0]) && Array.isArray(val))
      ) {
        // Table or invalid -> flatten to single-level array
        const list =
          Array.isArray(val) && Array.isArray(val[0]) ? val.flat() : [];
        updateSectionGeneric(list);
      }
      return;
    }

    if (sectionType === "table") {
      if (
        !Array.isArray(val) ||
        (Array.isArray(val) && !Array.isArray(val[0]))
      ) {
        // From text or list -> wrap into a 1-row table
        if (Array.isArray(val)) {
          updateSectionGeneric([val]); // list -> one row
        } else if (typeof val === "string") {
          const cells = val ? val.split("\n").filter(Boolean) : [""];
          updateSectionGeneric([cells]);
        } else {
          updateSectionGeneric([[""]]);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionType, selectedSectionIndex]);

  // Derive divider length directly from template (source of truth)
  const dividerLength =
    sectionType === "horizontal_rule"
      ? section.generic_example?.length || DEFAULT_DIVIDER_LENGTH
      : 0;

  const updateDividerLength = (len) => {
    const safe = len <= 0 ? DEFAULT_DIVIDER_LENGTH : len;
    updateSectionGeneric("_".repeat(safe));
  };

  switch (sectionType) {
    case "title":
    case "text":
      return (
        <div>
          <Space style={{ marginBottom: 8 }} wrap>
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.6)" }}>
              Insert placeholder:
            </span>
            {placeholders.map((ph) => (
              <Tag
                key={ph}
                closable
                onClose={(e) => {
                  e.stopPropagation();
                  setPlaceholders((prev) => prev.filter((p) => p !== ph));
                }}
                onClick={() => insertPlaceholderAtCursor(ph)}
                style={{ cursor: "pointer", userSelect: "none", fontSize: 12 }}
              >
                <code style={{ fontSize: 12 }}>{ph}</code>
              </Tag>
            ))}

            <Popover
              content={
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Input
                    size="small"
                    placeholder="custom_placeholder (will become <custom_placeholder>)"
                    value={customPlaceholder}
                    onChange={(e) => setCustomPlaceholder(e.target.value)}
                    onPressEnter={() => {
                      const ph = normalizePlaceholder(customPlaceholder);
                      if (ph) {
                        insertPlaceholderAtCursor(ph);
                        setCustomPlaceholder("");
                      }
                    }}
                  />
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => {
                      const ph = normalizePlaceholder(customPlaceholder);
                      if (ph) {
                        insertPlaceholderAtCursor(ph);
                        setCustomPlaceholder("");
                      }
                    }}
                  >
                    Insert
                  </Button>
                </div>
              }
              title="Custom placeholder"
            >
              <Button size="small">custom placeholder</Button>
            </Popover>

            <Tooltip title="Placeholders will be passed to the LLM for substitution when generating content">
              <QuestionCircleOutlined />
            </Tooltip>
          </Space>

          <TextArea
            ref={textareaRef}
            placeholder="Write an example with placeholders, e.g. Hello <client_name>"
            autoSize={{ minRows: 4, maxRows: 10 }}
            value={section.generic_example || ""}
            onChange={(e) => updateSectionGeneric(e.target.value)}
            onClick={(e) => setCursorPos(e.target.selectionStart)}
            onKeyUp={(e) => setCursorPos(e.target.selectionStart)}
            onSelect={(e) => setCursorPos(e.target.selectionStart)}
          />
        </div>
      );

    case "list":
      return (
        <ListGenericExampleEditor
          value={
            Array.isArray(section.generic_example)
              ? section.generic_example
              : []
          }
          onChange={(val) => updateSectionGeneric(val)}
        />
      );

    case "table":
      return (
        <TableGenericExampleEditor
          value={
            Array.isArray(section.generic_example)
              ? section.generic_example.map((r) => (Array.isArray(r) ? r : [r]))
              : [[""]]
          }
          onChange={(val) => updateSectionGeneric(val)}
        />
      );
    case "horizontal_rule":
      return (
        <Flex gap="small">
          <Slider
            min={1}
            max={200}
            value={dividerLength}
            onChange={(v) => updateDividerLength(v)}
            style={{ width: "90%" }}
          />
          <Input value={dividerLength} readOnly style={{ width: "50px" }} />
        </Flex>
      );
    default:
      return null;
  }
};

export default TemplateGenericExampleEditor;
