# app/utils/report_prompt.py

from pathlib import Path
from app.utils.content_generator import ContentGenerator
import logging
import json
import re

logger = logging.getLogger(__name__)

class ReportPromptGenerator(ContentGenerator):
    def __init__(self):
        super().__init__()
        self.attempt_count = 0
        self.max_attempts = 3
        self.header_footer_template = self.prompts.get_report_prompt("header_footer", study_type="custom_template")
        self.header_footer_formatting_template = self.prompts.get_report_prompt("header_footer_formatting", study_type="custom_template")
        self.prompt_template = self.prompts.get_report_prompt("template", study_type="custom_template")
        self.formatting_template = self.prompts.get_report_prompt("formatting", study_type="custom_template")
        self.metadata_template = self.prompts.get_report_prompt("metadata", study_type="custom_template")
        self.section_template = self.prompts.get_report_prompt("section", study_type="custom_template")
        self.supporting_document_template = self.prompts.get_report_prompt("supporting_documents", study_type="custom_template")

    async def call(self, markdown:str, supporting_markdown:list[str]) -> str:
        logger.info(f"Starting case study prompt generation. Input length: {len(markdown)} chars")
        
        try:  
            # Extract header/footer
            prompt = self.header_footer_template.format(sample=markdown)
            logger.info("Calling LLM for header/footer extraction")
            header_footer, _ = await self._call_sagemaker_llm(prompt)
            logger.info(f"LLM response received for header/footer extraction. Length: {len(header_footer)} chars")

            # Validate and fix JSON
            logger.info("Starting JSON validation and fixing process")
            header_footer = await self.validate_and_fix_header_footer(self.extract_json_content(header_footer))
            logger.info("JSON validation and fixing completed successfully")
            
            # Generate initial template
            prompt = self.prompt_template.format(sample=markdown)
            logger.info("Calling LLM for initial template generation")
            result_text, _ = await self._call_sagemaker_llm(prompt)
            logger.info(f"LLM response received. Length: {len(result_text)} chars")

            # Extract JSON content
            logger.info("Extracting JSON content from LLM response")
            result_text = self.extract_json_content(result_text)
            logger.info(f"JSON extraction completed. Content length: {len(result_text)} chars")

            # Validate and fix JSON
            logger.info("Starting JSON validation and fixing process")
            result_text = await self.validate_and_fix_json(result_text)
            logger.info("JSON validation and fixing completed successfully")

            # Provide additional supporting documents
            result = json.loads(result_text)
            sections = result["sections"]
            new_sections = []
            
            for section in sections:
                if len(supporting_markdown) != 0 and section["content_type"] == "content":
                    supporting_documents = await self.determine_supporting_documents(section, supporting_markdown)
                    section["supporting_documents"] = supporting_documents.strip()

                if section["content_type"] in ["content", "structural"]:
                    section["generic_example"] = self._final_format(section["generic_example"], section["element_type"])
                
                new_sections.append(section)

            result["sections"] = new_sections
            result["header"] = header_footer["header"]
            result["footer"] = header_footer["footer"]

            result_text = json.dumps(result, indent=4)
            logger.info(f"Case study prompt generation completed successfully. Final sections: {len(result.get('sections', []))}")
            return result_text
            
        except Exception as e:
            logger.error(f"Case study prompt generation failed: {str(e)}")
            logger.info("Returning fallback template due to error")
            return self._create_fallback_template()
    
    async def validate_and_fix_header_footer(self, json_string):
        logger.info(f"Starting header/footer JSON validation. Content length: {len(json_string)} chars")
        json_object = None
        self.attempt_count = 0
        
        while self.attempt_count < self.max_attempts:
            try:
                json_object = json.loads(json_string)
                logger.info("Header/footer JSON parsing successful")
                
                # Structure validation within the same loop
                logger.info("Validating header/footer structure")
                if "header" not in json_object or "footer" not in json_object:
                    raise ValueError("JSON must contain 'header' and 'footer' keys.")
                
                valid_types = ["text", "page_number"]
                valid_formatting_types = ["bold", "italic", "underline", "strikethrough"]
                
                for key in ["header", "footer"]:
                    if not isinstance(json_object[key], dict):
                        raise ValueError(f"'{key}' must be a dictionary.")
                    
                    # Validate required fields
                    required_fields = ["type", "content", "text_formatting"]
                    for field in required_fields:
                        if field not in json_object[key]:
                            raise ValueError(f"'{key}' must contain '{field}' key.")
                    
                    # Validate type field
                    if json_object[key]["type"] not in valid_types and json_object[key]["type"] != "":
                        raise ValueError(f"'{key}.type' must be one of: {', '.join(valid_types)} or empty string.")
                    
                    # Validate content field (can be string or empty string)
                    if not isinstance(json_object[key]["content"], str):
                        raise ValueError(f"'{key}.content' must be a string.")
                    
                    # Validate text_formatting field
                    if not isinstance(json_object[key]["text_formatting"], list):
                        raise ValueError(f"'{key}.text_formatting' must be a list.")
                    
                    # Validate each formatting type
                    for fmt in json_object[key]["text_formatting"]:
                        if fmt not in valid_formatting_types:
                            raise ValueError(f"Invalid text_formatting '{fmt}' in '{key}'. Must be one of: {', '.join(valid_formatting_types)}.")
                
                logger.info("Header/footer structure validation successful")
                self.attempt_count = 0
                return json_object
                
            except Exception as e:
                logger.warning(f"Header/footer validation failed (attempt {self.attempt_count + 1}/{self.max_attempts}): {str(e)}")
                json_string = await self.fix_json(str(e), json_string, header_footer=True)
                self.attempt_count += 1
                
                if self.attempt_count >= self.max_attempts:
                    logger.error("Max attempts reached for header/footer validation, returning fallback")
                    return self._create_fallback_header_footer()

        return json_object

    def _create_fallback_header_footer(self) -> dict:
        """Create fallback header/footer structure when validation fails"""
        logger.info("Creating fallback header/footer structure")
        
        return {
            "header": {
                "type": "",
                "content": "",
                "text_formatting": []
            },
            "footer": {
                "type": "",
                "content": "",
                "text_formatting": []
            }
        }
    
    def extract_json_content(self, text: str) -> str:
        first_brace = text.find('{')
        if first_brace == -1:
            return text
        
        last_brace = text.rfind('}')
        if last_brace == -1 or last_brace <= first_brace:
            return text
        
        return text[first_brace:last_brace + 1]

    async def determine_supporting_documents(self, section, supporting_markdown):
        supporting_documents = ""
        
        for doc in supporting_markdown:
            supporting_documents += f"{doc['filename']}\n\n"
            supporting_documents += f"{doc['content']}\n\n"

        prompt = self.supporting_document_template.format(
            section=json.dumps(section, indent=2),
            supporting_documents=supporting_documents
        )
        logger.info(f"Determining supporting documents for section: {section['title']}")
        response, _ = await self._call_sagemaker_llm(prompt)
        return response

    async def validate_and_fix_json(self, json_string):
        logger.info(f"Starting JSON validation. Content length: {len(json_string)} chars")
        json_object = None
        
        while self.attempt_count < self.max_attempts:
            try:
                json_object = json.loads(json_string)
                logger.info("JSON parsing successful")
                self.attempt_count = 0
                break
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parsing failed (attempt {self.attempt_count + 1}/{self.max_attempts}): {str(e)}")
                json_string = await self.fix_json(str(e), json_string)
                self.attempt_count += 1
                
                if self.attempt_count >= self.max_attempts:
                    logger.error("Max attempts reached for JSON parsing, returning fallback")
                    return self._create_fallback_template()

        # Validate and fix metadata
        try:
            logger.info("Validating report metadata")
            if "report_metadata" not in json_object:
                logger.warning("Missing report_metadata, adding default")
                json_object["report_metadata"] = {}
            
            json_object["report_metadata"] = await self.validate_and_fix_metadata(json_object["report_metadata"])
            logger.info("Report metadata validation completed")
        except Exception as e:
            logger.error(f"Failed to validate metadata: {str(e)}")
            json_object["report_metadata"] = self._create_fallback_metadata()

        # Validate and fix sections
        try:
            logger.info("Validating sections")
            if "sections" not in json_object or not isinstance(json_object["sections"], list):
                logger.warning("Missing or invalid sections, adding default")
                json_object["sections"] = []
            
            sections = json_object["sections"]
            validated_sections = []
            
            for i, section in enumerate(sections):
                logger.info(f"Validating section {i + 1}/{len(sections)}: {section.get('title', 'Untitled')}")
                try:
                    validated_section = await self.validate_and_fix_section(section, i)
                    validated_sections.append(validated_section)
                    logger.info(f"Section {i + 1} validation successful")
                except Exception as e:
                    logger.error(f"Section {i + 1} validation failed: {str(e)}, using fallback")
                    validated_sections.append(self._create_fallback_section(i))

            json_object["sections"] = validated_sections
            logger.info(f"All sections validated. Total valid sections: {len(validated_sections)}")
            
        except Exception as e:
            logger.error(f"Failed to validate sections: {str(e)}")
            json_object["sections"] = [self._create_fallback_section(0)]

        result = json.dumps(json_object, indent=2)
        logger.info(f"JSON validation completed. Final content length: {len(result)} chars")
        return result

    async def fix_json(self, error: str, text: str, header_footer: bool = False) -> str:
        logger.info(f"Attempting JSON fix for error: {error}")
        logger.debug(f"JSON content to fix (first 200 chars): {text[:200]}...")
        
        try:
            if header_footer:
                prompt = self.header_footer_formatting_template.format(error=error, sample=text)
            else:
                prompt = self.formatting_template.format(error=error, sample=text)
                
            result_text, _ = await self._call_sagemaker_llm(prompt)
            
            # Extract JSON content from the result
            fixed_json = self.extract_json_content(result_text)
            logger.info(f"JSON fix attempt completed. Result length: {len(fixed_json)} chars")
            
            return fixed_json
        except Exception as e:
            logger.error(f"Failed to fix JSON: {str(e)}")
            return text  # Return original if fix fails

    async def validate_and_fix_metadata(self, metadata: dict) -> dict:
        logger.info(f"Validating metadata: {metadata}")
        self.attempt_count = 0
        
        while self.attempt_count < self.max_attempts:
            try:
                if not metadata or not isinstance(metadata, dict):
                    raise ValueError("Invalid or missing report_metadata in JSON.")
                
                if "report_type" not in metadata or "primary_focus" not in metadata:
                    raise ValueError("report_metadata must contain 'report_type' and 'primary_focus' keys.")
                
                # Validate that values are not empty
                if not metadata.get("report_type", "").strip():
                    raise ValueError("report_type cannot be empty")
                if not metadata.get("primary_focus", "").strip():
                    raise ValueError("primary_focus cannot be empty")
                
                logger.info("Metadata validation successful")
                return metadata
                
            except Exception as e:
                self.attempt_count += 1
                logger.warning(f"Metadata validation failed (attempt {self.attempt_count}/{self.max_attempts}): {str(e)}")
                
                if self.attempt_count >= self.max_attempts:
                    logger.error("Max attempts reached for metadata, using fallback")
                    return self._create_fallback_metadata()
                
                try:
                    prompt = self.metadata_template.format(error=str(e), sample=json.dumps(metadata, indent=2))
                    result_text, _ = await self._call_sagemaker_llm(prompt)
                    
                    # Extract JSON content and parse
                    json_content = self.extract_json_content(result_text)
                    metadata = json.loads(json_content)
                    logger.info(f"Metadata regeneration attempt {self.attempt_count} completed")
                    
                except Exception as regen_error:
                    logger.error(f"Metadata regeneration failed: {str(regen_error)}")
                    return self._create_fallback_metadata()

        return metadata

    async def validate_and_fix_section(self, section: dict, section_index: int) -> dict:
        logger.info(f"Validating section {section_index}: {section.get('title', 'Untitled')}")
        self.attempt_count = 0

        while self.attempt_count < self.max_attempts:
            issues = []
            
            try:
                if not isinstance(section, dict):
                    issues.append("Each section must be a dictionary.")

                required_fields = ["title", "description", "element_type", "generic_example", "content_type", "query_templates", "max_words", "text_formatting"]
                for field in required_fields:
                    if field not in section:
                        issues.append(f"Section must contain '{field}' key.")
                
                # Validate element_type
                valid_element_types = ["title", "text", "table", "list", "horizontal_rule"]
                if "element_type" in section and section["element_type"] not in valid_element_types:
                    issues.append(f"Invalid element_type '{section['element_type']}'. Must be one of: {', '.join(valid_element_types)}.")

                # Validate content_type
                valid_content_types = ["content", "formatting", "structural"]
                if "content_type" in section and section["content_type"] not in valid_content_types:
                    issues.append(f"Invalid content_type '{section['content_type']}'. Must be one of: {', '.join(valid_content_types)}.")

                # Validate query_templates based on content type
                if "query_templates" in section and not isinstance(section["query_templates"], list):
                    issues.append("'query_templates' must be a list.")

                # Auto-fix: For formatting sections, clear query_templates
                if section.get("content_type") == "formatting" and len(section.get("query_templates", [])) > 0:
                    logger.info(f"Auto-fixing: Clearing query_templates for formatting section {section_index}")
                    section["query_templates"] = []

                # For content sections, query_templates should not be empty
                if (section.get("content_type") in ["content", "structural"] and 
                    len(section.get("query_templates", [])) == 0):
                    issues.append("Content/structural sections must have at least one query template.")

                # Validate generic_example
                if section["element_type"] == "text":
                    if not isinstance(section["generic_example"], str):
                        issues.append("'generic_example' must be a string for text/titles.")
                elif section["element_type"] == "list":
                    if not isinstance(section["generic_example"], list):
                        issues.append("'generic_example' must be a list for list sections.")
                    elif not all(isinstance(item, str) for item in section["generic_example"]):
                        issues.append("'generic_example' must be a list of strings for list sections.")
                elif section["element_type"] == "table":
                    if not isinstance(section["generic_example"], list) or not all(isinstance(row, list) for row in section["generic_example"]):
                        issues.append("'generic_example' must be a list of lists for table sections.")
                    else:
                        # Enhanced table cleaning
                        cleaned_table = []
                        for row in section["generic_example"]:
                            cleaned_row = []
                            for cell in row:
                                if isinstance(cell, str):
                                    # Clean the cell content
                                    cleaned_cell = cell.strip()
                                    
                                    # Skip empty cells
                                    if not cleaned_cell:
                                        continue
                                    
                                    # Skip separator rows (lines with only dashes, spaces, underscores, etc.)
                                    if self._is_separator_content(cleaned_cell):
                                        continue
                                    
                                    # Skip cells that are just whitespace or formatting characters
                                    if self._is_formatting_only(cleaned_cell):
                                        continue
                                    
                                    cleaned_row.append(cleaned_cell)
                            
                            # Only add rows that have meaningful content
                            if cleaned_row and not self._is_separator_row(cleaned_row):
                                cleaned_table.append(cleaned_row)
                        
                        if not cleaned_table:
                            issues.append("'generic_example' table cannot be empty after removing separators and empty content.")
                        else:
                            section["generic_example"] = cleaned_table
                            logger.info(f"Auto-cleaned table for section {section_index}: removed separators, empty strings and formatting-only content")
                            
                if not isinstance(section["text_formatting"], list):
                    issues.append("'text_formatting' must be a list of strings.")
                elif not all(isinstance(fmt, str) for fmt in section["text_formatting"]):
                    issues.append("'text_formatting' must be a list of strings.")

                valid_formatting_types = ["bold", "italic", "underline", "strikethrough"]
                for fmt in section["text_formatting"]:
                    if fmt not in valid_formatting_types:
                        issues.append(f"Invalid text_formatting '{fmt}'. Must be one of: {', '.join(valid_formatting_types)}.")

                try:
                    max_words_int = int(section["max_words"])
                    section["max_words"] = max_words_int  # Normalize to int
                    
                    # Auto-fix: Set max_words to 0 for formatting sections
                    if section.get("content_type") == "formatting" and max_words_int != 0:
                        logger.info(f"Auto-fixing: Setting max_words to 0 for formatting section {section_index}")
                        section["max_words"] = 0
                    
                    if section.get("content_type") in ["content", "structural"] and max_words_int <= 0:
                        issues.append("Content/structural sections must have a positive 'max_words' value.")
                        
                except (ValueError, TypeError):
                    issues.append("'max_words' must be a valid integer.")
                
                if len(issues) == 0:
                    logger.info(f"Section {section_index} validation successful")
                    return section
                else:
                    raise ValueError(f"Section validation issues: {'; '.join(issues)}")
                    
            except Exception as e:
                self.attempt_count += 1
                logger.warning(f"Section {section_index} validation failed (attempt {self.attempt_count}/{self.max_attempts}): {str(e)}")

                if self.attempt_count >= self.max_attempts:
                    logger.error(f"Max attempts reached for section {section_index}, using fallback")
                    return self._create_fallback_section(section_index)
                
                try:
                    error_message = str(e) if not issues else "; ".join(issues)
                    prompt = self.section_template.format(error=error_message, sample=json.dumps(section, indent=2))
                    result_text, _ = await self._call_sagemaker_llm(prompt)
                    
                    # Extract JSON content and parse
                    json_content = self.extract_json_content(result_text)
                    section = json.loads(json_content)
                    logger.info(f"Section {section_index} regeneration attempt {self.attempt_count} completed")
                    
                except Exception as regen_error:
                    logger.error(f"Section {section_index} regeneration failed: {str(regen_error)}")
                    return self._create_fallback_section(section_index)

        return section

    def _create_fallback_template(self) -> str:
        """Create a minimal valid template when all else fails"""
        logger.info("Creating fallback template")
        
        fallback = {
            "report_metadata": self._create_fallback_metadata(),
            "sections": [self._create_fallback_section(0)]
        }
        
        return json.dumps(fallback, indent=2)

    def _create_fallback_metadata(self) -> dict:
        """Create fallback metadata"""
        logger.info("Creating fallback metadata")
        
        return {
            "report_type": "Document Analysis Report",
            "primary_focus": "Analysis of provided document content"
        }

    def _create_fallback_section(self, index: int) -> dict:
        """Create a fallback section"""
        logger.info(f"Creating fallback section {index}")
        
        return {
            "title": f"Section {index + 1}",
            "description": f"Content section {index + 1}",
            "element_type": "text",
            "content_type": "content",
            "text_formatting": [],
            "generic_example": "Document content analysis",
            "max_words": 200,
            "query_templates": [f"Generate content for section {index + 1}"]
        }
    
    def _is_separator_content(self, content: str) -> bool:
        """Check if content is just a separator (dashes, underscores, etc.)"""
        if not content or len(content.strip()) == 0:
            return True
        
        # Remove whitespace
        stripped = content.strip()
        
        # Check if it's only separator characters
        separator_chars = set('-_=|+*~^`')
        content_chars = set(stripped)
        
        # If all characters are separators or spaces, it's a separator
        if content_chars.issubset(separator_chars | {' '}):
            return True
        
        # Check for common separator patterns
        separator_patterns = [
            r'^[-_=]{3,}$',  # 3+ dashes, underscores, or equals
            r'^[|\s]*[-_=]+[|\s]*$',  # separators with optional pipes and spaces
            r'^\s*[+\-|=]+\s*$',  # table borders like +---+---+
            r'^\s*[─┌┐└┘├┤┬┴┼│]+\s*$',  # Unicode box drawing characters
        ]
        
        for pattern in separator_patterns:
            if re.match(pattern, stripped):
                return True
        
        return False

    def _is_formatting_only(self, content: str) -> bool:
        """Check if content is only formatting characters (spaces, tabs, etc.)"""
        if not content:
            return True
        
        # Check if it's only whitespace and basic formatting
        formatting_chars = set(' \t\n\r\u00a0')  # space, tab, newline, carriage return, non-breaking space
        
        return set(content).issubset(formatting_chars)

    def _is_separator_row(self, row: list) -> bool:
        """Check if an entire row is just separators"""
        if not row:
            return True
        
        # If all cells in the row are separators, it's a separator row
        for cell in row:
            if not self._is_separator_content(str(cell)):
                return False
        
        return True
    
    def _remove_text_formatting(self, text: str) -> str:
        """Remove all text formatting (bold, italic, underline, strikethrough) from a string"""
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'_(.*?)_', r'\1', text)
        text = re.sub(r'~~(.*?)~~', r'\1', text)
        text = re.sub(r'<u>(.*?)</u>', r'\1', text)
        return text

    def _final_format(self, text, element_type):
        """Apply final formatting rules based on element type"""
        if element_type in ["text", "title"]:
            text = self._remove_text_formatting(text)
            text = re.sub(r'(?<!\n)\n(?!\n)', r'\n\n', text)
            return text
        elif element_type == "table":
            cleaned_table = []
            for row in text:
                cleaned_row = []
                for cell in row:
                    # Remove text formatting first
                    cell = self._remove_text_formatting(cell)
                    
                    # Process lists within table cells
                    cell = self._process_table_cell_lists(cell)
                    
                    cleaned_row.append(cell)
                cleaned_table.append(cleaned_row)
            return cleaned_table           
        elif element_type == "list":
            cleaned_list = []
            for item in text:
                item = self._remove_text_formatting(item)
                cleaned_list.append(item)
            return cleaned_list

    def _process_table_cell_lists(self, cell_content: str) -> str:
        """Process lists within table cells and ensure proper spacing"""
        if not isinstance(cell_content, str):
            return str(cell_content)
        
        bullet_patterns = [
            r'^\s*[-*+•·‣⁃]\s+',  
            r'^\s*\d+\.\s+',  
            r'^\s*[a-zA-Z]\.\s+', 
            r'^\s*[ivxlcdm]+\.\s+',
            r'^\s*\([a-zA-Z0-9]+\)\s+',
            r'^\s*[a-zA-Z0-9]+\)\s+',
        ]
        
        lines = cell_content.split('\n')
        processed_lines = []
        
        for i, line in enumerate(lines):
            is_list_item = False
            
            for pattern in bullet_patterns:
                if re.match(pattern, line, re.IGNORECASE):
                    is_list_item = True
                    break
            
            if is_list_item:
                if i > 0:
                    prev_line = processed_lines[-1] if processed_lines else ""
                    needs_spacing = True
                    
                    if not prev_line.strip():
                        needs_spacing = False
                    
                    prev_is_list = False
                    for pattern in bullet_patterns:
                        if re.match(pattern, prev_line.strip(), re.IGNORECASE):
                            prev_is_list = True
                            break
                    
                    if prev_is_list:
                        needs_spacing = False
                    
                    if needs_spacing and processed_lines:
                        processed_lines.append("")
            
            processed_lines.append(line)
        
        result = '\n'.join(processed_lines)
        result = re.sub(r'\n{3,}', '\n\n', result)
        return result