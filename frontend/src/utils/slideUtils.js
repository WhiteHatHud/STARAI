// Simple markdown-like rendering using basic HTML
export const stripMarkdownText = (content) => {
  if (!content) return "";

  // Normalize line endings
  let text = String(content).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Remove bold/italic markers but keep content
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  text = text.replace(/__(.*?)__/g, "$1");
  text = text.replace(/\*(.*?)\*/g, "$1");
  text = text.replace(/_(.*?)_/g, "$1");

  // Remove heading markers (#, ##, ###...) at line start
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, "");

  // Remove blockquote markers '>' at line start
  text = text.replace(/^\s*>\s?/gm, "");

  // Collapse multiple blank lines to a single blank line
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim each line and overall text
  text = text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  return text;
};

/**
 * Calculates the scale factor for template previews based on column width
 * @param {number} colWidth - The width of the column containing the template
 * @returns {number} The scale factor to apply to templates
 */
export const calculateScale = (colWidth) => {
  const newScale = colWidth / 1280; // Base width of templates
  return newScale;
};
