import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  Flex,
  Typography,
  Select,
  Empty,
  Button,
  Tag,
  Space,
  Form,
  notification,
  Pagination,
  Menu,
  Dropdown,
  Skeleton,
} from "antd";
import {
  DownloadOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import axios from "axios";
import useStore from "../../store";
import styleMapping from "../../data/styleMapping";
import SectionCard from "../../components/Reports/SectionCard";
import { BackButton } from "../../components/global";

const { Text } = Typography;

export const ReportEditor = ({ token, redirectTo, isDarkMode }) => {
  const location = useLocation();

  const [reports, setReports] = useState([]);
  const [selectedReportOption, setSelectedReportOption] = useState();
  const [selectedReportData, setSelectedReportData] = useState({});
  const [selectedReportSections, setSelectedReportSections] = useState(
    []
  );
  const [selectedSectionOption, setSelectedSectionOption] = useState();
  const [selectedSectionData, setSelectedSectionData] = useState({});
  const [isViewContentAsSections, setIsViewContentAsSections] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editMode, setEditMode] = useState("");
  const { currentCaseID } = useStore();
  const readOnly = location.pathname.includes("/admin");
  const [isDownloading, setIsDownloading] = useState(false);
  const projectVariant = import.meta.env.VITE_PROJECT_VARIANT;
  const isMobile = window.innerWidth <= 768;

  const [form] = Form.useForm();

  async function refreshDataAfterSave() {
    const updatedReport = await fetchSelectedReportData(
      selectedReportData._id
    );
    setSelectedReportSections(updatedReport?.sections);
    setSelectedReportData(updatedReport);
    setSelectedSectionData(
      updatedReport?.sections.find(
        (section) => section.section_id === selectedSectionOption
      )
    );
    setEditMode("");
  }

  const fetchSelectedReportData = useCallback(
    async (caseID) => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/reports/${caseID}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        setSelectedReportData(response.data);
        return response.data;
      } catch (err) {
        console.error("Error fetching case studies from ReportEditor:", err);
      }
    },
    [token]
  );

  const saveManualEdit = async (content) => {
    if (readOnly) {
      notification.warning({
        message: "Read-only",
        description:
          "Editing is disabled when viewing from the Admin Dashboard.",
      });
      return;
    }
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/reports/${
          selectedReportData._id
        }/sections/${selectedSectionOption}`,
        { content: content },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      notification.success({
        message: "Section updated!",
      });

      await refreshDataAfterSave();
    } catch (error) {
      console.error("Error saving manual edits to the DB:", error);
    }
  };

  useEffect(() => {
    const fetchAllCaseFolders = async () => {
      const selectedUserID = location.state?.selectedUserID ?? null;
      const fetchURL = readOnly
        ? `/reports/user/${selectedUserID}`
        : "/reports/";
      try {
        setIsLoading(true);
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}${fetchURL}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const options = response.data
          .filter((item) => item.status === "published")
          .filter(
            (item) =>
              item.study_type !== "style_custom" &&
              item.study_type !== "style_sof"
          )
          .map((item) => ({
            value: item._id,
            label: item.title,
          }));
        const sofOptions = response.data
          .filter((item) => item.status === "published")
          .filter((item) => item.study_type === "style_sof")
          .map((item) => ({
            value: item._id,
            label: item.title,
          }));

        let selectedCase = null;

        if (projectVariant === "sof") {
          setReports(sofOptions);
          selectedCase = sofOptions[0].value;
          if (currentCaseID !== "")
            selectedCase = sofOptions.find(
              (option) => option.value === currentCaseID
            ).value;
          setSelectedReportOption(selectedCase);
        } else {
          setReports(options);
          selectedCase = options[0].value;
          if (currentCaseID !== "")
            selectedCase = options.find(
              (option) => option.value === currentCaseID
            ).value;
          setSelectedReportOption(selectedCase);
        }
      } catch (err) {
        console.error("Error fetching case studies from ReportEditor:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllCaseFolders();
  }, [
    token,
    currentCaseID,
    projectVariant,
    location.state?.selectedUserID,
    readOnly,
  ]);

  useEffect(() => {
    const reloadSelectedReport = async () => {
      const selectedReportData = await fetchSelectedReportData(
        selectedReportOption
      );

      setSelectedReportSections(selectedReportData?.sections);
      setSelectedSectionOption(selectedReportData?.sections[0].section_id);
    };

    if (selectedReportOption) reloadSelectedReport();
  }, [selectedReportOption, fetchSelectedReportData]);

  useEffect(() => {
    if (selectedSectionOption) {
      const newSectionData = selectedReportSections.find(
        (section) => section.section_id === selectedSectionOption
      );

      setSelectedSectionData(newSectionData);
      form.setFieldsValue({ content: newSectionData.content });
    }
  }, [selectedSectionOption, editMode, selectedReportSections, form]);

  const handleOnChangePage = (currentPage) => {
    setSelectedSectionOption(
      selectedReportSections[currentPage - 1].section_id
    );
  };

  const handleOnDownload = async (format = "pdf") => {
    try {
      setIsDownloading(true);

      notification.info({
        message: "Preparing Download",
        description: `Your case study is being prepared for download in ${format.toUpperCase()} format...`,
      });

      let response;

      const projectVariant = import.meta.env.VITE_PROJECT_VARIANT;
      if (projectVariant === "sof") {
        // Make API request to sof download endpoint
        response = await axios({
          url: `${import.meta.env.VITE_API_BASE_URL}/reports/${
            selectedReportData._id
          }/download-form?format=${format}`,
          method: "GET",
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } else {
        // Make API request to case study download endpoint
        response = await axios({
          url: `${import.meta.env.VITE_API_BASE_URL}/reports/${
            selectedReportData._id
          }/download?format=${format}`,
          method: "GET",
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      // Create a download link and trigger it
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${selectedReportData.title || "Report"}.${format}`
      );
      document.body.appendChild(link);
      link.click();
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      notification.success({
        message: "Download Complete",
        description: `Case study has been downloaded successfully in ${format.toUpperCase()} format.`,
      });
    } catch (error) {
      console.error(`Error downloading ${format} case study:`, error);
      notification.error({
        message: "Download Failed",
        description: `Unable to download the case study in ${format.toUpperCase()} format. Please try again later.`,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const calculateCurrentPageNumber = () => {
    const index = selectedReportSections.findIndex(
      (section) => section.section_id === selectedSectionOption
    );
    return index + 1;
  };

  const downloadMenu = (
    <Menu>
      <Menu.Item
        key="pdf"
        icon={<FilePdfOutlined />}
        onClick={() => handleOnDownload("pdf")}
        disabled={isDownloading}
      >
        Download as PDF
      </Menu.Item>
      <Menu.Item
        key="docx"
        icon={<FileWordOutlined />}
        onClick={() => handleOnDownload("docx")}
        disabled={isDownloading}
      >
        Download as Word Document (.docx)
      </Menu.Item>
    </Menu>
  );

  return (
    <Flex vertical gap="middle" style={{ padding: isMobile ? 0 : 24 }}>
      {isLoading ? (
        <Skeleton active />
      ) : reports.length === 0 ? (
        <Empty
          description={<Text type="secondary">No Reports Generated.</Text>}
        >
          <Button type="primary" onClick={() => redirectTo("contentBridge")}>
            Generate Now
          </Button>
        </Empty>
      ) : (
        <Flex vertical gap="middle">
          <Space>
            <BackButton />
          </Space>
          <Flex vertical={isMobile} gap="small">
            <Space>
              {/* SEARCH BAR */}
              <Select
                className="report-selector"
                value={selectedReportOption}
                onChange={(value) => setSelectedReportOption(value)}
                options={reports}
                style={{ width: "100%" }}
              />
              {/* STUDY TYPE TAG */}
              {selectedReportData.study_type && (
                <Flex justify="center" align="center">
                  <Tag
                    color={
                      styleMapping[selectedReportData.study_type]?.color
                    }
                    style={{
                      margin: 0,
                      borderRadius: 24,
                      paddingTop: 4,
                      paddingBottom: 4,
                    }}
                  >
                    {styleMapping[selectedReportData.study_type]?.label}
                  </Tag>
                </Flex>
              )}
            </Space>
            {/* CHANGE VIEW BUTTON */}
            {projectVariant !== "sof" && (
              <Button
                icon={<EyeOutlined />}
                shape="round"
                onClick={() =>
                  setIsViewContentAsSections(!isViewContentAsSections)
                }
              >
                {`View Mode: ${isViewContentAsSections ? "Section" : "Scroll"}`}
              </Button>
            )}
            {/* DOWNLOAD BUTTON */}
            <Dropdown
              overlay={downloadMenu}
              trigger={["click"]}
              disabled={isDownloading}
            >
              <Button
                type="primary"
                icon={
                  isDownloading ? (
                    <DownloadOutlined spin />
                  ) : (
                    <DownloadOutlined />
                  )
                }
                loading={isDownloading}
                shape="round"
              >
                {isDownloading ? "Downloading..." : "Download"}
              </Button>
            </Dropdown>
          </Flex>
          {/* VIEW MODE: SCROLL */}
          {!isViewContentAsSections &&
            selectedReportSections.map((section) => (
              <SectionCard
                key={section.section_id}
                section={section}
                studyType={selectedReportData.study_type}
                styleMapping={styleMapping}
                editMode={editMode}
                selectedSectionOption={selectedSectionOption}
                setEditMode={setEditMode}
                setSelectedSectionOption={setSelectedSectionOption}
                form={form}
                saveManualEdit={saveManualEdit}
                isViewContentAsSections={isViewContentAsSections}
                isDarkMode={isDarkMode}
                token={token}
                reportId={selectedReportData._id}
                refreshDataAfterSave={refreshDataAfterSave}
                readOnly={readOnly}
              />
            ))}

          {/* VIEW MODE: SECTION CONTENT */}
          {isViewContentAsSections && selectedSectionData && (
            <>
              <SectionCard
                section={selectedSectionData}
                studyType={selectedReportData.study_type}
                styleMapping={styleMapping}
                editMode={editMode}
                selectedSectionOption={selectedSectionOption}
                setEditMode={setEditMode}
                setSelectedSectionOption={setSelectedSectionOption}
                form={form}
                saveManualEdit={saveManualEdit}
                isViewContentAsSections={isViewContentAsSections}
                isDarkMode={isDarkMode}
                token={token}
                reportId={selectedReportData._id}
                refreshDataAfterSave={refreshDataAfterSave}
                readOnly={readOnly}
              />

              {/* Pagination for navigating sections */}
              <Flex justify="center">
                <Pagination
                  simple={{ readOnly: true }}
                  current={calculateCurrentPageNumber()}
                  onChange={handleOnChangePage}
                  pageSize={1}
                  total={selectedReportSections?.length}
                />
              </Flex>
            </>
          )}
        </Flex>
      )}
    </Flex>
  );
};
