import React from "react";

export const layoutId = "bullet-icons-only-slide";
export const layoutName = "Bullet Icons Only";
export const layoutDescription =
  "A slide layout with title, grid of bullet points (title and description) with icons, and a supporting image.";

// Simple schema for AI content generation
export const schema = {
  title: {
    type: "string",
    default: "Solutions",
    description: "Main title of the slide (3-40 characters)",
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
        "Business professionals collaborating and discussing solutions",
    },
  },
  bulletPoints: {
    type: "array",
    description: "Bullet points with title, subtitle, and icon (2-4 items)",
    items: {
      title: {
        type: "string",
        description: "Bullet point title (2-80 characters)",
      },
      subtitle: {
        type: "string",
        optional: true,
        description:
          "Optional short subtitle or brief explanation (5-150 characters)",
      },
      icon: {
        type: "object",
        properties: {
          __icon_url__: { type: "string", description: "URL to icon" },
          __icon_query__: {
            type: "string",
            description: "Query used to search the icon",
          },
        },
      },
    },
    default: [
      {
        title: "Custom Software",
        subtitle:
          "We create tailored software to optimize processes and boost efficiency.",
        icon: {
          __icon_url__:
            "https://api.iconify.design/mdi/code.svg?color=%23ffffff",
          __icon_query__: "code software development",
        },
      },
      {
        title: "Digital Consulting",
        subtitle:
          "Our consultants guide organizations in leveraging the latest technologies.",
        icon: {
          __icon_url__:
            "https://api.iconify.design/mdi/account-group.svg?color=%23ffffff",
          __icon_query__: "users consulting team",
        },
      },
      {
        title: "Support Services",
        subtitle:
          "We provide ongoing support to help businesses adapt and maintain performance.",
        icon: {
          __icon_url__:
            "https://api.iconify.design/mdi/headset.svg?color=%23ffffff",
          __icon_query__: "headphones support service",
        },
      },
      {
        title: "Scalable Marketing",
        subtitle:
          "Our data-driven strategies help businesses expand their reach and engagement.",
        icon: {
          __icon_url__:
            "https://api.iconify.design/mdi/trending-up.svg?color=%23ffffff",
          __icon_query__: "trending up marketing growth",
        },
      },
    ],
  },
};

const BulletIconsOnlySlideLayout = ({ data: slideData }) => {
  const bulletPoints = slideData?.bulletPoints || [];

  // Function to determine grid columns based on number of bullets
  const getGridColumns = (count) => {
    if (count <= 2) return "1fr";
    if (count <= 4) return "repeat(2, 1fr)";
    return "repeat(3, 1fr)";
  };

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
      {/* Company Name Header */}
      {slideData?.__companyName__ && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "20px 80px",
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
              backgroundColor: "var(--text-heading-color, #111827)",
              opacity: 0.7,
            }}
          ></div>
        </div>
      )}

      {/* Decorative Background Patterns */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "128px",
          height: "100%",
          opacity: 0.1,
          overflow: "hidden",
        }}
      >
        <svg
          style={{ width: "100%", height: "100%" }}
          viewBox="0 0 100 400"
          fill="none"
        >
          <path
            d="M0 100C25 150 50 50 75 100C87.5 125 100 100 100 100V0H0V100Z"
            fill="#8b5cf6"
            opacity="0.4"
          />
          <path
            d="M0 200C37.5 250 62.5 150 100 200V150C75 175 50 150 25 175L0 200Z"
            fill="#8b5cf6"
            opacity="0.3"
          />
        </svg>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "192px",
          height: "128px",
          opacity: 0.1,
          overflow: "hidden",
        }}
      >
        <svg
          style={{ width: "100%", height: "100%" }}
          viewBox="0 0 200 100"
          fill="none"
        >
          <path
            d="M0 50C50 25 100 75 150 50C175 37.5 200 50 200 50V100H0V50Z"
            fill="#8b5cf6"
            opacity="0.2"
          />
        </svg>
      </div>

      {/* Main Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          height: "100%",
          padding: "80px 80px 40px 80px",
        }}
      >
        {/* Left Section - Title and Bullet Points */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            paddingRight: "40px",
          }}
        >
          {/* Title */}
          <h1
            style={{
              color: "var(--text-heading-color, #111827)",
              fontSize: "64px",
              fontWeight: 700,
              margin: "0 0 40px 0",
              lineHeight: 1.1,
            }}
          >
            {slideData?.title || "Solutions"}
          </h1>

          {/* Bullet Points Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: getGridColumns(bulletPoints.length),
              gap: "24px",
              flex: 1,
              alignContent: "center",
            }}
          >
            {bulletPoints.map((bullet, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "16px",
                  padding: "16px",
                  borderRadius: "8px",
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    flexShrink: 0,
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--primary-accent-color, #9333ea)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={bullet.icon.__icon_url__}
                    alt={bullet.icon.__icon_query__ || "icon"}
                    style={{
                      width: "24px",
                      height: "24px",
                      filter: "brightness(0) invert(1)",
                    }}
                  />
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      color: "var(--text-heading-color, #111827)",
                      fontSize: "20px",
                      fontWeight: 600,
                      margin: "0 0 4px 0",
                    }}
                  >
                    {bullet.title}
                  </h3>
                  {bullet.subtitle && (
                    <p
                      style={{
                        color: "var(--text-body-color, #4b5563)",
                        fontSize: "14px",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {bullet.subtitle}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Section - Image */}
        <div
          style={{
            flexShrink: 0,
            width: "384px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Decorative Elements */}
          <div
            style={{
              position: "absolute",
              top: "32px",
              right: "32px",
              color: "var(--primary-accent-color, #9333ea)",
              opacity: 0.6,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
              <path d="M16 0l4.12 8.38L28 12l-7.88 3.62L16 24l-4.12-8.38L4 12l7.88-3.62L16 0z" />
            </svg>
          </div>

          <div
            style={{
              position: "absolute",
              top: "64px",
              left: "32px",
              opacity: 0.2,
            }}
          >
            <svg
              width="80"
              height="20"
              viewBox="0 0 80 20"
              style={{ color: "var(--primary-accent-color, #9333ea)" }}
            >
              <path
                d="M0 10 Q20 0 40 10 T80 10"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>

          {/* Main Image */}
          <div
            style={{
              width: "100%",
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
      </div>
    </div>
  );
};

export default BulletIconsOnlySlideLayout;
