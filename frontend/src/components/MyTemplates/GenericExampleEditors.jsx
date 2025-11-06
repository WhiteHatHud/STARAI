import { Button, Input, Space, Dropdown, Menu, Typography } from 'antd';
import { PlusOutlined, MinusCircleOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

// Text Editor Component
export const TextEditor = ({ value, onChange, placeholder }) => {
    return (
        <TextArea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
                let newValue = e.target.value;
                try {
                    newValue = JSON.parse(newValue);
                } catch {
                    // Keep as string if not valid JSON
                }
                onChange(newValue);
            }}
            rows={3}
            placeholder={placeholder || "Generic example content with <placeholders> for all variable content"}
        />
    );
};

// List Editor Component
export const ListEditor = ({ value, onChange }) => {
    const currentList = Array.isArray(value) ? value : [];

    const addItem = () => {
        onChange([...currentList, 'New list item with <placeholders>']);
    };

    const updateItem = (itemIndex, newValue) => {
        const newList = [...currentList];
        newList[itemIndex] = newValue;
        onChange(newList);
    };

    const removeItem = (itemIndex) => {
        const newList = currentList.filter((_, i) => i !== itemIndex);
        onChange(newList);
    };

    const getListItemMenu = (itemIndex) => (
        <Menu>
            <Menu.Item 
                key="add-above" 
                icon={<PlusOutlined />}
                onClick={() => {
                    const newList = [...currentList];
                    newList.splice(itemIndex, 0, 'New list item with <placeholders>');
                    onChange(newList);
                }}
            >
                Add Item Above
            </Menu.Item>
            <Menu.Item 
                key="add-below" 
                icon={<PlusOutlined />}
                onClick={() => {
                    const newList = [...currentList];
                    newList.splice(itemIndex + 1, 0, 'New list item with <placeholders>');
                    onChange(newList);
                }}
            >
                Add Item Below
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item 
                key="delete" 
                icon={<DeleteOutlined />}
                danger
                onClick={() => removeItem(itemIndex)}
            >
                Delete Item
            </Menu.Item>
        </Menu>
    );

    return (
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
            }}>
                <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={addItem}
                    size="small"
                >
                    Add Item
                </Button>
            </div>

            <Space direction="vertical" style={{ width: '100%' }} size="small">
                {currentList.map((item, itemIndex) => (
                    <Dropdown 
                        key={itemIndex}
                        overlay={getListItemMenu(itemIndex)} 
                        trigger={['contextMenu']}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px',
                                cursor: 'context-menu'
                            }}
                        >
                            <Text
                                style={{
                                    minWidth: '20px',
                                    lineHeight: '32px',
                                    color: '#666'
                                }}
                            >
                                •
                            </Text>
                            <Input
                                value={item}
                                onChange={(e) => updateItem(itemIndex, e.target.value)}
                                placeholder="Enter list item with <placeholders>"
                                style={{ flex: 1 }}
                            />
                        </div>
                    </Dropdown>
                ))}

                {currentList.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        color: '#999',
                        fontStyle: 'italic',
                        padding: '12px'
                    }}>
                        No list items yet. Click "Add Item" to create one.
                    </div>
                )}
            </Space>
        </div>
    );
};

// Table Editor Component
export const TableEditor = ({ value, onChange }) => {
    const currentTable = Array.isArray(value) ? value : [];

    const updateCell = (rowIndex, cellIndex, newValue) => {
        const newTable = [...currentTable];
        const currentRow = [...newTable[rowIndex]];
        currentRow[cellIndex] = newValue;
        newTable[rowIndex] = currentRow;
        onChange(newTable);
    };

    const getIntegratedMenu = (rowIndex, cellIndex) => (
        <Menu>
            <Menu.Item 
                key="add-row-above" 
                icon={<PlusOutlined />}
                onClick={() => {
                    const newTable = [...currentTable];
                    newTable.splice(rowIndex, 0, ['New cell with <placeholders>']);
                    onChange(newTable);
                }}
            >
                Add Row Above
            </Menu.Item>
            <Menu.Item 
                key="add-row-below" 
                icon={<PlusOutlined />}
                onClick={() => {
                    const newTable = [...currentTable];
                    newTable.splice(rowIndex + 1, 0, ['New cell with <placeholders>']);
                    onChange(newTable);
                }}
            >
                Add Row Below
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item 
                key="add-cell-left" 
                icon={<PlusOutlined />}
                onClick={() => {
                    const newTable = [...currentTable];
                    const currentRow = [...newTable[rowIndex]];
                    currentRow.splice(cellIndex, 0, 'New cell');
                    newTable[rowIndex] = currentRow;
                    onChange(newTable);
                }}
            >
                Add Cell Left
            </Menu.Item>
            <Menu.Item 
                key="add-cell-right" 
                icon={<PlusOutlined />}
                onClick={() => {
                    const newTable = [...currentTable];
                    const currentRow = [...newTable[rowIndex]];
                    currentRow.splice(cellIndex + 1, 0, 'New cell');
                    newTable[rowIndex] = currentRow;
                    onChange(newTable);
                }}
            >
                Add Cell Right
            </Menu.Item>
            <Menu.Divider />
            {currentTable[rowIndex].length > 1 && (
                <Menu.Item 
                    key="delete-cell" 
                    icon={<MinusCircleOutlined />}
                    danger
                    onClick={() => {
                        const newTable = [...currentTable];
                        const currentRow = [...newTable[rowIndex]];
                        currentRow.splice(cellIndex, 1);
                        newTable[rowIndex] = currentRow;
                        onChange(newTable);
                    }}
                >
                    Delete Cell
                </Menu.Item>
            )}
            <Menu.Item 
                key="delete-row" 
                icon={<DeleteOutlined />}
                danger
                onClick={() => {
                    const newTable = currentTable.filter((_, i) => i !== rowIndex);
                    onChange(newTable);
                }}
            >
                Delete Row
            </Menu.Item>
        </Menu>
    );

    return (
        <div>
            <div style={{
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                overflow: 'hidden',
                backgroundColor: '#fff'
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%'
                }}>
                    {currentTable.map((row, rowIndex) => {
                        const rowArray = Array.isArray(row) ? row : [row];
                        return (
                            <div
                                key={rowIndex}
                                style={{
                                    display: 'flex',
                                    width: '100%',
                                    minHeight: '40px'
                                }}
                            >
                                {rowArray.map((cell, cellIndex) => (
                                    <Dropdown 
                                        key={cellIndex}
                                        overlay={getIntegratedMenu(rowIndex, cellIndex)} 
                                        trigger={['contextMenu']}
                                    >
                                        <div
                                            style={{
                                                flex: 1,
                                                border: '1px solid #f0f0f0',
                                                padding: '8px',
                                                display: 'flex',
                                                alignItems: 'stretch',
                                                minHeight: '40px',
                                                cursor: 'context-menu'
                                            }}
                                        >
                                            <TextArea
                                                value={cell}
                                                onChange={(e) => updateCell(rowIndex, cellIndex, e.target.value)}
                                                placeholder="Cell content with <placeholders>"
                                                autoSize={{ minRows: 1 }}
                                                style={{
                                                    border: 'none',
                                                    padding: '0',
                                                    boxShadow: 'none',
                                                    resize: 'none',
                                                    width: '100%'
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
                    <div style={{
                        textAlign: 'center',
                        color: '#999',
                        fontStyle: 'italic',
                        padding: '24px'
                    }}>
                        No table data yet. Right-click to add a row.
                    </div>
                )}
            </div>

            <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#666'
            }}>
                <Text type="secondary">
                    💡 Tip: Right-click on any cell to add rows, add cells, or delete. Use &lt;placeholders&gt; for dynamic content.
                </Text>
            </div>
        </div>
    );
};