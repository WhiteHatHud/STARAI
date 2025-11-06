/**
 * Template registry for dynamic imports
 * Maps layoutId to import functions
 *
 * Templates are now part of the frontend codebase and can be imported directly
 * using Webpack's dynamic import feature - no runtime compilation needed!
 */

export const TEMPLATE_REGISTRY = {
  // General templates (layoutIds match exports from template files)
  "general:basic-info-slide": () =>
    import("./general/BasicInfoSlideLayout.jsx"),
  "general:bullet-icons-only-slide": () =>
    import("./general/BulletIconsOnlySlideLayout.jsx"),
  "general:bullet-with-icons-slide": () =>
    import("./general/BulletWithIconsSlideLayout.jsx"),
  "general:chart-with-bullets-slide": () =>
    import("./general/ChartWithBulletsSlideLayout.jsx"),

  // Modern templates (layoutIds match exports from template files)
  "modern:intro-pitchdeck-slide": () =>
    import("./modern/1IntroSlideLayout.jsx"),
  "modern:about-company-slide": () =>
    import("./modern/2AboutCompanySlideLayout.jsx"),
  "modern:problem-statement-slide": () =>
    import("./modern/3ProblemSlideLayout.jsx"),
  "modern:solution-slide": () => import("./modern/4SolutionSlideLayout.jsx"),
};

/**
 * Load a template dynamically using Webpack's code splitting
 * This is much faster than runtime Babel compilation!
 *
 * @param {string} id - The layout ID (e.g., 'general:basic-info-slide') or template ID prefix (e.g., 'general')
 * @returns {Promise<Object>} For single layoutId: object with component and metadata; for prefix: object with 'slides' array
 */
export const loadTemplate = async (id) => {
  // Check if it's a full layoutId (contains ':')
  if (id.includes(":")) {
    // Single template
    const importFn = TEMPLATE_REGISTRY[id];

    if (!importFn) {
      throw new Error(`Template ${id} not found in registry`);
    }

    try {
      // Dynamic import - Webpack handles code splitting automatically
      const module = await importFn();

      return {
        component: module.default,
        layoutName: module.layoutName,
        layoutId: module.layoutId,
        layoutDescription: module.layoutDescription,
        schema: module.schema,
      };
    } catch (error) {
      console.error(`Failed to load template ${id}:`, error);
      throw error;
    }
  } else {
    // It's a templateId prefix
    const matchingKeys = Object.keys(TEMPLATE_REGISTRY).filter((key) =>
      key.startsWith(`${id}:`)
    );

    if (matchingKeys.length === 0) {
      throw new Error(`No templates found for prefix ${id}`);
    }

    try {
      const promises = matchingKeys.map(async (key) => {
        const importFn = TEMPLATE_REGISTRY[key];
        const module = await importFn();

        return {
          id: module.layoutId,
          name: module.layoutName,
          description: module.layoutDescription,
          json_schema: module.schema,
        };
      });

      const slides = await Promise.all(promises);
      return { slides };
    } catch (error) {
      console.error(`Failed to load templates for prefix ${id}:`, error);
      throw error;
    }
  }
};

/**
 * Get all available template IDs
 * @returns {string[]} Array of layout IDs
 */
export const getAllTemplateIds = () => {
  return Object.keys(TEMPLATE_REGISTRY);
};

/**
 * Check if a template exists
 * @param {string} layoutId - The layout ID to check
 * @returns {boolean} True if template exists
 */
export const templateExists = (layoutId) => {
  return layoutId in TEMPLATE_REGISTRY;
};
