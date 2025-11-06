import { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  Alert,
  Typography,
  Tabs,
  Card,
  Progress,
  Divider,
  Tag,
  App,
} from "antd";
import {
  LockOutlined,
  UserOutlined,
  MailOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RobotOutlined,
  FileTextOutlined,
  BarChartOutlined,
  LoginOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./AuthPage.css";
import useStore from "../../store";

const { Title, Text, Paragraph } = Typography;

const AuthPage = ({ onLogin, loginError, isDarkMode }) => {
  const { notification } = App.useApp();
  const { setAuth } = useStore();
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [registerError, setRegisterError] = useState(null);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [currentFeature, setCurrentFeature] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();

  const features = [
    {
      icon: <RobotOutlined style={{ fontSize: "24px", color: "#1890ff" }} />,
      title: "AI-Powered Processing",
      description: "Automatically extract and organize data from documents",
    },
    {
      icon: <FileTextOutlined style={{ fontSize: "24px", color: "#52c41a" }} />,
      title: "Smart Form Filling",
      description:
        "AI assists in completing forms with intelligent suggestions",
    },
    {
      icon: <BarChartOutlined style={{ fontSize: "24px", color: "#faad14" }} />,
      title: "Report Generation",
      description: "Generate comprehensive case studies from your data",
    },
  ];

  // Extract redirect parameter from URL
  const getRedirectPath = () => {
    const urlParams = new URLSearchParams(location.search);
    const redirectParam = urlParams.get("redirect");
    return redirectParam ? decodeURIComponent(redirectParam) : null;
  };

  // Rotate features every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [features.length]);

  // Password strength checker
  const checkPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    return strength;
  };

  const onPasswordChange = (e) => {
    const password = e.target.value;
    setPasswordStrength(checkPasswordStrength(password));
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 50) return "#ff4d4f";
    if (passwordStrength < 75) return "#faad14";
    return "#52c41a";
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 25) return "Very Weak";
    if (passwordStrength < 50) return "Weak";
    if (passwordStrength < 75) return "Fair";
    if (passwordStrength < 100) return "Good";
    return "Strong";
  };

  const onLoginFinish = async (values) => {
    try {
      const { token, user } = await onLogin(values);

      if (useStore.getState().resetToDefaults)
        useStore.getState().resetToDefaults();
      setAuth({ token: token, user: user });

      const redirectPath = getRedirectPath();
      if (redirectPath) navigate(redirectPath, { replace: true });
    } catch (error) {
      // Login error is handled by the parent component
      console.error("Login failed:", error);
    }
  };

  const onRegisterFinish = async (values) => {
    setLoading(true);
    setRegisterError(null);

    try {
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/auth/register`, {
        email: values.email,
        username: values.username,
        password: values.password,
      });

      notification.success({
        message: "Registration Successful",
        description:
          "Your account has been created successfully. You can now log in.",
        duration: 4,
        icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
      });

      registerForm.resetFields();
      setActiveTab("login");
    } catch (error) {
      console.error("Registration error:", error);

      let errorMessage = "Registration failed. Please try again.";
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }

      setRegisterError(errorMessage);

      notification.error({
        message: "Registration Failed",
        description: errorMessage,
        duration: 4,
        icon: <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const validateConfirmPassword = ({ getFieldValue }) => ({
    validator(_, value) {
      if (!value || getFieldValue("password") === value) {
        return Promise.resolve();
      }
      return Promise.reject(new Error("The passwords do not match!"));
    },
  });

  const currentFeatureData = features[currentFeature];

  return (
    <div className={`auth-page ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <div className="auth-layout">
        {/* Left Side - Branding & Features (Desktop Only) */}
        <div className="auth-left">
          <div className="left-content">
            <div className="brand-section-desktop">
              <Title level={1} className="brand-title-desktop">
                StarAI
              </Title>
              <Text className="brand-subtitle-desktop">
                AI-Powered Document Processing
              </Text>
            </div>

            <div className="features-list">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`feature-item ${
                    index === currentFeature ? "active" : ""
                  }`}
                >
                  <div className="feature-icon-wrapper">{feature.icon}</div>
                  <div className="feature-content-desktop">
                    <Text strong className="feature-title-desktop">
                      {feature.title}
                    </Text>
                    <Paragraph className="feature-description-desktop">
                      {feature.description}
                    </Paragraph>
                  </div>
                </div>
              ))}
            </div>

            <div className="feature-indicators-desktop">
              {features.map((_, index) => (
                <div
                  key={index}
                  className={`indicator ${
                    index === currentFeature ? "active" : ""
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Auth Forms */}
        <div className="auth-right">
          {/* Mobile Header (Mobile Only) */}
          <div className="mobile-header">
            <div className="brand-section-mobile">
              <Title level={2} className="brand-title-mobile">
                StarAI
              </Title>
              <Text className="brand-subtitle-mobile">
                AI-Powered Document Processing
              </Text>
            </div>
          </div>

          {/* Feature Showcase (Mobile Only) */}
          <div className="feature-showcase-mobile">
            <Card className="feature-card-mobile" bordered={false}>
              <div className="feature-content-mobile">
                <div className="feature-icon-mobile">
                  {currentFeatureData.icon}
                </div>
                <div className="feature-text-mobile">
                  <Text strong className="feature-title-mobile">
                    {currentFeatureData.title}
                  </Text>
                  <Paragraph className="feature-description-mobile">
                    {currentFeatureData.description}
                  </Paragraph>
                </div>
              </div>
              <div className="feature-indicators-mobile">
                {features.map((_, index) => (
                  <div
                    key={index}
                    className={`indicator ${
                      index === currentFeature ? "active" : ""
                    }`}
                  />
                ))}
              </div>
            </Card>
          </div>

          {/* Auth Forms */}
          <div className="auth-forms">
            <Card className="auth-card" bordered={false}>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                centered
                size="large"
                className="auth-tabs"
                items={[
                  {
                    key: "login",
                    label: <span>Sign In</span>,
                    children: (
                      <div className="form-content">
                        <div className="form-header">
                          <Title level={3} className="form-title">
                            Welcome Back
                          </Title>
                          <Text className="form-subtitle">
                            Sign in to continue to StarAI
                          </Text>
                        </div>

                        {loginError && (
                          <Alert
                            message={loginError}
                            type="error"
                            showIcon
                            closable
                            className="error-alert"
                          />
                        )}

                        <Form
                          form={loginForm}
                          name="login_form"
                          onFinish={onLoginFinish}
                          layout="vertical"
                          size="large"
                        >
                          <Form.Item
                            name="username"
                            rules={[
                              {
                                required: true,
                                message: "Please enter your username!",
                              },
                            ]}
                          >
                            <Input
                              prefix={<UserOutlined />}
                              placeholder="Username"
                              className="auth-input"
                            />
                          </Form.Item>

                          <Form.Item
                            name="password"
                            rules={[
                              {
                                required: true,
                                message: "Please enter your password!",
                              },
                            ]}
                          >
                            <Input.Password
                              prefix={<LockOutlined />}
                              placeholder="Password"
                              className="auth-input"
                              iconRender={(visible) =>
                                visible ? (
                                  <EyeTwoTone />
                                ) : (
                                  <EyeInvisibleOutlined />
                                )
                              }
                            />
                          </Form.Item>

                          <Form.Item>
                            <Button
                              type="primary"
                              htmlType="submit"
                              block
                              className="auth-button"
                              icon={<LoginOutlined />}
                            >
                              Sign In
                            </Button>
                          </Form.Item>
                        </Form>

                        <Divider>
                          <Text type="secondary">New to StarAI?</Text>
                        </Divider>

                        <Button
                          type="link"
                          block
                          onClick={() => setActiveTab("register")}
                          className="switch-button"
                        >
                          Create an account
                        </Button>
                      </div>
                    ),
                  },
                  {
                    key: "register",
                    label: <span>Sign Up</span>,
                    children: (
                      <div className="form-content">
                        <div className="form-header">
                          <Title level={3} className="form-title">
                            Get Started
                          </Title>
                          <Text className="form-subtitle">
                            Create your account and unlock AI-powered features
                          </Text>
                        </div>

                        {registerError && (
                          <Alert
                            message={registerError}
                            type="error"
                            showIcon
                            closable
                            className="error-alert"
                            onClose={() => setRegisterError(null)}
                          />
                        )}

                        <Form
                          form={registerForm}
                          name="register_form"
                          onFinish={onRegisterFinish}
                          layout="vertical"
                          size="large"
                        >
                          <Form.Item
                            name="email"
                            rules={[
                              {
                                required: true,
                                message: "Please enter your email!",
                              },
                              {
                                type: "email",
                                message: "Please enter a valid email!",
                              },
                            ]}
                          >
                            <Input
                              prefix={<MailOutlined />}
                              placeholder="Email address"
                              className="auth-input"
                            />
                          </Form.Item>

                          <Form.Item
                            name="username"
                            rules={[
                              {
                                required: true,
                                message: "Please enter a username!",
                              },
                              {
                                min: 3,
                                message:
                                  "Username must be at least 3 characters!",
                              },
                              {
                                max: 50,
                                message:
                                  "Username cannot exceed 50 characters!",
                              },
                              {
                                pattern: /^[a-zA-Z0-9_]+$/,
                                message:
                                  "Username can only contain letters, numbers, and underscores!",
                              },
                            ]}
                          >
                            <Input
                              prefix={<UserOutlined />}
                              placeholder="Choose username"
                              className="auth-input"
                            />
                          </Form.Item>

                          <Form.Item
                            name="password"
                            rules={[
                              {
                                required: true,
                                message: "Please enter a password!",
                              },
                              {
                                min: 8,
                                message:
                                  "Password must be at least 8 characters!",
                              },
                            ]}
                          >
                            <Input.Password
                              prefix={<LockOutlined />}
                              placeholder="Create password"
                              className="auth-input"
                              onChange={onPasswordChange}
                              iconRender={(visible) =>
                                visible ? (
                                  <EyeTwoTone />
                                ) : (
                                  <EyeInvisibleOutlined />
                                )
                              }
                            />
                          </Form.Item>

                          {passwordStrength > 0 && (
                            <div className="password-strength">
                              <div className="strength-header">
                                <Text
                                  type="secondary"
                                  className="strength-label"
                                >
                                  Password Strength:
                                </Text>
                                <Tag
                                  color={getPasswordStrengthColor()}
                                  className="strength-tag"
                                >
                                  {getPasswordStrengthText()}
                                </Tag>
                              </div>
                              <Progress
                                percent={passwordStrength}
                                showInfo={false}
                                strokeColor={getPasswordStrengthColor()}
                                size="small"
                                className="strength-progress"
                              />
                            </div>
                          )}

                          <Form.Item
                            name="confirmPassword"
                            dependencies={["password"]}
                            rules={[
                              {
                                required: true,
                                message: "Please confirm your password!",
                              },
                              validateConfirmPassword,
                            ]}
                          >
                            <Input.Password
                              prefix={<LockOutlined />}
                              placeholder="Confirm password"
                              className="auth-input"
                              iconRender={(visible) =>
                                visible ? (
                                  <EyeTwoTone />
                                ) : (
                                  <EyeInvisibleOutlined />
                                )
                              }
                            />
                          </Form.Item>

                          <Form.Item>
                            <Button
                              type="primary"
                              htmlType="submit"
                              block
                              loading={loading}
                              className="auth-button"
                              icon={loading ? null : <UserAddOutlined />}
                            >
                              {loading
                                ? "Creating Account..."
                                : "Create Account"}
                            </Button>
                          </Form.Item>
                        </Form>

                        <Divider>
                          <Text type="secondary">Already have an account?</Text>
                        </Divider>

                        <Button
                          type="link"
                          block
                          onClick={() => setActiveTab("login")}
                          className="switch-button"
                        >
                          Sign in instead
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
