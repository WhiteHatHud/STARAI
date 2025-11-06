import logging
import asyncio
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from app.models.report_models import StudyType, ReportMetrics
from .structure_loader import get_structure_for_type
from .section_generator import SectionGenerator

SINGAPORE_TZ = ZoneInfo('Asia/Singapore')
logger = logging.getLogger(__name__)

class ReportAgent():
    def __init__(self, study_type=StudyType.STYLE_A):
        self.study_type = study_type
        self.report_structure = get_structure_for_type(study_type)

        # Create a mapping for quick access to section configs
        self.section_config_map = {
            config.get("section"): config 
            for config in self.report_structure
        }
        
        self.section_generator = SectionGenerator(self.study_type, self.report_structure)

    async def generate_enhanced_section(self, section_config, case_id, document_ids=None, previous_sections=None):
        return await self.section_generator.enhance_section(
            section_config=section_config,
            case_id=case_id,
            document_ids=document_ids,
            previous_sections=previous_sections
        )
    
    async def generate_complete_report(self, case_id, document_ids=None, title=None, study_type=None, progress_callback=None):
        """
        Generate a complete case study of the specified type
        """
        print(f"🔧 GENERATE - Starting with case_id: {case_id}")
        print(f"🔧 GENERATE - study_type param: {study_type}")
        print(f"🔧 GENERATE - self.study_type: {self.study_type}")

        # Use provided study_type if given, otherwise use the one set at initialization
        
        if study_type:
            print(f"🔧 GENERATE - Updating study_type from {self.study_type} to {study_type}")
            self.study_type = study_type
            # Update the structure based on the new type
            self.report_structure = get_structure_for_type(study_type)
            print(f"🔧 GENERATE - New structure has {len(self.report_structure)} sections")
            print(f"🔧 GENERATE - Final study_type: {self.study_type}")
            print(f"🔧 GENERATE - Structure sections: {len(self.report_structure)}")
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
        
        update_progress(30, f"Starting generation of {total_sections} sections...")
        
        try:
            update_progress(35, f"Generating {(total_sections)} sections...")
            
            for i, section_config in enumerate(self.report_structure):
                logger.info(f"Generating {section_config['title']}")
                # Calculate progress for dependent sections (35% to 75% of total progress)
                section_progress = 35 + (40 * i / len(self.report_structure)) if self.report_structure else 75
                update_progress(section_progress, f"Generating: {section_config['title']}")
                
                # Generate section with context from all previously generated sections
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
                completed_progress = 35 + (40 * (i + 1) / total_sections) if self.report_structure else 75
                update_progress(completed_progress, f"Completed: {section_config['title']}")
            
            # Calculate average confidence
            if metrics.answered_count > 0:
                metrics.overall_confidence /= metrics.answered_count
            
            update_progress(75, "Reviewing case study for coherence...")
            logger.info("Reviewing case study for coherence")
            
            # Use parallel review for large case studies (more than 4 sections)
            if len(generated_sections) > 4:
                coherence_review = await self._generate_parallel_coherence_review(generated_sections)
            else:
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

            generation_time = (end_time - start_time).total_seconds()
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
            
            # Add type-specific metadata
            if self.study_type == StudyType.STYLE_B:
                # Extract teaching notes if available
                teaching_notes = {}
                for section in generated_sections:
                    if section.section_id == "teaching_notes":
                        teaching_notes["content"] = section.content
                        break

                metadata["teaching_notes"] = teaching_notes
            
            elif self.study_type == StudyType.STYLE_C:
                # Extract multimedia elements if available
                multimedia_elements = []
                for section in generated_sections:
                    if section.section_id == "multimedia_modules":
                        # Extract multimedia elements from content (simplified)
                        elements = self._extract_multimedia_elements(section.content)
                        multimedia_elements.extend(elements)
                        break
                
                metadata["multimedia_elements"] = multimedia_elements
                
                # Extract interactive features if available
                interactive_features = {}
                for section in generated_sections:
                    if section.section_id == "interactive_elements" and hasattr(section, "interactive_elements"):
                        interactive_features = section.interactive_elements
                        break
                
                metadata["interactive_features"] = interactive_features
           
            logger.info("In theory generate_complete ran to completion")
            update_progress(95, "Case study generation complete!")
            
            # Format return structure to match your models
            return {
                "title": title or f"{self.study_type.value.capitalize()} Study",
                "case_id": case_id,
                "status": "published",
                "study_type": self.study_type,
                "sections": generated_sections,
                "metadata": metadata
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
            
            return error_object 
        
    async def _generate_coherence_review(self, sections):
        """Review the entire case study for coherence and consistency"""
        # Handle Reports that do not require reviews
        if self.section_generator.report_review_prompt is None:
            return

        # Format the case study for review
        full_case = ""
        for section in sections:
            full_case += f"## {section.title}\n{section.content}\n\n"
        
        # Add study type information to the review prompt
        study_type_info = f"This is a {self.study_type.value.capitalize()} style case study."
        
        # Use our review prompt
        prompt = self.section_generator.report_review_prompt.format(
            report=full_case,
            study_type=study_type_info
        )
        
        # Call LLM with temperature=0 for more precise analysis
        review_text, _ = await self.section_generator._call_sagemaker_llm(prompt)
        logger.info(f"This is the supposed json response for coherence:{review_text}")
        # Extract and parse the JSON review
        try:
            # Try to extract JSON from the response
            parse_result = await self.section_generator._parse_json_from_llm_response(review_text)
            # Handle different return types from the parser
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
                # Try to parse the string as JSON directly
                import json
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
    
    async def _generate_parallel_coherence_review(self, sections):
        """
        Parallel coherence review for large case studies
        Review sections in pairs for faster processing while maintaining quality
        """
        if len(sections) <= 2:
            return await self._generate_coherence_review(sections)
        
        logger.info(f"Using parallel coherence review for {len(sections)} sections")
        
        # Create section pairs for parallel review
        section_pairs = []
        for i in range(len(sections) - 1):
            section_pairs.append((sections[i], sections[i + 1], i))
        
        # Review pairs in parallel with rate limiting
        semaphore = asyncio.Semaphore(2)  # Max 2 concurrent reviews
        
        async def review_with_semaphore(pair_data):
            async with semaphore:
                section1, section2, pair_index = pair_data
                return await self._review_section_pair(section1, section2, pair_index)
        
        # Execute parallel reviews
        review_tasks = [review_with_semaphore(pair) for pair in section_pairs]
        pair_reviews = await asyncio.gather(*review_tasks, return_exceptions=True)
        
        # Consolidate results
        all_issues = []
        for i, review_result in enumerate(pair_reviews):
            if isinstance(review_result, Exception):
                logger.warning(f"Error reviewing section pair {i}: {review_result}")
                continue
            
            if review_result and isinstance(review_result, dict):
                issues = review_result.get("issues", [])
                all_issues.extend(issues)
        
        return {
            "overall_assessment": f"Parallel review of {len(section_pairs)} section pairs completed",
            "issues": all_issues
        }
    
    async def _review_section_pair(self, section1, section2, pair_index):
        """Review a pair of adjacent sections for coherence"""
        try:
            # Create a focused prompt for pair review
            pair_content = f"## {section1.title}\n{section1.content}\n\n## {section2.title}\n{section2.content}"
            
            # Use the parallel review prompt from the template
            if not self.section_generator.report_parallel_review_prompt:
                logger.warning("Parallel review prompt not available, skipping pair review")
                return {"issues": []}
            
            # Use the template-based prompt
            simplified_prompt = self.section_generator.report_parallel_review_prompt.format(
                pair_content=pair_content,
                section1_title=section1.title,
                section2_title=section2.title
            )
            
            # Call LLM with shorter, focused prompt
            review_text, _ = await self.section_generator._call_sagemaker_llm(simplified_prompt)
            
            # Parse response
            parse_result = await self.section_generator._parse_json_from_llm_response(review_text)
            
            if isinstance(parse_result, tuple):
                review_data, error = parse_result
                return review_data if review_data else {"issues": []}
            elif isinstance(parse_result, dict):
                return parse_result
            else:
                return {"issues": []}
                
        except Exception as e:
            logger.warning(f"Error reviewing section pair {pair_index}: {e}")
            return {"issues": []}
        
    async def _apply_coherence_fixes(self, sections, review):
        """
        Apply suggested fixes from coherence review with parallel processing
        """
        # Handle Reports that do not require revisions
        if self.section_generator.report_revision_prompt is None:
            return sections, {}

        if not review or not review.get("issues"):
            return sections, {}
        
        updated_sections = sections.copy()
        coherence_scores = {}
        
        # Group issues by section for parallel processing
        section_issues = {}
        for issue in review.get("issues", []):
            affected_section_names = issue.get("affected_sections", [])
            for section_name in affected_section_names:
                if section_name not in section_issues:
                    section_issues[section_name] = []
                section_issues[section_name].append(issue)
        
        if not section_issues:
            # No issues to fix, return original sections with positive scores
            for section in updated_sections:
                coherence_scores[section.section_id] = 1.0
            return updated_sections, coherence_scores
        
        # Create revision tasks for parallel processing
        revision_tasks = []
        section_indices = {}
        
        for i, section in enumerate(updated_sections):
            section_indices[section.title] = i
            if section.title in section_issues:
                revision_tasks.append(self._revise_section_for_issues(
                    section, section_issues[section.title], i
                ))
        
        # Execute revisions in parallel with rate limiting
        if revision_tasks:
            semaphore = asyncio.Semaphore(2)  # Limit concurrent revisions
            
            async def revise_with_semaphore(task):
                async with semaphore:
                    return await task
            
            revision_results = await asyncio.gather(
                *[revise_with_semaphore(task) for task in revision_tasks],
                return_exceptions=True
            )
            
            # Apply successful revisions
            for result in revision_results:
                if isinstance(result, Exception):
                    logger.error(f"Error in revision: {result}")
                    continue
                    
                if result and isinstance(result, dict):
                    section_index = result.get("section_index")
                    revised_content = result.get("revised_content")
                    section_id = result.get("section_id")
                    
                    if section_index is not None and revised_content:
                        # Update section content
                        updated_sections[section_index].content = revised_content.strip()
                        
                        # Update type-specific fields
                        await self._update_section_type_fields(updated_sections[section_index], revised_content)
                        
                        # Add negative coherence score for revised sections
                        coherence_scores[section_id] = coherence_scores.get(section_id, 0) - 0.1
        
        # Add positive coherence scores for sections without issues
        for section in updated_sections:
            if section.section_id not in coherence_scores:
                coherence_scores[section.section_id] = 1.0
                
        logger.info("Parallel coherence fixes applied successfully")
        return updated_sections, coherence_scores
    
    async def _revise_section_for_issues(self, section, issues, section_index):
        """Revise a single section to address multiple issues"""
        try:
            # Get max_words
            section_config = self.section_config_map.get(section.section_id, {})
            max_words = section_config.get("max_words", 400)

            # Combine all issues for this section
            combined_description = "; ".join([issue["description"] for issue in issues])
            combined_revision = "; ".join([issue["suggested_revision"] for issue in issues])
            
            # Generate fix using revision prompt
            prompt = self.section_generator.report_revision_prompt.format(
                section_title=section.title,
                max_words=max_words,
                section_content=section.content,
                issue_description=combined_description,
                suggested_revision=combined_revision,
            )
            
            # Call LLM for revision
            revised_content, revision_steps = await self.section_generator._call_sagemaker_llm(prompt)
            
            # Track revision in processing steps if available
            if section.explanation and section.explanation.processing_steps:
                section.explanation.processing_steps.extend(revision_steps)
                section.explanation.processing_steps = self.section_generator._record_processing_step(
                    section.explanation.processing_steps,
                    "coherence_revision",
                    issue_count=len(issues),
                    issues=[issue.get("issue_type") for issue in issues]
                )
            
            return {
                "section_index": section_index,
                "revised_content": revised_content,
                "section_id": section.section_id,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error revising section {section.title}: {e}")
            return {"success": False, "error": str(e)}
    
    async def _update_section_type_fields(self, section, revised_content):
        """Update type-specific fields after content revision"""
        try:
            if self.study_type == StudyType.STYLE_B:
                if section.section_id in ["learning_objectives", "discussion_questions"]:
                    section.learning_objectives = self.section_generator._extract_list_items(revised_content)
                if section.section_id == "discussion_questions":
                    section.discussion_questions = self.section_generator._extract_list_items(revised_content)
                    
            elif self.study_type == StudyType.STYLE_C:
                if section.section_id == "interactive_elements":
                    section.interactive_elements = self.section_generator._extract_interactive_elements(revised_content)
                if section.section_id == "assessment_components":
                    section.assessment_content = self.section_generator._extract_assessment_content(revised_content)
                    
        except Exception as e:
            logger.warning(f"Error updating type-specific fields for {section.title}: {e}")
    
    def _extract_multimedia_elements(self, text):
        """Extract multimedia elements from text (simplified)"""
        elements = []
        
        # Look for sections that might describe multimedia elements
        video_pattern = r"(?:^|\n).*video.*:?(.*?)(?=(?:\n\n)|$)"
        animation_pattern = r"(?:^|\n).*animation.*:?(.*?)(?=(?:\n\n)|$)"
        interactive_pattern = r"(?:^|\n).*interactive.*:?(.*?)(?=(?:\n\n)|$)"
        
        # Extract potential sections
        videos = re.findall(video_pattern, text, re.IGNORECASE | re.DOTALL)
        animations = re.findall(animation_pattern, text, re.IGNORECASE | re.DOTALL)
        interactives = re.findall(interactive_pattern, text, re.IGNORECASE | re.DOTALL)
        
        # Add to elements list
        for video in videos:
            if video.strip():
                elements.append({"type": "video", "description": video.strip()})
                
        for animation in animations:
            if animation.strip():
                elements.append({"type": "animation", "description": animation.strip()})
                
        for interactive in interactives:
            if interactive.strip():
                elements.append({"type": "interactive", "description": interactive.strip()})
        
        return elements