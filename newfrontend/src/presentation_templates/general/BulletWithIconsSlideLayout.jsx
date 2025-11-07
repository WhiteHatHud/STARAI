import React from 'react';

export const layoutId = 'bullet-with-icons-slide';
export const layoutName = 'Bullet with Icons';
export const layoutDescription = 'A bullets style slide with main content, supporting image, and bullet points with icons and descriptions.';

// Simple schema for AI content generation
export const schema = {
    title: {
        type: "string",
        default: 'Problem',
        description: "Main title of the slide (3-40 characters)"
    },
    description: {
        type: "string",
        default: 'Businesses face challenges with outdated technology and rising costs, limiting efficiency and growth in competitive markets.',
        description: "Main description text explaining the problem or topic (max 150 characters)"
    },
    image: {
        type: "object",
        description: "Supporting image for the slide",
        properties: {
            __image_url__: { type: "string", description: "URL to image" },
            __image_prompt__: { type: "string", description: "Prompt used to generate the image" }
        },
        default: {
            __image_url__: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
            __image_prompt__: 'Business people analyzing documents and charts in office'
        }
    },
    bulletPoints: {
        type: "array",
        description: "List of bullet points with icons and descriptions (1-3 items)",
        items: {
            title: { type: "string", description: "Bullet point title (2-60 characters)" },
            description: { type: "string", description: "Bullet point description (10-100 characters)" },
            icon: {
                type: "object",
                properties: {
                    __icon_url__: { type: "string", description: "URL to icon" },
                    __icon_query__: { type: "string", description: "Query used to search the icon" }
                }
            }
        },
        default: [
            {
                title: 'Inefficiency',
                description: 'Businesses struggle to find digital tools that meet their needs, causing operational slowdowns.',
                icon: {
                    __icon_url__: 'https://api.iconify.design/mdi/alert-circle.svg?color=%23ffffff',
                    __icon_query__: 'warning alert inefficiency'
                }
            },
            {
                title: 'High Costs',
                description: 'Outdated systems increase expenses, while small businesses struggle to expand their market reach.',
                icon: {
                    __icon_url__: 'https://api.iconify.design/mdi/trending-up.svg?color=%23ffffff',
                    __icon_query__: 'trending up costs chart'
                }
            }
        ]
    }
};

const BulletWithIconsSlideLayout = ({ data: slideData }) => {
    const bulletPoints = slideData?.bulletPoints || [];

    return (
        <div
            style={{
                width: '1280px',
                height: '720px',
                maxWidth: '1280px',
                maxHeight: '720px',
                aspectRatio: '16 / 9',
                background: 'var(--card-background-color, #ffffff)',
                fontFamily: 'var(--heading-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                borderRadius: '4px',
                margin: '0 auto'
            }}
        >
            {slideData?.__companyName__ && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: '16px 80px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <span style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: 'var(--text-heading-color, #111827)'
                    }}>
                        {slideData?.__companyName__}
                    </span>
                    <div style={{
                        height: '2px',
                        flex: 1,
                        opacity: 0.7,
                        backgroundColor: 'var(--text-heading-color, #111827)'
                    }}></div>
                </div>
            )}

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                padding: '64px 80px 32px 80px'
            }}>
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{
                        color: 'var(--text-heading-color, #111827)',
                        fontSize: '56px',
                        fontWeight: 700,
                        margin: 0,
                        lineHeight: 1.2
                    }}>
                        {slideData?.title || 'Problem'}
                    </h1>
                </div>

                <div style={{
                    display: 'flex',
                    flex: 1,
                    gap: '40px'
                }}>
                    <div style={{
                        flex: 1,
                        position: 'relative'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0.3
                        }}>
                            <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 200 200">
                                <defs>
                                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--primary-accent-color,#9333ea)" strokeWidth="0.5" />
                                    </pattern>
                                </defs>
                                <rect width="100%" height="100%" fill="url(#grid)" />
                            </svg>
                        </div>

                        <div style={{
                            position: 'relative',
                            zIndex: 10,
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '16px'
                        }}>
                            <div style={{
                                width: '100%',
                                maxWidth: '448px',
                                height: '320px',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }}>
                                <img
                                    src={slideData?.image?.__image_url__ || ''}
                                    alt={slideData?.image?.__image_prompt__ || slideData?.title || ''}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{
                            position: 'absolute',
                            top: '80px',
                            right: '32px',
                            color: 'var(--primary-accent-color, #9333ea)'
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0l3.09 6.26L22 9l-6.91 2.74L12 18l-3.09-6.26L2 9l6.91-2.74L12 0z" />
                            </svg>
                        </div>
                    </div>

                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                    }}>
                        <p style={{
                            color: 'var(--text-body-color, #4b5563)',
                            fontSize: '18px',
                            lineHeight: 1.6,
                            marginBottom: '32px',
                            margin: '0 0 32px 0'
                        }}>
                            {slideData?.description || 'Businesses face challenges with outdated technology and rising costs, limiting efficiency and growth in competitive markets.'}
                        </p>

                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '24px'
                        }}>
                            {bulletPoints.map((bullet, index) => (
                                <div key={index} style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '16px'
                                }}>
                                    <div style={{
                                        flexShrink: 0,
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'var(--primary-accent-color, #9333ea)'
                                    }}>
                                        <img
                                            src={bullet.icon.__icon_url__}
                                            alt={bullet.icon.__icon_query__ || 'icon'}
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                filter: 'brightness(0) invert(1)'
                                            }}
                                        />
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <h3 style={{
                                            color: 'var(--text-heading-color, #111827)',
                                            fontSize: '20px',
                                            fontWeight: 600,
                                            margin: '0 0 8px 0'
                                        }}>
                                            {bullet.title}
                                        </h3>
                                        <div style={{
                                            width: '48px',
                                            height: '2px',
                                            background: 'var(--primary-accent-color, #9333ea)',
                                            marginBottom: '12px'
                                        }}></div>
                                        <p style={{
                                            color: 'var(--text-body-color, #4b5563)',
                                            fontSize: '16px',
                                            lineHeight: 1.6,
                                            margin: 0
                                        }}>
                                            {bullet.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulletWithIconsSlideLayout;
