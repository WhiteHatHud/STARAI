import React from "react";

export const layoutId = "problem-statement-slide";
export const layoutName = "Problem Statement Slide";
export const layoutDescription =
  "A slide layout designed to present a clear problem statement, including categories of problems, company information, and an optional image.";

// Simple schema for AI content generation
export const schema = {
  title: {
    type: "string",
    default: "Problem",
    description: "Main title of the problem statement slide (3-20 characters)"
  },
  description: {
    type: "string",
    default: "A problem needs to be discussed further and in detail because this problem is the main foundation in the initial development of a product, service, and decision making. Without a well-defined problem, it will have an impact on a job that is unfocused, unmanaged, and less relevant.",
    description: "Main content text describing the problem statement (50-200 characters)"
  },
  problemCategories: {
    type: "array",
    description: "List of problem categories with titles, descriptions, and optional icons (2-4 items)",
    items: {
      title: { type: "string", description: "Title of the problem category (3-30 characters)" },
      description: { type: "string", description: "Description of the problem category (20-100 characters)" },
      icon: {
        type: "object",
        optional: true,
        description: "Optional icon for the problem category",
        properties: {
          __icon_url__: { type: "string", description: "URL to icon" },
          __icon_query__: { type: "string", description: "Query used to search the icon" }
        }
      }
    },
    default: [
      {
        title: "Inefficiency",
        description: "Businesses struggle to find digital tools that meet their needs, causing operational slowdowns.",
        icon: {
          __icon_url__: "https://api.iconify.design/mdi/alert-circle.svg?color=%23ffffff",
          __icon_query__: "warning alert inefficiency"
        }
      },
      {
        title: "High Costs",
        description: "Outdated systems increase expenses, while small businesses struggle to expand their market reach.",
        icon: {
          __icon_url__: "https://api.iconify.design/mdi/trending-up.svg?color=%23ffffff",
          __icon_query__: "trending up costs chart"
        }
      },
      {
        title: "Limited Reach",
        description: "Companies face challenges expanding market presence without effective digital strategies.",
        icon: {
          __icon_url__: "https://api.iconify.design/mdi/account-remove.svg?color=%23ffffff",
          __icon_query__: "limited reach market"
        }
      }
    ]
  },
  companyName: {
    type: "string",
    default: "presenton",
    description: "Company name displayed in header (2-50 characters)"
  },
  date: {
    type: "string",
    default: "June 13, 2038",
    description: "Today Date displayed in header (5-30 characters)"
  }
};

const ProblemStatementSlideLayout = ({ data: slideData }) => {
  const problemCategories = slideData?.problemCategories || [];

  return (
    <div
      style={{
        width: '1280px',
        height: '720px',
        maxWidth: '1280px',
        aspectRatio: '16 / 9',
        background: '#2563eb',
        fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '4px',
        margin: '0 auto',
        color: '#ffffff'
      }}
    >
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: '32px',
        left: '40px',
        right: '40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 600
      }}>
        <span>{slideData?.companyName}</span>
        <span>{slideData?.date}</span>
      </div>

      {/* Main content area */}
      <div style={{
        display: 'flex',
        height: '100%',
        padding: '0 64px 64px 64px'
      }}>
        {/* Left side - Main Problem */}
        <div style={{
          flex: 1,
          paddingRight: '64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            height: '100%'
          }}>
            <h2 style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '32px',
              lineHeight: 1.2,
              textAlign: 'left',
              margin: '0 0 32px 0'
            }}>
              {slideData?.title || 'Problem'}
            </h2>

            <div style={{
              fontSize: '18px',
              color: '#ffffff',
              lineHeight: 1.6,
              fontWeight: 400,
              marginBottom: '48px',
              maxWidth: '512px',
              textAlign: 'left'
            }}>
              {slideData?.description || 'A problem needs to be discussed further and in detail because this problem is the main foundation in the initial development of a product, service, and decision making.'}
            </div>
          </div>
        </div>

        {/* Right side - Problem Categories with Icons */}
        <div style={{
          flex: 1,
          paddingLeft: '64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '640px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '32px'
          }}>
            {problemCategories.map((category, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '24px'
                }}
              >
                {/* Icon Circle */}
                {category.icon && (
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <img
                      src={category.icon.__icon_url__}
                      alt={category.icon.__icon_query__ || 'icon'}
                      style={{
                        width: '32px',
                        height: '32px',
                        filter: 'brightness(0) invert(1)'
                      }}
                    />
                  </div>
                )}

                {/* Text Content */}
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '24px',
                    fontWeight: 600,
                    color: '#ffffff',
                    marginBottom: '8px',
                    margin: '0 0 8px 0'
                  }}>
                    {category.title}
                  </h3>
                  <p style={{
                    fontSize: '16px',
                    color: '#ffffff',
                    lineHeight: 1.5,
                    opacity: 0.9,
                    margin: 0
                  }}>
                    {category.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom border line */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '4px',
        background: '#ffffff'
      }}></div>
    </div>
  );
};

export default ProblemStatementSlideLayout;
