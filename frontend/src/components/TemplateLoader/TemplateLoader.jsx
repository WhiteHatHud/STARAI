import { useState, useEffect } from "react";
import { Alert } from "antd";
import { loadTemplate } from "../../presentation_templates/templateRegistry";
import "./TemplateLoader.css";

/**
 * TemplateLoader - Simplified component for loading templates using dynamic imports
 *
 * This replaces the complex DynamicTemplateRenderer that used runtime Babel compilation.
 * Now we use Webpack's dynamic imports which are:
 * - Faster (pre-compiled at build time)
 * - Simpler (no runtime compilation)
 * - Smaller bundle (no Babel needed)
 * - Better error handling (React error boundaries)
 */
const TemplateLoader = ({ layoutId, data, scale, showError = true }) => {
  const [state, setState] = useState({
    loading: true,
    error: null,
    Component: null,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setState({ loading: true, error: null, Component: null });

        // Load the template using dynamic import
        const { component } = await loadTemplate(layoutId);

        if (mounted) {
          setState({ loading: false, error: null, Component: component });
        }
      } catch (error) {
        console.error(`Template load error for ${layoutId}:`, error);
        if (mounted) {
          setState({
            loading: false,
            error: error.message,
            Component: null,
          });
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [layoutId]);

  // Error state
  if (state.error) {
    if (!showError) {
      return (
        <div className="template-loader-error-simple">
          <span>Failed to load template</span>
        </div>
      );
    }

    return (
      <Alert
        type="error"
        message="Template Load Error"
        description={state.error}
        showIcon
        style={{ margin: "20px" }}
      />
    );
  }

  // No component
  if (!state.Component) return null;

  // Render the loaded component
  const Component = state.Component;

  return (
    <div
      className="template-loader-wrapper"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        aspectRatio: "16 / 9",
        width: "1280px",
      }}
    >
      <Component data={data} />
    </div>
  );
};

export default TemplateLoader;
