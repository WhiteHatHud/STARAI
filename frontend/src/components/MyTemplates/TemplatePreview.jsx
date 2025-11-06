import { Card, Typography, Alert, Flex, List } from "antd";
import "../../pages/MyTemplates/TemplatePage.css";
import { Fragment, useEffect, useRef } from "react";

const { Title, Text, Paragraph } = Typography;

const TemplatePreview = ({
  generatedTemplate,
  isDarkMode,
  textSize,
  selectedSectionIndex,
  setSelectedSectionIndex,
  hoveredSectionIndex,
  selectedHeaderFooterIndex,
  setSelectedHeaderFooterIndex,
  hoveredHeaderFooterIndex,
}) => {
  // Variables for auto scrolling
  const sectionRefs = useRef([]);
  const scrollContainerRef = useRef(null);

  // Auto scroll when selection changes
  useEffect(() => {
    if (
      selectedSectionIndex == null ||
      !sectionRefs.current[selectedSectionIndex]
    )
      return;

    const element = sectionRefs.current[selectedSectionIndex];
    const container = scrollContainerRef.current;

    if (!container) {
      // fallback: whole window
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Compute offset so the section is centered
    const cRect = container.getBoundingClientRect();
    const eRect = element.getBoundingClientRect();
    const delta =
      eRect.top -
      cRect.top -
      cRect.height / 2 +
      eRect.height / 2 +
      container.scrollTop;

    container.scrollTo({ top: delta, behavior: "smooth" });
  }, [selectedSectionIndex]);

  const renderMultiline = (text) => {
    if (typeof text !== "string") return text;
    const lines = text.split(/\n/);
    return lines.map((line, i) => (
      <Fragment key={i}>
        {line}
        {i < lines.length - 1 && <br />}
      </Fragment>
    ));
  };

  const renderHeaderFooterContent = (headerFooter) => {
    if (headerFooter?.type === "") {
      return (
        <Text type="secondary" italic>
          No content defined
        </Text>
      );
    }

    const isBold = headerFooter?.text_formatting?.includes("bold");
    const isItalic = headerFooter?.text_formatting?.includes("italic");
    const isUnderline = headerFooter?.text_formatting?.includes("underline");
    const isStrikethrough =
      headerFooter?.text_formatting?.includes("strikethrough");

    let displayContent = headerFooter?.content || "";

    // Handle special types
    switch (headerFooter?.type) {
      case "page_number":
        displayContent = "Page 1";
        break;
      case "text":
      default:
        displayContent = displayContent || "No Content";
        break;
    }

    return (
      <Text
        strong={isBold}
        underline={isUnderline}
        italic={isItalic}
        delete={isStrikethrough}
        style={{
          fontSize: textSize - 2, // Slightly smaller for header/footer
        }}
      >
        {renderMultiline(displayContent)}
      </Text>
    );
  };

  const renderSectionContent = (section) => {
    const isBold = section.text_formatting.includes("bold");
    const isItalic = section.text_formatting.includes("italic");
    const isUnderline = section.text_formatting.includes("underline");
    const isStrikethrough = section.text_formatting.includes("strikethrough");
    const textAlignment = section.text_formatting.find(
      (format) => format === "center" || format === "right"
    );

    const renderTable = (raw) => {
      if (!Array.isArray(raw) || raw.length === 0) return null;

      // Ensure every row is an array (skip or coerce non-array items)
      const rows = raw
        .map((r) => (Array.isArray(r) ? r : [r]))
        .filter((r) => Array.isArray(r));

      if (rows.length === 0) return null;

      // Determine the maximum column count (at least 1)
      const maxCols = Math.max(1, ...rows.map((r) => r.length));

      const cellStyle = {
        border: isDarkMode
          ? "1px solid rgba(255,255,255,0.65)"
          : "1px solid #000",
        padding: "4px 6px",
        verticalAlign: "top",
        fontSize: textSize,
        whiteSpace: "pre-wrap",
      };

      return (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              tableLayout: "fixed",
              fontSize: textSize,
            }}
          >
            <tbody>
              {rows.map((row, ri) => {
                // Handle completely empty row -> one spanning blank cell
                if (!row || row.length === 0) {
                  return (
                    <tr key={ri}>
                      <td style={cellStyle} colSpan={maxCols}>
                        {/* empty row */}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={ri}>
                    {row.map((cell, ci) => {
                      const isLast = ci === row.length - 1;
                      const remaining = maxCols - row.length;
                      const span = isLast && remaining > 0 ? remaining + 1 : 1; // +1 includes its own column
                      return (
                        <td
                          key={ci}
                          style={cellStyle}
                          colSpan={span > 1 ? span : undefined}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    };

    switch (section.element_type) {
      case "title":
      case "text":
        return (
          <div style={{ textAlign: textAlignment || "justify" }}>
            <Text
              strong={isBold}
              underline={isUnderline}
              italic={isItalic}
              delete={isStrikethrough}
              style={{
                whiteSpace: "normal",
                fontSize: textSize,
              }}
            >
              {renderMultiline(section.generic_example)}
            </Text>
          </div>
        );
      case "list":
        return (
          <List
            dataSource={section.generic_example}
            renderItem={(item) => (
              <List.Item
                style={{
                  fontSize: textSize,
                  border: "none",
                  whiteSpace: "pre-wrap",
                }}
              >
                {item}
              </List.Item>
            )}
          />
        );
      case "table":
        return renderTable(section.generic_example);
      default:
        return (
          <div style={{ textAlign: textAlignment || "left" }}>
            <Paragraph
              strong={isBold}
              underline={isUnderline}
              italic={isItalic}
              delete={isStrikethrough}
              style={{ fontSize: textSize }}
            >
              {section.generic_example}
            </Paragraph>
          </div>
        );
    }
  };

  const isCardSelected = (index) =>
    index === selectedSectionIndex || index === selectedHeaderFooterIndex;
  const isCardHoveredOn = (index) =>
    index === hoveredSectionIndex || index === hoveredHeaderFooterIndex;
  return (
    <Card className="template-preview">
      <Flex vertical gap="large">
        <Alert
          message="Template Preview"
          description="This preview is for visualisation purposes only. The actual exported report may vary based on the data provided."
          type="info"
          showIcon
        />

        {/* HEADER SECTION */}
        <div>
          <Title
            level={5}
            style={{
              marginBottom: 8,
              color: isDarkMode ? "#8c8c8c" : "#595959",
            }}
          >
            📄 Header
          </Title>
          <div
            key={0}
            ref={(element) => (sectionRefs.current[0] = element)}
            className={
              isCardSelected("header")
                ? `template-section-card active `
                : isCardHoveredOn("header")
                ? `template-section-card hover`
                : "template-section-card"
            }
            style={{
              scrollMarginTop: 32, // so it doesn’t hug the top edge
            }}
          >
            <Card
              hoverable
              onClick={() => {
                setSelectedSectionIndex(null);
                setSelectedHeaderFooterIndex("header");
              }}
            >
              {renderHeaderFooterContent(generatedTemplate?.header)}
            </Card>
          </div>
        </div>

        {/* FOOTER SECTION */}
        <div>
          <Title
            level={5}
            style={{
              marginBottom: 8,
              color: isDarkMode ? "#8c8c8c" : "#595959",
            }}
          >
            🔗 Footer
          </Title>
          <div
            key={0}
            ref={(element) => (sectionRefs.current[1] = element)}
            className={
              isCardSelected("footer")
                ? `template-section-card active `
                : isCardHoveredOn("footer")
                ? `template-section-card hover`
                : "template-section-card"
            }
            style={{
              scrollMarginTop: 32, // so it doesn’t hug the top edge
            }}
          >
            <Card
              hoverable
              onClick={() => {
                setSelectedHeaderFooterIndex("footer");
                setSelectedSectionIndex(null);
              }}
            >
              {renderHeaderFooterContent(generatedTemplate.footer)}
            </Card>
          </div>
        </div>

        {/* TEMPLATE SECTIONS */}
        <Flex vertical>
          {generatedTemplate.sections.map((section, index) => (
            <div
              key={index}
              ref={(element) => (sectionRefs.current[index] = element)}
              className={
                isCardSelected(index)
                  ? `template-section-card active `
                  : isCardHoveredOn(index)
                  ? `template-section-card hover`
                  : "template-section-card"
              }
              style={{
                scrollMarginTop: 32, // so it doesn’t hug the top edge
              }}
            >
              <Card
                hoverable
                onClick={() => {
                  setSelectedSectionIndex(index);
                  setSelectedHeaderFooterIndex(null);
                }}
              >
                {renderSectionContent(section)}
              </Card>
            </div>
          ))}
        </Flex>
      </Flex>
    </Card>
  );
};

export default TemplatePreview;
