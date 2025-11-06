import { Card, Flex, Space, Typography, Tag } from "antd";
const { Title, Paragraph, Text } = Typography;

const VALUE_COLOR_MAP = {
  // element types
  horizontal_rule: "magenta",
  title: "geekblue",
  text: "blue",
  list: "gold",
  table: "purple",
  // header/footer types
  header: "geekblue",
  footer: "purple",
  // formatting (same group)
  bold: "volcano",
  italic: "volcano",
  underline: "volcano",
  strikethrough: "volcano",
  // alignment (same group)
  center: "cyan",
  right: "cyan",
  // semantic none
  none: "default",
};

const getTagColor = (val) => {
  const c = VALUE_COLOR_MAP[val];
  // Ant Design treats undefined as default grey; avoid passing "default"
  return c === "default" ? undefined : c;
};

export function TemplateViewer({
  themeToken,
  generatedTemplate,
  setSelectedSectionIndex,
  setSelectedHeaderFooterIndex,
  setHoveredHeaderFooterIndex,
  setHoveredSectionIndex,
}) {
  return (
    <Card
      className="template-viewer-pane"
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Flex vertical gap="middle">
        <Space direction="vertical" size="small">
          {/* TEMPLATE META DATA */}
          <Title level={4}>Template info</Title>
          <Card
            styles={{
              body: { backgroundColor: themeToken.colorBgElevated },
            }}
          >
            <Space direction="vertical" size="small">
              <Title
                level={4}
                ellipsis={{
                  rows: 2,
                  tooltip: generatedTemplate.report_metadata.report_type,
                }}
              >
                {generatedTemplate.report_metadata.report_type}
              </Title>
              <Paragraph
                type="secondary"
                ellipsis={{
                  rows: 3,
                  tooltip: generatedTemplate.report_metadata.primary_focus,
                }}
              >
                {generatedTemplate.report_metadata.primary_focus}
              </Paragraph>
            </Space>
          </Card>
        </Space>

        {/* HEADER & FOOTER */}
        <Space direction="vertical" size="small">
          <Title level={4}>Header & Footer</Title>
          <div className="template-viewer-header" key={0}>
            <Card
              key={0}
              title={
                <span>
                  <Tag color="geekblue">header</Tag>
                  Header
                </span>
              }
              hoverable
              size="small"
              onClick={() => {
                setSelectedSectionIndex(null);
                setSelectedHeaderFooterIndex("header");
              }}
              onMouseEnter={() => setHoveredHeaderFooterIndex("header")}
              onMouseLeave={() => setHoveredHeaderFooterIndex(null)}
            >
              <Card.Grid
                className="section-grid"
                style={{
                  width: "50%",
                  padding: 8,
                }}
                hoverable={false}
              >
                <Flex vertical>
                  <Text strong>Type</Text>
                  <Text>{generatedTemplate.header?.type || "none"}</Text>
                </Flex>
              </Card.Grid>
              <Card.Grid
                className="section-grid"
                style={{
                  width: "50%",
                  padding: 8,
                }}
                hoverable={false}
              >
                <Flex vertical>
                  <Text strong>Formatting</Text>
                  <Space wrap>
                    {generatedTemplate.header?.text_formatting?.length === 0 ||
                    !generatedTemplate.header?.text_formatting ? (
                      <Tag color={getTagColor("none")}>none</Tag>
                    ) : (
                      generatedTemplate.header?.text_formatting.map(
                        (format, idx) => (
                          <Tag key={idx} color={getTagColor(format)}>
                            {format}
                          </Tag>
                        )
                      )
                    )}
                  </Space>
                </Flex>
              </Card.Grid>
            </Card>
          </div>

          <div className="template-viewer-footer" key={1}>
            <Card
              key={1}
              title={
                <span>
                  <Tag color="purple">footer</Tag>
                  Footer
                </span>
              }
              hoverable
              size="small"
              onClick={() => {
                setSelectedSectionIndex(null);
                setSelectedHeaderFooterIndex("footer");
              }}
              onMouseEnter={() => setHoveredHeaderFooterIndex("footer")}
              onMouseLeave={() => setHoveredHeaderFooterIndex(null)}
            >
              <Card.Grid
                className="section-grid"
                style={{
                  width: "50%",
                  padding: 8,
                }}
                hoverable={false}
              >
                <Flex vertical>
                  <Text strong>Type</Text>
                  <Text>{generatedTemplate.footer?.type || "none"}</Text>
                </Flex>
              </Card.Grid>
              <Card.Grid
                className="section-grid"
                style={{
                  width: "50%",
                  padding: 8,
                }}
                hoverable={false}
              >
                <Flex vertical>
                  <Text strong>Formatting</Text>
                  <Space wrap>
                    {generatedTemplate.footer?.text_formatting?.length === 0 ||
                    !generatedTemplate.footer?.text_formatting ? (
                      <Tag color={getTagColor("none")}>none</Tag>
                    ) : (
                      generatedTemplate.footer?.text_formatting.map(
                        (format, idx) => (
                          <Tag key={idx} color={getTagColor(format)}>
                            {format}
                          </Tag>
                        )
                      )
                    )}
                  </Space>
                </Flex>
              </Card.Grid>
            </Card>
          </div>
        </Space>

        {/* TEMPLATE SECTIONS */}
        <Space direction="vertical" size="small">
          <Title level={4}>Template sections</Title>
          <Flex
            vertical
            gap="small"
            style={{ paddingTop: 8, maxHeight: "50vh", overflowY: "auto" }}
          >
            {generatedTemplate.sections.map((section, index) => (
              <div className="template-viewer-section" key={index + 2}>
                <Card
                  key={index + 2}
                  title={
                    <span>
                      <Tag color={getTagColor(section.element_type)}>
                        {section.element_type}
                      </Tag>
                      {section.title}
                    </span>
                  }
                  hoverable
                  size="small"
                  onClick={() => {
                    setSelectedSectionIndex(index);
                    setSelectedHeaderFooterIndex(null);
                  }}
                  onMouseEnter={() => setHoveredSectionIndex(index)}
                  onMouseLeave={() => setHoveredSectionIndex(null)}
                >
                  {/* SECTION DESCRIPTION */}
                  <Card.Grid
                    className="section-grid"
                    style={{
                      width: "100%",
                      padding: 8,
                    }}
                    hoverable={false}
                  >
                    <Flex vertical>
                      <Text strong>Description</Text>
                      <Text type="secondary">{section.description}</Text>
                    </Flex>
                  </Card.Grid>
                  {/* SECTION MAX WORD */}
                  <Card.Grid
                    className="section-grid"
                    style={{
                      width: "50%",
                      padding: 8,
                    }}
                    hoverable={false}
                  >
                    <Flex vertical>
                      <Text strong>Max words</Text>
                      <Text>{section.max_words}</Text>
                    </Flex>
                  </Card.Grid>
                  {/* SECTION TEXT FORMATTING */}
                  <Card.Grid
                    className="section-grid"
                    style={{
                      width: "50%",
                      padding: 8,
                    }}
                    hoverable={false}
                  >
                    <Flex vertical>
                      <Text strong>Text formatting</Text>
                      <Space wrap>
                        {section.text_formatting.length === 0 ? (
                          <Tag color={getTagColor("none")}>none</Tag>
                        ) : (
                          section.text_formatting.map((format, idx) => (
                            <Tag key={idx} color={getTagColor(format)}>
                              {format}
                            </Tag>
                          ))
                        )}
                      </Space>
                    </Flex>
                  </Card.Grid>
                </Card>
              </div>
            ))}
          </Flex>
        </Space>
      </Flex>
    </Card>
  );
}
