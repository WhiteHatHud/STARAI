import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Flex, Typography, Select, List, Card, Checkbox } from "antd";
import InfiniteScroll from "react-infinite-scroll-component";
import useStore from "../../store";
import documentHelpers from "../../utils/documentHelpers";

const { Title, Text } = Typography;

export const DocumentSelector = ({
  selectedDocuments,
  setSelectedDocuments,
}) => {
  const { token, currentCase } = useStore();
  const { getDocumentLogo } = documentHelpers();
  const [folders, setFolders] = useState(null);
  const [selectedFolders, setSelectedFolders] = useState(
    currentCase ? [currentCase.id] : []
  );
  const [allDocuments, setAllDocuments] = useState(null);

  const toggleDocumentSelection = (id) => {
    setSelectedDocuments((prev) =>
      prev.includes(id) ? prev.filter((docId) => docId !== id) : [...prev, id]
    );
  };

  const selectAllDocuments = () => {
    if (allChecked) setSelectedDocuments([]);
    else setSelectedDocuments(filteredDocuments.map((doc) => doc._id));
  };

  const handleFolderSelect = (values) => {
    if (values.length === 0) {
      setSelectedFolders([]);
      setSelectedDocuments([]);
      return;
    }
    setSelectedFolders(values);
    setSelectedDocuments([]);
  };

  const fetchDocuments = useCallback(async () => {
    let folderIDs = [];
    try {
      // Fetch folders
      const folders = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/cases/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setFolders(folders.data);
      folderIDs = folders.data.map((folder) => folder.id);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }

    try {
      // Fetch all documents for each folder
      const params = new URLSearchParams();
      folderIDs.forEach((id) => params.append("case_ids", id));

      const docsResp = await axios.get(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/cases/documents?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setAllDocuments(docsResp.data);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const filteredDocuments = allDocuments?.filter((doc) => {
    if (selectedFolders.length === 0) return true;
    return selectedFolders.includes(doc.case_id);
  });

  const allChecked =
    selectedDocuments.length === filteredDocuments?.length &&
    filteredDocuments.length > 0;
  const isIndeterminate =
    selectedDocuments.length > 0 &&
    selectedDocuments.length < filteredDocuments?.length;

  return (
    <Flex vertical gap="large">
      <Title level={3}>Select Documents</Title>

      {/* FOLDER SELECTOR */}
      {folders?.length > 0 && (
        <Flex vertical gap="small">
          <Text strong>Filter by folder</Text>
          <Select
            value={selectedFolders ?? []}
            showSearch
            mode="multiple"
            allowClear
            placeholder="Select a folder"
            optionFilterProp="label"
            onChange={handleFolderSelect}
            options={folders.map((folder) => ({
              value: folder.id,
              label: folder.name,
            }))}
          />
        </Flex>
      )}

      {/* FILE SELECTOR */}
      {filteredDocuments?.length > 0 && (
        <Flex vertical>
          <Card
            styles={{ body: { padding: "8px 8px", cursor: "pointer" } }}
            onClick={() => selectAllDocuments()}
          >
            <Checkbox indeterminate={isIndeterminate} checked={allChecked}>
              <Text strong>Select All</Text>
            </Checkbox>
          </Card>
          <div
            id="scrollableDiv"
            style={{
              maxHeight: "35vh",
              overflow: "auto",
              padding: "0 0",
            }}
          >
            <InfiniteScroll
              dataLength={filteredDocuments.length}
              scrollableTarget="scrollableDiv"
            >
              <List
                size="small"
                dataSource={filteredDocuments}
                renderItem={(item) => (
                  <List.Item
                    key={item.case_id}
                    onClick={() => toggleDocumentSelection(item._id)}
                    style={{ cursor: "pointer" }}
                  >
                    <Checkbox
                      checked={selectedDocuments.includes(item._id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDocumentSelection(item._id);
                      }}
                      style={{ marginRight: 24 }}
                    />
                    <List.Item.Meta
                      style={{ alignItems: "center" }}
                      avatar={getDocumentLogo(item.name)}
                      title={
                        <Text ellipsis={{ tooltip: item.name }} strong>
                          {item.name}
                        </Text>
                      }
                      description={`Last modified: ${new Date(
                        item.updated_at
                      ).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`}
                    />
                  </List.Item>
                )}
              />
            </InfiniteScroll>
          </div>
        </Flex>
      )}
    </Flex>
  );
};
