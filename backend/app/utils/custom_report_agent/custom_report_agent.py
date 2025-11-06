import json
import logging
import asyncio
import re
from datetime import datetime
from unittest import result
from zoneinfo import ZoneInfo

from app.models.report_models import StudyType, ReportMetrics
from .custom_section_generator import CustomSectionGenerator

SINGAPORE_TZ = ZoneInfo('Asia/Singapore')
logger = logging.getLogger(__name__)

class CustomReportAgent():
    def __init__(self, study_type=StudyType.STYLE_CUSTOM, report_structure=None):
        self.study_type = study_type
        self.report_structure = report_structure["sections"]
        self.report_metadata = report_structure["report_metadata"]

        if hasattr(report_structure, "header"):
            self.header = report_structure["header"]
        else:
            self.header = None
            
        if hasattr(report_structure, "footer"):
            self.footer = report_structure["footer"]
        else:
            self.footer = None

        self.section_generator = CustomSectionGenerator(self.study_type, report_structure)

    async def generate_enhanced_section(self, section_config, case_id, document_ids=None, previous_sections=None):
        return await self.section_generator.enhance_section(
            section_config=section_config,
            case_id=case_id,
            document_ids=document_ids,
            previous_sections=previous_sections
        )
    
    async def generate_complete_report(self, case_id, document_ids=None, title=None, study_type=None, progress_callback=None, report_structure=None):
        """
        Generate a complete case study of the specified type
        """
        print(f"🔧 GENERATE - Starting with case_id: {case_id}")
        print(f"🔧 GENERATE - study_type param: {study_type}")
        print(f"🔧 GENERATE - self.study_type: {self.study_type}")
        with open("report_generation.log", "w") as log_file:
            log_file.write(f"Start\n\n")
            log_file.write(json.dumps(self.report_structure, indent=4))
            log_file.write(json.dumps(self.report_metadata, indent=4))
        
        logger.info(f"Starting {self.study_type.value} case study generation for case ID: {case_id}")
        
        # Progress callback helper
        def update_progress(percent, message):
            print(f"🔧 PROGRESS - {percent}% - {message}")
            if progress_callback:
                progress_callback(percent, message)
        
        start_time = datetime.now(SINGAPORE_TZ)
        print(f"🔧 GENERATE - Starting at {start_time}")
        
        # Initialize metrics
        metrics = ReportMetrics(
            started_at=start_time,
            question_count=len(self.report_structure),
            answered_count=0,
            overall_confidence=0.0,
            low_confidence_count=0,
            evidence_count=0
        )
        print(f"🔧 GENERATE - Metrics initialized, question_count: {metrics.question_count}")
        
        # Track generated sections
        generated_sections = []
        total_sections = len(self.report_structure)
        
        update_progress(35, f"Starting generation of {total_sections} sections...")
        
        try:
            # Progress through each section systematically
            for i, section_config in enumerate(self.report_structure):
                logger.info(f"Generating section: {section_config['title']}")
                
                # Calculate progress for this section (35% to 75% of total progress)
                section_progress = 35 + (40 * i / total_sections)
                update_progress(section_progress, f"Generating: {section_config['title']}")
                
                # Generate section with progressive enhancement
                section = await self.section_generator.enhance_section(
                    section_config, 
                    case_id,
                    document_ids, 
                    [{"title": s.title, "content": s.content} for s in generated_sections]
                )

                # Update metrics
                metrics.answered_count += 1
                if section.explanation:
                    metrics.overall_confidence += section.explanation.confidence
                    if section.explanation.confidence < 3.0:
                        metrics.low_confidence_count += 1
                    metrics.evidence_count += len(section.explanation.evidence or [])
                
                # Save this section
                generated_sections.append(section)
                
                # Update progress after completing section
                completed_progress = 35 + (40 * (i + 1) / total_sections)
                update_progress(completed_progress, f"Completed: {section_config['title']}")
                
                # Small delay to allow for natural generation flow
                await asyncio.sleep(0.5)
            
            # Calculate average confidence
            if metrics.answered_count > 0:
                metrics.overall_confidence /= metrics.answered_count
            
            # Review the case study for coherence and consistency
            update_progress(75, "Reviewing case study for coherence...")
            logger.info("Reviewing case study for coherence")
            coherence_review = await self._generate_coherence_review(generated_sections)
            
            # Apply fixes based on review
            update_progress(80, "Applying coherence fixes...")
            coherence_scores = {}
            if coherence_review and coherence_review.get("issues"):
                logger.info(f"Applying {len(coherence_review.get('issues', []))} coherence fixes")
                generated_sections, coherence_scores = await self._apply_coherence_fixes(
                    generated_sections, coherence_review
                )         
  
            # Calculate total generation time
            update_progress(85, "Finalizing case study...")
            end_time = datetime.now(SINGAPORE_TZ)
            logger.info("suspected error is here")

            generation_time = (end_time - start_time).total_seconds()
            logger.info("error is NOT here")
            # Update metrics
            metrics.completed_at = end_time
            metrics.processing_time_seconds = generation_time
            
            # Create type-specific metadata
            update_progress(90, "Creating metadata...")
            metadata = {
                "document_count": len(document_ids) if document_ids else 0,
                "generation_metrics": metrics,
                "coherence_scores": coherence_scores,
                "enhancement_history": []
            }
    
            logger.info("In theory generate_complete ran to completion")
            update_progress(95, "Case study generation complete!")
            
            with open("report_generation.log", "a") as log_file:
                log_file.write(f"Generated sections: {generated_sections}")
            
            return {
                "title": title or f"{self.study_type.value.capitalize()} Study",
                "case_id": case_id,
                "status": "pending_review",
                "study_type": self.study_type,
                "sections": generated_sections,
                "metadata": metadata,
                "header" : self.header,
                "footer" : self.footer,
            }
            
        except Exception as e:
            logger.error(f"Error generating {self.study_type.value} case study: {str(e)}")
            update_progress(0, f"Error: {str(e)}")
            
            # Return partial case study with error information
            error_object = {
                "title": title or f"{self.study_type.value.capitalize()} Study (Error)",
                "case_id": case_id,
                "status": "draft",
                "study_type": self.study_type,
                "sections": generated_sections,  # Return what we've generated so far
                "metadata": {
                    "document_count": len(document_ids) if document_ids else 0,
                    "generation_metrics": metrics,
                    "coherence_scores": {},
                    "enhancement_history": []
                },
                "error": str(e)
            }
            with open("report_generation.log", "a") as log_file:
                log_file.write(f"Error message: {str(e)}\n\n")
            
            return error_object

    async def _generate_coherence_review(self, sections):
        """Review the entire case study for coherence and consistency"""
        full_case = ""
        for section in sections:
            full_case += f"## {section.title}\n{section.content}\n\n"
        
        study_type_info = f"This is a {self.study_type.value.capitalize()} style case study."
        
        prompt = self.section_generator.report_review_prompt.format(
            report_type=self.report_metadata.get("report_type", ""),
            report=full_case,
            study_type=study_type_info
        )
        
        review_text, _ = await self.section_generator._call_sagemaker_llm(prompt)
        logger.info(f"This is the supposed json response for coherence:{review_text}")
        try:
            parse_result = await self.section_generator._parse_json_from_llm_response(review_text)
            if isinstance(parse_result, tuple):
                review_data, error = parse_result
                if error:
                    logger.warning(f"JSON parsing had warnings: {error}")
                if review_data and isinstance(review_data, dict):
                    return review_data
                else:
                    logger.error(f"Invalid review data format: {review_data}")
                    return {"overall_assessment": "Invalid format", "issues": []}
            elif isinstance(parse_result, dict):
                return parse_result
            elif isinstance(parse_result, str):
                try:
                    return json.loads(parse_result)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse string as JSON: {parse_result}")
                    return {"overall_assessment": "JSON parse error", "issues": []}
            else:
                logger.error(f"Unexpected parse result type: {type(parse_result)}")
                return {"overall_assessment": "Unexpected format", "issues": []}
                
        except Exception as e:
            logger.error(f"Exception in coherence review parsing: {e}")
            return {"overall_assessment": "Error parsing review", "issues": []}
        
    async def _apply_coherence_fixes(self, sections, review):
        """Apply suggested fixes from coherence review"""
        if not review or not review.get("issues"):
            return sections
        
        updated_sections = sections.copy()
        coherence_scores = {}
        
        for issue in review.get("issues", []):
            affected_section_names = issue.get("affected_sections", [])
            for i, section in enumerate(updated_sections):
                if section.title in affected_section_names and section.content_type == "content":
                    prompt = self.section_generator.report_revision_prompt.format(
                        report_type=self.report_metadata.get("report_type", ""),
                        section_title=section.title,
                        section_content=section.content,
                        issue_description=issue["description"],
                        suggested_revision=issue["suggested_revision"],
                        study_type=self.study_type.value.capitalize()
                    )
                    
                    # Call LLM with moderate temperature for creative revision
                    revised_content, revision_steps = await self.section_generator._call_sagemaker_llm(prompt)
                    logger.info("If u see this means there is an issue resolved by the LLM")
                    revised_content = await self.section_generator._validate_format(revised_content)
                    updated_sections[i].content = revised_content.strip()
                    
                    # Add to coherence scores
                    section_id = updated_sections[i].section_id
                    coherence_scores[section_id] = coherence_scores.get(section_id, 0) - 0.1
        
        # Add positive coherence scores for sections without issues
        for section in updated_sections:
            if section.section_id not in coherence_scores:
                coherence_scores[section.section_id] = 1.0
        logger.info("apply coherence fix ran to completion")
        return updated_sections, coherence_scores