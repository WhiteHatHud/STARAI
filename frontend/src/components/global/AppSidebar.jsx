import { useLocation } from "react-router-dom";

import { Menu, Layout, Switch, App } from "antd";
import {
  LogoutOutlined,
  ExclamationCircleOutlined,
  MoonFilled,
  SunOutlined,
} from "@ant-design/icons";
import getMenuItems from "../../data/menuItems";
import projectLogo from "../../assets/images/project_logo.png";
import projectLogoCollapsed from "../../assets/images/project_logo_collapsed.png";
import { useEffect, useMemo, useState } from "react";
import useStore from "../../store";

const keyExistsInMenu = (key, items) => {
  for (const item of items) {
    if (item.key === key) return true;
    if (item.children) {
      if (keyExistsInMenu(key, item.children)) return true;
    }
  }
  return false;
};

const findParentKey = (key, items, parent = null) => {
  for (const item of items) {
    if (item.key === key) return parent;
    if (item.children) {
      const found = findParentKey(key, item.children, item.key);
      if (found) return found;
    }
  }
  return null;
};

export const AppSidebar = ({
  redirectTo,
  themeToken,
  user,
  isMobile,
  onLogout,
  isDarkMode,
  setIsDarkMode,
}) => {
  const { modal } = App.useApp();
  const footerChildren = [];
  let location = useLocation();
  const [selectedMenuItems, setSelectedMenuItems] = useState([]);
  const [openKeys, setOpenKeys] = useState([]);
  const mainMenuItems = useMemo(() => {
    const items = getMenuItems().map((menuItem) =>
      menuItem?.children
        ? { ...menuItem, children: [...menuItem.children] }
        : menuItem
    );

    if (!user?.is_admin) {
      items.forEach((menuItem) => {
        if (menuItem && Array.isArray(menuItem.children)) {
          menuItem.children = menuItem.children.filter(
            (child) => child.key !== "/admin"
          );
        }
      });
    }
    return items;
    //eslint-disable-next-line
  }, [user?.is_admin, isDarkMode]);

  // Get collapsed state from store
  const collapsed = useStore((state) => state.collapsed);

  useEffect(() => {
    const candidateKey = location.pathname;
    let selected = [];
    let open = [];
    if (keyExistsInMenu(candidateKey, mainMenuItems)) {
      selected = [candidateKey];
      const parent = findParentKey(candidateKey, mainMenuItems);
      if (parent) open = [parent];
    } else {
      const rootPath = location.pathname.split("/")[1];
      selected = ["/" + rootPath];
    }
    setSelectedMenuItems(selected);
    if (!collapsed) {
      setOpenKeys(open);
    } else {
      setOpenKeys([]);
    }
  }, [location, collapsed, mainMenuItems]);

  const handleMenuClick = (menuItem) => {
    if (menuItem.key === "logout" || menuItem.key === "edit-account") return;

    if (menuItem.key === "theme-toggle") {
      setIsDarkMode(!isDarkMode);
      return;
    }
    redirectTo(menuItem.key);
  };

  footerChildren.push({
    key: "logout",
    icon: <LogoutOutlined />,
    label: "Logout",
    onClick: () => {
      modal.confirm({
        title: "Confirm Logout",
        icon: <ExclamationCircleOutlined />,
        content: "Are you sure you want to log out?",
        okText: "Logout",
        okType: "danger",
        cancelText: "Cancel",
        onOk: () => {
          onLogout();
        },
      });
    },
  });

  const footerMenuItems = {
    key: "footer",
    label: "Account",
    type: "group",
    children: footerChildren,
  };

  const themeMenuItem = {
    key: "theme",
    label: "Theme",
    type: "group",
    children: [
      {
        key: "theme-toggle",
        className: "theme-select-menu-item",
        icon: isDarkMode ? <MoonFilled /> : <SunOutlined />,
        label: (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Switch
              checked={isDarkMode}
              onChange={(checked) => setIsDarkMode(checked)}
              checkedChildren="Dark"
              unCheckedChildren="Light"
            />
          </div>
        ),
      },
    ],
  };

  mainMenuItems.push(themeMenuItem);
  mainMenuItems.push(footerMenuItems);

  return (
    <Layout.Sider
      collapsed={collapsed}
      width={240}
      collapsedWidth={isMobile ? 0 : 80}
      trigger={null}
      className="app-sidebar"
      style={{ border: `1px solid ${themeToken.colorBorder}` }}
    >
      <div className="app-logo" onClick={() => redirectTo("/")}>
        <img
          src={collapsed ? projectLogoCollapsed : projectLogo}
          alt="App Logo"
        />
      </div>

      <Menu
        mode="inline"
        selectedKeys={selectedMenuItems}
        openKeys={openKeys}
        onOpenChange={(keys) => {
          if (!collapsed) setOpenKeys(keys);
        }}
        onClick={handleMenuClick}
        items={mainMenuItems}
        style={{
          backgroundColor: themeToken.colorBgContainer,
          borderInlineEnd: 0,
        }}
      />
    </Layout.Sider>
  );
};
