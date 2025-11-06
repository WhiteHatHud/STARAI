import { useEffect, useState } from "react";
import axios from "axios";
import {
  Form,
  Modal,
  Input,
  Typography,
  Select,
  List,
  Checkbox,
  Empty,
  Button,
} from "antd";
import InfiniteScroll from "react-infinite-scroll-component";
import useStore from "../../store";
import documentHelpers from "../../utils/documentHelpers";
import styleMapping from "../../data/styleMapping";

const { Text } = Typography;
const { getDocumentLogo } = documentHelpers();

export const GenerateModal = ({
  visible,
  onCancel,
  onSubmit,
  loading,
  token,
  selectedDocuments,
  setSelectedDocuments,
  redirectTo,
  reportStyle,
}) => {
  const [form] = Form.useForm();
  const { currentCase, setCurrentCase } = useStore();

  const projectVariant = import.meta.env.VITE_PROJECT_VARIANT;

  const [caseFolders, setCaseFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [formFolderOptions, setFormFolderOptions] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);

  const allChecked =
    selectedDocuments.length === allDocuments.length && allDocuments.length > 0;
  const isIndeterminate =
    selectedDocuments.length > 0 &&
    selectedDocuments.length < allDocuments.length;

  // Form folder options handler
  const handleOnChange = (value) => {
    setSelectedDocuments([]);

    const selected = caseFolders.find((folder) => folder.id === value);
    if (selected) {
      setCurrentCase(selected);
      setSelectedFolder(value);
    }
  };

  // Individual checkbox handler
  const handleCheckboxChange = (id, checked) => {
    if (checked) {
      setSelectedDocuments((prev) => [...prev, id]);
    } else {
      setSelectedDocuments((prev) => prev.filter((docId) => docId !== id));
    }
  };

  // Select/Deselect all checkbox handler
  const handleCheckAll = (e) => {
    if (e.target.checked) {
      setSelectedDocuments(allDocuments.map((doc) => doc._id));
    } else {
      setSelectedDocuments([]);
    }
  };

  useEffect(() => {
    if (!token) return;

    const fetchFolders = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/cases/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Handle no case folders
        if (response.data.length === 0) return;

        const options = response.data.map((item) => ({
          value: item.id,
          label: item.name,
        }));

        setCaseFolders(response.data);
        setFormFolderOptions(options);

        let initialSelectOption = currentCase
          ? options.find((opt) => opt.value === currentCase.id).value
          : options[0].value;
        setSelectedFolder(initialSelectOption);
        if (!currentCase) setCurrentCase(response.data[0]);
      } catch (error) {
        console.error("Error fetching folders", error);
      }
    };

    fetchFolders();
  }, [currentCase, setCurrentCase, token]);

  useEffect(() => {
    const finalName = `${styleMapping[reportStyle].label}: ${currentCase?.name}`;

    form.setFieldsValue({
      reportName: finalName,
    });
  }, [currentCase, reportStyle, form]);

  useEffect(() => {
    if (!token || !selectedFolder) return;

    const fetchDocuments = async (case_id) => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/cases/${case_id}/documents/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setAllDocuments(response.data);
      } catch (error) {
        console.error("Error fetching documents:", error);
        throw error;
      }
    };

    fetchDocuments(selectedFolder);
    form.setFieldsValue({ reportFolder: selectedFolder });
  }, [selectedFolder, form, token]);

  return (
    <Modal
      title={
        projectVariant === "sof" ? "Generate Report" : "Generate Report"
      }
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okButtonProps={{ disabled: selectedDocuments.length === 0 }}
      confirmLoading={loading}
      footer={caseFolders.length === 0 ? null : undefined}
      destroyOnClose
      forceRender={true}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => onSubmit(values.reportName)}
        initialValues={{
          llmModel: "Qwen_3_NT",
          reportFolder: formFolderOptions[0]?.label,
        }}
        style={{ paddingTop: 16 }}
      >
        {caseFolders.length === 0 ? (
          <Empty
            styles={{ image: { height: 60 } }}
            description={<Text type="secondary">No folders created</Text>}
          >
            <Button
              type="primary"
              size="small"
              onClick={() => redirectTo("/folders")}
            >
              Create Now
            </Button>
          </Empty>
        ) : (
          <>
            <Form.Item
              name="reportName"
              label="Name"
              rules={[
                {
                  required: true,
                  message: "Please enter a name for your case study",
                },
                {
                  min: 10,
                  message:
                    "Case study name must be at least 10 characters long",
                },
              ]}
            >
              <Input placeholder="Enter case study name" autoFocus />
            </Form.Item>
            {/* //TODO: Implement different model type */}
            {/* <Form.Item
            name="llmModel"
            label="LLM Model"
            rules={[{ required: true, message: "Please select an LLM Model" }]}
          >
            <Select
              placeholder="Select model..."
              options={[
                { value: "Qwen_3_NT", label: "Qwen 3 Non-Thinking" },
                { value: "Qwen_3_T", label: "Qwen 3 Thinking" },
              ]}
            />
          </Form.Item> */}
            <Form.Item name="reportFolder" label="Folder">
              <Select onChange={handleOnChange} options={formFolderOptions} />
            </Form.Item>
            <Form.Item name="uploadedDocuments" label="Uploaded Documents">
              {/* UPLOADED DOCUMENTS */}
              {allDocuments?.length > 0 ? (
                <>
                  <Checkbox
                    indeterminate={isIndeterminate}
                    checked={allChecked}
                    onChange={handleCheckAll}
                    style={{ marginBottom: 8 }}
                  >
                    Select All
                  </Checkbox>
                  <div
                    id="scrollableDiv"
                    style={{
                      height: allDocuments.length > 3 ? 150 : "auto",
                      overflow: "auto",
                      padding: "0 16px",
                      border: "1px solid rgba(140, 140, 140, 0.35)",
                    }}
                  >
                    {/*Put the scroll bar always on the bottom*/}
                    <InfiniteScroll
                      dataLength={allDocuments.length}
                      scrollableTarget="scrollableDiv"
                    >
                      <List
                        dataSource={allDocuments}
                        renderItem={(item) => (
                          <List.Item key={item._id}>
                            <Checkbox
                              checked={selectedDocuments.includes(item._id)}
                              onChange={(e) =>
                                handleCheckboxChange(item._id, e.target.checked)
                              }
                              style={{ marginRight: 24 }}
                            />
                            <List.Item.Meta
                              avatar={getDocumentLogo(item.name)}
                              title={
                                <Text
                                  ellipsis
                                  strong
                                  style={{ maxWidth: "80%" }}
                                >
                                  {item.name}
                                </Text>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    </InfiniteScroll>
                  </div>
                </>
              ) : (
                <Empty
                  description={
                    <Typography.Text type="secondary">
                      No documents were uploaded for this folder yet.
                    </Typography.Text>
                  }
                >
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => redirectTo("/folders")}
                  >
                    Upload Now
                  </Button>
                </Empty>
              )}
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};
