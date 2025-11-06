/**
 * Generate sample data for template previews
 * This data is used when rendering templates in preview mode
 */
export const generateSampleData = () => {
  return {
    // Basic fields
    title: 'Product Overview',
    description: 'Our product offers customizable dashboards for real-time reporting and data-driven decisions. It integrates with third-party tools to enhance operations and scales with business growth for improved efficiency.',
    content: 'This is sample content that demonstrates how the template layout will look with actual data.',
    subtitle: 'Innovative Solutions for Modern Business',
    author: 'John Smith',
    date: new Date().toLocaleDateString(),
    
    // Company information
    companyName: 'ACME Corporation',
    __companyName__: 'ACME Corporation',
    contactNumber: '+1-555-123-4567',
    contactAddress: '123 Business St, Tech City, TC 12345',
    contactWebsite: 'www.acmecorp.com',
    mainDescription: 'We provide innovative solutions that transform businesses through technology and data-driven insights.',
    
    // Images
    image: {
      __image_url__: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
      __image_prompt__: 'Business team in meeting room'
    },
    images: [
      {
        __image_url__: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
        __image_prompt__: 'Business meeting'
      }
    ],
    
    // Simple lists
    items: [
      'First key point about the product',
      'Second important feature',
      'Third benefit for users'
    ],
    
    // Bullet points with icons
    bulletPoints: [
      {
        title: 'Custom Software',
        subtitle: 'We create tailored software to optimize processes and boost efficiency.',
        description: 'Comprehensive software development services tailored to your business needs.',
        icon: {
          __icon_url__: 'https://api.iconify.design/mdi/code-tags.svg?color=%23ffffff',
          __icon_query__: 'code software development'
        }
      },
      {
        title: 'Digital Consulting',
        subtitle: 'Our consultants guide organizations in leveraging the latest technologies.',
        description: 'Expert guidance to help you navigate the digital transformation journey.',
        icon: {
          __icon_url__: 'https://api.iconify.design/mdi/account-group.svg?color=%23ffffff',
          __icon_query__: 'users consulting team'
        }
      },
      {
        title: 'Support Services',
        subtitle: 'We provide ongoing support to help businesses adapt and maintain performance.',
        description: '24/7 support to ensure your systems run smoothly and efficiently.',
        icon: {
          __icon_url__: 'https://api.iconify.design/mdi/headset.svg?color=%23ffffff',
          __icon_query__: 'headphones support service'
        }
      }
    ],
    
    // Chart data
    chartData: [
      { name: 'TAM', value: 100 },
      { name: 'SAM', value: 60 },
      { name: 'SOM', value: 25 },
    ],
    
    // Problem categories
    problemCategories: [
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
          __icon_url__: 'https://api.iconify.design/mdi/currency-usd.svg?color=%23ffffff',
          __icon_query__: 'dollar money costs'
        }
      },
      {
        title: 'Limited Scalability',
        description: 'Legacy infrastructure prevents businesses from scaling efficiently to meet growing demands.',
        icon: {
          __icon_url__: 'https://api.iconify.design/mdi/trending-up.svg?color=%23ffffff',
          __icon_query__: 'trending up growth chart'
        }
      }
    ],
    
    // Solution sections
    sections: [
      {
        title: 'Market Innovation',
        description: 'Innovative and widely accepted solutions for modern business challenges.',
        icon: {
          __icon_url__: 'https://api.iconify.design/mdi/lightbulb-on.svg?color=%23ffffff',
          __icon_query__: 'lightbulb innovation idea'
        }
      },
      {
        title: 'Industry Standards',
        description: 'Based on sound market decisions and industry best practices.',
        icon: {
          __icon_url__: 'https://api.iconify.design/mdi/shield-check.svg?color=%23ffffff',
          __icon_query__: 'shield check security'
        }
      },
      {
        title: 'Scalable Platform',
        description: 'Built to grow with your business and adapt to changing needs.',
        icon: {
          __icon_url__: 'https://api.iconify.design/mdi/chart-line.svg?color=%23ffffff',
          __icon_query__: 'chart growth scalability'
        }
      },
      {
        title: 'Expert Support',
        description: 'Dedicated team available to help you succeed every step of the way.',
        icon: {
          __icon_url__: 'https://api.iconify.design/mdi/account-star.svg?color=%23ffffff',
          __icon_query__: 'star expert support'
        }
      }
    ]
  };
};
