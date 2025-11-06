import { useEffect, useState } from "react";
import axios from "axios";
import {
  Alert,
  Space,
  Typography,
  Card,
  Progress,
  Flex,
} from "antd";
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import useStore from "../../store";

const { Text } = Typography;
export const ProgressStatus = ({ token, progressID, processingContent }) => {
  const [progressData, setProgressData] = useState(null);
  const [serverError, setServerError] = useState();
  const { setCurrentCaseID } = useStore();

  useEffect(() => {
    if (!progressID) return;

    const fetchProgress = async () => {
      try {
        const response = await axios.get(
          `${
            import.meta.env.VITE_API_BASE_URL
          }/reports/progress/by-id/${progressID}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        setProgressData(response.data);
      } catch (error) {
        setServerError(error);
        console.error("Error fetching progress data:", error);
      }
    };

    fetchProgress();

    if (progressData?.status === "completed")
      setCurrentCaseID(progressData.report_id);
  }, [
    progressID,
    processingContent,
    progressData?.status,
    progressData?.report_id,
    setCurrentCaseID,
    token,
  ]);

  const currentProgress = progressData?.progress || 0;
  const currentMessage = progressData?.message || "Starting...";
  const status = progressData?.status || "initializing";

  const getProgressStatus = () => {
    if (status === "error") return "exception";
    if (status === "completed") return "success";
    return "active";
  };

  return (
    <Flex vertical align="center" style={{ padding: "40px 20px" }}>
      <Flex vertical gap="middle" style={{ width: "100%", maxWidth: "600px" }}>
        {serverError && (
          <Alert
            message="Error"
            description={serverError}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Card>
          <div className={`progress-header-compact`}>
            <div className={`progress-summary`} style={{ marginBottom: "16px" }}>
              <Space>
                {status === "error" ? (
                  <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />
                ) : status === "completed" ? (
                  <CheckCircleOutlined style={{ color: "#52c41a" }} />
                ) : (
                  <LoadingOutlined style={{ color: "#1890ff" }} />
                )}
                <Text
                  strong
                  style={{
                    color:
                      status === "error"
                        ? "#ff4d4f"
                        : status === "completed"
                        ? "#52c41a"
                        : "#1890ff",
                  }}
                >
                  {currentMessage}
                </Text>
                <Text type="secondary">({currentProgress}%)</Text>
              </Space>
            </div>
            <Progress
              percent={currentProgress}
              status={getProgressStatus()}
              strokeColor={status === "error" ? "#ff4d4f" : undefined}
              showInfo={true}
            />
          </div>
        </Card>
      </Flex>
    </Flex>
  );
};
