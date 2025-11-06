// DocumentToContentBridge.jsx
import { useEffect, useState } from "react";
import { Flex, Segmented, theme } from "antd";
import useStore from "../../store";
import "./DocumentToContentBridge.css";
import ReportPreview from "../../components/PresetGeneration/ReportPreview";

const presetStyleMapping = [
  { label: "Style A", key: "style_a" },
];

const DocumentToContentBridge = ({
  token,
  triggerProcessingData,
  redirectTo,
  setCurrentProgressId,
  setPreviousPageID,
}) => {
  const { currentCase, setCurrentCase } = useStore();
  const { token: themeToken } = theme.useToken();
  const [selectedStyle, setSelectedStyle] = useState("");
  const projectVariant = import.meta.env.VITE_PROJECT_VARIANT;

  useEffect(() => {
    if (projectVariant === "sof") setSelectedStyle("style_sof");
    else setSelectedStyle(presetStyleMapping[0].key);
  }, [projectVariant]);

  // Get total document count from the current case
  useEffect(() => {
    if (currentCase?.documents && currentCase.model_type === undefined)
      setCurrentCase({ ...currentCase, model_type: "Qwen_3_NT" });
  }, [currentCase, setCurrentCase]);

  return (
    <Flex vertical gap="middle" align="center">
      {projectVariant !== "sof" && (
        <Segmented
          className="style-selector"
          size="large"
          options={presetStyleMapping.map((s) => ({
            label: s.label,
            value: s.key,
          }))}
          onChange={(value) => setSelectedStyle(value)}
          style={{ border: `1px solid ${themeToken.colorBorder}` }}
        />
      )}

      {selectedStyle !== "" && (
        <ReportPreview
          styleKey={selectedStyle}
          token={token}
          triggerProcessingData={triggerProcessingData}
          redirectTo={redirectTo}
          setCurrentProgressId={setCurrentProgressId}
          setPreviousPageID={setPreviousPageID}
        />
      )}
    </Flex>
  );
};

export default DocumentToContentBridge;
