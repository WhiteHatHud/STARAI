import { useNavigate } from "react-router-dom";

import { Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

export const BackButton = ({ onClick, style }) => {
  const navigate = useNavigate();

  const handleClick = onClick || (() => navigate(-1));

  return (
    <div>
      <Button
        shape="round"
        icon={<ArrowLeftOutlined />}
        onClick={handleClick}
        className="back-button"
        style={{ ...style }}
      >
        Back
      </Button>
    </div>
  );
};
