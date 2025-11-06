import {
  useCallback,
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import axios from "axios";
import useStore from "../../store";
import { useNavigate } from "react-router-dom";

import { Modal, Flex, Button, Typography, Space } from "antd";
import TemplateLoader from "../../components/TemplateLoader";
import { generateSampleData } from "../../utils/sampleDataGenerator";
import { calculateScale } from "../../utils/slideUtils";

const { Title, Text } = Typography;
export const TemplatePreviewModal = ({ isOpenModal, templateID, onClose }) => {
  const { token } = useStore();
  const navigate = useNavigate();
  const { setSelectedSlideTemplateId } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [templateData, setTemplateData] = useState(null);
  const [scale, setScale] = useState(1);
  const sampleData = generateSampleData();
  const colRef = useRef();

  const fetchTemplateDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/slides/layouts/${templateID}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 200) setTemplateData(response.data);
    } catch (error) {
      console.error("Error fetching template details:", error);
    } finally {
      setIsLoading(false);
    }
  }, [templateID, token]);

  useEffect(() => {
    if (!isOpenModal) return;

    fetchTemplateDetails();
  }, [fetchTemplateDetails, isOpenModal]);

  useEffect(() => {
    if (!isOpenModal) {
      setTemplateData(null);
    }
  }, [isOpenModal]);

  const updateScale = useCallback(() => {
    if (!colRef.current) return;
    const colWidth = colRef.current.clientWidth;
    const newScale = calculateScale(colWidth);
    setScale(newScale);
  }, []);

  useLayoutEffect(() => {
    if (
      templateData &&
      templateData.layouts &&
      templateData.layouts.length > 0 &&
      colRef.current
    ) {
      const resizeObserver = new ResizeObserver(() => updateScale());
      resizeObserver.observe(colRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [templateData, updateScale]);

  return (
    <Modal
      open={isOpenModal}
      onCancel={onClose}
      loading={isLoading}
      title={`Preview of the ${templateID} template`}
      footer={null}
      width={"100%"}
      style={{ top: 20 }}
    >
      <Flex style={{ width: "100%" }}>
        {/* Left Panel */}
        <Flex
          vertical
          gap="middle"
          style={{
            width: "80%",
            maxHeight: "87vh",
            overflowY: "scroll",
            overflowX: "hidden",
            background: "#1e1e1e",
          }}
        >
          <Flex
            vertical
            style={{ maxWidth: "80%", margin: "auto" }}
            ref={colRef}
          >
            {templateData &&
              templateData.layouts &&
              templateData.layouts.length > 0 &&
              templateData.layouts.map((layout) => (
                <Space
                  key={layout.layoutId}
                  direction="vertical"
                  size="small"
                  style={{ height: "auto" }}
                >
                  <Text
                    type="secondary"
                    style={{ fontSize: 20, color: "white" }}
                  >
                    {layout.layoutName}
                  </Text>
                  <div
                    style={{
                      width: `${1280 * scale}px`,
                      height: `${720 * scale}px`,
                    }}
                  >
                    <TemplateLoader
                      key={`${layout.layoutId}-${scale}`}
                      layoutId={layout.layoutId}
                      data={sampleData}
                      scale={scale}
                    />
                  </div>
                </Space>
              ))}
          </Flex>
        </Flex>
        {/* Right Panel */}
        <Flex
          vertical
          gap="middle"
          style={{ width: "20%", padding: "0px 16px" }}
        >
          {/* Generate Button */}
          <Button
            type="primary"
            size="large"
            shape="round"
            block
            onClick={() => {
              setSelectedSlideTemplateId(templateID);
              navigate("/slides");
            }}
          >
            Generate Slides
          </Button>

          {/* Theme Selection */}
          <Title level={4} style={{ margin: 0 }}>
            Select Theme (WIP)
          </Title>
        </Flex>
      </Flex>
    </Modal>
  );
};
