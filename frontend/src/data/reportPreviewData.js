import {
  FileTextOutlined,
  BulbOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  PieChartOutlined,
  CheckCircleOutlined,
  FileOutlined,
  BookOutlined,
  PlayCircleOutlined,
  MessageOutlined,
  InteractionOutlined,
  ContainerOutlined,
} from "@ant-design/icons";

const stylePreviewData = [
  {
    style: "style_a",
    title: "Style A Preview",
    description:
      "A classic Harvard-style case study with a multi-section or single-section. This style is ideal for deep dives and step-by-step reasoning",
    sections: [
      {
        id: "executive_summary",
        title: "Executive Summary",
        description:
          "Provides a clear overview of the case, key decisions, and main stakeholders.",
        icon: <BookOutlined style={{ color: "#1890ff" }} />,
      },
      {
        id: "background",
        title: "Background",
        description:
          "Outlines the company’s history, market position, and performance trends.",
        icon: <FileTextOutlined style={{ color: "#722ed1" }} />,
      },
      {
        id: "industry_context",
        title: "Industry Context",
        description:
          "Highlights industry trends, benchmarks, and evolving market dynamics.",
        icon: <BulbOutlined style={{ color: "#eb2f96" }} />,
      },
      {
        id: "key_figures",
        title: "Key Figures",
        description:
          "Profiles the main stakeholders and their influence on decisions.",
        icon: <UserOutlined style={{ color: "#fa541c" }} />,
      },
      {
        id: "the_challenge",
        title: "The Challenge",
        description:
          "Describes operational issues, risks, and financial challenges faced.",
        icon: <ExclamationCircleOutlined style={{ color: "#faad14" }} />,
      },
      {
        id: "options_analysis",
        title: "Options and Analysis",
        description:
          "Examines strategic alternatives, costs, benefits, and potential outcomes.",
        icon: <PieChartOutlined style={{ color: "#52c41a" }} />,
      },
      {
        id: "decision_point",
        title: "Decision Point",
        description:
          "Provides the framework and success factors for final decision-making.",
        icon: <CheckCircleOutlined style={{ color: "#722ed1" }} />,
      },
      {
        id: "exhibits",
        title: "Exhibits",
        description:
          "Includes supporting data, financials, and reference materials for context.",
        icon: <FileOutlined style={{ color: "#13c2c2" }} />,
      },
    ],
    single: {
      title: "Full Report",
      description:
        "Generates a single, integrated 2000-word Harvard-style case study covering all analysis elements in one cohesive narrative.",
      icon: <ContainerOutlined style={{ color: "#13c2c2" }} />,
    },
  },
  {
    style: "style_b",
    title: "Style B Preview",
    description:
      "An interactive case study designed for guided learning and discussion. Ideal for classroom engagement and applying concepts through exercises and questions.",
    sections: [
      {
        id: "learning_objectives",
        title: "Learning Objectives",
        description:
          "Defines the core skills and outcomes students should achieve.",
        icon: <BulbOutlined style={{ color: "#faad14" }} />,
      },
      {
        id: "key_concepts",
        title: "Key Concepts and Theoretical Framework",
        description:
          "Covers essential theories and concepts underpinning the case study.",
        icon: <BookOutlined style={{ color: "#1890ff" }} />,
      },
      {
        id: "case_overview",
        title: "Case Overview and Background",
        description:
          "Summarizes the case context, key events, and organizational details.",
        icon: <FileTextOutlined style={{ color: "#722ed1" }} />,
      },
      {
        id: "analysis_application",
        title: "Analysis and Application",
        description:
          "Demonstrates how to apply concepts to analyze the case effectively.",
        icon: <PlayCircleOutlined style={{ color: "#52c41a" }} />,
      },
      {
        id: "discussion_questions",
        title: "Discussion Questions",
        description:
          "Provides thought-provoking questions to stimulate classroom debate.",
        icon: <MessageOutlined style={{ color: "#13c2c2" }} />,
      },
      {
        id: "class_activities",
        title: "Class Activities and Exercises",
        description:
          "Suggests interactive exercises to reinforce concepts and engagement.",
        icon: <PlayCircleOutlined style={{ color: "#52c41a" }} />,
      },
      {
        id: "teaching_notes",
        title: "Teaching Notes and Recommendations",
        description:
          "Offers guidance and tips for instructors delivering the case study.",
        icon: <CheckCircleOutlined style={{ color: "#722ed1" }} />,
      },
      {
        id: "references",
        title: "References and Further Reading",
        description:
          "Lists academic and practical resources for deeper exploration.",
        icon: <BookOutlined style={{ color: "#1890ff" }} />,
      },
    ],
  },
  {
    style: "style_c",
    title: "Style C Preview",
    description:
      "A structured learning experience emphasizing progression, multimedia, and practice. Suitable for self-paced learning with real-world applications and feedback loops.",
    sections: [
      {
        id: "learning_pathway",
        title: "Learning Pathway Overview",
        description:
          "Outlines a step-by-step roadmap for learners' progression and milestones.",
        icon: <BookOutlined style={{ color: "#1890ff" }} />,
      },
      {
        id: "multimedia_modules",
        title: "Multimedia Content Modules",
        description:
          "Details videos, animations, and interactive media supporting learning.",
        icon: <PlayCircleOutlined style={{ color: "#52c41a" }} />,
      },
      {
        id: "interactive_elements",
        title: "Interactive Learning Elements",
        description:
          "Describes exercises, simulations, and scenarios for active engagement.",
        icon: <InteractionOutlined style={{ color: "#faad14" }} />,
      },
      {
        id: "assessment_components",
        title: "Assessment Components",
        description:
          "Explains quizzes, assignments, and evaluation strategies for learners.",
        icon: <CheckCircleOutlined style={{ color: "#722ed1" }} />,
      },
      {
        id: "application_scenarios",
        title: "Practical Application Scenarios",
        description:
          "Shows real-world examples and case studies to apply knowledge.",
        icon: <BulbOutlined style={{ color: "#eb2f96" }} />,
      },
      {
        id: "discussion_forums",
        title: "StyleC Discussion Forums",
        description:
          "Encourages collaborative discussions and sharing perspectives.",
        icon: <MessageOutlined style={{ color: "#13c2c2" }} />,
      },
      {
        id: "supplementary_resources",
        title: "Supplementary Resources",
        description:
          "Provides additional learning materials and external references.",
        icon: <BookOutlined style={{ color: "#b37feb" }} />,
      },
      {
        id: "feedback_mechanisms",
        title: "Feedback Mechanisms",
        description:
          "Covers tools and strategies for monitoring learner progress and feedback.",
        icon: <UserOutlined style={{ color: "#fa541c" }} />,
      },
    ],
  },
  {
    style: "style_sof",
    title: "SOF Report Preview",
    description:
      "A structured SOF (Statement of Facts) report layout used for legal/forensic case summaries.",
    sections: [
      {
        id: "accused_profile",
        title: "Accused Profile",
        description:
          "Details surrounding the accused and their status at the time of arrest",
        analysisElements: ["Accused Details"],
        sample:
          "The Accused is TAN WEI MING ('the Accused'), a 38-year-old Singaporean bearing NRIC No.: XXXXXXXXX. He was unemployed at the material time.",
        icon: <UserOutlined style={{ color: "#fa541c" }} />,
      },
      {
        id: "arrest_and_exhibhits",
        title: "Arrest and seizure of exhibits",
        description:
          "Description of how the arrest was carried out and all evidences secured from the accused",
        analysisElements: ["Arrest", "Exhibits"],
        sample:
          "On 12 April 2024 at about 11.15pm, at Blk 123  XXXXX #04-321, Singapore XXXXX  (the “Location”), Central Narcotics Bureau  (“CNB”) officers arrested the Accused. ",
        icon: <ExclamationCircleOutlined style={{ color: "#faad14" }} />,
      },
      {
        id: "charge_facts",
        title: "Facts relating to the proceeded charges",
        description:
          "Relevant information regarding the exhibits and how it relates to the charge. Analysis results are also included in this section",
        analysisElements: ["Relevant Facts", "Analysis Results"],
        sample:
          "On 13 April 2024, the exhibit marked as “A1A” was submitted to the Illicit Drugs Laboratory of the Health Sciences Authority (“HSA”) for analysis. ",
        icon: <FileTextOutlined style={{ color: "#722ed1" }} />,
      },
      {
        id: "acknowledgement",
        title: "Acknowledgement Officer",
        description: "Details and date of the acknowledgement",
        analysisElements: ["Acknowledgement"],
        sample: [
          "SSGT MOHAMMAD RXXXX XXX XXXXXXXX",
          "INVESTIGATION OFFICER",
          "SINGAPORE",
          "6 October 2024",
        ].join("\n"),
        icon: <CheckCircleOutlined style={{ color: "#722ed1" }} />,
      },
    ],
  },
];

export default stylePreviewData;
