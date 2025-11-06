import { Select } from "antd";

const ModelSelector = ({ handleChange }) => {
  return (
    <Select
      placeholder="Select model..."
      defaultValue="Qwen_3_NT"
      style={{ width: 200 }}
      onChange={handleChange}
      options={[
        // { value: "Qwen_2.5", label: "Qwen 2.5" },
        { value: "Qwen_3_NT", label: "Qwen 3 Non-Thinking" },
        { value: "Qwen_3_T", label: "Qwen 3 Thinking" },
      ]}
    />
  );
};

export default ModelSelector;
