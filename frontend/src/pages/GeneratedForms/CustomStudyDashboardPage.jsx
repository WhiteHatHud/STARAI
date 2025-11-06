import { useEffect, useState, useCallback } from "react";
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
  Form,
  Select,
  DatePicker,
  Tabs,
} from "antd";
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  TagOutlined,
  FilePdfOutlined,
  FileWordOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import useStore from "../../store";

const { confirm } = Modal;
const { Option } = Select;

const getPresetRanges = () => {
  const today = dayjs();

  return {
    Today: [today, today],
    Yesterday: [today.subtract(1, "day"), today.subtract(1, "day")],
    "Last 7 Days": [today.subtract(7, "day"), today],
    "Last 14 Days": [today.subtract(14, "day"), today],
    "This Month": [today.startOf("month"), today.endOf("month")],
    "Last Month": [
      today.subtract(1, "month").startOf("month"),
      today.subtract(1, "month").endOf("month"),
    ],
  };
};

export const CustomStudyDashboardPage = ({
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
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedDateRange, setSelectedDateRange] = useState([null, null]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadType, setDownloadType] = useState("excel");

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
        { text: "Pending Review", value: "pending_review" },
      ],
      onFilter: (value, record) => {
        if (record.status === "draft" && value === "processing") return true;

        return record.status === value;
      },
      render: (status) => {
        switch (status) {
          case "published":
            return (
              <Tag icon={<CheckCircleOutlined />} color="success">
                Published
              </Tag>
            );
          case "draft":
          case "processing":
            return (
              <Tag icon={<ClockCircleOutlined />} color="orange">
                Processing
              </Tag>
            );
          case "pending_review":
            return (
              <Tag icon={<EditOutlined />} color="cyan">
                Pending Review
              </Tag>
            );
          default:
            return (
              <Tag icon={<ClockCircleOutlined />} color="default">
                Unknown
              </Tag>
            );
        }
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
              disabled={
                record.status === "draft" || record.status === "processing"
              }
              onClick={(e) => {
                e.stopPropagation();
                handleOnRowClick(record);
              }}
            />
          </Tooltip>
          {record.status !== "published" && (
            <Tooltip title="Mark as Published">
              <Button
                type="text"
                icon={
                  <TagOutlined
                    style={{
                      color:
                        record.status === "draft" ||
                        record.status === "processing"
                          ? undefined
                          : "#08979c",
                    }}
                  />
                }
                disabled={
                  record.status === "draft" || record.status === "processing"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleStatus(record._id);
                }}
              />
            </Tooltip>
          )}
          <Tooltip title="Delete Report">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={
                record.status === "draft" || record.status === "processing"
              }
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
    if (rowData.status === "processing" || rowData.status === "draft") {
      const rowProgressID = await fetchProgressID(rowData._id);
      setCurrentProgressId(rowProgressID);
      setPreviousPageID("reports");
      redirectTo("/progress");
    } else {
      setCurrentCaseID(rowData._id);
      redirectTo("/generated-forms/editor");
    }
  };

  const handleToggleStatus = async (reportId) => {
    try {
      await axios.patch(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/${reportId}/toggle-status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      // Refetch data to update the UI
      await fetchReports();
    } catch (error) {
      console.error("Error toggling case study status:", error);
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

  const fetchReports = useCallback(async () => {
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

      setTableData(response.data);
    } catch (error) {
      console.error("Error fetching case studies: ", error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReports();
  }, [processingContent.length, token, fetchReports]);

  useEffect(() => {
    if (!isModalVisible) return;

    const fetchTemplates = async () => {
      try {
        const [privateResponse, publicResponse] = await Promise.all([
          axios.get(
            `${import.meta.env.VITE_API_BASE_URL}/custom/documents/templates`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          ),
          axios.get(
            `${
              import.meta.env.VITE_API_BASE_URL
            }/custom/documents/templates/public`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          ),
        ]);

        const privateTemplates = privateResponse.data?.templates || [];
        const publicTemplatesDict = publicResponse.data?.templates || {};

        const publicTemplates = Object.values(publicTemplatesDict).map(
          (template) => ({
            ...template,
            isPublic: true,
          })
        );

        const markedPrivateTemplates = privateTemplates.map((template) => ({
          ...template,
          isPublic: false,
        }));

        // Create a Set of public template names/identifiers for deduplication
        const publicTemplateIdentifiers = new Set(
          publicTemplates.map(
            (template) => template.template_name || template.template_identifier
          )
        );

        // Filter out private templates that have public equivalents
        const filteredPrivateTemplates = markedPrivateTemplates.filter(
          (template) => {
            const identifier =
              template.template_name || template.template_identifier;
            return !publicTemplateIdentifiers.has(identifier);
          }
        );

        // Combine public templates with filtered private templates
        const allTemplates = [...filteredPrivateTemplates, ...publicTemplates];

        setTemplates(allTemplates);
      } catch (error) {
        console.error("Error fetching templates:", error);
        notification.error({
          message: "Failed to Load Templates",
          description:
            "Unable to load templates for filtering. Please try again later.",
        });
      }
    };

    fetchTemplates();
  }, [isModalVisible, token]);

  const handleDownload = async () => {
    if (!selectedTemplate) {
      notification.error({
        message: "Template Required",
        description: "Please select a template to download case studies.",
      });
      return;
    }

    const params = {};
    if (selectedDateRange && selectedDateRange[0] && selectedDateRange[1]) {
      params.start_date = selectedDateRange[0].startOf("day").toISOString();
      params.end_date = selectedDateRange[1].endOf("day").toISOString();
    }

    try {
      setIsDownloading(true);

      const template = templates.find(
        (t) =>
          t.template_name === selectedTemplate ||
          t.template_identifier === selectedTemplate
      );
      const reportType = template?.report_metadata?.report_type;

      let apiUrl, filename, description, format;

      if (downloadType === "excel") {
        apiUrl = `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/template/${selectedTemplate}/downloadExcel`;
        filename = `${reportType.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        )}_Case_Studies.xlsx`;
        description = `Case studies for ${reportType} have been downloaded successfully in Excel format.`;
        format = "Excel";
      } else if (downloadType === "docx") {
        apiUrl = `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/template/${selectedTemplate}/downloadDocuments?format=docx`;
        filename = `${reportType.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        )}_Case_Studies_DOCX.zip`;
        description = `Case studies for ${reportType} have been downloaded successfully as a ZIP file containing Word documents.`;
        format = "Word Documents (ZIP)";
      } else {
        // downloadType === 'pdf'
        apiUrl = `${
          import.meta.env.VITE_API_BASE_URL
        }/reports/template/${selectedTemplate}/downloadDocuments?format=pdf`;
        filename = `${reportType.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        )}_Case_Studies_PDF.zip`;
        description = `Case studies for ${reportType} have been downloaded successfully as a ZIP file containing PDF documents.`;
        format = "PDF Documents (ZIP)";
      }

      if (reportType) {
        params.display_name = reportType;
      }

      notification.info({
        message: "Preparing Download",
        description: `Your case studies are being prepared for download in ${format} format...`,
      });

      const response = await axios.get(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
        params: params,
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      const contentDisposition = response.headers["content-disposition"];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notification.success({
        message: "Download Complete",
        description: description,
      });

      setIsModalVisible(false);
      setSelectedTemplate(null);
      setSelectedDateRange([null, null]);
    } catch (error) {
      console.error(`Error downloading ${downloadType} file:`, error);

      let errorMessage = `Unable to download the ${downloadType} file. Please try again.`;
      if (error.response && error.response.status === 404) {
        errorMessage =
          "No case studies found for the selected template or date range.";
      }

      notification.error({
        message: "Download Failed",
        description: errorMessage,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setSelectedTemplate(null);
    setSelectedDateRange([null, null]);
    setDownloadType("excel");
    setIsModalVisible(false);
  };

  const filterOption = (input, option) => {
    const template = templates.find(
      (template) => template.template_name === option.value
    );
    if (!template) return false;
    const reportType = template.report_metadata?.report_type || "";
    return reportType.toLowerCase().includes(input.toLowerCase());
  };

  const filteredTableData = tableData
    ?.filter((rowData) => rowData.title.toLowerCase().includes(searchTerm))
    ?.filter((rowData) => rowData.study_type === "style_custom");
  return (
    <Flex vertical gap="middle" style={{ padding: 32 }}>
      {isLoading ? (
        <Skeleton active />
      ) : (
        <>
          <Flex gap="middle" justify="space-between" align="center">
            <Input
              placeholder="Search"
              suffix={<SearchOutlined />}
              style={{ maxWidth: "50%", borderRadius: "24px" }}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button icon={<DownloadOutlined />} onClick={handleDownloadModal}>
              Download Reports
            </Button>
          </Flex>
          <Table
            size="middle"
            scroll={{ x: "max-content" }}
            bordered
            columns={columns}
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

      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <DownloadOutlined />
            <span>Download Reports By Template</span>
          </div>
        }
        open={isModalVisible}
        onOk={handleDownload}
        onCancel={handleCancel}
        okText={isDownloading ? "Downloading..." : "Download"}
        okButtonProps={{ loading: isDownloading }}
        destroyOnClose
      >
        <Tabs
          activeKey={downloadType}
          onChange={setDownloadType}
          items={[
            {
              key: "excel",
              label: (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <FileExcelOutlined />
                  <span>Excel</span>
                </div>
              ),
            },
            {
              key: "docx",
              label: (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <FileWordOutlined />
                  <span>Word Document</span>
                </div>
              ),
            },
            {
              key: "pdf",
              label: (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <FilePdfOutlined />
                  <span>PDF</span>
                </div>
              ),
            },
          ]}
        />

        <Form layout="vertical">
          <Form.Item
            label="Select Template"
            help="Template selection is required."
            required
          >
            <Select
              showSearch
              placeholder="Select or search for a template"
              value={selectedTemplate}
              onChange={setSelectedTemplate}
              filterOption={filterOption}
              optionFilterProp="children"
              style={{ width: "100%" }}
              size="medium"
              disabled={isDownloading}
              allowClear
            >
              {templates.map((template) => (
                <Option
                  key={template.template_name}
                  value={template.template_name}
                >
                  {template.report_metadata?.report_type ||
                    template.template_name}
                  {template.isPublic && (
                    <span style={{ color: "#52c41a", marginLeft: "8px" }}>
                      (Public)
                    </span>
                  )}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Date Range" help="Optional: Filter by date range.">
            <DatePicker.RangePicker
              style={{ width: "100%" }}
              size="medium"
              value={selectedDateRange}
              onChange={setSelectedDateRange}
              disabled={isDownloading}
              placeholder={["Start Date", "End Date"]}
              format="MM-DD-YYYY"
              allowClear
              ranges={getPresetRanges()}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
};
