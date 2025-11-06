import { Card, Tag, Divider, Button, Flex, Typography, Space } from "antd";
import { GlobalOutlined, ArrowRightOutlined } from "@ant-design/icons";

const { Title } = Typography;
const PublicTemplateCard = ({
  setSelectedTemplate,
  template,
  onView,
  onGenerate,
}) => {
  return (
    <Card
      hoverable
      onClick={() => onView(template)}
      style={{ height: "100%" }}
      styles={{ body: { height: "100%" } }}
    >
      <Flex
        vertical
        justify="space-between"
        gap="middle"
        style={{ height: "100%" }}
      >
        {/* HEADER */}
        <Flex justify="space-between" align="center">
          <Space>
            <GlobalOutlined className="template-card-icon-public" />
          </Space>
        </Flex>
        {/* BODY */}
        <Space direction="vertical">
          <Title
            level={4}
            style={{ margin: 0 }}
            ellipsis={{
              rows: 2,
              tooltip: template.report_metadata?.report_type,
            }}
          >
            {template.report_metadata?.report_type}
          </Title>
          <Typography.Paragraph
            type="secondary"
            ellipsis={{
              rows: 2,
              tooltip: template.report_metadata?.primary_focus,
            }}
            style={{ margin: 0 }}
          >
            {template.report_metadata?.primary_focus}
          </Typography.Paragraph>
          <Tag style={{ borderRadius: 24 }}>
            {template.report_metadata?.sections_count} Sections
          </Tag>
        </Space>
        {/* FOOTER */}
        <Divider />
        <Flex justify="flex-end" align="center" gap="small">
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            iconPosition="end"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTemplate({
                template_name: template.template_identifier,
                isPublic: true,
              });
              onGenerate();
            }}
          >
            Generate
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
};

export default PublicTemplateCard;
