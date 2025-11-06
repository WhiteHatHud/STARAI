import React from "react";

export const layoutId = "intro-pitchdeck-slide";
export const layoutName = "Intro Pitch Deck Slide";
export const layoutDescription =
  "A visually appealing introduction slide for a pitch deck, featuring a large title, company name, date, and contact information with a modern design. This Slide is always the first slide in a pitch deck, setting the tone for the presentation with a clean and professional look.";

// Simple schema for AI content generation
export const schema = {
  title: {
    type: "string",
    default: "Pitch Deck",
    description: "Main title of the slide (2-15 characters)",
  },
  description: {
    type: "string",
    default: "",
    description: "Description as per the design",
  },
  contactNumber: {
    type: "string",
    default: "+123-456-7890",
    description: "Contact phone number displayed in footer",
  },
  contactAddress: {
    type: "string",
    default: "123 Anywhere St., Any City, ST 123",
    description: "Contact address displayed in footer",
  },
  contactWebsite: {
    type: "string",
    default: "www.reallygreatsite.com",
    description: "Contact website URL displayed in footer",
  },
  companyName: {
    type: "string",
    default: "presenton",
    description: "Company name displayed in header",
  },
  date: {
    type: "string",
    default: "June 13, 2038",
    description: "Date of the presentation",
  },
};

const IntroPitchDeckSlide = ({ data: slideData }) => {
  return (
    <div
      style={{
        width: "1280px",
        height: "720px",
        maxWidth: "1280px",
        aspectRatio: "16 / 9",
        background: "#ffffff",
        fontFamily:
          'Montserrat, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        position: "relative",
        overflow: "hidden",
        borderRadius: "4px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        margin: "0 auto",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          position: "absolute",
          top: "32px",
          left: "40px",
          right: "40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#1E4CD9",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        <p style={{ margin: 0 }}>{slideData?.companyName}</p>
        <p style={{ margin: 0 }}>{slideData?.date}</p>
      </div>

      {/* Main Title */}
      <div
        style={{
          position: "absolute",
          left: "40px",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      >
        {slideData?.title && (
          <div style={{ position: "relative", display: "inline-block" }}>
            <h1
              style={{
                fontSize: "72px",
                fontWeight: 700,
                color: "#1E4CD9",
                lineHeight: 1,
                margin: 0,
              }}
            >
              {slideData?.title}
            </h1>
            {/* Blue underline */}
            <span
              style={{
                display: "block",
                background: "#1E4CD9",
                height: "4px",
                position: "absolute",
                left: 0,
                width: "50%",
                bottom: "-0.5em",
                transition: "width 0.3s",
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom Contact Row */}
      <div
        style={{
          position: "absolute",
          bottom: "32px",
          left: "40px",
          right: "40px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "40px",
          color: "#1E4CD9",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        {slideData?.contactNumber && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>📞</span>
            <span>{slideData?.contactNumber}</span>
          </div>
        )}
        {slideData?.contactAddress && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>📍</span>
            <span>{slideData?.contactAddress}</span>
          </div>
        )}
        {slideData?.contactWebsite && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>🌐</span>
            <span>{slideData?.contactWebsite}</span>
          </div>
        )}
        {slideData?.description && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>💬</span>
            <span>{slideData?.description}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntroPitchDeckSlide;
