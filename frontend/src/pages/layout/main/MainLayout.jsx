import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Layout, Button, Typography, theme, Flex } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";

import useStore from "../../../store";
import "./MainLayout.css";

import HomePage from "../../HomePage/HomePage";
import DatasetDetailPage from "../../DatasetDetail";
import RootPage from "../RootPage";
import AdminDashboardPage from "../../AdminDashboard/AdminDashboardPage";
import TemplatePage from "../../MyTemplates";
import DocumentToContentBridge from "../../PresetGeneration/DocumentToContentBridge";
import { FolderManager, UploadManager } from "../../MyFolders";
import { ReportEditor, ReportDashboardPage } from "../../Reports";
import {
  CustomReportViewer,
  CustomStudyDashboardPage,
} from "../../GeneratedForms";
import {
  AppSidebar,
  CurrentlyProcessingContent,
  ProgressStatus,
} from "../../../components/global";

import { getPageTitle } from "../../../data/menuItems";
import {
  SlideDashboardPage,
  SlideCreatePage,
  SlideOutlinesPage,
} from "../../MySlides";
import { SlideTemplatesPage } from "../../SlideTemplates";
import { FirstTimeLoginModal } from "../../../components/global/FirstTimeLoginModal";

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

const MainLayout = ({ onLogout, isDarkMode, setIsDarkMode }) => {
  const {
    user,
    token,
    currentCaseID,
    renderedPageID,
    previousPageID,
    setPreviousPageID,
    collapsed,
    setCollapsed,
    footerContent,
  } = useStore();
  const projectVariant = import.meta.env.VITE_PROJECT_VARIANT;

  const [currentProgressId, setCurrentProgressId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [processingContent, setProcessingContent] = useState([]);
  const navigate = useNavigate();

  const { token: themeToken } = theme.useToken();

  const fetchCurrentlyProcessingContent = useCallback(async () => {
    try {
      // TODO: Implement progress tracking for anomaly detection
      // When implementing, use: /api/anomaly/analysis-sessions?status=processing
      // For now, we'll keep this empty to avoid 404 errors
      setProcessingContent([]);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    fetchCurrentlyProcessingContent();

    return () => window.removeEventListener("resize", handleResize);
  }, [fetchCurrentlyProcessingContent]);

  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile, setCollapsed]);

  useEffect(() => {
    if (!processingContent || processingContent.length === 0) return;

    const intervalID = setInterval(fetchCurrentlyProcessingContent, 5000);
    return () => clearInterval(intervalID);
  }, [fetchCurrentlyProcessingContent, processingContent]);

  return (
    <Layout
      className="main-layout"
      style={{
        minHeight: "100vh",
        backgroundColor: themeToken.colorBgContainer,
      }}
    >
      {isMobile && !collapsed && (
        <div
          className="mobile-overlay"
          onClick={() => setCollapsed(true)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            zIndex: 999,
          }}
        />
      )}
      <AppSidebar
        selectedKey={renderedPageID}
        redirectTo={navigate}
        themeToken={themeToken}
        user={user}
        isMobile={isMobile}
        onLogout={onLogout}
        setIsDarkMode={setIsDarkMode}
        isDarkMode={isDarkMode}
      />
      <Layout style={{ marginLeft: isMobile ? 0 : undefined }}>
        <Header
          style={{
            display: "flex",
            padding: "0 24px",
            alignItems: "center",
            justifyContent: "space-between",
            background: themeToken.colorBgContainer,
          }}
        >
          <Flex gap="middle" align="center">
            <Button
              shape="circle"
              size="large"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Title level={3} style={{ margin: 0 }}>
              {getPageTitle(renderedPageID)}
            </Title>
          </Flex>

          <Flex gap="small" align="center" style={{ paddingRight: "6px" }}>
            {processingContent?.length > 0 && (
              <CurrentlyProcessingContent
                processingContent={processingContent}
                themeToken={themeToken}
                setCurrentProgressId={setCurrentProgressId}
                setPreviousPageID={setPreviousPageID}
                redirectTo={navigate}
              />
            )}
          </Flex>
        </Header>
        <Content
          className="main-content"
          style={{
            padding: "24px",
            margin: "0",
            minHeight: "calc(100vh - 64px)",
            background: themeToken.colorBgContainer,
          }}
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dataset/:datasetId" element={<DatasetDetailPage />} />
            {user?.is_admin &&
              (projectVariant === "custom" ||
                projectVariant === "report") && (
                <Route path="/admin" element={<RootPage />}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route
                    path="generated-content"
                    element={
                      projectVariant === "custom" ? (
                        <CustomReportViewer
                          reportId={currentCaseID}
                          token={token}
                        />
                      ) : (
                        <ReportEditor
                          token={token}
                          themeToken={themeToken}
                          redirectTo={navigate}
                          isDarkMode={isDarkMode}
                        />
                      )
                    }
                  />
                </Route>
              )}
            <Route path="/folders" element={<RootPage />}>
              <Route index element={<FolderManager token={token} />} />
              <Route
                path="upload"
                element={
                  <UploadManager
                    redirectTo={navigate}
                    token={token}
                    triggerProcessingData={fetchCurrentlyProcessingContent}
                    processingContent={processingContent}
                  />
                }
              />
            </Route>
            {projectVariant === "custom" && (
              <>
                <Route
                  path="/templates"
                  element={
                    <TemplatePage
                      token={token}
                      isDarkMode={isDarkMode}
                      triggerProcessingData={fetchCurrentlyProcessingContent}
                      setCurrentProgressId={setCurrentProgressId}
                    />
                  }
                />
                <Route path="/generated-forms" element={<RootPage />}>
                  <Route
                    index
                    element={
                      <CustomStudyDashboardPage
                        token={token}
                        themeToken={themeToken}
                        isDarkMode={isDarkMode}
                        redirectTo={navigate}
                        processingContent={processingContent}
                        setPreviousPageID={setPreviousPageID}
                        setCurrentProgressId={setCurrentProgressId}
                      />
                    }
                  />
                  <Route
                    path="editor"
                    element={
                      <CustomReportViewer
                        reportId={currentCaseID}
                        token={token}
                      />
                    }
                  />
                </Route>
              </>
            )}

            {(projectVariant === "report" || projectVariant === "sof") && (
              <>
                <Route
                  path="/content-bridge"
                  element={
                    <DocumentToContentBridge
                      token={token}
                      themeToken={themeToken}
                      triggerProcessingData={fetchCurrentlyProcessingContent}
                      setCurrentProgressId={setCurrentProgressId}
                      setPreviousPageID={setPreviousPageID}
                      redirectTo={navigate}
                    />
                  }
                />
                <Route
                  path={
                    projectVariant === "sof" ? "/sof-reports" : "/reports"
                  }
                  element={<RootPage />}
                >
                  <Route
                    index
                    element={
                      <ReportDashboardPage
                        token={token}
                        themeToken={themeToken}
                        isDarkMode={isDarkMode}
                        redirectTo={navigate}
                        processingContent={processingContent}
                        setPreviousPageID={setPreviousPageID}
                        setCurrentProgressId={setCurrentProgressId}
                      />
                    }
                  />
                  <Route
                    path="editor"
                    element={
                      <ReportEditor
                        token={token}
                        themeToken={themeToken}
                        redirectTo={navigate}
                        isDarkMode={isDarkMode}
                      />
                    }
                  />
                </Route>
              </>
            )}

            {projectVariant === "slide" && (
              <>
                <Route path="/slides" element={<RootPage />}>
                  <Route index element={<SlideDashboardPage />} />
                  <Route path="create" element={<SlideCreatePage />} />
                  <Route path="outlines" element={<SlideOutlinesPage />} />
                  <Route path="templates" element={<SlideTemplatesPage />} />
                </Route>
              </>
            )}

            <Route
              path="/progress"
              element={
                <ProgressStatus
                  previousPageID={previousPageID}
                  token={token}
                  progressID={currentProgressId}
                  redirectTo={navigate}
                  processingContent={processingContent}
                />
              }
            />

            {/* Handle unknown routes by redirecting to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* FIRST TIME LOGIN MODAL */}
          <FirstTimeLoginModal />
        </Content>
        {footerContent && (
          <Footer
            style={{
              background: themeToken.colorBgContainer,
              position: footerContent.isSticky ? "sticky" : "static",
              bottom: footerContent.isSticky ? 0 : "auto",
              zIndex: footerContent.isSticky ? 1000 : "auto",
              padding: 0,
              ...(footerContent.isSticky
                ? { boxShadow: "0 -4px 8px rgba(0, 0, 0, 0.05)" }
                : {}),
            }}
          >
            {footerContent.content}
          </Footer>
        )}
      </Layout>
    </Layout>
  );
};

export default MainLayout;
