import React from "react";

export const layoutId = "about-company-slide";
export const layoutName = "About Our Company Slide";
export const layoutDescription =
  "A slide layout providing an overview of the company, its background, and key information.";

// Simple schema for AI content generation
export const schema = {
  title: {
    type: "string",
    default: "About Our Company",
    description: "Main title of the slide (3-30 characters)"
  },
  content: {
    type: "string",
    default: "In the presentation session, the background/introduction can be filled with information that is arranged systematically and effectively with respect to an interesting topic to be used as material for discussion at the opening of the presentation session. The introduction can provide a general overview for those who are listening to your presentation so that the key words on the topic of discussion are emphasized during this background/introductory presentation session.",
    description: "Main content text describing the company or topic (25-400 characters)"
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
  },
  image: {
    type: "object",
    optional: true,
    description: "Optional supporting image for the slide (building, office, etc.)",
    properties: {
      __image_url__: { type: "string", description: "URL to image" },
      __image_prompt__: { type: "string", description: "Prompt used to generate the image" }
    },
    default: null
  }
};

const AboutCompanySlideLayout = ({ data: slideData }) => {
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
        margin: '0 auto'
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

      {/* Main content area */}
      <div style={{
        display: 'flex',
        height: '100%',
        padding: '0 64px 64px 64px'
      }}>
        {/* Left side - Image */}
        <div style={{
          flex: 1,
          paddingRight: '64px',
          display: 'flex',
          alignItems: 'center',
          paddingTop: '32px'
        }}>
          <div style={{
            width: '100%',
            height: '384px',
            overflow: 'hidden'
          }}>
            {slideData?.image ? (
              <img
                src={slideData.image.__image_url__}
                alt={slideData.image.__image_prompt__ || 'Company image'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              /* Default building facade */
              <div style={{
                width: '100%',
                height: '100%',
                background: '#e5e7eb',
                position: 'relative'
              }}>
                {/* Building structure simulation */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#d1d5db'
                }}></div>

                {/* Horizontal lines (building floors) */}
                <div style={{ position: 'absolute', inset: 0 }}>
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        borderTop: '1px solid #9ca3af',
                        opacity: 0.6,
                        top: `${(i + 1) * 8}%`
                      }}
                    ></div>
                  ))}
                </div>

                {/* Vertical lines (building columns) */}
                <div style={{ position: 'absolute', inset: 0 }}>
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        height: '100%',
                        borderLeft: '1px solid #9ca3af',
                        opacity: 0.4,
                        left: `${(i + 1) * 16}%`
                      }}
                    ></div>
                  ))}
                </div>

                {/* Windows */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                  padding: '16px'
                }}>
                  {[...Array(32)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        background: '#dbeafe',
                        opacity: 0.6,
                        borderRadius: '2px',
                        border: '1px solid #d1d5db'
                      }}
                    ></div>
                  ))}
                </div>

                {/* Building edge highlight */}
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  width: '4px',
                  height: '100%',
                  background: '#ffffff',
                  opacity: 0.8
                }}></div>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Content */}
        <div style={{
          flex: 1,
          paddingLeft: '64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          {slideData?.title && (
            <h2 style={{
              fontSize: '60px',
              fontWeight: 700,
              color: '#2563eb',
              marginBottom: '48px',
              lineHeight: 1.2,
              margin: '0 0 48px 0'
            }}>
              {slideData?.title}
            </h2>
          )}

          {slideData?.content && (
            <div style={{
              fontSize: '18px',
              color: '#2563eb',
              lineHeight: 1.6,
              fontWeight: 400,
              maxWidth: '512px'
            }}>
              {slideData?.content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AboutCompanySlideLayout;
