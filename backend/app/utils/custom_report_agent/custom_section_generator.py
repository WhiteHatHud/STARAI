import numpy as np
import re
from zoneinfo import ZoneInfo
import logging
import json

from app.models.report_models import StudyType, ExplanationModel, ReportSection
from app.utils.content_generator import ContentGenerator


SINGAPORE_TZ = ZoneInfo('Asia/Singapore')

logger = logging.getLogger(__name__)

class CustomSectionGenerator(ContentGenerator):
    def __init__(self, study_type, report_structure):
        super().__init__()
        self.study_type = study_type
        self.report_metadata = report_structure["report_metadata"]
        self.report_structure = report_structure["sections"]

        self.report_content_section_prompt = self.prompts.get_report_prompt("content_section", study_type=self.study_type)
        self.report_structural_section_prompt = self.prompts.get_report_prompt("structural_section", study_type=self.study_type)
        self.report_formatting_section_prompt = self.prompts.get_report_prompt("formatting_section", study_type=self.study_type)
        self.report_review_prompt = self.prompts.get_report_prompt("review", study_type=self.study_type)
        self.report_revision_prompt = self.prompts.get_report_prompt("revision", study_type=self.study_type)
        self.report_gap_prompt = self.prompts.get_report_prompt("gap_analysis", study_type=self.study_type)
        self.report_enhancement_prompt = self.prompts.get_report_prompt("enhancement", study_type=self.study_type)

    async def create_section(self, section_config, case_id, document_ids, previous_sections):
        """
        Generate a single section of a case study with comprehensive context
        """
        # Retrieve relevant data for this section
        section_data = await self._retrieve_section_data(section_config, case_id, document_ids)
        # Format previous sections text if available
        previous_sections_text = ""
        if previous_sections:
            previous_sections_text = "Previously generated sections:\n\n"
            for prev in previous_sections:
                previous_sections_text += f"## {prev['title']}\n{prev['content']}\n\n"

        report_type = self.report_metadata["report_type"]
        study_type_hint = f"This is a {report_type} style case study."

        formatting_instructions = self._get_custom_formatting_instructions(format_type=section_config["element_type"])
        
        if section_config.get("content_type") == "content":
            supporting_documents = section_config.get("supporting_documents", "")

            prompt = self.report_content_section_prompt.format(
                previous_sections_text=previous_sections_text,
                max_words=section_config["max_words"],
                context=section_data["context"],
                report_type=report_type,
                section_title=section_config["title"],
                section_description=section_config["description"],
                format=section_config["element_type"],
                formatting_instructions=formatting_instructions,
                supporting_documents=supporting_documents,
                generic_example=section_config["generic_example"],
                study_type=study_type_hint
            )
        elif section_config.get("content_type") == "structural":
            prompt = self.report_structural_section_prompt.format(
                max_words=section_config["max_words"],
                context=section_data["context"],
                report_type=report_type,
                section_title=section_config["title"],
                section_description=section_config["description"],
                format=section_config["element_type"],
                formatting_instructions=formatting_instructions,
                generic_example=section_config["generic_example"],
                study_type=study_type_hint
            )
        elif section_config.get("content_type") == "formatting":
            prompt = self.report_formatting_section_prompt.format(
                report_type=report_type,
                section_title=section_config["title"],
                section_description=section_config["description"],
                format=section_config["element_type"],
                formatting_instructions=formatting_instructions,
                generic_example=section_config["generic_example"],
                study_type=study_type_hint
            )
        
        logger.info(f"Generating section: {section_config['title']} with prompt: {prompt}")
        
        # Call LLM with slightly higher temperature for case study sections
        # to get more engaging narrative
        result_text, processing_steps = await self._call_sagemaker_llm(prompt, processing_steps=section_data["processing_steps"])
        result_text = await self._validate_format(result_text, section_config["element_type"])
        
        section_data = {
            "section_id": str(len(previous_sections)),
            "title": section_config["title"],
            "content": result_text,
            "enhanced": False,
            "content_type": section_config["content_type"],
            "formatting": section_config["text_formatting"]
        }
    
        # Create section object
        section = ReportSection(**section_data)
        
        return section
    
    async def enhance_section(self, section_config, case_id, document_ids=None, previous_sections=None):
        """
        Generate a section with progressive enhancement for information gaps
        """
        # Initial generation
        section = await self.create_section(
            section_config, case_id, document_ids, previous_sections
        )
        
        # Identify gaps
        if section_config.get("content_type") == "content":
            gaps = []
            try:
                gaps = await self._identify_information_gaps(section_config, section.content)

                # Ensure we have a list of gaps
                if gaps is None:
                    gaps = []
                elif isinstance(gaps, dict):
                    # If we got back a single gap as a dict, convert it to a list
                    gaps = [gaps]
                elif not isinstance(gaps, list):
                    logger.warning(f"Expected list or dict but got {type(gaps)}: {gaps}")
                    try:
                        # Try to convert to list
                        gaps = list(gaps) if gaps is not None else []
                    except Exception:
                        logger.error("Could not convert gaps to list, defaulting to empty list")
                        gaps = []
                
                # Now we should have a list, but let's make sure each item is a dict
                valid_gaps = []
                for gap in gaps:
                    if isinstance(gap, dict) and "gap" in gap and "query" in gap:
                        valid_gaps.append(gap)
                    else:
                        logger.warning(f"Skipping invalid gap: {gap}")
                
                gaps = valid_gaps[:3]  # Limit to top 3 valid gaps
            except Exception as e:
                logger.error(f"Error processing gaps: {str(e)}")
                gaps = []

            if gaps:              
                # Perform targeted retrieval for each gap
                additional_context = ""
                evidence_quotes = []
                
                for i, gap in enumerate(gaps):
                    try:
                        gap_query = gap.get("query", "")
                        if not gap_query:
                            logger.warning(f"Missing query in gap: {gap}")
                            continue
                        
                        # Get additional context for this gap
                        gap_context, gap_sources, _, gap_steps = await self._get_context(
                            gap_query, k=3, case_id=case_id, document_ids=document_ids
                        )
                        
                        if gap_context:
                            gap_description = gap.get("gap", f"Gap {i+1}")
                            additional_context += f"\nAdditional information for '{gap_description}':\n{gap_context}\n"
                        
                        # Extract evidence quotes from gap retrieval
                        for source in gap_sources:
                            text = source.get("text", "")
                            # Extract a representative sentence or short paragraph
                            if text:
                                sentences = text.split(".")
                                if sentences:
                                    evidence = sentences[0].strip() + "."
                                    if evidence not in evidence_quotes and len(evidence) > 20:
                                        evidence_quotes.append(evidence)

                    except Exception as e:
                        logger.error(f"Error processing gap {i}: {str(e)}")
                        continue
                
                # Generate enhanced section with gap-filling information
                if additional_context and self.report_enhancement_prompt:
                    try:
                        enhancement_prompt = self.report_enhancement_prompt.format(
                            report_type=self.report_metadata.get("report_type", "Custom Report"),
                            section_content=section.content,
                            additional_context=additional_context
                        )

                        enhanced_content, enhancement_steps = await self._call_sagemaker_llm(enhancement_prompt)
                        result_text = await self._validate_format(result_text, section_config["element_type"])
                        section.content = enhanced_content.strip()
                        section.enhanced = True
                        
                    except Exception as e:
                        logger.error(f"Error enhancing section: {str(e)}")
                        
        return section
    
    async def recreate_section(
        self,
        section_config: dict,
        case_id: str,
        document_ids: list = None,
        previous_sections: list = None,
        feedback: str = "",
        original_content: str = ""
    ):
        """
        Regenerate a section using user feedback to guide the AI.
        Uses 'feedback_query' for retrieval if present, else falls back to 'query_templates'.
        """
        # --- Use feedback_query for retrieval if present ---
        queries = []
        if "feedback_query" in section_config:
            if isinstance(section_config["feedback_query"], list):
                queries = section_config["feedback_query"]
            else:
                queries = [section_config["feedback_query"]]
        else:
            queries = section_config.get("query_templates", [])

        # Retrieve relevant data for this section using the chosen queries
        all_results = []
        retrieval_scores = []
        processing_steps = []

        for query in queries:
            sub_context, sub_sources, sub_scores, sub_steps = await self._get_context(
                query,
                k=5,
                case_id=case_id,
                document_ids=document_ids
            )
            retrieval_scores.extend(sub_scores)
            processing_steps.extend(sub_steps)
            for source in sub_sources:
                if source not in all_results:
                    all_results.append(source)

        # Sort and format context as in _retrieve_section_data
        all_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        top_results = all_results[:15]
        formatted_context = []
        source_info = []
        for i, result in enumerate(top_results):
            source_name = result.get("document_name", "Unknown Document")
            content = result.get("text", "")
            formatted_context.append(f"[Source {i+1}: {source_name}]\n{content}")
            source_info.append({
                "text": content,
                "document_name": source_name,
                "doc_id": str(result.get("doc_id", "")),
                "chunk_index": result.get("chunk_index", 0),
                "score": float(result.get("score", 0))
            })
        context_text = "\n\n".join(formatted_context)

        # Format previous sections text if available
        previous_sections_text = ""
        if previous_sections:
            previous_sections_text = "Previously generated sections:\n\n"
            for prev in previous_sections:
                previous_sections_text += f"## {prev['title']}\n{prev['content']}\n\n"

        study_type_hint = f"This is a {self.study_type.value.capitalize()} style case study."
        original_content_text = f"\n\nOriginal content:\n{original_content}\n" if original_content else ""
        feedback_text = f"\n\nUser feedback for improvement: {feedback}\n"

            # Generate this section using our custom prompt
        report_type = self.report_metadata.get("report_type", "Custom Report")
        study_type_hint = f"This is a {report_type} style case study."
        
        if section_config["element_type"] == "table":
            columns = section_config.get("columns", [])
        else:
            columns = []

        formatting_instructions = self._get_custom_formatting_instructions(format_type=section_config["element_type"], columns=columns)
        prompt = self.report_section_prompt.format(
            report_type=report_type,
            section_title=section_config["title"],
            section_description=section_config["description"],
            format=section_config["element_type"],
            max_words=section_config["max_words"],
            formatting_instructions=formatting_instructions,
            context=context_text,
            previous_sections_text=previous_sections_text,
            study_type=study_type_hint
        ) + original_content_text +  feedback_text


        result_text, llm_processing_steps = await self._call_sagemaker_llm(prompt, processing_steps=processing_steps)
        result_text = await self._validate_format(result_text, section_config["element_type"])
            
        avg_retrieval_score = np.mean(retrieval_scores) if retrieval_scores else 0

        explanation = ExplanationModel(
            evidence=[],
            reasoning=f"Regenerated based on {len(source_info)} relevant passages and user feedback.",
            confidence=4.0,
            retrieval_quality=avg_retrieval_score,
            system_confidence=self.calculate_system_confidence(4.0, retrieval_scores),
            sources=source_info,
            processing_steps=llm_processing_steps
        )

        section_obj = {
            "section_id": section_config["section"],
            "title": section_config["title"],
            "content": result_text.strip(),
            "formatting": section_config["text_formatting"],
            "explanation": explanation,
            "enhanced": True
        }

        # Return as ReportSection
        return ReportSection(**section_obj)
    
    async def _retrieve_section_data(self, section, case_id, document_ids=None):
        """
        Retrieve relevant data for a specific case study section
        using multiple targeted queries
        """
        all_results = []
        retrieval_scores = []
        processing_steps = []
        
        processing_steps = self._record_processing_step(
            processing_steps, 
            "section_retrieval_start",
            section=section["title"],
            query_count=len(section["query_templates"])
        )
        
        # Use multiple queries to get more comprehensive results
        for query_template in section["query_templates"]:
            # Get context for this query
            sub_context, sub_sources, sub_scores, sub_steps = await self._get_context(
                query_template,
                k=5,  # More chunks per query for case study sections
                case_id=case_id,
                document_ids=document_ids
            )
            
            # Add scores to overall tracking
            retrieval_scores.extend(sub_scores)
            
            # Add processing steps
            processing_steps.extend(sub_steps)
            
            # Add sources with deduplication
            for source in sub_sources:
                is_duplicate = False
                for existing in all_results:
                    if source["text"] == existing["text"]:
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    all_results.append(source)
        
        # Sort by relevance score
        all_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        # Limit to top results (avoid context too long)
        top_results = all_results[:15]
        
        # Format context for the LLM
        formatted_context = []
        source_info = []
        
        for i, result in enumerate(top_results):
            source_name = result.get("document_name", "Unknown Document")
            content = result.get("text", "")
            
            formatted_context.append(f"[Source {i+1}: {source_name}]\n{content}")
            
            source_info.append({
                "text": content,
                "document_name": source_name,
                "doc_id": str(result.get("doc_id", "")),
                "chunk_index": result.get("chunk_index", 0),
                "score": float(result.get("score", 0))
            })
        
        context_text = "\n\n".join(formatted_context)
        
        processing_steps = self._record_processing_step(
            processing_steps, 
            "section_retrieval_complete",
            section=section["title"],
            context_length=len(context_text),
            source_count=len(source_info)
        )
        
        return {
            "context": context_text,
            "sources": source_info,
            "retrieval_scores": retrieval_scores,
            "processing_steps": processing_steps
        }
    
    async def _identify_information_gaps(self, section, generated_content):
        """
        Identify missing information in a generated section
        """
        # Handle case studies that do not require gap analysis
        if self.report_gap_prompt is None:
            return

        if self.study_type == StudyType.STYLE_CUSTOM:
            prompt = self.report_gap_prompt.format(
                report_type=self.report_metadata.get("report_type", ""),
                section_title=section["title"],
                section_content=generated_content
            )
        else:
            prompt = self.report_gap_prompt.format(
                section_title=section["title"],
                section_content=generated_content
            )
        
        result, processing_steps = await self._call_sagemaker_llm(prompt)
        
        # Parse JSON from response
        try:
            gaps_data, _ = await self._parse_json_from_llm_response(result, processing_steps)
            return gaps_data or []
        except Exception as e:
            logger.error(f"Error parsing gap analysis response: {str(e)}")
            return []
        
    def _get_custom_formatting_instructions(self, format_type):
        """
        Get custom formatting instructions based on the section format type
        """
        if format_type == "table":
            return """
                Create a table following the structure of the generic_example as closely as possible, return JSON format:
                
                {{
                    "tabledata": [
                        [cell(1, 1), cell(1, 2), ...],
                        [cell(2, 1), cell(2, 2), ...],
                        ...
                    ]
                }}
                """
        elif format_type == "list":
            return """
            Create a list with succinct points, return JSON format:

            {{
                "listdata": [
                    "point1",
                    "point2",
                    "point3",
                    ...
                ]
            }}
            """
        else:
            return """
            Create a plain text response, return JSON format:

            {{
                "textdata": "text response"
            }}
            """

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