import { Modal, Button, Typography, Space } from "antd";
import { CheckOutlined } from "@ant-design/icons";

const { Title } = Typography;

export default function ComparisonModal({
  visible,
  onConfirm,
  onCancel,
  sectionTitle,
  originalContent,
  regeneratedContent,
  isDarkMode = false,
  loading = false,
}) {
  const contentStyle = {
    maxHeight: "400px",
    overflow: "auto",
    padding: "16px",
    border: isDarkMode ? "1px solid #434343" : "1px solid #d9d9d9",
    borderRadius: "6px",
    backgroundColor: isDarkMode ? "#1f1f1f" : "#fafafa",
    color: isDarkMode ? "#ffffff" : "#000000",
    lineHeight: "1.6",
    whiteSpace: "pre-wrap",
  };

  return (
    <Modal
      title={`Review: ${sectionTitle}`}
      open={visible}
      onCancel={onCancel}
      width={1000}
      centered
      footer={
        <Space>
          <Button onClick={onCancel} disabled={loading}>
            Keep Original
          </Button>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={onConfirm}
            loading={loading}
          >
            Use New Content
          </Button>
        </Space>
      }
      destroyOnClose
    >
      <div style={{ display: "flex", gap: "24px" }}>
        {/* Original Content */}
        <div style={{ flex: 1 }}>
          <Title level={5} style={{ color: "#ff4d4f", marginBottom: "12px" }}>
            Original
          </Title>
          <div style={contentStyle}>{originalContent}</div>
        </div>

        {/* Regenerated Content */}
        <div style={{ flex: 1 }}>
          <Title level={5} style={{ color: "#52c41a", marginBottom: "12px" }}>
            Regenerated
          </Title>
          <div style={contentStyle}>{regeneratedContent}</div>
        </div>
      </div>
    </Modal>
  );
}
