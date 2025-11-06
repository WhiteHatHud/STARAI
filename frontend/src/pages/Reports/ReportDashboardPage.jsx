import { useEffect, useState } from "react";
import axios from "axios";
import {
  Flex,
  Input,
  Table,
  Space,
  Tag,
  Button,
  notification,
  Spin,
  Modal,
  Tooltip,
  Skeleton,
} from "antd";
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import useStore from "../../store";
import styleMapping from "../../data/styleMapping";

const { confirm } = Modal;

export const ReportDashboardPage = ({
  token,
  redirectTo,
  processingContent,
  setCurrentProgressId,
  setPreviousPageID,
}) => {
  const [tableData, setTableData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { setCurrentCaseID } = useStore();
  const projectVariant = import.meta.env.VITE_PROJECT_VARIANT;

  const columns = [
    {
      title: "Name",
      dataIndex: "title",
      key: "name",
      sorter: (a, b) => {
        const titleA = a.title.toString().toLowerCase();
        const titleB = b.title.toString().toLowerCase();
        return titleA.localeCompare(titleB);
      },
    },
    {
      title: "Study Type",
      dataIndex: "study_type",
      key: "study_type",
      filters: [
        { text: "Style A", value: "style_a" },
        { text: "Style B", value: "style_b" },
        { text: "Style C", value: "style_c" },
      ],
      onFilter: (value, record) => {
        return record.study_type === value;
      },
      render: (studyType) => {
        const style = styleMapping[studyType] || styleMapping["default"];
        return <Tag color={style.color}>{style.label}</Tag>;
      },
    },
    {
      title: "Created At",
      dataIndex: "created_at",
      key: "created_at",
      sorter: (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (value) => {
        const date = new Date(value);

        return date.toLocaleString(undefined, {
          day: "2-digit",
          month: "short",
          year: "2-digit",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      },
    },
    {
      title: "Last Updated",
      dataIndex: "updated_at",
      key: "updated_at",
      sorter: (a, b) =>
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
      render: (value) => {
        const date = new Date(value);

        return date.toLocaleString(undefined, {
          day: "2-digit",
          month: "short",
          year: "2-digit",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      },
    },
    {
      title: "Processing Time",
      dataIndex: "processing_time",
      key: "processing_time",
      sorter: (a, b) => a.processing_time - b.processing_time,
      render: (seconds) => {
        if (!seconds) return "Processing...";

        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        return [
          hrs ? `${hrs}hr` : null,
          mins ? `${mins} min` : null,
          `${secs} s`,
        ]
          .filter(Boolean)
          .join(" ");
      },
    },
    {
      title: "Status",
      key: "status",
      dataIndex: "status",
      filters: [
        { text: "Published", value: "published" },
        { text: "Processing", value: "processing" },
      ],
      onFilter: (value, record) => {
        if (value === "published") return record.status === value;
        return record.status !== "published";
      },
      render: (status) => {
        if (status === "published")
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              Published
            </Tag>
          );
        else
          return (
            <Tag icon={<ClockCircleOutlined />} color="processing">
              Processing
            </Tag>
          );
      },
    },
    {
      title: "Actions",
      key: "action",
      render: (record) => (
        <Space size="small">
          <Tooltip title="Edit Report">
            <Button
              type="text"
              icon={<EditOutlined />}
              disabled={record.status !== "published"}
              onClick={(e) => {
                e.stopPropagation();
                handleOnRowClick(record);
              }}
            />
          </Tooltip>
          <Tooltip title="Delete Report">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.status !== "published"}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(record._id);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const fetchProgressID = async (caseID) => {
    try {
      const response = await axios.get(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/progress/by-case-id/${caseID}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.progress_id;
    } catch (error) {
      console.error("Error fetching progress data: ", error);
    }
  };

  const handleOnRowClick = async (rowData) => {
    if (rowData.status !== "published") {
      const rowProgressID = await fetchProgressID(rowData._id);
      setCurrentProgressId(rowProgressID);
      setPreviousPageID("reports");
      redirectTo("/progress");
    } else {
      setCurrentCaseID(rowData._id);
      projectVariant === "sof"
        ? redirectTo("/sof-reports/editor")
        : redirectTo("/reports/editor");
    }
  };

  const handleDelete = (reportId) => {
    // Verify the ID exists
    const reportToDelete = tableData.find((cs) => cs._id === reportId);
    if (!reportToDelete) {
      notification.error({
        message: "Error",
        description: "Case study not found in local data.",
      });
      return;
    }

    confirm({
      title: `Delete "${reportToDelete.title}"?`,
      icon: <ExclamationCircleOutlined />,
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        const loadingKey = "deleting-report";
        notification.open({
          key: loadingKey,
          message: "Deleting Report",
          description: `Deleting "${reportToDelete.title}". Please wait...`,
          icon: <Spin size="small" />,
          duration: 0, // Keep open until manually closed
        });

        try {
          await axios.delete(
            `${import.meta.env.VITE_API_BASE_URL}/reports/${reportId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          // Close loading notification
          notification.destroy(loadingKey);

          // Remove from local state immediately
          setTableData((prev) =>
            prev.filter((study) => study._id !== reportId)
          );

          notification.success({
            message: "Report Deleted",
            description: `"${reportToDelete.title}" has been deleted successfully.`,
          });
        } catch (error) {
          console.error("Delete failed:", error.response || error);

          // Close loading notification
          notification.destroy(loadingKey);

          let errorMessage = "Unable to delete the case study.";

          if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            console.error("Error status:", status, "Error data:", data);

            switch (status) {
              case 404:
                errorMessage = "Case study not found on server.";
                break;
              case 403:
                errorMessage =
                  "You do not have permission to delete this case study.";
                break;
              case 401:
                errorMessage = "Authentication failed. Please log in again.";
                break;
              case 500:
                errorMessage = "Server error occurred while deleting.";
                break;
              default:
                errorMessage = data?.detail || data?.message || errorMessage;
            }
          }

          notification.error({
            message: "Delete Failed",
            description: errorMessage,
          });
        }
      },
    });
  };

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/reports/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const reports = response.data.filter(
          (report) =>
            report.study_type !== "style_custom" &&
            report.study_type !== "style_sof"
        );
        const sofReports = response.data.filter(
          (report) => report.study_type === "style_sof"
        );

        const filteredReports =
          projectVariant === "sof" ? sofReports : reports;
        setTableData(filteredReports);
      } catch (error) {
        console.error("Error fetching case studies: ", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [processingContent.length, token, projectVariant]);

  const filteredTableData = tableData
    ?.filter((rowData) => rowData.title.toLowerCase().includes(searchTerm))
    ?.filter((rowData) => rowData.study_type !== "style_custom");
  return (
    <Flex vertical gap="middle" style={{ padding: 32 }}>
      {isLoading ? (
        <Skeleton active />
      ) : (
        <>
          <Flex gap="middle">
            <Input
              placeholder="Search"
              suffix={<SearchOutlined />}
              style={{ maxWidth: "50%", borderRadius: "24px" }}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Flex>
          <Table
            size="middle"
            scroll={{ x: "max-content" }}
            bordered
            columns={
              projectVariant === "sof"
                ? columns.filter((col) => col.dataIndex !== "study_type")
                : columns
            }
            dataSource={filteredTableData}
            rowKey="_id"
            onRow={(record) => {
              return {
                onClick: () => handleOnRowClick(record),
                style: { cursor: "pointer" },
              };
            }}
          />
        </>
      )}
    </Flex>
  );
};
