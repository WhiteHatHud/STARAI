import { FileTextOutlined } from "@ant-design/icons";

const getProgressStages = (type) => {
  if (type === null) type = "template";

  switch (type) {
    case "style_a":
      return [
        {
          key: "initializing",
          label: "Initializing Style A Report",
          threshold: 30,
        },

        // 8 sections spread across 35 → 70 (5% steps)
        {
          key: "executive_summary",
          label: "Generating Executive Summary",
          threshold: 35,
        },
        {
          key: "background",
          label: "Creating Background & History",
          threshold: 40,
        },
        {
          key: "industry_context",
          label: "Analyzing Industry Context",
          threshold: 45,
        },
        { key: "key_figures", label: "Identifying Key Figures", threshold: 50 },
        { key: "challenge", label: "Defining The Challenge", threshold: 55 },
        {
          key: "options_analysis",
          label: "Analyzing Options & Solutions",
          threshold: 60,
        },
        {
          key: "decision_point",
          label: "Establishing Decision Point",
          threshold: 65,
        },
        { key: "exhibits", label: "Compiling Exhibits & Data", threshold: 70 },

        // Post-generation steps from backend
        {
          key: "coherence_review",
          label: "Reviewing for Coherence",
          threshold: 75,
        },
        {
          key: "apply_fixes",
          label: "Applying Coherence Fixes",
          threshold: 80,
        },
        { key: "finalizing", label: "Finalizing Report", threshold: 85 },
        { key: "metadata", label: "Creating Metadata", threshold: 90 },
        {
          key: "generation_complete",
          label: "Report Generation Complete",
          threshold: 95,
        },
        { key: "completed", label: "Report Complete", threshold: 100 },
      ];

    case "style_b":
      return [
        {
          key: "initializing",
          label: "Initializing Style B Report",
          threshold: 30,
        },

        // 8 sections spread across 35 → 70
        {
          key: "learning_objectives",
          label: "Generating Learning Objectives",
          threshold: 35,
        },
        {
          key: "key_concepts",
          label: "Developing Key Concepts & Frameworks",
          threshold: 40,
        },
        {
          key: "case_overview",
          label: "Creating Case Overview & Background",
          threshold: 45,
        },
        {
          key: "analysis_application",
          label: "Writing Analysis & Application",
          threshold: 50,
        },
        {
          key: "discussion_questions",
          label: "Formulating Discussion Questions",
          threshold: 55,
        },
        {
          key: "class_activities",
          label: "Designing Class Activities",
          threshold: 60,
        },
        {
          key: "teaching_notes",
          label: "Preparing Teaching Notes",
          threshold: 65,
        },
        {
          key: "references",
          label: "Compiling References & Readings",
          threshold: 70,
        },

        // Post-generation steps
        {
          key: "coherence_review",
          label: "Reviewing for Coherence",
          threshold: 75,
        },
        {
          key: "apply_fixes",
          label: "Applying Coherence Fixes",
          threshold: 80,
        },
        { key: "finalizing", label: "Finalizing Report", threshold: 85 },
        { key: "metadata", label: "Creating Metadata", threshold: 90 },
        {
          key: "generation_complete",
          label: "Report Generation Complete",
          threshold: 95,
        },
        { key: "completed", label: "Report Complete", threshold: 100 },
      ];

    case "style_c":
      return [
        {
          key: "initializing",
          label: "Initializing Style C Report",
          threshold: 30,
        },

        // 8 sections (35 → 70)
        {
          key: "learning_pathway",
          label: "Building Learning Pathway Overview",
          threshold: 35,
        },
        {
          key: "multimedia_modules",
          label: "Designing Multimedia Content Modules",
          threshold: 40,
        },
        {
          key: "interactive_elements",
          label: "Creating Interactive Learning Elements",
          threshold: 45,
        },
        {
          key: "assessment_components",
          label: "Developing Assessment Components",
          threshold: 50,
        },
        {
          key: "application_scenarios",
          label: "Writing Practical Application Scenarios",
          threshold: 55,
        },
        {
          key: "discussion_forums",
          label: "Organizing StyleC Discussion Forums",
          threshold: 60,
        },
        {
          key: "supplementary_resources",
          label: "Adding Supplementary Resources",
          threshold: 65,
        },
        {
          key: "feedback_mechanisms",
          label: "Designing Feedback Mechanisms",
          threshold: 70,
        },

        // Post-generation
        {
          key: "coherence_review",
          label: "Reviewing for Coherence",
          threshold: 75,
        },
        {
          key: "apply_fixes",
          label: "Applying Coherence Fixes",
          threshold: 80,
        },
        { key: "finalizing", label: "Finalizing Report", threshold: 85 },
        { key: "metadata", label: "Creating Metadata", threshold: 90 },
        {
          key: "generation_complete",
          label: "Report Generation Complete",
          threshold: 95,
        },
        { key: "completed", label: "Report Complete", threshold: 100 },
      ];

    case "style_sof":
      return [
        {
          key: "initializing",
          label: "Initializing Statement of Facts",
          threshold: 30,
        },

        // Single section (put right at 50 for balance in 35-70 range)
        {
          key: "statement_of_facts",
          label: "Generating Statement of Facts",
          threshold: 50,
        },

        // Post-generation
        {
          key: "coherence_review",
          label: "Reviewing for Coherence",
          threshold: 75,
        },
        {
          key: "apply_fixes",
          label: "Applying Coherence Fixes",
          threshold: 80,
        },
        { key: "finalizing", label: "Finalizing Report", threshold: 85 },
        { key: "metadata", label: "Creating Metadata", threshold: 90 },
        {
          key: "generation_complete",
          label: "Report Generation Complete",
          threshold: 95,
        },
        { key: "completed", label: "Report Complete", threshold: 100 },
      ];
    case "template":
      return [
        {
          key: "processing_template",
          label: "Processing template file...",
          threshold: 5,
        },
        {
          key: "template_processed",
          label: "Processed template",
          threshold: 20,
        },
        // Supporting docs are dynamic, let's assume 4 docs as example
        {
          key: "supporting_doc",
          label: "Processeding document(s)",
          threshold: 30,
        },
        {
          key: "finished_doc",
          label: "Processed document(s)",
          threshold: 60,
        },
        {
          key: "generating_content",
          label: "Generating custom format content...",
          threshold: 65,
        },
        {
          key: "saving_template",
          label: "Saving generated template...",
          threshold: 85,
        },
        {
          key: "completed",
          label: "Custom format generation completed successfully!",
          threshold: 100,
        },
      ];

    case "style_custom":
      return [
        {
          key: "initializing",
          label: "Initializing custom case study generation",
          threshold: 5,
        },
        {
          key: "template_processing",
          label: "Processing template file",
          threshold: 20,
        },
        {
          key: "supporting_docs_processing",
          label: "Processing supporting documents",
          threshold: 60, // cumulative progress after all docs
        },
        {
          key: "content_generation",
          label: "Generating custom content",
          threshold: 85,
        },
        {
          key: "saving_template",
          label: "Saving generated form",
          threshold: 95,
        },
        {
          key: "completed",
          label: "Custom form generation completed",
          threshold: 100,
        },
      ];
    case "document_upload":
      return [
        {
          key: "initializing",
          label: "Starting document upload",
          threshold: 0,
        },
        {
          key: "processing_file",
          label: "Processing uploaded file",
          threshold: 5,
        },
        {
          key: "storing_document",
          label: "Storing document",
          threshold: 10,
        },
        {
          key: "processing_document",
          label: "Processing document",
          threshold: 30,
        },
        {
          key: "finalizing_document",
          label: "Finalizing document",
          threshold: 70,
        },
        {
          key: "completed",
          label: "Document uploaded successfully",
          threshold: 100,
        },
      ];

    default:
      return [
        {
          key: "initializing",
          label: "Initializing generation",
          threshold: 30,
        },
        { key: "analyzing", label: "Analyzing documents", threshold: 50 },
        { key: "structuring", label: "Structuring content", threshold: 70 },
        { key: "generating", label: "Generating sections", threshold: 80 },
        { key: "enhancing", label: "Enhancing content", threshold: 90 },
        { key: "finalizing", label: "Finalizing", threshold: 95 },
        { key: "completed", label: "Completed", threshold: 100 },
      ];
  }
};

const getStudyTypeInfo = (studyType) => {
  const finalStudyType = studyType === null ? "template" : studyType;
  switch (finalStudyType) {
    case "style_a":
      return {
        title: "Style A Report",
        description:
          "A comprehensive business case study following the Style A methodology.",
        features: [
          "Executive summary with key insights",
          "Background and organizational history",
          "Industry context and competitive landscape",
          "Key figures and stakeholders",
          "Challenge analysis and problem definition",
          "Options and solution analysis",
          "Decision point and recommendations",
          "Supporting exhibits and data",
        ],
        icon: <FileTextOutlined style={{ fontSize: 24, color: "#1890ff" }} />,
      };
    case "style_a_single":
      return {
        title: "Style A (Single Section)",
        description:
          "A streamlined version of Style A, focusing only on the executive summary.",
        features: [
          "Executive summary overview",
          "Concise synthesis of key points",
          "Rapid generation for quick insights",
        ],
        icon: <FileTextOutlined style={{ fontSize: 24, color: "#40a9ff" }} />,
      };
    case "style_b":
      return {
        title: "Style B Report",
        description:
          "An educational case study structured for classroom teaching and learning.",
        features: [
          "Clear learning objectives",
          "Key concepts and theoretical framework",
          "Case overview and background",
          "Analysis and application of theory",
          "Discussion questions",
          "Class activities and exercises",
          "Teaching notes and recommendations",
          "References and further reading",
        ],
        icon: <FileTextOutlined style={{ fontSize: 24, color: "#52c41a" }} />,
      };
    case "style_c":
      return {
        title: "Style C Report",
        description:
          "A modern, interactive case study format with multimedia and interactive learning features.",
        features: [
          "Learning pathway overview",
          "Multimedia content modules",
          "Interactive learning elements",
          "Assessment components",
          "Application scenarios",
          "Discussion forums",
          "Supplementary resources",
          "Feedback mechanisms",
        ],
        icon: <FileTextOutlined style={{ fontSize: 24, color: "#722ed1" }} />,
      };
    case "style_sof":
      return {
        title: "Style SOF (Statement of Facts)",
        description:
          "A formal legal document providing a complete statement of facts for legal proceedings.",
        features: [
          "Comprehensive factual account",
          "Exact dates, times, and locations",
          "Detailed description of exhibits and seizures",
          "Charges with legal basis under the MDA",
          "Laboratory analysis results",
          "Accused’s knowledge and intent",
          "Investigation officer details",
          "Preparation and signing dates",
        ],
        icon: <FileTextOutlined style={{ fontSize: 24, color: "#faad14" }} />,
      };
    case "template":
      return {
        title: "Custom Template Generation",
        description:
          "Generate a template tailored to your documents. Users can define the structure and style of their report based on input files.",
        features: [
          "Custom template-based content generation",
          "Automatic analysis of supporting documents",
          "Structured sections according to your template",
          "Content refinement for coherence and clarity",
          "Immediate saving of generated templates for future use",
        ],
        icon: <FileTextOutlined style={{ fontSize: 24, color: "#13c2c2" }} />,
      };
    case "style_custom":
      return {
        title: "Custom Form",
        description:
          "Generate a form based on your customized template and uploaded supporting documents.",
        features: [
          "Flexible template-based generation",
          "Supports multiple document types",
          "Dynamic content generation with placeholders",
          "Structured and professional formatting",
          "Real-time progress tracking",
        ],
        icon: <FileTextOutlined style={{ fontSize: 24, color: "#13c2c2" }} />,
      };
    case "document_upload":
      return {
        title: "Document Upload",
        description:
          "Uploading and processing documents for your case study project.",
        features: [
          "Secure file upload to cloud storage",
          "Automatic content extraction and processing", 
          "Text chunking for efficient retrieval",
          "Integration with case study workflow",
          "Progress tracking and status updates",
          "Error handling and validation",
        ],
        icon: <FileTextOutlined style={{ fontSize: 24, color: "#13c2c2" }} />,
      };
    default:
      return {
        title: "Report Generation",
        description:
          "Generating a comprehensive case study based on your documents.",
        features: [
          "Document analysis and synthesis",
          "Structured content organization",
          "Evidence-based conclusions",
          "Professional formatting",
          "Quality assurance review",
        ],
        icon: <FileTextOutlined style={{ fontSize: 24, color: "#1890ff" }} />,
      };
  }
};

export { getProgressStages, getStudyTypeInfo };
