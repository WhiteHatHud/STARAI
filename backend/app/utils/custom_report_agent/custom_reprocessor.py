from app.models.report_models import StudyType
from app.utils.content_generator import ContentGenerator
import json
import logging

class CustomReprocessor(ContentGenerator):
    def __init__(self, remarks, section, report_data):
        super().__init__()
        json_section = json.loads(section) if isinstance(section, str) else section
        
        if 'textdata' in json_section and json_section['textdata']:
            self.type = "text"
        elif 'listdata' in json_section and json_section['listdata']:
            self.type = "list"
        elif 'tabledata' in json_section and json_section['tabledata']:
            self.type = "table"
        else:
            # Default fallback
            self.type = "text"
        
        report_string = ""
        json_report = json.loads(report_data) if isinstance(report_data, str) else report_data
        json_report = json_report["sections"]
        for sec in json_report:
            sec = sec.get("content", {})
            sec = json.dumps(sec, indent=2)
            report_string += sec + "\n"
        
        self.prompt = self.prompts.get_report_prompt("reprocess", study_type=StudyType.STYLE_CUSTOM).format(remarks=remarks, section=json.dumps(section), report=report_string)

    async def reprocess_section(self):
        result_text, _ = await self._call_sagemaker_llm(self.prompt)
        validated_content = await self._validate_format(result_text, format_type=self.type)
        validated_content = json.dumps(validated_content)
        return validated_content

    async def _validate_format(self, content, format_type=None):
        """
        Format the section content based on the specified format type
        """
        if not format_type:
            if "tabledata" in content:
                format_type = "table"
            elif "listdata" in content:
                format_type = "list"
            else:
                format_type = "text"
        
        max_retrys = 3
        retry_count = 0
        current_content = content
        
        while retry_count < max_retrys:
            if format_type == "table":
                validated_content, reformat_prompt = self._validate_table(current_content)
            elif format_type == "list":
                validated_content, reformat_prompt = self._validate_list(current_content)
            else:
                validated_content, reformat_prompt = self._validate_text(current_content)
            
            if validated_content:
                return validated_content
            else:
                retry_count += 1
                if retry_count < max_retrys:
                    # Generate new content using the reformat prompt
                    reformatted_content, _ = await self._call_sagemaker_llm(reformat_prompt.format(content=current_content))
                    current_content = reformatted_content
                else:
                    # All retries exhausted, return the latest result stripped
                    return current_content.strip()

    def _validate_text(self, content):
        try:
            data = json.loads(content)
            if isinstance(data, dict) and "textdata" in data and isinstance(data["textdata"], str):
                return content, None
            else:
                raise ValueError("Invalid text format")
        except Exception as e:
            prompt = """"
            Given the following string "{content}", reformat it to fit the JSON object below.
            Your response must be only the JSON object, with no other text.
            
            Required JSON Format:
            {{
                "textdata": "text response"
            }}
            """
            return None, prompt
    
    def _validate_list(self, content):
        try:
            data = json.loads(content)
            if isinstance(data, dict) and "listdata" in data and isinstance(data["listdata"], list):
                return content, None
            else:
                raise ValueError("Invalid list format")
        except Exception as e:
            prompt = """"
            Given the following string "{content}", reformat it to fit the JSON object below
            Your response must be only the JSON object, with no other text.
            
            Required JSON Format:
            {{
                "listdata": [
                    "point1",
                    "point2",
                    "point3",
                    ...
                ]
            }}
            """
            return None, prompt
            
    def _validate_table(self, content):
        try:
            data = json.loads(content)
            if isinstance(data, dict) and "tabledata" in data and isinstance(data["tabledata"], list):
                return content, None
            else:
                raise ValueError("Invalid table format")
        except Exception as e:
            prompt = """
            Given the following string "{content}", reformat it to fit the JSON object below.
            Your response must be only the JSON object, with no other text.
            
            Required JSON Format:
            {{
                "tabledata": [
                    [cell(1, 1), cell(1, 2), ...],
                    [cell(2, 1), cell(2, 2), ...],
                    ...
                ]
            }}
            """
            return None, prompt