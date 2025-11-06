import {
  Card,
  Tag,
  Divider,
  Button,
  Flex,
  Dropdown,
  Typography,
  Space,
} from "antd";
import {
  ProfileOutlined,
  ArrowRightOutlined,
  EllipsisOutlined,
  ShareAltOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

const { Title } = Typography;
const TemplateCard = ({
  setSelectedTemplate,
  template,
  onSelect,
  onTogglePublic,
  onShareCode,
  onDelete,
  onGenerate,
}) => {
  const dropdownOptions = [
    {
      key: "1",
      label: "Share",
      icon: <ShareAltOutlined />,
      onClick: (e) => onShareCode(template, e),
    },
    {
      key: "2",
      label: "Delete",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: (e) => onDelete(template, e),
    },
  ];

  return (
    <Card
      hoverable
      onClick={(e) => {
        e.stopPropagation();
        onSelect(template, true);
      }}
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
            <ProfileOutlined className="template-card-icon" />
            <Tag
              color={template.isPublic ? "green" : "default"}
              className="template-card-tag"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePublic(template);
              }}
            >
              {template.isPublic ? "Public" : "Private"}
            </Tag>
          </Space>
          <Dropdown menu={{ items: dropdownOptions }} trigger={["click"]}>
            <Button
              type="text"
              shape="circle"
              icon={<EllipsisOutlined style={{ fontSize: 20 }} />}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
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
        <Space direction="vertical">
          <Divider />
          <Flex justify="flex-end" align="center" gap="small">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(template, true);
              }}
            >
              Edit
            </Button>
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              iconPosition="end"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTemplate({
                  template_name: template.template_name,
                  isPublic: false,
                });
                onGenerate();
              }}
            >
              Generate
            </Button>
          </Flex>
        </Space>
      </Flex>
    </Card>
  );
};

export default TemplateCard;
