import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Flex, Space, Typography } from "antd";

import useStore from "../../store";
import "./SlideDashboardPage.css";
import { GeneratedSlidesList } from "../../components/MySlides/GeneratedSlidesList";
import { RecentSlidePrompts } from "../../components/MySlides/RecentSlidePrompts";
import { useCallback, useEffect, useState } from "react";

const { Title } = Typography;
export const SlideDashboardPage = () => {
  const navigate = useNavigate();
  const { token, setCurrentCase } = useStore();
  const [prompts, setPrompts] = useState([]);

  const fetchRecentPrompts = useCallback(async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/slides/presentations`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 200) setPrompts(response.data);
    } catch (error) {
      console.error("Error fetching recent prompts:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchRecentPrompts();
  }, [fetchRecentPrompts]);

  return (
    <Flex vertical gap="large" style={{ maxWidth: "80%", margin: "0 auto" }}>
      {/* GENERATED SLIDES LIST */}
      <Space direction="vertical" size="small">
        <Title level={3}>Generated slides</Title>
        <GeneratedSlidesList
          setCurrentCase={setCurrentCase}
          navigate={navigate}
        />
      </Space>

      {/* RECENT PROMPTS SECTION */}
      {prompts?.length > 0 && (
        <Space direction="vertical" size="small">
          <Title level={3} style={{ textAlign: "center" }}>
            Recent prompts
          </Title>
          <RecentSlidePrompts prompts={prompts} />
        </Space>
      )}
    </Flex>
  );
};
