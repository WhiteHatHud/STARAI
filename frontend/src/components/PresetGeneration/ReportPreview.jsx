import { useState } from "react";
import axios from "axios";
import { Card, Flex, Typography, Button, notification, List } from "antd";

import stylePreviewData from "../../data/reportPreviewData";
import { GenerateModal } from "../global";
import useStore from "../../store";

const { Title, Text } = Typography;
const ReportPreview = ({
  styleKey,
  triggerProcessingData,
  token,
  redirectTo,
  setCurrentProgressId,
}) => {
  const reportData = stylePreviewData.find(
    (item) => item.style === styleKey
  );
  const [isGenerateModalVisible, setIsGenerateModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const { currentCase } = useStore();
  const isMobile = window.innerWidth <= 768;

  const generateReport = async (title) => {
    setIsSubmitting(true);

    let requestBody = {
      title: title,
      case_id: currentCase.id,
      document_ids: selectedDocuments,
      study_type: reportData.style,
    };

    if (reportData.style === "style_a") requestBody.single_section = false;

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/reports/generate/${
          reportData.style
        }`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const { progress_id } = response.data;
      triggerProcessingData();
      setCurrentProgressId(progress_id);
      redirectTo("/progress");
    } catch (error) {
      notification.error({
        message: "Error",
        description: "Failed to start case study generation",
      });
    } finally {
      setIsGenerateModalVisible(false);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card styles={{ body: { padding: isMobile ? "24px 0px" : 24 } }}>
        <Flex vertical gap="large" justify="space-between" align="center">
          <Flex vertical justify="center" align="center">
            <Title level={2} style={{ marginTop: 8, marginBottom: 8 }}>
              {reportData.title}
            </Title>
            <Text
              type="secondary"
              style={{ textAlign: "center", maxWidth: "80%" }}
            >
              {reportData.description}
            </Text>
          </Flex>

          {/* SECTION LIST */}
          <Card className="report-preview-sections">
            <List
              itemLayout="horizontal"
              dataSource={reportData.sections}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    avatar={item.icon}
                    title={item.title}
                    description={item.description}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Flex>
      </Card>
      <Button
        type="primary"
        style={{ width: isMobile ? "100%" : "60%" }}
        onClick={() => setIsGenerateModalVisible(true)}
      >
        Generate Content
      </Button>

      <GenerateModal
        visible={isGenerateModalVisible}
        onCancel={() => setIsGenerateModalVisible(false)}
        onSubmit={generateReport}
        loading={isSubmitting}
        reportStyle={styleKey}
        token={token}
        selectedDocuments={selectedDocuments}
        setSelectedDocuments={setSelectedDocuments}
        redirectTo={redirectTo}
      />
    </>
  );
};

export default ReportPreview;
