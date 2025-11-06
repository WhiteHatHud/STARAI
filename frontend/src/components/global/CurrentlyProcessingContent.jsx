import ProcessingContentItem from "./ProcessingContentItem";
import { Dropdown, Badge, Button } from "antd";
import { FieldTimeOutlined } from "@ant-design/icons";

export const CurrentlyProcessingContent = ({
  processingContent,
  setCurrentProgressId,
  setPreviousPageID,
  redirectTo,
}) => {
  const items = processingContent.map((content, index) => ({
    key: index.toString(),
    label: (
      <ProcessingContentItem
        setPreviousPageID={setPreviousPageID}
        content={content}
        setCurrentProgressId={setCurrentProgressId}
        redirectTo={redirectTo}
      />
    ),
  }));

  return (
    <div
      style={{
        paddingRight: "24px",
        paddingTop: "6px",
      }}
    >
      <Dropdown
        menu={{
          items,
          style: {
            maxHeight: "230px",
            overflowY: "auto",
          },
        }}
      >
        <Badge
          count={processingContent.length}
          style={{ color: "white" }}
          offset={[-2, 5]}
        >
          <Button
            shape="circle"
            size="large"
            icon={
              <FieldTimeOutlined
                style={{
                  fontSize: "20px",
                  paddingLeft: "2px",
                }}
              />
            }
            style={{ cursor: "default" }}
          />
        </Badge>
      </Dropdown>
    </div>
  );
};
