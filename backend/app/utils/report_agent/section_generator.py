import asyncio
import numpy as np
import re
from zoneinfo import ZoneInfo
import logging

from app.models.report_models import StudyType, ExplanationModel, ReportSection
from app.utils.content_generator import ContentGenerator


SINGAPORE_TZ = ZoneInfo('Asia/Singapore')

logger = logging.getLogger(__name__)

class SectionGenerator(ContentGenerator):
    def __init__(self, study_type, report_structure):
        super().__init__()
        self.study_type = study_type
        self.report_structure = report_structure

        self.report_section_prompt = self.prompts.get_report_prompt("section", study_type=self.study_type)
        self.report_review_prompt = self.prompts.get_report_prompt("review", study_type=self.study_type)
        self.report_revision_prompt = self.prompts.get_report_prompt("revision", study_type=self.study_type)
        self.report_gap_prompt = self.prompts.get_report_prompt("gap_analysis", study_type=self.study_type)
        self.report_enhancement_prompt = self.prompts.get_report_prompt("enhancement", study_type=self.study_type)
        self.report_parallel_review_prompt = self.prompts.get_report_prompt("parallel_review", study_type=self.study_type)
        self.query_generation_prompt = self.prompts.get_regenerate_prompt()

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
        
        # Add study type to the prompt for type-specific content
        study_type_hint = f"This is a {self.study_type.value.capitalize()} style case study."
        
        # Generate this section using our custom prompt
        prompt = self.report_section_prompt.format(
            section_title=section_config["title"],
            section_description=section_config["description"],
            max_words=section_config["max_words"],
            context=section_data["context"],
            previous_sections_text=previous_sections_text,
            study_type=study_type_hint
        )
        
        # Call LLM with slightly higher temperature for case study sections to get more engaging narrative
        result_text, processing_steps = await self._call_sagemaker_llm(prompt, processing_steps=section_data["processing_steps"])
        
        # Calculate average confidence and retrieval quality for explanation
        avg_retrieval_score = np.mean(section_data["retrieval_scores"]) if section_data["retrieval_scores"] else 0
        
        # Create explanation model for this section
        explanation = ExplanationModel(
            evidence=[],  # Will be populated during enhancement
            reasoning=f"Generated based on {len(section_data['sources'])} relevant passages from source documents.",
            confidence=4.0,  # Default confidence
            retrieval_quality=avg_retrieval_score,
            system_confidence=self.calculate_system_confidence(4.0, section_data["retrieval_scores"]),
            sources=section_data["sources"],
            processing_steps=processing_steps
        )
        
        # Create ReportSection with appropriate fields based on study type
        section_data = {
            "section_id": section_config["section"],
            "title": section_config["title"],
            "content": result_text.strip(),
            "explanation": explanation,
            "enhanced": False
        }
        
        # Add type-specific fields
        if self.study_type == StudyType.STYLE_B:
            if section_config["section"] == "learning_objectives" or section_config["section"] == "discussion_questions":
                # Try to extract list items for these sections
                section_data["learning_objectives"] = self._extract_list_items(result_text)
            else:
                section_data["learning_objectives"] = []
                
            if section_config["section"] == "discussion_questions":
                section_data["discussion_questions"] = self._extract_list_items(result_text)
            else:
                section_data["discussion_questions"] = []
                
        elif self.study_type == StudyType.STYLE_C:
            if section_config["section"] == "interactive_elements":
                section_data["interactive_elements"] = self._extract_interactive_elements(result_text)
            else:
                section_data["interactive_elements"] = {}
                
            if section_config["section"] == "assessment_components":
                section_data["assessment_content"] = self._extract_assessment_content(result_text)
            else:
                section_data["assessment_content"] = {}
        
        # Create section object
        section = ReportSection(**section_data)
        
        return section
    
    async def enhance_section(self, section_config, case_id, document_ids=None, previous_sections=None):
        """Generate a section with progressive enhancement for information gaps"""
        # Initial generation
        section = await self.create_section(
            section_config, case_id, document_ids, previous_sections
        )
        
        # Identify gaps with reduced scope
        gaps = []
        try:
            gaps = await self._identify_information_gaps(section_config, section.content)

            # Ensure we have a list of gaps
            if gaps is None:
                gaps = []
            elif isinstance(gaps, dict):
                gaps = [gaps]
            elif not isinstance(gaps, list):
                logger.warning(f"Expected list or dict but got {type(gaps)}: {gaps}")
                try:
                    gaps = list(gaps) if gaps is not None else []
                except Exception:
                    logger.error("Could not convert gaps to list, defaulting to empty list")
                    gaps = []
            
            # Validate and limit gaps for faster processing
            valid_gaps = []
            for gap in gaps:
                if isinstance(gap, dict) and "gap" in gap and "query" in gap:
                    valid_gaps.append(gap)
                else:
                    logger.warning(f"Skipping invalid gap: {gap}")
            
            gaps = valid_gaps[:3]
        except Exception as e:
            logger.error(f"Error processing gaps: {str(e)}")
            gaps = []

        if gaps:
            # Parallel gap filling
            section = await self._enhance_section_with_gaps(section_config, section, gaps, case_id, document_ids)
        
        return section

    async def _enhance_section_with_gaps(self, section_config, section, gaps, case_id, document_ids):
        """Parallel gap enhancement for faster processing"""
        try:
            # Record gap identification
            if section.explanation and section.explanation.processing_steps:
                gap_descriptions = [gap.get("gap", "Unknown gap") for gap in gaps]
                section.explanation.processing_steps = self._record_processing_step(
                    section.explanation.processing_steps, 
                    "gap_identification",
                    found_gaps=len(gaps),
                    gaps=gap_descriptions
                )
            
            # Parallel retrieval for all gaps
            async def retrieve_gap_context(gap):
                gap_query = gap.get("query", "")
                if not gap_query:
                    return {"context": "", "sources": [], "steps": []}
                
                gap_context, gap_sources, _, gap_steps = await self._get_context(
                    gap_query, k=3, case_id=case_id, document_ids=document_ids
                )
                return {
                    "context": gap_context,
                    "sources": gap_sources,
                    "steps": gap_steps,
                    "gap": gap.get("gap", "")
                }
            
            # Retrieve context for all gaps in parallel
            gap_tasks = [retrieve_gap_context(gap) for gap in gaps]
            gap_results = await asyncio.gather(*gap_tasks, return_exceptions=True)
            
            # Combine all additional context
            additional_context = ""
            evidence_quotes = []
            all_gap_steps = []
            
            for result in gap_results:
                if isinstance(result, Exception):
                    logger.warning(f"Error retrieving gap context: {result}")
                    continue
                    
                if result["context"]:
                    additional_context += f"\nAdditional information for '{result['gap']}':\n{result['context']}\n"
                    
                    # Extract evidence quotes
                    for source in result["sources"]:
                        text = source.get("text", "")
                        if text:
                            sentences = text.split(".")
                            if sentences:
                                evidence = sentences[0].strip() + "."
                                if evidence not in evidence_quotes and len(evidence) > 20:
                                    evidence_quotes.append(evidence)
                    
                    all_gap_steps.extend(result["steps"])
            
            # Enhance section if we have additional context
            if additional_context.strip() and self.report_enhancement_prompt:
                enhancement_prompt = self.report_enhancement_prompt.format(
                    section_content=section.content,
                    max_words=section_config["max_words"],
                    additional_context=additional_context.strip()
                )
                
                enhanced_content, enhancement_steps = await self._call_sagemaker_llm(enhancement_prompt)
                
                # Update section
                section.content = enhanced_content.strip()
                section.enhanced = True
                
                # Update explanation
                if section.explanation:
                    section.explanation.evidence = evidence_quotes[:5]  # Limit to top 5
                    section.explanation.confidence = 4.5  # Enhanced confidence
                    section.explanation.processing_steps.extend(all_gap_steps)
                    section.explanation.processing_steps.extend(enhancement_steps)
                    section.explanation.processing_steps = self._record_processing_step(
                        section.explanation.processing_steps,
                        "parallel_gap_enhancement_complete",
                        gaps_filled=len([r for r in gap_results if not isinstance(r, Exception) and r["context"]]),
                        evidence_added=len(evidence_quotes)
                    )
            
            return section
            
        except Exception as e:
            logger.error(f"Error enhancing section with gaps: {e}")
            return section
    
    async def _retrieve_section_data(self, section, case_id, document_ids=None, additional_queries=None):
        """
        Retrieve relevant data for a specific case study section using multiple targeted queries
        Includes feedback-generated queries if additional_queries are provided
        """
        all_results = []
        retrieval_scores = []
        processing_steps = []

        # Combine original queries with additional feedback-generated queries if provided
        all_queries = section["query_templates"].copy()
        if additional_queries:
            all_queries.extend(additional_queries)

        processing_steps = self._record_processing_step(
            processing_steps, 
            "section_retrieval_start",
            section=section["title"],
            original_query_count=len(section["query_templates"]),
            additional_query_count=len(additional_queries) if additional_queries else 0,
            total_query_count=len(all_queries)
        )
        
        # Use multiple queries to get more comprehensive results
        for i, query_template in enumerate(all_queries):
            is_feedback_query = i >= len(section["query_templates"])
            
            # Get context for this query
            sub_context, sub_sources, sub_scores, sub_steps = await self._get_context(
                query_template,
                k=5,  # More chunks per query for case study sections
                case_id=case_id,
                document_ids=document_ids
            )
            
            # Add scores to overall tracking
            retrieval_scores.extend(sub_scores)
            
            # Add processing steps with query type information
            for step in sub_steps:
                if "query_type" not in step:
                    step["query_type"] = "feedback_generated" if is_feedback_query else "original"
            processing_steps.extend(sub_steps)
            
            # Add sources with deduplication
            for source in sub_sources:
                is_duplicate = False
                for existing in all_results:
                    if source["text"] == existing["text"]:
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    # Mark source with query type
                    source["query_type"] = "feedback_generated" if is_feedback_query else "original"
                    all_results.append(source)
        
        # Sort by relevance score
        all_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        # Adaptive limit: more results if we have additional queries
        max_results = 20 if additional_queries else 15
        top_results = all_results[:max_results]
        
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
                "score": float(result.get("score", 0)),
                "query_type": result.get("query_type", "original")
            })
        
        context_text = "\n\n".join(formatted_context)
        
        processing_steps = self._record_processing_step(
            processing_steps, 
            "section_retrieval_complete",
            section=section["title"],
            context_length=len(context_text),
            source_count=len(source_info),
            feedback_chunks=len([s for s in source_info if s.get("query_type") == "feedback_generated"])
        )
        
        return {
            "context": context_text,
            "sources": source_info,
            "retrieval_scores": retrieval_scores,
            "processing_steps": processing_steps
        }
    
    def _extract_list_items(self, text):
        """Extract numbered or bulleted list items from text"""
        # Look for numbered items like "1. Item" or "1) Item"
        numbered_pattern = r"(?:^|\n)[\s]*(?:\d+[\.\)]|\*|\-|\•)[\s]+(.+?)(?=(?:\n[\s]*(?:\d+[\.\)]|\*|\-|\•)[\s]+)|$)"
        items = re.findall(numbered_pattern, text, re.DOTALL)
        
        # Clean up items
        cleaned_items = [item.strip() for item in items if item.strip()]
        
        # If we didn't find items with the regex, try a simpler approach
        if not cleaned_items and "\n" in text:
            lines = [line.strip() for line in text.split('\n')]
            # Filter to lines that look like list items (start with number or bullet)
            cleaned_items = [
                line.lstrip("0123456789.) -•*").strip() 
                for line in lines 
                if line and (line[0].isdigit() or line[0] in ['-', '•', '*'])
            ]
        
        return cleaned_items
    
    def _extract_assessment_content(self, text):
        """Extract assessment content from text (simplified)"""
        # For now, we'll just create a structured representation
        # In a real implementation, this would parse the text more intelligently
        assessment = {}
        
        # Look for sections that might describe assessment elements
        quiz_pattern = r"(?:^|\n).*quiz.*:?(.*?)(?=(?:\n\n)|$)"
        assignment_pattern = r"(?:^|\n).*assignment.*:?(.*?)(?=(?:\n\n)|$)"
        rubric_pattern = r"(?:^|\n).*rubric.*:?(.*?)(?=(?:\n\n)|$)"
        
        # Extract potential sections
        quizzes = re.findall(quiz_pattern, text, re.IGNORECASE | re.DOTALL)
        assignments = re.findall(assignment_pattern, text, re.IGNORECASE | re.DOTALL)
        rubrics = re.findall(rubric_pattern, text, re.IGNORECASE | re.DOTALL)
        
        # Add to assessment dictionary
        if quizzes:
            assessment["quizzes"] = [quiz.strip() for quiz in quizzes if quiz.strip()]
        if assignments:
            assessment["assignments"] = [assign.strip() for assign in assignments if assign.strip()]
        if rubrics:
            assessment["rubrics"] = [rubric.strip() for rubric in rubrics if rubric.strip()]
        
        return assessment
    
    def _extract_interactive_elements(self, text):
        """Extract interactive elements from text (simplified)"""
        # For now, we'll just create a structured representation
        # In a real implementation, this would parse the text more intelligently
        elements = {}
        
        # Look for sections that might describe interactive elements
        simulation_pattern = r"(?:^|\n).*simulation.*:?(.*?)(?=(?:\n\n)|$)"
        activity_pattern = r"(?:^|\n).*activity.*:?(.*?)(?=(?:\n\n)|$)"
        quiz_pattern = r"(?:^|\n).*quiz.*:?(.*?)(?=(?:\n\n)|$)"
        
        # Extract potential sections
        simulations = re.findall(simulation_pattern, text, re.IGNORECASE | re.DOTALL)
        activities = re.findall(activity_pattern, text, re.IGNORECASE | re.DOTALL)
        quizzes = re.findall(quiz_pattern, text, re.IGNORECASE | re.DOTALL)
        
        # Add to elements dictionary
        if simulations:
            elements["simulations"] = [sim.strip() for sim in simulations if sim.strip()]
        if activities:
            elements["activities"] = [act.strip() for act in activities if act.strip()]
        if quizzes:
            elements["quizzes"] = [quiz.strip() for quiz in quizzes if quiz.strip()]
        
        return elements
    
    async def _identify_information_gaps(self, section, generated_content):
        """
        Identify missing information in a generated section
        """
        # Handle case studies that do not require gap analysis
        if self.report_gap_prompt is None:
            return

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
    
    async def generate_feedback_queries(self, section_config, feedback_items):
        """
        Generate new search queries based on user feedback about specific highlighted text
        """
        # Format feedback items into text
        feedback_text = ""
        for item in feedback_items:
            feedback_text += f"Highlighted Text: {item.highlighted_text}\nFeedback: {item.feedback}\n\n"

        query_generation_prompt = self.query_generation_prompt.format(
        section_title=section_config.get('title', section_config.get('section', 'Unknown')),
        section_description=section_config.get('description', 'Generate content for this section'),
        feedback_text=feedback_text
        )

        # Get new queries from LLM
        try:
            new_queries_result, _ = await self._call_sagemaker_llm(query_generation_prompt)
            
            # Parse queries into a list
            query_list = [q.strip() for q in new_queries_result.split('\n') if q.strip()]
            
            logger.info(f"Generated {len(query_list)} feedback queries for section {section_config.get('title', 'Unknown')}")
            return query_list
            
        except Exception as e:
            logger.warning(f"Failed to generate new queries: {e}")
            return []
    
    async def regenerate_section_with_feedback(self, section_config, case_id, document_ids, previous_sections, additional_queries=None):
        """
        Regenerate a section with enhanced retrieval based on user feedback
        """
        logger.info(f"Regenerating section {section_config['title']} with feedback-enhanced retrieval")
        
        # Step 1: Enhanced retrieval with additional queries
        section_data = await self._retrieve_section_data(
            section_config, case_id, document_ids, additional_queries
        )
        
        # Format previous sections text if available
        previous_sections_text = ""
        if previous_sections:
            previous_sections_text = "Previously generated sections:\n\n"
            for prev in previous_sections:
                previous_sections_text += f"## {prev['title']}\n{prev['content']}\n\n"
        
        # Add study type to the prompt for type-specific content
        study_type_hint = f"This is a {self.study_type.value.capitalize()} style case study."
        
        # Generate this section using our custom prompt with feedback context
        prompt = self.report_section_prompt.format(
            section_title=section_config["title"],
            section_description=section_config["description"],
            max_words=section_config["max_words"],
            context=section_data["context"],
            previous_sections_text=previous_sections_text,
            study_type=study_type_hint
        )
        
        # Call SageMaker LLM
        raw_result, processing_steps = await self._call_sagemaker_llm(prompt)
        
        # Use the raw text result directly
        cleaned_result = raw_result.strip()
        
        # Create section object
        section = ReportSection(
            section_id=section_config["section"],
            title=section_config["title"], 
            content=cleaned_result,
            metadata={
                "processing_steps": processing_steps,
                "regenerated_with_feedback": True,
                "additional_queries_used": additional_queries or []
            }
        )
        
        logger.info(f"Successfully regenerated section {section_config['title']} with feedback")
        return section
    