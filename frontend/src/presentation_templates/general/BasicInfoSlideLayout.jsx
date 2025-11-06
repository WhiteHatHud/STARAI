import React from "react";

export const layoutId = "basic-info-slide";
export const layoutName = "Basic Info";
export const layoutDescription =
  "A clean slide layout with title, description text, and a supporting image.";

// Simple schema for AI content generation
export const schema = {
  title: {
    type: "string",
    default: "Product Overview",
    description: "Main title of the slide (3-40 characters)",
  },
  description: {
    type: "string",
    default:
      "Our product offers customizable dashboards for real-time reporting and data-driven decisions. It integrates with third-party tools to enhance operations and scales with business growth for improved efficiency.",
    description: "Main description text content (10-150 characters)",
  },
  image: {
    type: "object",
    description: "Supporting image for the slide",
    properties: {
      __image_url__: { type: "string", description: "URL to image" },
      __image_prompt__: {
        type: "string",
        description: "Prompt used to generate the image",
      },
    },
    default: {
      __image_url__:
        "https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
      __image_prompt__:
        "Business team in meeting room discussing product features and solutions",
    },
  },
};

const BasicInfoSlideLayout = ({ data: slideData }) => {
  return (
    <div
      style={{
        width: "1280px",
        height: "720px",
        maxWidth: "1280px",
        maxHeight: "720px",
        aspectRatio: "16 / 9",
        background: "var(--card-background-color, #ffffff)",
        fontFamily:
          'var(--heading-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif)',
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        borderRadius: "4px",
        margin: "0 auto",
      }}
    >
      {slideData?.__companyName__ && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "16px 80px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <span
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--text-heading-color, #111827)",
            }}
          >
            {slideData?.__companyName__}
          </span>
          <div
            style={{
              height: "2px",
              flex: 1,
              opacity: 0.7,
              backgroundColor: "var(--text-heading-color, #111827)",
            }}
          ></div>
        </div>
      )}

      {/* Main Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          height: "100%",
          padding: "64px 80px 32px 80px",
        }}
      >
        {/* Left Section - Image */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingRight: "40px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "512px",
              height: "320px",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <img
              src={slideData?.image?.__image_url__ || ""}
              alt={slideData?.image?.__image_prompt__ || slideData?.title || ""}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        </div>

        {/* Right Section - Content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: "40px",
            gap: "24px",
          }}
        >
          {/* Title */}
          <h1
            style={{
              color: "var(--text-heading-color, #111827)",
              fontSize: "56px",
              fontWeight: 700,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {slideData?.title || "Product Overview"}
          </h1>

          {/* Purple accent line */}
          <div
            style={{
              width: "80px",
              height: "4px",
              background: "var(--primary-accent-color, #9333ea)",
            }}
          ></div>

          {/* Description */}
          <p
            style={{
              color: "var(--text-body-color, #4b5563)",
              fontSize: "18px",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {slideData?.description ||
              "Our product offers customizable dashboards for real-time reporting and data-driven decisions. It integrates with third-party tools to enhance operations and scales with business growth for improved efficiency."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BasicInfoSlideLayout;
