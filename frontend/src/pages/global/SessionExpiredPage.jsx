import { Button, Result, theme } from "antd";
import { useNavigate } from "react-router-dom";

const SessionExpiredPage = () => {
  const navigate = useNavigate();
  const { token: themeToken } = theme.useToken();

  const handleLoginRedirect = () => {
    navigate("/login", { replace: true });
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: themeToken.colorBgContainer,
      }}
    >
      <Result
        status="403"
        title="Session Expired"
        subTitle="It looks like your session has timed out. Please log in again to continue enjoying our services."
        extra={[
          <Button
            type="primary"
            key="login"
            onClick={handleLoginRedirect}
            size="large"
            style={{
              borderRadius: "20px",
              padding: "0 30px",
            }}
          >
            Log In
          </Button>,
        ]}
        style={{
          maxWidth: "500px",
          backgroundColor: themeToken.colorBgElevated,
          padding: "40px",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        }}
      />
    </div>
  );
};

export default SessionExpiredPage;
