import { useEffect, useState } from "react";
import axios from "axios";
import { Table, Skeleton, Tag } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";
import useStore from "../../store";
import styleMapping from "../../data/styleMapping";

const UserGeneratedContent = ({ selectedUser, redirectTo }) => {
  const { token } = useStore();
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState([]);
  const { setCurrentCaseID } = useStore();

  const columns = [
    {
      title: "Name",
      dataIndex: "title",
      key: "name",
      sorter: (a, b) => a.title?.toString().localeCompare(b.title?.toString()),
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
      onFilter: (value, record) => record.study_type === value,
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
      render: (value) => new Date(value).toLocaleString(),
    },
    {
      title: "Last Updated",
      dataIndex: "updated_at",
      key: "updated_at",
      sorter: (a, b) =>
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
      render: (value) => new Date(value).toLocaleString(),
    },
    {
      title: "Processing Time",
      dataIndex: "processing_time",
      key: "processing_time",
      sorter: (a, b) => (a.processing_time || 0) - (b.processing_time || 0),
      render: (seconds) => {
        if (!seconds) return "";
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
      onFilter: (value, record) =>
        value === "published"
          ? record.status === value
          : record.status !== "published",
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
  ];

  // If PROJECT_VARIANT is set to 'custom', hide the Study Type column.
  const showStudyType =
    import.meta.env.VITE_PROJECT_VARIANT === "custom" ||
    import.meta.env.VITE_PROJECT_VARIANT === "sof";
  const visibleColumns = showStudyType
    ? columns.filter((c) => c.dataIndex !== "study_type")
    : columns;
  useEffect(() => {
    const fetchReports = async () => {
      if (!selectedUser?.id) return;
      setLoading(true);
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/reports/user/${
            selectedUser.id
          }`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const filteredData = response.data
          .filter((item) => {
            const projectVariant = import.meta.env.VITE_PROJECT_VARIANT;

            if (projectVariant === "custom")
              return item.study_type === "style_custom";
            else if (projectVariant === "sof")
              return item.study_type === "style_sof";
            else
              return (
                item.study_type !== "style_custom" &&
                item.study_type !== "style_sof"
              );
          })
          .filter((item) => item.status === "published");
        setTableData(filteredData);
      } catch (err) {
        console.error("Failed to fetch case studies for user:", err);
        setTableData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [selectedUser, token, showStudyType]);

  const handleOnRowClick = async (rowData) => {
    if (rowData.status !== "published") {
      if (redirectTo) {
        setCurrentCaseID(rowData._id);
        redirectTo("/progress");
      }
    } else {
      setCurrentCaseID(rowData._id);
      redirectTo("/admin/generated-content", {
        state: {
          selectedUserID: selectedUser.id,
        },
      });
    }
  };

  return (
    <div style={{ padding: 12 }}>
      {loading ? (
        <Skeleton active />
      ) : (
        <Table
          size="middle"
          scroll={{ x: "max-content" }}
          bordered
          columns={visibleColumns}
          dataSource={tableData}
          rowKey="_id"
          onRow={(record) => ({
            onClick: () => handleOnRowClick(record),
            style: { cursor: "pointer" },
          })}
        />
      )}
    </div>
  );
};

export default UserGeneratedContent;
