import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Flex, Card, Typography, Space, Button } from "antd";
import { RightOutlined, PlusOutlined } from "@ant-design/icons";

import { getLastUpdated } from "../../utils/timeUtils";
import useStore from "../../store";
import "./RecentSlidePrompts.css";

const { Text, Title } = Typography;

export const RecentSlidePrompts = ({ prompts }) => {
  const [visibleCount, setVisibleCount] = useState(3);
  const { setPresentationId } = useStore();
  const navigate = useNavigate();

  const handleSelectPrompt = (promptId) => () => {
    setPresentationId(promptId);
    navigate(`/slides/outlines`);
  };

  return (
    <>
      <Flex vertical gap="middle">
        {prompts.slice(0, visibleCount).map((prompt) => (
          <Card
            key={prompt.id}
            styles={{ body: { padding: 16 } }}
            hoverable
            className="slide-prompt-card"
            onClick={handleSelectPrompt(prompt.id)}
          >
            <Flex justify="space-between" align="center">
              {/* CARD TEXT */}
              <Space direction="vertical" size="none">
                <Title level={5} style={{ margin: 0 }}>
                  {prompt.content}
                </Title>
                <Text type="secondary">
                  Last Update: {getLastUpdated(prompt.updated_at)}
                </Text>
              </Space>
              <RightOutlined />
            </Flex>
          </Card>
        ))}

        {/* LOAD MORE BUTTON */}
        {visibleCount < prompts.length && (
          <Button
            icon={<PlusOutlined />}
            onClick={() => setVisibleCount((prev) => prev + 2)}
            block
          >
            Load More
          </Button>
        )}
      </Flex>
    </>
  );
};
