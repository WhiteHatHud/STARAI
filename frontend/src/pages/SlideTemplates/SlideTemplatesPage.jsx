import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
} from "react";
import axios from "axios";

import { Flex, Typography, message, Row, Col, Space } from "antd";
import { LayoutOutlined } from "@ant-design/icons";
import { generateSampleData } from "../../utils/sampleDataGenerator";
import { calculateScale } from "../../utils/slideUtils";
import TemplateLoader from "../../components/TemplateLoader";
import { TemplatePreviewModal } from "../../components/MySlides/TemplatePreviewModal";

const { Title, Text } = Typography;
export const SlideTemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [scale, setScale] = useState(1);
  const [messageApi, contextHolder] = message.useMessage();
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [selectedTemplateID, setSelectedTemplateID] = useState("");
  const sampleData = generateSampleData();
  const colRef = useRef();
  const colGap = 16;

  const handleClosePreviewModal = () => {
    setIsOpenModal(false);
    setSelectedTemplateID("");
  };

  const fetchTemplates = useCallback(async () => {
    try {
      messageApi.destroy();
      messageApi.open({
        type: "loading",
        content: "Loading slide templates...",
        duration: 0,
      });
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/slides/templates`
      );
      // Handle the response data
      if (response.status === 200) {
        setTemplates(response.data.templates);
        messageApi.destroy();
        messageApi.open({
          type: "success",
          content: "Slide templates loaded successfully!",
        });
      }
    } catch (error) {
      console.error("Error fetching slide templates:", error);
      messageApi.destroy();
      messageApi.open({
        type: "error",
        content: "Failed to load slide templates. Please try again later.",
      });
    }
  }, [messageApi]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const updateScale = useCallback(() => {
    if (!colRef.current) return;
    const colWidth = colRef.current.clientWidth - colGap;
    const newScale = calculateScale(colWidth);
    setScale(newScale);
  }, []);

  useLayoutEffect(() => {
    if (templates.length > 0 && colRef.current) {
      const resizeObserver = new ResizeObserver(() => updateScale());
      resizeObserver.observe(colRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [templates, updateScale]);

  const handleOpenPreviewModal = (templateID) => {
    setIsOpenModal(true);
    setSelectedTemplateID(templateID);
  };

  return (
    <Flex vertical gap="middle" style={{ padding: "0px 24px" }}>
      {contextHolder}
      <Title level={3}>
        <LayoutOutlined /> Slide Templates
      </Title>

      {/* Template Card Grid */}
      {templates.length > 0 && (
        <Row gutter={[colGap, 16]}>
          {templates.map((template, index) => (
            <Col
              key={template.templateID}
              xs={24}
              sm={24}
              md={12}
              lg={12}
              xl={8}
              ref={index === 0 ? colRef : null}
            >
              <Space
                direction="vertical"
                size="small"
                style={{ height: "auto" }}
              >
                <Text type="secondary" style={{ fontSize: 20 }}>
                  {template.templateName}
                </Text>
                <div
                  className="template-preview-wrapper"
                  style={{
                    width: `${1280 * scale}px`,
                    height: `${720 * scale}px`,
                  }}
                  onClick={() => handleOpenPreviewModal(template.templateID)}
                >
                  <TemplateLoader
                    key={`${template.templateID}-${scale}`}
                    layoutId={template.layouts[0].layoutId}
                    data={sampleData}
                    scale={scale}
                  />
                </div>
              </Space>
            </Col>
          ))}
        </Row>
      )}
      {/* Template Preview Modal */}
      {selectedTemplateID !== "" && (
        <TemplatePreviewModal
          isOpenModal={isOpenModal}
          templateID={selectedTemplateID}
          onClose={handleClosePreviewModal}
        />
      )}
    </Flex>
  );
};
