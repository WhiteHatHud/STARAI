import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Flex,
  Select,
  Input,
  Typography,
  Button,
  Tooltip,
  Modal,
  Space,
  Switch,
  message,
} from "antd";
import {
  ArrowRightOutlined,
  ControlOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import useStore from "../../store";
import { DocumentSelector } from "../../components/MySlides/DocumentSelector";

const { TextArea } = Input;
const { Title, Text } = Typography;

const MAX_SLIDES = 10;

// SELECTOR OPTIONS
const numOfSlidesOptions = Array.from({ length: MAX_SLIDES }, (_, i) => ({
  label: i === 0 ? `1 slide` : `${(i + 1).toString()} slides`,
  value: (i + 1).toString(),
}));
const toneOptions = [
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
];
const verbosityOptions = [
  { label: "Concise", value: "concise" },
  { label: "Standard", value: "standard" },
  { label: "Text-Heavy", value: "text-heavy" },
];

export const SlideCreatePage = () => {
  const { setPresentationId, token } = useStore();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [slideConfigurations, setSlideConfigurations] = useState({
    slides: "8",
    language: "English",
    prompt: "",
    tone: "default",
    verbosity: "standard",
    instructions: "",
    includeTableOfContents: false,
    includeTitleSlide: false,
    webSearch: false,
  });
  const canIncludeTableOfContent = parseInt(slideConfigurations.slides) >= 3;
  const [selectedDocuments, setSelectedDocuments] = useState([]);

  const getPresentationId = async (requestBody) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/slides/create`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.id;
    } catch (error) {
      console.error("error in presentation creation", error);
      throw error;
    }
  };

  const handleNextButton = async () => {
    // Validate final body request before making API call
    if (slideConfigurations.prompt.trim() === "") {
      messageApi.open({
        type: "warning",
        content: "Please enter a prompt for your presentation",
      });
      return;
    }

    const bodyRequest = {
      content: slideConfigurations.prompt.trim(),
      n_slides: parseInt(slideConfigurations.slides),
      file_paths: selectedDocuments || [],
      language: slideConfigurations.language,
      tone: slideConfigurations.tone,
      verbosity: slideConfigurations.verbosity,
      instructions: slideConfigurations.instructions || null,
      include_table_of_contents: slideConfigurations.includeTableOfContents,
      include_title_slide: slideConfigurations.includeTitleSlide,
      web_search: slideConfigurations.webSearch,
    };

    const presentationId = await getPresentationId(bodyRequest);
    setPresentationId(presentationId);
    navigate("/slides/outlines");
  };

  return (
    <Flex
      vertical
      gap="middle"
      justify="center"
      style={{ maxWidth: "80%", margin: "0 auto" }}
    >
      {/* GENERATE BY PROMPT */}
      {contextHolder}
      <Title level={3}>Generate by prompt</Title>
      <Flex justify="flex-end" gap="small">
        <Select
          value={slideConfigurations.slides}
          style={{ width: 200 }}
          options={numOfSlidesOptions}
          placeholder="Select number of slides"
          onSelect={(value) =>
            setSlideConfigurations((prev) => ({
              ...prev,
              slides: value,
              includeTableOfContents:
                parseInt(value) >= 3 ? prev.includeTableOfContents : false,
            }))
          }
        />
        <Tooltip title="View advanced settings">
          <Button
            shape="round"
            icon={<ControlOutlined style={{ fontSize: 20 }} />}
            onClick={() => setIsModalOpen((prev) => !prev)}
          >
            Advanced Settings
          </Button>
        </Tooltip>
      </Flex>
      {/* SLIDE GENERATION PROMPT */}
      <TextArea
        rows={4}
        placeholder="Tell us about your presentation"
        onChange={(e) =>
          setSlideConfigurations((prev) => ({
            ...prev,
            prompt: e.target.value,
          }))
        }
      />

      {/* DOCUMENT SELECTOR */}
      <DocumentSelector
        selectedDocuments={selectedDocuments}
        setSelectedDocuments={setSelectedDocuments}
      />

      {/* Submit Button */}
      <Button
        type="primary"
        shape="round"
        size="large"
        icon={<ArrowRightOutlined />}
        iconPosition="end"
        onClick={handleNextButton}
      >
        Next
      </Button>

      {/* Advanced Settings Modal */}
      <Modal
        title="Advanced Settings"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => setIsModalOpen(false)}
      >
        <Flex vertical gap="middle" style={{ marginBottom: 24 }}>
          <Flex justify="center" align="center" gap="middle">
            <Flex vertical style={{ width: "50%" }} gap="middle">
              {/* TONE SETTINGS */}
              <Space direction="vertical">
                <Space>
                  <Text strong>Tone</Text>
                  <Tooltip title="Defines the “voice” of your presentation text">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </Space>
                <Select
                  value={slideConfigurations.tone}
                  style={{ width: "100%" }}
                  options={toneOptions}
                  placeholder="Select tone"
                  onSelect={(value) =>
                    setSlideConfigurations((prev) => ({
                      ...prev,
                      tone: value,
                    }))
                  }
                />
              </Space>

              {/* TABLE OF CONTENT SETTINGS */}
              <Space direction="vertical" size={0}>
                <Flex align="center" justify="space-between">
                  <Text strong>Include table of contents</Text>
                  <Tooltip title="Number of slides must be at least 3">
                    <Switch
                      checked={
                        canIncludeTableOfContent
                          ? slideConfigurations.includeTableOfContents
                          : false
                      }
                      disabled={!canIncludeTableOfContent}
                      size="small"
                      onChange={(checked) => {
                        setSlideConfigurations((prev) => ({
                          ...prev,
                          includeTableOfContents: canIncludeTableOfContent
                            ? checked
                            : false,
                        }));
                      }}
                    />
                  </Tooltip>
                </Flex>
                <Text type="secondary">Add a slide summarizing sections</Text>
              </Space>
            </Flex>
            <Flex vertical style={{ width: "50%" }} gap="middle">
              {/* VERBOSITY SETTINGS */}
              <Space direction="vertical">
                <Space>
                  <Text strong>Verbosity</Text>
                  <Tooltip title="Controls how much detail the generated text contains">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </Space>
                <Select
                  value={slideConfigurations.verbosity}
                  style={{ width: "100%" }}
                  options={verbosityOptions}
                  placeholder="Select verbosity"
                  onSelect={(value) =>
                    setSlideConfigurations((prev) => ({
                      ...prev,
                      verbosity: value,
                    }))
                  }
                />
              </Space>

              {/* TITLE SLIDE SETTINGS */}
              <Space direction="vertical" size={0}>
                <Flex align="center" justify="space-between">
                  <Text strong>Title slide</Text>
                  <Switch
                    checked={slideConfigurations.titleSlide}
                    size="small"
                    onChange={(checked, event) =>
                      setSlideConfigurations((prev) => ({
                        ...prev,
                        titleSlide: checked,
                      }))
                    }
                  />
                </Flex>
                <Text type="secondary">
                  Include a title slide as the first slide
                </Text>
              </Space>
            </Flex>
          </Flex>
          {/* WEB SEARCH SETTINGS */}
          <Space direction="vertical" size={0} style={{ width: "48%" }}>
            <Flex align="center" justify="space-between">
              <Text strong>Web search</Text>
              <Switch
                checked={slideConfigurations.webSearch}
                size="small"
                onChange={(checked, event) =>
                  setSlideConfigurations((prev) => ({
                    ...prev,
                    webSearch: checked,
                  }))
                }
              />
            </Flex>
            <Text type="secondary">
              Allow the model to consult the web for fresher facts
            </Text>
          </Space>
        </Flex>
      </Modal>
    </Flex>
  );
};
