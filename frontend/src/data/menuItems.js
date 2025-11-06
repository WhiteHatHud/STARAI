import {
  FormOutlined,
  BookOutlined,
  AppstoreOutlined,
  FolderOutlined,
  CodeOutlined,
  DatabaseOutlined,
  HomeOutlined,
  ControlOutlined,
  LayoutOutlined,
  PlusOutlined,
} from "@ant-design/icons";

export default function getMenuItems() {
  let menuItems = [{ type: "divider" }];
  const variant = import.meta.env.VITE_PROJECT_VARIANT;

  switch (variant) {
    case "sof":
      menuItems.push({
        key: "menu",
        label: "Menu",
        type: "group",
        children: [
          {
            key: "/",
            icon: <HomeOutlined />,
            label: "Home Page",
            description: "Quick overview and navigation to main features.",
          },
          {
            key: "/folders",
            icon: <FolderOutlined />,
            label: "My Folders",
            description:
              "Organize and manage your uploaded documents and cases.",
          },
          {
            key: "/content-bridge",
            icon: <CodeOutlined />,
            label: "Preset Generation",
            description: "Generate SOF Reports using the predefined preset.",
          },
          {
            key: "/sof-reports",
            icon: <BookOutlined />,
            label: "Generated SOF Reports",
            description: "Browse and manage your generated reports.",
          },
        ],
      });
      break;
    case "report":
      menuItems.push({
        key: "menu",
        label: "Menu",
        type: "group",
        children: [
          {
            key: "/",
            icon: <HomeOutlined />,
            label: "Home Page",
            description: "Quick overview and navigation to main features.",
          },
          {
            key: "/admin",
            icon: <AppstoreOutlined />,
            label: "Admin Dashboard",
            description: "Monitor other user's folders and generated content.",
          },
          {
            key: "/folders",
            icon: <FolderOutlined />,
            label: "My Folders",
            description:
              "Organize and manage your uploaded documents and cases.",
          },
          {
            key: "/content-bridge",
            icon: <CodeOutlined />,
            label: "Preset Generation",
            description: "Generate new case studies using predefined presets.",
          },
          {
            key: "/reports",
            icon: <DatabaseOutlined />,
            label: "Reports",
            description: "Browse and manage your generated case studies.",
          },
        ],
      });
      break;
    case "custom":
      menuItems.push({
        key: "menu",
        label: "Menu",
        type: "group",
        children: [
          {
            key: "/",
            icon: <HomeOutlined />,
            label: "Home Page",
            description: "Quick overview and navigation to main features.",
          },
          {
            key: "/admin",
            icon: <AppstoreOutlined />,
            label: "Admin Dashboard",
            description: "Monitor other user's folders and generated content.",
          },
          {
            key: "/folders",
            icon: <FolderOutlined />,
            label: "My Folders",
            description:
              "Organize and manage your uploaded documents and cases.",
          },
          {
            key: "/templates",
            icon: <FormOutlined />,
            label: "My Templates",
            description: "Design and customize your own forms.",
          },
          {
            key: "/generated-forms",
            icon: <DatabaseOutlined />,
            label: "Generated Forms",
            description: "Browse and manage your generated forms.",
          },
        ],
      });
      break;

    case "slide":
      menuItems = [
        { type: "divider" },
        {
          key: "menu",
          label: "Menu",
          type: "group",
          children: [
            {
              key: "/",
              icon: <HomeOutlined />,
              label: "Home Page",
              description: "Quick overview and navigation to main features.",
            },
            {
              key: "/folders",
              icon: <FolderOutlined />,
              label: "My Folders",
              description:
                "Organize and manage your uploaded documents and cases.",
            },
            {
              key: "slides",
              label: "Slides",
              icon: <ControlOutlined />,
              children: [
                {
                  key: "/slides",
                  label: "My Slides",
                  icon: <DatabaseOutlined />,
                  description: "Browse and manage your generated slide decks.",
                },
                {
                  key: "/slides/create",
                  label: "Create Slides",
                  icon: <PlusOutlined />,
                  description: "Upload and manage your slide documents.",
                },
                {
                  key: "/slides/templates",
                  icon: <LayoutOutlined />,
                  label: "View Templates",
                  description:
                    "Browse and explore available presentation templates.",
                },
              ],
            },
          ],
        },
      ];
      break;
    default:
      menuItems.push({
        key: "menu",
        label: "Menu",
        type: "group",
        children: [
          {
            key: "/",
            icon: <HomeOutlined />,
            label: "Home Page",
            description: "Quick overview and navigation to main features.",
          },
          {
            key: "/admin",
            icon: <AppstoreOutlined />,
            label: "Admin Dashboard",
            description: "Monitor other user's folders and generated content.",
          },
          {
            key: "/folders",
            icon: <FolderOutlined />,
            label: "My Folders",
            description:
              "Organize and manage your uploaded documents and cases.",
          },
        ],
      });
  }

  return menuItems;
}

export function getPageTitle(key) {
  const items = getMenuItems();

  // Flatten children from grouped menuItems
  const allChildren = items
    .filter((item) => item.children) // keep only groups
    .flatMap((item) => item.children);

  // Find the matching one
  const match = allChildren.find((child) => child.key === key);

  return match ? match.label : "";
}
