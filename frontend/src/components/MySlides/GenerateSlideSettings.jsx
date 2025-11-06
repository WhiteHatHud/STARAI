import {
  Flex,
  Space,
  Typography,
  Card,
  Collapse,
  Select,
  message,
  List,
  Image,
} from "antd";
import {
  AlignLeftOutlined,
  GroupOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { generateSampleData } from "../../utils/sampleDataGenerator";
import { calculateScale } from "../../utils/slideUtils";
import TemplateLoader from "../../components/TemplateLoader";
import "./GenerateSlideSettings.css";
import useStore from "../../store";

const { Title, Text } = Typography;

export const GenerateSlideSettings = ({
  settings,
  setSettings,
  selectedTemplate,
  setSelectedTemplate,
}) => {
  const { collapsed } = useStore();
  const [templates, setTemplates] = useState([]);
  const [scale, setScale] = useState(0.15);
  const [messageApi, contextHolder] = message.useMessage();
  const sampleData = generateSampleData();
  const containerRef = useRef();

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/slides/templates`
      );
      // Handle the response data
      if (response.status === 200) {
        setTemplates(response.data.templates);
        if (selectedTemplate === "" && response.data.templates.length > 0)
          setSelectedTemplate(response.data.templates[0].templateID);
      }
    } catch (error) {
      console.error("Error fetching slide templates:", error);
      messageApi.destroy();
      messageApi.open({
        type: "error",
        content: "Failed to load slide templates. Please try again later.",
      });
    }
  }, [messageApi, selectedTemplate, setSelectedTemplate]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 16;
    const newScale = calculateScale(containerWidth);
    setScale(newScale);
  }, []);

  useLayoutEffect(() => {
    if (templates.length > 0 && containerRef.current) {
      const resizeObserver = new ResizeObserver(() => updateScale());
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [templates, updateScale]);
  return (
    <Flex style={{ width: "30%" }} justify="center">
      {contextHolder}
      <Space direction="vertical" style={{ width: "100%" }}>
        <Text type="secondary">Settings</Text>
        <Card styles={{ body: { width: "100%", padding: 8 } }}>
          <Collapse
            defaultActiveKey={["1", "2", "3"]}
            ghost
            items={[
              {
                key: "1",
                label: (
                  <Space size="middle">
                    <AlignLeftOutlined style={{ fontSize: 16 }} />
                    <Title level={5} style={{ margin: 0 }}>
                      Text Content
                    </Title>
                  </Space>
                ),
                children: (
                  <Flex vertical gap="middle">
                    {/* Tone Setting */}
                    <Space direction="vertical" size="small">
                      <Text strong>Tone</Text>
                      <Select
                        value={settings.tone}
                        style={{ width: "100%" }}
                        onSelect={(value) =>
                          setSettings((prev) => ({ ...prev, tone: value }))
                        }
                        options={[
                          {
                            label: "Default",
                            value: "default",
                          },
                          {
                            label: "Casual",
                            value: "casual",
                          },
                          {
                            label: "Professional",
                            value: "professional",
                          },
                          {
                            label: "Funny",
                            value: "funny",
                          },
                          {
                            label: "Educational",
                            value: "educational",
                          },
                          {
                            label: "Sales Pitch",
                            value: "sales_pitch",
                          },
                        ]}
                      />
                    </Space>
                    {/* Verbosity Setting */}
                    <Space direction="vertical" size="small">
                      <Text strong>Verbosity</Text>
                      <Select
                        value={settings.verbosity}
                        style={{ width: "100%" }}
                        onSelect={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            verbosity: value,
                          }))
                        }
                        options={[
                          { label: "Concise", value: "concise" },
                          { label: "Standard", value: "standard" },
                          { label: "Heavy", value: "heavy" },
                        ]}
                      />
                    </Space>
                  </Flex>
                ),
              },
              {
                key: "2",
                forceRender: true,
                label: (
                  <Space size="middle">
                    <GroupOutlined style={{ fontSize: 16 }} />
                    <Title level={5} style={{ margin: 0 }}>
                      Slide Layout
                    </Title>
                  </Space>
                ),
                children: (
                  <Flex vertical gap="middle">
                    {/* Template Card Grid */}
                    {templates.length > 0 && (
                      <List
                        grid={{
                          gutter: 8,
                          xs: 1,
                          sm: 1,
                          md: 1,
                          lg: 1,
                          xl: 1,
                          xxl: 2,
                        }}
                        dataSource={templates}
                        renderItem={(template, index) => (
                          <List.Item
                            key={template.templateID}
                            onClick={() =>
                              setSelectedTemplate(template.templateID)
                            }
                          >
                            <div
                              className={
                                template.templateID === selectedTemplate
                                  ? "template-selector selected"
                                  : "template-selector"
                              }
                              ref={index === 0 ? containerRef : null}
                            >
                              <div
                                style={{
                                  width: `${1280 * scale}px`,
                                  height: `${720 * scale}px`,
                                }}
                              >
                                <TemplateLoader
                                  key={`${template.templateID}-${scale}`}
                                  layoutId={template.layouts[0].layoutId}
                                  data={sampleData}
                                  scale={scale}
                                />
                              </div>
                              <Text className="template-name">
                                {template.templateName}
                              </Text>
                            </div>
                          </List.Item>
                        )}
                      />
                    )}
                  </Flex>
                ),
              },
              {
                key: "3",
                label: (
                  <Space size="middle">
                    <PictureOutlined style={{ fontSize: 16 }} />
                    <Title level={5} style={{ margin: 0 }}>
                      Visuals
                    </Title>
                  </Space>
                ),
                children: (
                  <List
                    grid={{
                      gutter: 16,
                      xs: 1,
                      sm: 2,
                      md: 2,
                      lg: 3,
                      xl: 4,
                      xxl: 5,
                    }}
                    dataSource={[
                      {
                        label: "Photorealistic",
                        value: "photorealistic",
                        src: "https://gamma.app/_next/static/media/photorealistic.5dc010df.jpg",
                      },
                      {
                        label: "Illustration",
                        value: "illustration",
                        src: "https://gamma.app/_next/static/media/illustration.10c4634f.jpg",
                      },
                      {
                        label: "Abstract",
                        value: "abstract",
                        src: "https://gamma.app/_next/static/media/abstract.51cf782d.jpg",
                      },
                      {
                        label: "3D",
                        value: "3d",
                        src: "https://gamma.app/_next/static/media/3D.99f31e2b.jpg",
                      },
                      {
                        label: "Line Art",
                        value: "line_art",
                        src: "https://gamma.app/_next/static/media/line-art.29089953.jpg",
                      },
                    ]}
                    renderItem={(item) => (
                      <List.Item key={item.value}>
                        <Space
                          direction="vertical"
                          size="none"
                          style={{ maxWidth: collapsed ? 75 : 65 }}
                        >
                          <div
                            className={
                              item.value === settings.visual_style
                                ? "visual-style-item selected"
                                : "visual-style-item"
                            }
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                visual_style: item.value,
                              }))
                            }
                          >
                            <Image
                              src={item.src}
                              alt={item.label}
                              preview={false}
                              width={collapsed ? 75 : 65}
                              height={collapsed ? 75 : 65}
                              style={{
                                borderRadius: "8px",
                                border: "1px solid #1e1e1e",
                                objectFit: "cover",
                              }}
                            />
                          </div>
                          <Text strong ellipsis={{ tooltip: item.label }}>
                            {item.label}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                ),
              },
            ]}
            className="outline-settings-collapse"
            expandIconPosition="end"
          />
        </Card>
      </Space>
    </Flex>
  );
};
