import { Typography, Progress, Flex } from "antd";
const { Text } = Typography;

const ProcessingContentItem = ({
  content,
  setCurrentProgressId,
  redirectTo,
}) => {
  return (
    <div
      style={{
        width: 300,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      onClick={() => {
        setCurrentProgressId(content.progress_id);
        redirectTo("/progress");
      }}
    >
      {content.report_title ? (
        <>
          <Text strong>{content.report_title}</Text>

          <Flex vertical>
            <Progress percent={content.progress} />
            <Text type="secondary">{content.message}</Text>
          </Flex>
        </>
      ) : (
        <>
          <Flex vertical>
            <Text strong>{content.message}</Text>
            <Progress percent={content.progress} />
          </Flex>
        </>
      )}
    </div>
  );
};

export default ProcessingContentItem;
