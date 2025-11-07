import React from 'react';

export const layoutId = 'chart-with-bullets-slide';
export const layoutName = 'Chart with Bullet Boxes';
export const layoutDescription = 'A slide layout with title, description, chart visualization on the left and colored bullet boxes with icons on the right.';

// Simple schema for AI content generation
export const schema = {
    title: {
        type: "string",
        default: 'Market Size',
        description: "Main title of the slide (3-40 characters)"
    },
    description: {
        type: "string",
        default: 'Our market analysis shows strong growth potential across all key segments with increasing demand.',
        description: "Description text below the title (10-150 characters)"
    },
    chartData: {
        type: "array",
        description: "Chart data points (2-5 items)",
        items: {
            name: { type: "string", description: "Data point name" },
            value: { type: "number", description: "Data point value" }
        },
        default: [
            { name: 'TAM', value: 100 },
            { name: 'SAM', value: 60 },
            { name: 'SOM', value: 25 }
        ]
    },
    bulletPoints: {
        type: "array",
        description: "List of bullet points with colored boxes and icons (1-3 items)",
        items: {
            title: { type: "string", description: "Bullet point title (2-80 characters)" },
            description: { type: "string", description: "Bullet point description (10-150 characters)" },
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
                title: 'Total Addressable Market',
                description: 'Companies can use TAM to plan future expansion and investment.',
                icon: {
                    __icon_url__: 'https://api.iconify.design/mdi/chart-line.svg?color=%23ffffff',
                    __icon_query__: 'target market scope'
                }
            },
            {
                title: 'Serviceable Available Market',
                description: 'Indicates more measurable market segments for sales efforts.',
                icon: {
                    __icon_url__: 'https://api.iconify.design/mdi/chart-pie.svg?color=%23ffffff',
                    __icon_query__: 'pie chart analysis'
                }
            },
            {
                title: 'Serviceable Obtainable Market',
                description: 'Help companies plan development strategies according to the market.',
                icon: {
                    __icon_url__: 'https://api.iconify.design/mdi/trending-up.svg?color=%23ffffff',
                    __icon_query__: 'trending up growth'
                }
            }
        ]
    }
};

const ChartWithBulletsSlideLayout = ({ data: slideData }) => {
    const chartData = slideData?.chartData || [];
    const bulletPoints = slideData?.bulletPoints || [];
    
    const maxValue = Math.max(...chartData.map(d => d.value), 1);
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

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
                height: '100%',
                padding: '64px 80px 32px 80px',
                gap: '40px'
            }}>
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <h1 style={{
                        color: 'var(--text-heading-color, #111827)',
                        fontSize: '56px',
                        fontWeight: 700,
                        margin: '0 0 16px 0',
                        lineHeight: 1.2
                    }}>
                        {slideData?.title || 'Market Size'}
                    </h1>

                    <p style={{
                        color: 'var(--text-body-color, #4b5563)',
                        fontSize: '16px',
                        lineHeight: 1.6,
                        margin: '0 0 32px 0'
                    }}>
                        {slideData?.description || 'Our market analysis shows strong growth potential across all key segments with increasing demand.'}
                    </p>

                    <div style={{
                        flex: 1,
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                        border: '1px solid #f3f4f6',
                        padding: '24px',
                        background: '#F5F8FE'
                    }}>
                        <div style={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'space-around',
                            gap: '16px',
                            paddingBottom: '32px'
                        }}>
                            {chartData.map((item, index) => {
                                const heightPercent = (item.value / maxValue) * 100;
                                return (
                                    <div key={index} style={{
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center'
                                    }}>
                                        <div style={{
                                            width: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center'
                                        }}>
                                            <span style={{
                                                color: 'var(--text-heading-color, #111827)',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                marginBottom: '8px'
                                            }}>
                                                {item.value}
                                            </span>
                                            <div 
                                                style={{ 
                                                    width: '100%',
                                                    height: `${Math.max(heightPercent * 2, 20)}px`,
                                                    maxHeight: '300px',
                                                    borderRadius: '8px 8px 0 0',
                                                    backgroundColor: colors[index % colors.length],
                                                    transition: 'all 0.3s'
                                                }}
                                            ></div>
                                        </div>
                                        <span style={{
                                            color: 'var(--text-body-color, #4b5563)',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            marginTop: '12px'
                                        }}>
                                            {item.name}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div style={{
                    flexShrink: 0,
                    width: '320px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '16px'
                }}>
                    {bulletPoints.map((bullet, index) => (
                        <div
                            key={index}
                            style={{
                                borderRadius: '16px',
                                padding: '24px',
                                color: '#ffffff',
                                backgroundColor: 'var(--primary-accent-color, #9333ea)'
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '12px'
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'rgba(255, 255, 255, 0.2)'
                                }}>
                                    <img
                                        src={bullet.icon.__icon_url__}
                                        alt={bullet.icon.__icon_query__ || 'icon'}
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            filter: 'brightness(0) invert(1)'
                                        }}
                                    />
                                </div>
                                <h3 style={{
                                    color: '#ffffff',
                                    fontSize: '18px',
                                    fontWeight: 600,
                                    margin: 0
                                }}>
                                    {bullet.title}
                                </h3>
                            </div>

                            <p style={{
                                color: '#ffffff',
                                fontSize: '14px',
                                lineHeight: 1.5,
                                margin: 0,
                                opacity: 0.9
                            }}>
                                {bullet.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ChartWithBulletsSlideLayout;
