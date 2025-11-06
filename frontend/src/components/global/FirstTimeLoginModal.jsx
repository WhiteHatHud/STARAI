import { Form, Input, Space, Button, App, Modal } from "antd";
import { useEffect, useState } from "react";
import axios from "axios";
import useStore from "../../store";

const SubmitButton = ({ form, children }) => {
  const [submittable, setSubmittable] = useState(false);
  // Watch all values
  const values = Form.useWatch([], form);
  useEffect(() => {
    form
      .validateFields({ validateOnly: true })
      .then(() => setSubmittable(true))
      .catch(() => setSubmittable(false));
  }, [form, values]);

  return (
    <Button type="primary" htmlType="submit" disabled={!submittable}>
      {children}
    </Button>
  );
};

export const FirstTimeLoginModal = () => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { user, setUser } = useStore();

  const handleSubmit = async (values) => {
    // Update Username only if different
    if (values.username !== user.username) {
      try {
        await axios.put(
          `${import.meta.env.VITE_API_BASE_URL}/auth/users/update-username`,
          { new_username: values.username }
        );
        message.success(`Username has been updated successfully.`);
        setUser({ ...user, username: values.username }); // Optimistically update user in store
      } catch (error) {
        console.error("Failed to reset password:", error);
        message.error("Failed to reset password. Please try again later.");
      }
    }

    // Update Password
    if (values.newPassword) {
      try {
        const response = await axios.put(
          `${import.meta.env.VITE_API_BASE_URL}/auth/users/update-password`,
          {
            new_password: values.newPassword,
            confirm_password: values.confirmPassword,
          }
        );

        setUser(response);
        message.success(
          `Password for ${user.username} has been reset successfully.`
        );
      } catch (error) {
        console.error("Failed to reset password:", error);
        message.error("Failed to reset password. Please try again.");
      }
    }
  };

  return (
    <Modal
      title="Change default username and password"
      open={user?.is_first_login}
      closable={false}
      footer={null}
      centered
    >
      <Form
        form={form}
        name="accountInfo"
        layout="vertical"
        autoComplete="off"
        style={{ margin: 24 }}
        initialValues={{ username: user?.username }}
        requiredMark={false}
        onFinish={handleSubmit}
      >
        <div style={{ maxWidth: "80%" }}>
          {/* USERNAME INPUT */}
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: "Please input your username" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: "Please input the new password!" },
              {
                min: 6,
                message: "Password must be at least 6 characters long.",
              },
            ]}
            hasFeedback
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            dependencies={["newPassword"]}
            hasFeedback
            rules={[
              { required: true, message: "Please confirm the new password!" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("The two passwords do not match!")
                  );
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>
        </div>

        {/* FORM BUTTONS */}
        <Form.Item>
          <Space style={{ float: "right" }}>
            <Button htmlType="reset">Reset</Button>
            <SubmitButton form={form}>Submit</SubmitButton>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
