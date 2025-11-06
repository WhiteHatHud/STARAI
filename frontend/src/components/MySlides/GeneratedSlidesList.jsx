import { Row, Col, Card, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;
export function GeneratedSlidesList({ setCurrentCase, navigate }) {
  return (
    <Row gutter={[16, 16]}>
      {/* TODO: Populate with real generated slides */}
      <Col sm={24} md={12} lg={8} xl={6}>
        <Card title="Slide 1" style={{ height: "100%" }}>
          <p>Slide 1 content</p>
        </Card>
      </Col>
      <Col sm={24} md={12} lg={8} xl={6}>
        <Card title="Slide 2" style={{ height: "100%" }}>
          <p>Slide 2 content</p>
        </Card>
      </Col>
      <Col sm={24} md={12} lg={8} xl={6}>
        <Card title="Slide 3" style={{ height: "100%" }}>
          <p>Slide 3 content</p>
        </Card>
      </Col>
      <Col sm={24} md={12} lg={8} xl={6}>
        <Card title="Slide 4" style={{ height: "100%" }}>
          <p>Slide 4 content</p>
        </Card>
      </Col>

      {/* CREATE NEW PRESENTATION CARD */}
      <Col sm={24} md={12} lg={8} xl={6}>
        <Card
          bordered={false}
          className="create-new-presentation-card"
          onClick={() => {
            setCurrentCase(null);
            navigate("/slides/create");
          }}
        >
          <Space direction="vertical" align="center">
            <PlusOutlined
              style={{ fontSize: 24 }}
              className="create-new-presentation-card"
            />
            <Title level={4} type="secondary" style={{ margin: 0 }}>
              Create New Presentation
            </Title>
            <Text type="secondary">
              Start from scratch or upload a file to create a new custom
              presentation.
            </Text>
          </Space>
        </Card>
      </Col>
    </Row>
  );
}
