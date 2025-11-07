import React from "react";

export const layoutId = "solution-slide";
export const layoutName = "Solution Slide";
export const layoutDescription =
  "A slide layout designed to present a solution to previously identified problems, showcasing key aspects of the solution with sections and icons.";

// Simple schema for AI content generation
export const schema = {
  companyName: {
    type: "string",
    default: "presenton",
    description: "Company name displayed in header (2-50 characters)"
  },
  date: {
    type: "string",
    default: "June 13, 2038",
    description: "Today Date displayed in header (5-30 characters)"
  },
  title: {
    type: "string",
    default: "Solution",
    description: "Main title of the slide (3-25 characters)"
  },
  mainDescription: {
    type: "string",
    default: "Show that we offer a solution that solves the problems previously described and identified. Make sure that the solutions we offer uphold the values of effectiveness, efficiency, and are highly relevant to the market situation and society.",
    description: "Main content text describing the solution (20-300 characters)"
  },
  sections: {
    type: "array",
    description: "List of solution sections with titles, descriptions, and optional icons (2-4 items)",
    items: {
      title: { type: "string", description: "Section title (3-30 characters)" },
      description: { type: "string", description: "Section description (5-100 characters)" },
      icon: {
        type: "object",
        optional: true,
        description: "Icon for the section",
        properties: {
          __icon_url__: { type: "string", description: "URL to icon" },
          __icon_query__: { type: "string", description: "Query used to search the icon" }
        }
      }
    },
    default: [
      {
        title: "Market",
        description: "Innovative and widely accepted solutions for modern business challenges.",
        icon: {
          __icon_query__: "market innovation",
          __icon_url__: "https://api.iconify.design/mdi/store.svg?color=%23ffffff"
        }
      },
      {
        title: "Industry",
        description: "Based on sound market decisions and industry best practices.",
        icon: {
          __icon_query__: "industry building",
          __icon_url__: "https://api.iconify.design/mdi/factory.svg?color=%23ffffff"
        }
      },
      {
        title: "Analytics",
        description: "Driven by precise data and comprehensive analysis.",
        icon: {
          __icon_query__: "data analysis",
          __icon_url__: "https://api.iconify.design/mdi/chart-bar.svg?color=%23ffffff"
        }
      }
    ]
  }
};

const SolutionSlideLayout = ({ data: slideData }) => {
  const sections = slideData?.sections || [];

  return (
    <div
      style={{
        width: '1280px',
        height: '720px',
        maxWidth: '1280px',
        aspectRatio: '16 / 9',
        background: '#ffffff',
        fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        borderRadius: '4px',
        margin: '0 auto',
        border: '2px solid #1f2937'
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
        color: '#1E4CD9',
        fontSize: '14px',
        fontWeight: 600
      }}>
        <span>{slideData?.companyName}</span>
        <span>{slideData?.date}</span>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        padding: '0 64px 64px 64px',
        gap: '16px'
      }}>
        {/* Title and Description */}
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start'
        }}>
          <h1 style={{
            fontSize: '60px',
            fontWeight: 700,
            color: '#2563eb',
            marginBottom: '32px',
            lineHeight: 1.2,
            textAlign: 'left',
            margin: '0 0 32px 0'
          }}>
            {slideData?.title || 'Solution'}
          </h1>
          <p style={{
            color: '#2563eb',
            fontSize: '18px',
            lineHeight: 1.6,
            fontWeight: 400,
            marginBottom: '48px',
            maxWidth: '512px',
            textAlign: 'left',
            margin: '0 0 48px 0'
          }}>
            {slideData?.mainDescription || 'Show that we offer a solution that solves the problems previously described.'}
          </p>
        </div>

        {/* Four Small Boxes in a Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          width: '100%'
        }}>
          {sections.map((section, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                background: '#F5F8FE',
                borderRadius: '8px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                padding: '12px 16px'
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                {section.icon ? (
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={section.icon.__icon_url__}
                      alt={section.icon.__icon_query__ || 'icon'}
                      style={{
                        width: '24px',
                        height: '24px',
                        filter: 'brightness(0) invert(1)'
                      }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#2563eb'
                  }}></div>
                )}
              </div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#2563eb',
                marginBottom: '4px',
                margin: '0 0 4px 0'
              }}>
                {section.title}
              </h2>
              <div style={{
                width: '32px',
                height: '4px',
                background: '#2563eb',
                marginBottom: '8px'
              }}></div>
              <p style={{
                color: '#2563eb',
                fontSize: '12px',
                lineHeight: 1.4,
                margin: 0
              }}>
                {section.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Border */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: '#2563eb'
      }}></div>
    </div>
  );
};

export default SolutionSlideLayout;
