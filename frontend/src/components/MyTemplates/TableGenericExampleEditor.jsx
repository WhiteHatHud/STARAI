import { Dropdown, Input, Typography, theme, Tooltip, Flex, Space } from "antd";
import {
  PlusOutlined,
  MinusCircleOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";

const { TextArea } = Input;
const { Text } = Typography;

const DEFAULT_CELL = "New cell with <placeholders>";

const TableGenericExampleEditor = ({ value, onChange }) => {
  const { token: themeToken } = theme.useToken();
  const currentTable = Array.isArray(value) ? value : [];

  const setTable = (next) => onChange(next);

  const updateCell = (rowIndex, cellIndex, newValue) => {
    const next = [...currentTable];
    const row = Array.isArray(next[rowIndex]) ? [...next[rowIndex]] : [];
    row[cellIndex] = newValue;
    next[rowIndex] = row;
    setTable(next);
  };

  const rightClickMenuItems = (rowIndex, cellIndex) => [
    {
      key: "add-row-above",
      icon: <PlusOutlined />,
      label: "Add Row Above",
      onClick: () => {
        const next = [...currentTable];
        next.splice(rowIndex, 0, [DEFAULT_CELL]);
        setTable(next);
      },
    },
    {
      key: "add-row-below",
      icon: <PlusOutlined />,
      label: "Add Row Below",
      onClick: () => {
        const next = [...currentTable];
        next.splice(rowIndex + 1, 0, [DEFAULT_CELL]);
        setTable(next);
      },
    },
    {
      key: "add-cell-left",
      icon: <PlusOutlined />,
      label: "Add Cell Left",
      onClick: () => {
        const next = [...currentTable];
        const row = [...next[rowIndex]];
        row.splice(cellIndex, 0, "New cell");
        next[rowIndex] = row;
        setTable(next);
      },
    },
    {
      key: "add-cell-right",
      icon: <PlusOutlined />,
      label: "Add Cell Right",
      onClick: () => {
        const next = [...currentTable];
        const row = [...next[rowIndex]];
        row.splice(cellIndex + 1, 0, "New cell");
        next[rowIndex] = row;
        setTable(next);
      },
    },
    { type: "divider" },
    {
      key: "delete-cell",
      icon: <MinusCircleOutlined />,
      label: "Delete Cell",
      danger: true,
      onClick: () => {
        const next = [...currentTable];
        const row = [...next[rowIndex]];
        row.splice(cellIndex, 1);
        next[rowIndex] = row;
        setTable(next);
      },
      disabled: currentTable[rowIndex]?.length <= 1,
    },
    {
      key: "delete-row",
      icon: <DeleteOutlined />,
      label: "Delete Row",
      danger: true,
      onClick: () => {
        setTable(currentTable.filter((_, i) => i !== rowIndex));
      },
    },
  ];

  return (
    <Flex vertical gap="small">
      <Space>
        <Text>Edit Table</Text>
        <Tooltip title="Tip: Right-click on any cell to add rows, add cells, or delete.">
          <QuestionCircleOutlined />
        </Tooltip>
      </Space>
      <div
        style={{
          border: `1px solid ${themeToken.colorText}`,
          borderRadius: 6,
          overflow: "hidden",
          backgroundColor: themeToken.colorBgElevated,
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
          {currentTable.map((row, rowIndex) => {
            const rowArray = Array.isArray(row) ? row : [row];
            return (
              <div
                key={rowIndex}
                style={{
                  display: "flex",
                  width: "100%",
                  minHeight: 40,
                }}
              >
                {rowArray.map((cell, cellIndex) => (
                  <Dropdown
                    key={cellIndex}
                    menu={{ items: rightClickMenuItems(rowIndex, cellIndex) }}
                    trigger={["contextMenu"]}
                  >
                    <div
                      style={{
                        flex: 1,
                        border: `1px solid ${themeToken.colorText}`,
                        padding: 8,
                        display: "flex",
                        alignItems: "stretch",
                        minHeight: 40,
                        cursor: "context-menu",
                      }}
                    >
                      <TextArea
                        value={cell}
                        onChange={(e) =>
                          updateCell(rowIndex, cellIndex, e.target.value)
                        }
                        placeholder="Cell content with <placeholders>"
                        autoSize={{ minRows: 1 }}
                        style={{
                          border: "none",
                          padding: 0,
                          boxShadow: "none",
                          resize: "none",
                          width: "100%",
                          backgroundColor: "transparent",
                        }}
                      />
                    </div>
                  </Dropdown>
                ))}
              </div>
            );
          })}
        </div>

        {currentTable.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#999",
              fontStyle: "italic",
              padding: 24,
            }}
          >
            No table data yet. Right-click to add a row.
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: "#666",
        }}
      ></div>
    </Flex>
  );
};

export default TableGenericExampleEditor;
