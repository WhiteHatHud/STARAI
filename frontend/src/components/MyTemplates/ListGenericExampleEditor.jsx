import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Space } from "antd";
import { PlusOutlined, MenuOutlined, DeleteOutlined } from "@ant-design/icons";

const DEFAULT_ITEM = "New list item with <placeholders>";
const SEED_COUNT = 1;

const ListGenericExampleEditor = ({ value, onChange }) => {
  const currentList = Array.isArray(value) ? value : [];
  const initializedRef = useRef(false);

  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const setList = useCallback(
    (nextList) => {
      if (onChange) onChange(nextList);
    },
    [onChange]
  );

  // Seed initial items if empty
  useEffect(() => {
    if (initializedRef.current || currentList.length > 0) return;

    setList(Array.from({ length: SEED_COUNT }, () => DEFAULT_ITEM));
    initializedRef.current = true;
  }, [currentList.length, setList]);

  const addItem = () => setList([...currentList, DEFAULT_ITEM]);

  const updateItem = (idx, newVal) => {
    const next = [...currentList];
    next[idx] = newVal;
    setList(next);
  };

  const removeItem = (idx) => {
    setList(currentList.filter((_, i) => i !== idx));
  };

  // Drag and drop handlers
  const handleDragStart = (idx) => {
    setDragIndex(idx);
    setDragOverIndex(null);
  };

  const handleDragEnter = (idx) => {
    if (idx !== dragIndex) setDragOverIndex(idx);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (idx) => {
    if (dragIndex === null || dragIndex === idx) {
      handleDragEnd();
      return;
    }
    const from = dragIndex;
    let to = idx;

    const next = [...currentList];
    const [moved] = next.splice(from, 1);

    // If dropping at tail zone (idx === length after removal)
    if (to === currentList.length) {
      next.push(moved);
    } else {
      // Adjust target index if item removed from above
      if (from < to) to = to - 1;
      next.splice(to, 0, moved);
    }

    setList(next);
    handleDragEnd();
  };

  return (
    <div className="list-editor-root">
      <div className="list-editor-toolbar">
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addItem}
          size="small"
        >
          Add Item
        </Button>
      </div>

      <Space direction="vertical" style={{ width: "100%" }} size="small">
        {currentList.map((item, idx) => {
          const isDragging = idx === dragIndex;
          const isDragOver = idx === dragOverIndex;
          return (
            <div
              key={idx}
              className={
                "list-editor-item" +
                (isDragging ? " is-dragging" : "") +
                (isDragOver ? " is-drag-over" : "")
              }
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={(e) => {
                e.preventDefault();
                handleDragEnter(idx);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(idx);
              }}
              onDragEnd={handleDragEnd}
            >
              <span className="list-editor-drag-handle" title="Drag to reorder">
                <MenuOutlined />
              </span>
              <Input
                className="list-editor-input"
                value={item}
                onChange={(e) => updateItem(idx, e.target.value)}
                placeholder="Enter list item with <placeholders>"
              />
              <div className="list-editor-actions">
                <Button
                  danger
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label={`Delete item ${idx + 1}`}
                  onClick={() => removeItem(idx)}
                />
              </div>
            </div>
          );
        })}

        {/* Tail drop zone to allow moving item to end */}
        {currentList.length > 0 && (
          <div
            className={
              "list-editor-tail-dropzone" +
              (dragOverIndex === currentList.length ? " is-active" : "")
            }
            onDragEnter={(e) => {
              e.preventDefault();
              if (dragIndex !== null) setDragOverIndex(currentList.length);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(currentList.length);
            }}
          />
        )}
      </Space>
    </div>
  );
};

export default ListGenericExampleEditor;
