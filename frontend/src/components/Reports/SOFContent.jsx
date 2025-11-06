import { Typography } from "antd";

const { Title, Text, Paragraph } = Typography;

const SOFContent = ({ content, isDarkMode = false }) => {
  const formatSOFContent = (text) => {
    const lines = text.split("\n").filter((line) => line.trim());
    const formattedElements = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) {
        i++;
        continue;
      }

      // Handle HTML tables
      if (line.includes("<table")) {
        let tableHtml = "";
        let j = i;

        while (j < lines.length) {
          const tableLine = lines[j].trim();
          tableHtml += tableLine + " ";

          if (tableLine.includes("</table>")) {
            j++;
            break;
          }
          j++;
        }

        if (tableHtml) {
          formattedElements.push(
            <div
              key={`table-${i}`}
              className={`section-content-table ${
                isDarkMode ? "dark" : "light"
              }`}
              dangerouslySetInnerHTML={{ __html: tableHtml }}
              style={{ marginBottom: "16px" }}
            />
          );
        }
        i = j;
        continue;
      }

      // Handle charge headers (legal documents)
      if (
        line.toUpperCase().includes("FACTS RELATING TO THE PROCEEDED")
      ) {
        formattedElements.push(
          <Title
            key={`header-${i}`}
            level={4}
            style={{
              marginTop: "24px",
              marginBottom: "16px",
              color: isDarkMode ? "#FFFFFF" : "#000000",
              textDecoration: "underline",
              fontWeight: "600",
            }}
          >
            {line}
          </Title>
        );
        i++;
        continue;
      }

      // Handle subheaders (Analysis results, Laboratory analysis details, etc.)
      // But exclude numbered/lettered items to prevent false positives
      if (
        !(/^\d+\.\s/.test(line)) && // Not a numbered item (1., 2., 3.)
        !(/^[a-z]\.\s/.test(line)) && // Not a lettered item (a., b., c.)
        !(/^(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv|xvi{1,3}|xix|xx)\.\s/i.test(line)) && // Not roman numerals
        (
          line.toLowerCase().startsWith("subheader:") ||
          [
            "analysis results",
            "laboratory analysis", 
            "arrest and seizure",
            "legal elements",
            "conclusion stating",
          ].some((keyword) => {
            const lowerLine = line.toLowerCase();
            const lowerKeyword = keyword.toLowerCase();
            // More strict matching - keyword should be at start or after punctuation/space
            return lowerLine === lowerKeyword || 
                   lowerLine.startsWith(lowerKeyword + " ") ||
                   lowerLine.startsWith(lowerKeyword + ":") ||
                   lowerLine.includes(". " + lowerKeyword) ||
                   lowerLine.includes("- " + lowerKeyword);
          })
        )
      ) {
        const headerText = line.replace(/^subheader:\s*/i, "");
        formattedElements.push(
          <Title
            key={`subheader-${i}`}
            level={5}
            style={{
              marginTop: "20px",
              marginBottom: "12px",
              color: isDarkMode ? "#d9d9d9" : "#595959",
              fontStyle: "italic",
              fontWeight: "500",
            }}
          >
            {headerText}
          </Title>
        );
        i++;
        continue;
      }

      // Handle numbered paragraphs (1., 2., 3., etc.)
      if (/^\d+\.\s/.test(line)) {
        formattedElements.push(
          <div
            key={`numbered-${i}`}
            style={{
              marginLeft: "0px",
              marginBottom: "12px",
              paddingLeft: "20px",
              textIndent: "-20px",
            }}
          >
            <Text
              strong
              style={{ color: isDarkMode ? "#FFFFFF" : "#000000" }}
            >
              {line.match(/^\d+\./)[0]}
            </Text>
            <Text style={{ marginLeft: "8px", lineHeight: "1.6" }}>
              {line.replace(/^\d+\.\s*/, "")}
            </Text>
          </div>
        );
        i++;
        continue;
      }

      // Handle roman numeral sub-points (i., ii., iii., etc.) - CHECK THIS BEFORE LETTERED
      if (
        /^(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv|xvi{1,3}|xix|xx)\.\s/i.test(
          line
        )
      ) {
        formattedElements.push(
          <div
            key={`roman-${i}`}
            style={{
              marginLeft: "60px",
              marginBottom: "6px",
              paddingLeft: "20px",
              textIndent: "-20px",
            }}
          >
            <Text
              style={{
                color: isDarkMode ? "#bfbfbf" : "#8c8c8c",
                fontWeight: "400",
              }}
            >
              {
                line.match(
                  /^(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv|xvi{1,3}|xix|xx)\./i
                )[0]
              }
            </Text>
            <Text style={{ marginLeft: "8px", lineHeight: "1.6" }}>
              {line.replace(
                /^(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv|xvi{1,3}|xix|xx)\.\s*/i,
                ""
              )}
            </Text>
          </div>
        );
        i++;
        continue;
      }

      // Handle lettered sub-points (a., b., c., etc.) - BUT EXCLUDE ROMAN NUMERALS
      if (
        /^[a-z]\.\s/.test(line) &&
        !/^(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv|xvi{1,3}|xix|xx)\.\s/i.test(
          line
        )
      ) {
        formattedElements.push(
          <div
            key={`lettered-${i}`}
            style={{
              marginLeft: "30px",
              marginBottom: "8px",
              paddingLeft: "20px",
              textIndent: "-20px",
            }}
          >
            <Text
              style={{
                color: isDarkMode ? "#d9d9d9" : "#595959",
                fontWeight: "500",
              }}
            >
              {line.match(/^[a-z]\./)[0]}
            </Text>
            <Text style={{ marginLeft: "8px", lineHeight: "1.6" }}>
              {line.replace(/^[a-z]\.\s*/, "")}
            </Text>
          </div>
        );
        i++;
        continue;
      }

      // Handle parenthesized roman numerals ((i), (ii), etc.)
      if (
        /^\((i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv|xvi{1,3}|xix|xx)\)\s/i.test(
          line
        )
      ) {
        formattedElements.push(
          <div
            key={`paren-roman-${i}`}
            style={{
              marginLeft: "90px",
              marginBottom: "4px",
              paddingLeft: "20px",
              textIndent: "-20px",
            }}
          >
            <Text
              style={{
                color: isDarkMode ? "#a6a6a6" : "#a6a6a6",
                fontSize: "13px",
              }}
            >
              {
                line.match(
                  /^\((i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv|xvi{1,3}|xix|xx)\)/i
                )[0]
              }
            </Text>
            <Text
              style={{
                marginLeft: "8px",
                lineHeight: "1.6",
                fontSize: "14px",
              }}
            >
              {line.replace(
                /^\((i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv|xvi{1,3}|xix|xx)\)\s*/i,
                ""
              )}
            </Text>
          </div>
        );
        i++;
        continue;
      }

      // Handle bullet points
      if (/^[-•*]\s/.test(line)) {
        formattedElements.push(
          <div
            key={`bullet-${i}`}
            style={{
              marginLeft: "16px",
              marginBottom: "6px",
              paddingLeft: "16px",
              textIndent: "-16px",
            }}
          >
            <Text style={{ color: isDarkMode ? "#d9d9d9" : "#1890ff" }}>
              •
            </Text>
            <Text style={{ marginLeft: "8px", lineHeight: "1.6" }}>
              {line.replace(/^[-•*]\s*/, "")}
            </Text>
          </div>
        );
        i++;
        continue;
      }

      // Handle Investigation Officer signatures
      if (
        line.toUpperCase().includes("INVESTIGATION OFFICER") ||
        /^(SSGT|SGT|CPL|PC|INSP)\s/.test(line.toUpperCase()) ||
        line.toUpperCase() === "SINGAPORE"
      ) {
        formattedElements.push(
          <div
            key={`io-${i}`}
            style={{
              textAlign: "left",
              fontWeight: "600",
            }}
          >
            <Text style={{ color: isDarkMode ? "#fff" : "#000" }}>
              {line}
            </Text>
          </div>
        );
        i++;
        continue;
      }

      // Regular paragraph
      formattedElements.push(
        <Paragraph
          key={`para-${i}`}
          className={isDarkMode ? "text-light" : ""}
          style={{
            marginBottom: "12px",
            lineHeight: "1.6",
            textAlign: "justify",
            textIndent: "0px",
          }}
        >
          {line}
        </Paragraph>
      );
      i++;
    }

    return formattedElements;
  };

  return <div>{formatSOFContent(content)}</div>;
};

export default SOFContent;