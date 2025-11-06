import { useState, useEffect } from "react";
import axios from "axios";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Typography,
  message,
  Space,
  Tag,
  Empty,
  Popconfirm,
  Flex,
  Dropdown,
  notification,
} from "antd";
import {
  DeleteOutlined,
  QuestionCircleOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import useStore from "../../store";
import CreateBatch from "./CreateBatch";
import DownloadAll from "./DownloadAll";
import "./AdminSettingsPage.css";

const { Title } = Typography;

const AdminSettingsPage = ({ searchTerm, setSelectedUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  const { user: currentUser } = useStore();
  const projectVariant = import.meta.env.VITE_PROJECT_VARIANT;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/admin/users`
      );
      // Normalize user data to ensure 'id' field is present for consistency
      const normalizedUsers = response.data.map((u) => ({
        ...u,
        id: u.id || u._id,
      }));

      setUsers(normalizedUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      message.error(
        "Failed to load user data. You may not have admin privileges."
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showPasswordModal = (event, user) => {
    event.stopPropagation();
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    form.resetFields();
  };

  const handlePasswordReset = async (values) => {
    if (!editingUser) return;

    try {
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/admin/users/${editingUser.id}`,
        { password: values.password }
      );
      message.success(
        `Password for ${editingUser.username} has been reset successfully.`
      );
      handleCancel();
    } catch (error) {
      console.error("Failed to reset password:", error);
      message.error("Failed to reset password. Please try again.");
    }
  };

  const handleDeleteUser = async (userIdToDelete) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/admin/users/${userIdToDelete}`
      );
      message.success("User deleted successfully.");
      setUsers((prevUsers) =>
        prevUsers.filter((user) => user.id !== userIdToDelete)
      );
      setSelectedUser(null);
    } catch (error) {
      console.error("Failed to delete user:", error);
      const errorMessage =
        error.response?.data?.detail ||
        "Failed to delete user. Please try again.";
      message.error(errorMessage);
    }
  };

  const handleDownload = async (user, format) => {
    try {
      const formatDisplay = format.toUpperCase();
      const documentType =
        format === "docx"
          ? "ZIP file containing Word documents"
          : "ZIP file containing PDF documents";

      notification.info({
        message: "Preparing Download",
        description: `${user.username}'s case studies are being prepared for download in ${formatDisplay} format...`,
      });

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/reports/admin/users/${
          user.id
        }/reports/download`,
        {
          params: { format },
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${currentUser?.token}`,
          },
        }
      );

      // Create blob and download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Extract filename from response headers or create default
      const contentDisposition = response.headers["content-disposition"];
      let filename = `${user.username}_Case_Studies_${formatDisplay}.zip`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      notification.success({
        message: "Download Complete",
        description: `${user.username}'s case studies have been downloaded successfully as a ${documentType}.`,
      });
    } catch (error) {
      console.error("Download failed:", error);

      let errorMessage = "Unable to download case studies. Please try again.";
      if (error.response && error.response.status === 404) {
        errorMessage = `No case studies found for ${user.username}.`;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }

      notification.error({
        message: "Download Failed",
        description: errorMessage,
      });
    }
  };

  const getDownloadMenuItems = (user) => [
    {
      key: "pdf",
      label: "Download as PDF",
      onClick: () => handleDownload(user, "pdf"),
    },
    {
      key: "docx",
      label: "Download as Word Document",
      onClick: () => handleDownload(user, "docx"),
    },
  ];

  const columns = [
    {
      title: "Username",
      dataIndex: "username",
      key: "username",
      sorter: (a, b) => a.username.localeCompare(b.username),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Admin Role",
      dataIndex: "is_admin",
      key: "is_admin",
      render: (isAdmin) =>
        isAdmin ? <Tag color="gold">Yes</Tag> : <Tag color="default">No</Tag>,
      filters: [
        { text: "Admin", value: true },
        { text: "User", value: false },
      ],
      onFilter: (value, record) => record.is_admin === value,
    },
    {
      title: "Status",
      dataIndex: "disabled",
      key: "disabled",
      render: (disabled) =>
        disabled ? (
          <Tag color="red">Disabled</Tag>
        ) : (
          <Tag color="green">Active</Tag>
        ),
      filters: [
        { text: "Active", value: false },
        { text: "Disabled", value: true },
      ],
      onFilter: (value, record) => record.disabled === value,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => {
        const isSelf = record.id === (currentUser?.id || currentUser?._id);
        const downloadMenu = {
          items: getDownloadMenuItems(record),
        };

        return (
          <Space size="middle">
            {projectVariant === "custom" && (
              <Dropdown menu={downloadMenu} trigger={["click"]}>
                <Button onClick={(e) => e.stopPropagation()}>
                  <DownloadOutlined /> Download Reports
                </Button>
              </Dropdown>
            )}
            <Button onClick={(event) => showPasswordModal(event, record)}>
              Reset Password
            </Button>
            <Popconfirm
              title="Delete this user?"
              description="This action cannot be undone."
              onConfirm={(event) => {
                event.stopPropagation();
                handleDeleteUser(record.id);
              }}
              onCancel={(event) => {
                event.stopPropagation();
              }}
              okText="Yes, Delete"
              cancelText="No"
              icon={<QuestionCircleOutlined style={{ color: "red" }} />}
              disabled={isSelf}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                disabled={isSelf}
              >
                Delete
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  if (!loading && users.length === 0) {
    return (
      <Empty description="Could not load user data or no users found. Ensure you have admin rights." />
    );
  }

  // Filter out users based on search term
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Flex
        justify="space-between"
        align="center"
        style={{ marginBottom: "24px" }}
      >
        <Title level={2} style={{ margin: 0 }}>
          User Management
        </Title>
        {projectVariant === "custom" && (
          <Space>
            <DownloadAll />
            <CreateBatch
              updateUsers={fetchUsers}
              setSelectedUser={setSelectedUser}
            />
          </Space>
        )}
      </Flex>

      <Table
        columns={columns}
        dataSource={filteredUsers.map((u) => ({ ...u, key: u.id }))}
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: true }}
        rowClassName={() => "user-table-row"}
        onRow={(record) => ({
          onClick: () => {
            if (!record.is_admin) setSelectedUser(record);
          },
        })}
      />

      <Modal
        title={`Reset Password for ${editingUser?.username}`}
        open={isModalOpen}
        onCancel={handleCancel}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handlePasswordReset}
          style={{ marginTop: "24px" }}
        >
          <Form.Item
            name="password"
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
            name="confirm"
            label="Confirm New Password"
            dependencies={["password"]}
            hasFeedback
            rules={[
              { required: true, message: "Please confirm the new password!" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
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
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Reset Password
              </Button>
              <Button onClick={handleCancel}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default AdminSettingsPage;
