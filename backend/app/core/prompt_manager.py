# # app/utils/prompt_manager.py
import yaml
import re
from pathlib import Path
from langchain_core.prompts import PromptTemplate

class PromptManager:
    def __init__(self):
        self.base_config = {
            "validate_template": True
        }
        self.prompts = self._load_all_prompts()

    def _load_all_prompts(self):
        return {
            "report": self._load_all_report_prompts()
        }
    
    def _load_all_report_prompts(self):
        path = Path(__file__).resolve().parent.parent / "templates" / "report_prompts"
        all_prompts = {}

        for yaml_file in path.glob("*.yaml"):
            style_prefix = yaml_file.stem.replace("_prompts", "").lower()
            print(f"Loading prompts from: {yaml_file}")
            if style_prefix not in all_prompts:
                all_prompts[style_prefix] = {}

            with open(yaml_file, "r") as f:
                templates = yaml.safe_load(f)

            if templates is None:
                print(f"WARNING: File {yaml_file.name} is empty or invalid.")
                continue

            for name, config in templates.items():
                print(f"Processing template: {name}")
                try:
                    # Extract input variables used in the template text
                    template_text = config["template"]
                    found_vars = set(re.findall(r'\{([^}]+)\}', template_text))
                    declared_vars = set(config["input_variables"])
                    
                    # Check for mismatches
                    missing_vars = found_vars - declared_vars
                    unused_vars = declared_vars - found_vars
                    
                    if missing_vars:
                        print(f"WARNING: Template '{name}' uses variables not in input_variables: {missing_vars}")
                    if unused_vars:
                        print(f"INFO: Template '{name}' has unused input_variables: {unused_vars}")
                        
                    all_prompts[style_prefix][name] = PromptTemplate(
                        template=config["template"],
                        input_variables=config["input_variables"],
                        **self.base_config
                    )
                    print(f"Successfully created template: {style_prefix}/{name}")
                except Exception as e:
                    print(f"ERROR creating template '{style_prefix}/{name}': {e}")
                    raise

        return all_prompts
    
    def get_regenerate_prompt(self):
        return self.prompts['report']['query_generation']['query_generation']

    def get_report_prompt(self, name, fallback=None, study_type=None):
        """
        Get a case study prompt template with support for different study types.
        
        Args:
            name: The base name of the prompt (e.g., "section", "review")
            fallback: A fallback prompt to use if not found
            study_type: Optional study type (style_a, style_b, style_c, style_sof)
            
        Returns:
            PromptTemplate for the requested prompt
        """
        if study_type and study_type in self.prompts["report"]:
            study_prompts = self.prompts["report"][study_type]
            if name in study_prompts:
                return study_prompts[name]

        if name in self.prompts["report"]:
            return self.prompts["report"][name]

        if fallback is not None:
            return fallback

        print(f"INFO: Optional prompt '{name}' not found for study_type '{study_type}'")
        return None

    def format_report_prompt(self, name, study_type=None, **kwargs):
        """
        Format a case study prompt with provided variables and study type.
        
        Args:
            name: The prompt name
            study_type: Optional study type (style_a, style_b, style_c, style_sof)
            **kwargs: Variables to use in formatting
            
        Returns:
            Formatted prompt string
        """
        prompt_template = self.get_report_prompt(name, study_type=study_type)
        return prompt_template.format(**kwargs)