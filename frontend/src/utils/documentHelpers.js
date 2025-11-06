import pdfIcon from "../assets/images/pdf-logo.png";
import wordIcon from "../assets/images/word-logo.png";
import videoIcon from "../assets/images/video-logo.png";
import audioIcon from "../assets/images/audio-logo.png";
import pptIcon from "../assets/images/ppt-logo.png";
import imageIcon from "../assets/images/image-logo.png";
import fileIcon from "../assets/images/default-logo.png";
import styles from "../components/global/DocumentList.module.css";

export default function documentHelpers() {
  const getFileExtension = (fileName) => {
    return fileName.split(".").pop().toLowerCase();
  };

  const getDocumentLogo = (fileName) => {
    const extension = getFileExtension(fileName);
    const logoMap = {
      pdf: { src: pdfIcon, alt: "PDF" },
      doc: { src: wordIcon, alt: "Word Document" },
      docx: { src: wordIcon, alt: "Word Document" },
      ppt: { src: pptIcon, alt: "PowerPoint" },
      pptx: { src: pptIcon, alt: "PowerPoint" },
      mp3: { src: audioIcon, alt: "Audio File" },
      m4a: { src: audioIcon, alt: "Audio File" },
      wav: { src: audioIcon, alt: "Audio File" },
      jpg: { src: imageIcon, alt: "Image" },
      jpeg: { src: imageIcon, alt: "Image" },
      png: { src: imageIcon, alt: "Image" },
      gif: { src: imageIcon, alt: "Image" },
      mp4: { src: videoIcon, alt: "Video File" },
    };

    const logo = logoMap[extension] || { src: fileIcon, alt: "File" };
    return (
      <img src={logo.src} alt={logo.alt} className={styles.documentLogo} />
    );
  };
  return { getFileExtension, getDocumentLogo };
}
