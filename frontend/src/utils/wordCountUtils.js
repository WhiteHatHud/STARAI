/**
 * Utility functions for handling word count in case study content
 */

/**
 * Extract word count from content by counting actual words
 * @param {string} content - The content to count words from
 * @returns {number} - The actual word count 
 */
export const extractWordCount = (content) => {
  if (!content) return 0;
  
  try {
      // Count actual words in content
      // Remove HTML tags and count words
      const cleanedContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const words = cleanedContent.split(' ').filter(word => word.length > 0);
      return words.length;

  } catch (error) {
    console.error('Error counting words:', error);
    return 0;
  }
};
