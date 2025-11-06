import { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import {
  Flex,
  Typography,
  Spin,
  Space,
  Alert,
  Button,
  message,
  Card,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import "./SlideOutlinesPage.css";

import useStore from "../../store";
import { useOutlineStreaming } from "../../hooks/useOutlineStreaming";
import { stripMarkdownText } from "../../utils";
import { OutlineItem } from "../../components/MySlides/OutlineItem";
import { BackButton } from "../../components/global";
import { GenerateSlideSettings } from "../../components/MySlides/GenerateSlideSettings";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { loadTemplate } from "../../presentation_templates/templateRegistry";

const { Title, Text } = Typography;

export const SlideOutlinesPage = () => {
  const {
    presentationId,
    setFooterContent,
    token,
    selectedSlideTemplateId,
    setSelectedSlideTemplateId,
  } = useStore();
  const navigate = useNavigate();
  const [activeSlideIndex, setActiveSlideIndex] = useState(null);
  const [highestActiveIndex, setHighestActiveIndex] = useState(-1);
  const [streamingOutlines, setStreamingOutlines] = useState([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [editedOutline, setEditedOutline] = useState(null);
  const [originalOutline, setOriginalOutline] = useState(null);
  const [settings, setSettings] = useState({ visual_style: "photorealistic" });
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(
    selectedSlideTemplateId ?? ""
  );

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1,
      },
    })
  );

  // Use the streaming hook
  const { isStreaming, isLoading, status, rawContent, outlines } =
    useOutlineStreaming(presentationId);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoadingSettings(true);
      const response = await axios.get(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/slides/presentation/${presentationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        const { tone, verbosity, title } = response.data;
        const cleanTitle = stripMarkdownText(title);
        setSettings((prev) => ({
          ...prev,
          tone,
          verbosity,
          title: cleanTitle,
        }));
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoadingSettings(false);
    }
  }, [presentationId, token]);

  const handleSubmit = useCallback(async () => {
    let canGenerateSlides = true; // If any update fails, don't allow slide generation

    // Update the outlines if any edits were made
    if (JSON.stringify(editedOutline) !== JSON.stringify(originalOutline)) {
      try {
        const response = await axios.put(
          `${
            import.meta.env.VITE_API_BASE_URL
          }/slides/outlines/${presentationId}`,
          {
            slides: editedOutline,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status !== 200) {
          console.error("Failed to update outlines.", response);
          canGenerateSlides = false;
        }
      } catch (error) {
        console.error("Error updating outlines:", error);
        canGenerateSlides = false;
      }
    }

    // Update presentation settings
    try {
      const response = await axios.put(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/slides/presentation/${presentationId}`,
        { ...settings },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status !== 200) {
        console.error("Failed to update presentation settings.", response);
        canGenerateSlides = false;
      }
    } catch (error) {
      console.error("Error updating presentation settings:", error);
      canGenerateSlides = false;
    }

    // Load selected template
    let slides = [];
    try {
      const response = await loadTemplate(selectedTemplate);
      slides = response.slides;
      if (slides.length === 0) {
        console.error("No slides found in the selected template.");
        canGenerateSlides = false;
      }
    } catch (error) {
      console.error("Error loading selected template:", error);
      canGenerateSlides = false;
    }

    if (!canGenerateSlides) {
      console.log("Cannot generate slides due to previous errors.");
      return;
    }

    // Final API call before slide generation
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/slides/prepare/${presentationId}`,
        {
          name: selectedTemplate,
          ordered: false,
          slides: slides,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200) {
        console.log("Slides prepared successfully:", response.data);
      }
    } catch (error) {
      console.error("Error preparing slides:", error);
    }
  }, [
    settings,
    editedOutline,
    selectedTemplate,
    originalOutline,
    presentationId,
    token,
  ]);

  useEffect(() => {
    if (!presentationId) navigate("/slides");
  }, [presentationId, navigate]);

  useEffect(() => {
    if (!presentationId) return;
    fetchSettings();

    return () => setSelectedSlideTemplateId(null);
  }, [fetchSettings, presentationId, setSelectedSlideTemplateId]);

  useEffect(() => {
    // Set custom footer for this page
    setFooterContent(
      <Flex
        style={{ width: "100%", padding: 16 }}
        justify="center"
        align="center"
        gap="middle"
      >
        {!isStreaming && (
          <Title level={4} style={{ margin: 0 }}>
            {(() => {
              const count = editedOutline ? editedOutline.length : 0;
              const slideText = count === 1 ? "Slide" : "Slides";
              return `${count} ${slideText} Total`;
            })()}
          </Title>
        )}
        <Button
          type="primary"
          shape="round"
          size="large"
          onClick={handleSubmit}
          disabled={isStreaming}
        >
          {isStreaming ? "Generating Outlines..." : "Generate Slides"}
        </Button>
      </Flex>,
      true
    );

    // Cleanup on unmount
    return () => {
      setFooterContent(null);
    };
  }, [setFooterContent, editedOutline, handleSubmit, isStreaming]);

  useEffect(() => {
    if (status !== "") {
      // Error Status
      if (status.toLowerCase().includes("error")) {
        messageApi.destroy();
        messageApi.open({
          type: "error",
          content: status,
        });
      } else if (status.toLowerCase().includes("complete")) {
        // Streaming Status
        messageApi.destroy();
        messageApi.open({
          type: "success",
          content: "Slide Outline Generated!",
        });

        const strippedOutlines = outlines.map((slide) => ({
          title: stripMarkdownText(slide.title),
          content: stripMarkdownText(slide.content),
          speaker_notes: stripMarkdownText(slide.speaker_notes),
        }));
        setEditedOutline(strippedOutlines);
        setOriginalOutline(strippedOutlines);
      } else {
        messageApi.destroy();
        messageApi.open({
          type: "loading",
          content: status,
          duration: 0,
        });
      }
    }
  }, [status, messageApi, outlines]);

  // Parse rawContent in real-time to create streaming outlines
  useEffect(() => {
    if (isStreaming && rawContent) {
      // Real-time parsing that extracts content as it streams
      const parseStreamingContent = (content) => {
        if (!content) return [];

        const slides = [];

        try {
          // First try complete JSON parsing
          const parsed = JSON.parse(content);
          if (parsed.slides && Array.isArray(parsed.slides)) {
            return parsed.slides;
          }
        } catch (jsonError) {
          // Real-time parsing for incomplete JSON

          // Look for content field patterns and extract ongoing content
          const extractAll = (field) => {
            const arr = [];

            const regex = new RegExp(
              `"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`,
              "g"
            );
            let match;
            while ((match = regex.exec(content)) !== null) {
              let raw = match[1] || "";
              let value = raw;
              try {
                value = JSON.parse(`"${raw.replace(/"/g, '\\"')}"`);
              } catch {
                value = raw
                  .replace(/\\n/g, "\n")
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, "\\");
              }
              arr.push(value);
            }
            return arr;
          };

          const contents = extractAll("content");
          const titles = extractAll("title");
          const speakerNotes = extractAll("speaker_notes");

          const maxCount = Math.max(
            contents.length,
            titles.length,
            speakerNotes.length
          );

          if (maxCount > 0) {
            for (let i = 0; i < maxCount; i++) {
              slides[i] = {
                title: titles[i] || `Slide ${i + 1}`,
                content: contents[i] || "",
                speakerNotes: speakerNotes[i] || "",
              };
            }
          }
        }

        return slides.filter(
          (slide) =>
            slide &&
            ((slide.content && slide.content.trim().length > 0) ||
              (slide.title && slide.title.trim().length > 0) ||
              (slide.speakerNotes && slide.speakerNotes.trim().length > 0))
        );
      };

      const parsedOutlines = parseStreamingContent(rawContent);
      setStreamingOutlines(parsedOutlines);

      // Update active slide index more intelligently
      if (parsedOutlines.length > 0) {
        // The last slide with content is the active one
        let lastActiveIndex = -1;
        for (let i = parsedOutlines.length - 1; i >= 0; i--) {
          if (
            parsedOutlines[i]?.content &&
            parsedOutlines[i].content.trim().length > 0
          ) {
            lastActiveIndex = i;
            break;
          }
        }

        setActiveSlideIndex((prev) => {
          if (lastActiveIndex >= 0) return lastActiveIndex;
          return prev ?? null;
        });
        setHighestActiveIndex((prev) => Math.max(prev, lastActiveIndex));
      }
    } else if (!isStreaming) {
      setStreamingOutlines([]);
      setActiveSlideIndex(null);
      setHighestActiveIndex(-1);
    }
  }, [isStreaming, rawContent, highestActiveIndex]);

  // Drag end handler for sorting
  const onDragEnd = ({ active, over }) => {
    if (!active || !over || active.id === over.id) return;
    if (editedOutline) {
      const oldIndex = editedOutline.findIndex(
        (_, i) => `outline-${i}` === active.id
      );
      const newIndex = editedOutline.findIndex(
        (_, i) => `outline-${i}` === over.id
      );
      if (oldIndex !== -1 && newIndex !== -1) {
        setEditedOutline(arrayMove(editedOutline, oldIndex, newIndex));
      }
    }
  };

  // Determine which outlines to display
  const displayOutlines = useMemo(() => {
    if (!isStreaming) return outlines || [];

    return (streamingOutlines || []).filter((slide, i) => {
      const hasContent = !!slide?.content && slide.content.trim().length > 0;

      // Visible if content exists, or it's the active item, or it's already been seen
      return hasContent || i === activeSlideIndex || i <= highestActiveIndex;
    });
  }, [
    isStreaming,
    streamingOutlines,
    outlines,
    activeSlideIndex,
    highestActiveIndex,
  ]);

  // Sortable Outline Item Component
  const SortableOutlineItem = ({ id, ...props }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      setActivatorNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });

    const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      ...(isDragging ? { position: "relative", zIndex: 9999 } : {}),
    };

    const isComplete = status.toLowerCase().includes("complete");

    const dragProps = isComplete
      ? { setActivatorNodeRef, listeners, attributes }
      : {};

    return (
      <div ref={setNodeRef} style={style}>
        <OutlineItem {...props} dragProps={dragProps} />
      </div>
    );
  };

  const addEmptyOutline = () => {
    setEditedOutline((prev) => [
      ...prev,
      {
        title: "Outline Title",
        content: "Outline content",
        speaker_notes: "Outline speaker notes",
      },
    ]);
  };

  return (
    <Flex vertical style={{ width: "100%" }} gap="large">
      {contextHolder}
      <BackButton />
      {/* Main Container */}
      <Flex style={{ width: "100%" }} justify="center" gap="middle">
        {/* Outline Panel */}
        <Flex style={{ width: "70%" }} justify="center">
          <Space direction="vertical" style={{ width: "100%" }}>
            <Text type="secondary">Outlines</Text>
            <Card style={{ width: "100%" }}>
              <Flex
                vertical
                gap="large"
                justify="center"
                style={{ width: "100%" }}
              >
                {/* Header */}
                <Alert
                  message="CLICK to edit the text content and DRAG to reorder slide outlines"
                  type="info"
                  showIcon
                  closable
                />

                {/* Loading State - Initial */}
                {isLoading && (!outlines || outlines.length === 0) && (
                  <Spin size="large" />
                )}

                {/* Outlines Content - Show streaming outlines during streaming, final outlines after */}
                {editedOutline &&
                editedOutline.length > 0 &&
                status.toLowerCase().includes("complete") ? (
                  // Finished Outline Cards
                  <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                    <SortableContext
                      items={editedOutline.map((_, i) => `outline-${i}`)}
                    >
                      <Space
                        direction="vertical"
                        size="middle"
                        className="outline-items-container"
                      >
                        {editedOutline.map((item, index) => (
                          <SortableOutlineItem
                            key={`outline-${index}`}
                            id={`outline-${index}`}
                            status={status}
                            index={index + 1}
                            slideOutline={item}
                            isStreaming={isStreaming}
                            isActiveStreaming={activeSlideIndex === index}
                            isStableStreaming={
                              highestActiveIndex >= 0 &&
                              index < highestActiveIndex
                            }
                            editedOutline={editedOutline}
                            setEditedOutline={setEditedOutline}
                          />
                        ))}
                        {/* CREATE NEW OUTLINE ITEM BUTTON */}
                        <Button
                          icon={<PlusOutlined />}
                          type="dashed"
                          block
                          onClick={addEmptyOutline}
                        >
                          Add Outline Card
                        </Button>
                      </Space>
                    </SortableContext>
                  </DndContext>
                ) : (
                  // Streaming Outline Cards
                  displayOutlines &&
                  displayOutlines.length > 0 && (
                    <Space
                      direction="vertical"
                      size="middle"
                      className="outline-items-container"
                    >
                      {displayOutlines.map((item, index) => (
                        <OutlineItem
                          key={`slide-${index}`}
                          index={index + 1}
                          slideOutline={item}
                          isStreaming={isStreaming}
                          isActiveStreaming={activeSlideIndex === index}
                          isStableStreaming={
                            highestActiveIndex >= 0 &&
                            index < highestActiveIndex
                          }
                          editedOutline={editedOutline}
                          setEditedOutline={setEditedOutline}
                        />
                      ))}
                    </Space>
                  )
                )}
              </Flex>
            </Card>
          </Space>
        </Flex>
        {/* Settings Panel */}
        {!isStreaming && !isLoadingSettings && (
          <GenerateSlideSettings
            presentationId={presentationId}
            settings={settings}
            setSettings={setSettings}
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
          />
        )}
      </Flex>
    </Flex>
  );
};
