# app/utils/content_generator.py

from app.utils.vector_search import VectorSearch
from app.core.sagemaker_manager import sagemaker_manager
from typing import Any, Dict, List, Optional
import re
import json
import logging
from app.utils.chunking import embed_sentence_sagemaker
from app.core.prompt_manager import PromptManager
from datetime import datetime

import numpy as np

logger = logging.getLogger(__name__)

class ContentGenerator:
    """Base service for generating content from documents using RAG"""
    
    def __init__(self):
        self.vector_search = VectorSearch()
        self.endpoint_name = "Qwen3-235B-A22B-Instruct-2507-9"
        self.prompts = PromptManager()
    
    def _record_processing_step(self, processing_steps, step_name, **details):
        """Record a processing pipeline step for explainability"""
        processing_steps.append({
            "step": step_name,
            "timestamp": datetime.now().isoformat(),
            "details": details
        })
        return processing_steps
    
    def calculate_system_confidence(self, llm_confidence, retrieval_scores):
        """
        Calculate overall system confidence based on LLM and retrieval metrics
        Returns a value between 1-5 (5 being highest confidence)
        """
        # LLM confidence is already on a 1-5 scale
        # Calculate retrieval quality (0-1 range)
        retrieval_quality = np.mean(retrieval_scores) if retrieval_scores else 0.5
        
        # Weight LLM confidence higher than retrieval
        system_confidence = (0.7 * llm_confidence) + (0.3 * retrieval_quality * 5)
        
        # Ensure output is in 1-5 range
        return max(1.0, min(5.0, system_confidence))
    
    # Add processing time tracking in each step:
    def _record_processing_step(self, processing_steps, step_name, **details):
        """Record a processing pipeline step for explainability"""
        step_start_time = datetime.now()
        processing_steps.append({
            "step": step_name,
            "timestamp": step_start_time.isoformat(),
            "details": details,
            "step_start_time": step_start_time  # Add this
        })
        return processing_steps

    async def _preprocess_query(self, question, processing_steps=None):
        """
        Preprocess the question to improve search results
        Step 1: Query Preprocessing
        """
        if processing_steps is None:
            processing_steps = []
            
        # Record this step
        processing_steps = self._record_processing_step(
            processing_steps, 
            "query_preprocessing",
            original_query=question
        )
        
        # Remove extra whitespace and normalize
        processed_query = question.strip()
            
        logger.info(f"Preprocessed query: '{processed_query}'")
        
        # Record result
        processing_steps = self._record_processing_step(
            processing_steps, 
            "query_preprocessing_complete",
            processed_query=processed_query
        )
        
        return processed_query, processing_steps
    
    async def _vectorize_query(self, question, processing_steps=None):
        """
        Convert the question into a vector embedding
        Step 2: Query Vectorization
        """
        if processing_steps is None:
            processing_steps = []
            
        # Record this step
        processing_steps = self._record_processing_step(
            processing_steps, 
            "query_vectorization_start",
            query=question
        )
        
        logger.info(f"Vectorizing query: '{question[:50]}...'")
        
        # Generate embedding using the embedding model via SageMaker
        query_vector = None
        try:
            query_vector = await embed_sentence_sagemaker(question)
            
            if not query_vector:
                logger.error("Failed to generate vector embedding for query")
                processing_steps = self._record_processing_step(
                    processing_steps, 
                    "query_vectorization_failed"
                )
            else:
                logger.info(f"Successfully vectorized query: {len(query_vector)} dimensions")
                processing_steps = self._record_processing_step(
                    processing_steps, 
                    "query_vectorization_complete",
                    vector_dimensions=len(query_vector)
                )
                
        except Exception as e:
            logger.error(f"Error vectorizing query: {str(e)}")
            processing_steps = self._record_processing_step(
                processing_steps, 
                "query_vectorization_error",
                error=str(e)
            )
            
        return query_vector, processing_steps
    
    def format_instruction(self, instruction, query, doc):
        """Format the query and document pair for the reranker model."""
        prefix = '<|im_start|>system\nJudge whether the Document meets the requirements based on the Query and the Instruct provided. Note that the answer can only be "yes" or "no".<|im_end|>\n<|im_start|>user\n'
        suffix = "<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
        if instruction is None:
            instruction = "Given a web search query, retrieve relevant passages that answer the query"
        return f"{prefix}<Instruct>: {instruction}\n<Query>: {query}\n<Document>: {doc}{suffix}"
    
    async def _rerank_search_results(self, query, search_results, processing_steps=None):
        """
        Re-rank search results using the Qwen3-Reranker model hosted on SageMaker.
        """
        if processing_steps is None:
            processing_steps = []

        processing_steps = self._record_processing_step(
            processing_steps, 
            "reranking_start",
            search_result_count=len(search_results)
        )

        # If no results to rerank, return early
        if not search_results:
            processing_steps = self._record_processing_step(
                processing_steps, 
                "reranking_skipped",
                reason="No search results to rerank"
            )
            return search_results, processing_steps
        
        try:
            # Prepare the query-document pairs for the model
            pairs = [
                self.format_instruction("Given a web search query, retrieve relevant passages that answer the query", query, result.get("content", ""))
                for result in search_results
            ]

            # Create the payload for SageMaker
            payload = {
                "pairs": pairs
            }

            # Send the payload to the SageMaker endpoint
            reranker_response = await sagemaker_manager.invoke_endpoint(
                endpoint_name='Qwen3-Reranker-8B-2025-10-29-05-29-12-335',
                payload=payload
            )

            # Extract the scores from the response
            scores = reranker_response
            logging.info(f"Reranker response: {scores}")

            if not scores:
                logger.warning("No scores returned by the reranker model.")
                processing_steps = self._record_processing_step(
                    processing_steps, 
                    "reranking_error",
                    error="No scores returned from reranker model"
                )
                return search_results, processing_steps

            # Add the scores to the search results
            for i, score in enumerate(scores):
                if i < len(search_results):
                    search_results[i]["score"] = score

            # Sort the results by score in descending order
            reranked_results = sorted(search_results, key=lambda x: x["score"], reverse=True)

            # Record reranking complete
            processing_steps = self._record_processing_step(
                processing_steps, 
                "reranking_complete",
                result_count=len(reranked_results),
                avg_score=sum(scores) / len(scores) if scores else 0,
                max_score=max(scores) if scores else 0,
                min_score=min(scores) if scores else 0
            )

            return reranked_results, processing_steps

        except Exception as e:
            # Log the error and return the original search results
            logger.error(f"Error during reranking: {str(e)}", exc_info=True)
            processing_steps = self._record_processing_step(
                processing_steps, 
                "reranking_error",
                error=str(e)
            )
            return search_results, processing_steps
    
    async def _get_context(self, question, k=3, case_id=None, document_ids=None):
        """
        Retrieve relevant context for a question with explainability tracking
        Steps 1-4: Query Preprocessing → Vectorization → Vector Search → Context Assembly
        
        Args:
            question: The question or query to find context for
            k: Number of chunks to retrieve
            case_id: Case ID to search within
            document_ids: Optional list of specific document IDs to search within
        """
        # Initialize processing steps tracking
        processing_steps = []
        processing_steps = self._record_processing_step(
            processing_steps, 
            "context_retrieval_start",
            question=question,
            case_id=case_id,
            document_ids=document_ids if document_ids else []
        )
        
        # Step 1: Query Preprocessing
        processed_query, processing_steps = await self._preprocess_query(question, processing_steps)
        
        # Step 2: Query Vectorization
        query_vector, processing_steps = await self._vectorize_query(processed_query, processing_steps)
        
        # Step 3: Vector Search
        processing_steps = self._record_processing_step(
            processing_steps, 
            "vector_search_start",
            case_id=case_id,
            document_ids=document_ids if document_ids else [],
            k=k
        )
        
        # Pass the document_ids parameter along with the case_id
        results = await self.vector_search.search(
            processed_query, 
            k=k, 
            case_id=case_id,
            document_ids=document_ids,
            query_vector=query_vector
        )
        
        processing_steps = self._record_processing_step(
            processing_steps, 
            "vector_search_complete",
            result_count=len(results)
        )

        # Step 4: Reranking
        results, processing_steps = await self._rerank_search_results(
            processed_query, 
            results, 
            processing_steps
        )
        
        # Limit to k results after reranking
        results = results[:k]
        
        # Step 5: Context Assembly
        processing_steps = self._record_processing_step(
            processing_steps, 
            "context_assembly_start"
        )
        
        # Format results for prompt context
        formatted_context = []
        source_info = []
        retrieval_scores = []
        
        for i, result in enumerate(results):
            source_name = result.get("document_name", "Unknown Document")
            content = result.get("content", "")
            score = float(result.get("score", 1.0))
            
            formatted_context.append(f"[Source {i+1}: {source_name}]\n{content}")
            retrieval_scores.append(score)
            
            source_info.append({
                "text": content,
                "document_name": source_name,
                "doc_id": str(result.get("doc_id", "")),
                "chunk_index": result.get("index", 0),
                "score": score
            })
            
        context_text = "\n\n".join(formatted_context)
        
        # Record context assembly completion
        processing_steps = self._record_processing_step(
            processing_steps, 
            "context_assembly_complete",
            context_length=len(context_text),
            source_count=len(source_info),
            avg_score=np.mean(retrieval_scores) if retrieval_scores else 0
        )
        
        logger.info(f"Retrieved {len(results)} relevant context chunks for RAG")
        
        return context_text, source_info, retrieval_scores, processing_steps
        

    async def _call_sagemaker_llm(self, prompt, processing_steps=None, progress_id=None, progress_tracker=None):
        """
        Call SageMaker endpoint with the given prompt
        Step 5: LLM Generation 
        """
        import os
        result = ""

        if processing_steps is None:
            processing_steps = []

        processing_steps = self._record_processing_step(
            processing_steps, 
            "llm_generation_start",
            prompt_length=len(prompt),
        )

        try:
            logger.info(f"full prompt: {prompt}")
            logger.info("Using streaming for LLM generation...")
            with open("report_generation.log", "a") as log_file:
                log_file.write(f"Prompt:\n{prompt}\n\n")

            messages_payload = {
                "messages": [{"role": "user", "content": prompt}],
                "parameters": {
                    "max_new_tokens": 16384,
                    "temperature": 0.7,
                    "top_p": 0.8,
                    "return_full_text": False,
                    "stream": True
                }
            }
                
            output = ""

            async for chunk in sagemaker_manager.stream_invoke(messages_payload, endpoint_name = self.endpoint_name, progress_id=progress_id, progress_tracker=progress_tracker):
                output += chunk
                if progress_id and progress_tracker and progress_id in progress_tracker:
                    progress_tracker[progress_id].update({
                        "partial_response": output,
                        "last_updated": str(datetime.now())
                    })
            
            result = output
                    
            logger.info(f"Received response from LLM (first 100 chars): {result[:100]}...")
            with open("report_generation.log", "a") as log_file:
                log_file.write(f"Generated section:\n{result}\n\n")

            processing_steps = self._record_processing_step(
                processing_steps, 
                "llm_generation_complete",
                response_length=len(result)
            )

            return result, processing_steps

        except Exception as e:
            logger.error(f"Error calling SageMaker endpoint: {str(e)}")
            processing_steps = self._record_processing_step(
                processing_steps, 
                "llm_generation_error",
                error=str(e)
            )
            return f"Error calling SageMaker endpoint: {str(e)}", processing_steps

       
    async def _parse_json_from_llm_response(self, result_text, processing_steps=None):
        """
        Parse JSON from LLM response with fallback patterns
        Shared utility for extracting structured data
        """
        if processing_steps is None:
            processing_steps = []
            
        processing_steps = self._record_processing_step(
            processing_steps, 
            "json_parsing_start"
        )

        try:
            # Multiple fallback patterns
            json_patterns = [
                r'```json\s*({.*?})\s*```',  # Match ```json { ... } ```
                r'```\s*({.*?})\s*```',      # Match ``` { ... } ```
                # r'({.*?})'                   # Match first complete JSON object
            ]

            # Log the full text for debugging
            logger.debug(f"Parsing JSON from text: {result_text[:200]}...")

            for pattern in json_patterns:
                json_match = re.search(pattern, result_text, re.DOTALL)
                if json_match:
                    try:
                        json_data = json.loads(json_match.group(1))
                        processing_steps = self._record_processing_step(
                            processing_steps, 
                            "json_parsing_complete",
                            pattern_used=pattern
                        )
                        return json_data, processing_steps
                    except json.JSONDecodeError:
                        continue
            # Fallback: Use raw_decode to extract first valid JSON object
            decoder = json.JSONDecoder()
            for idx in range(len(result_text)):
                try:
                    obj, end = decoder.raw_decode(result_text[idx:].strip())
                    processing_steps = self._record_processing_step(
                        processing_steps,
                        "json_parsing_complete",
                        pattern_used="raw_decode_fallback"
                    )
                    return obj, processing_steps
                except json.JSONDecodeError:
                    continue

            # Handle duplicated JSON (Qwen sometimes outputs multiple copies)
            if '```json' in result_text and result_text.count('```json') > 1:
                # Take the first occurrence
                parts = result_text.split('```json', 2)
                if len(parts) > 1:
                    result_text = '```json' + parts[1]
            
            # Array patterns (for bundle responses)
            array_patterns = [
                r'```json\s*(\[[\s\S]*?\])\s*```',  # Match ```json [ ... ] ```
                r'```\s*(\[[\s\S]*?\])\s*```',      # Match ``` [ ... ] ```
                r'\[\s*\{\s*"question_id"[\s\S]*?\}\s*\]'  # Match standalone array with question_id field
            ]
            
            # Object patterns (for single responses)
            object_patterns = [
                r'```json\s*(\{[\s\S]*?\})\s*```',  # Match ```json { ... } ```
                r'```\s*(\{[\s\S]*?\})\s*```',      # Match ``` { ... } ```
                r'(\{[\s\S]*?\})'                   # Match complete JSON object
            ]

            # Try array patterns first (for bundles)
            for pattern in array_patterns:
                json_match = re.search(pattern, result_text, re.DOTALL)
                if json_match:
                    try:
                        json_str = json_match.group(1)
                        logger.debug(f"Extracted JSON array: {json_str[:200]}...")
                        json_data = json.loads(json_str)
                        processing_steps = self._record_processing_step(
                            processing_steps, 
                            "json_parsing_complete",
                            pattern_used=pattern,
                            is_array=True
                        )
                        return json_data, processing_steps
                    except json.JSONDecodeError as jde:
                        logger.warning(f"JSON array decode error with pattern {pattern}: {str(jde)}")
                        continue

            # Then try object patterns (for individual questions)
            for pattern in object_patterns:
                json_match = re.search(pattern, result_text, re.DOTALL)
                if json_match:
                    try:
                        json_str = json_match.group(1)
                        logger.debug(f"Extracted JSON object: {json_str[:200]}...")
                        json_data = json.loads(json_str)
                        processing_steps = self._record_processing_step(
                            processing_steps, 
                            "json_parsing_complete",
                            pattern_used=pattern,
                            is_array=False
                        )
                        return json_data, processing_steps
                    except json.JSONDecodeError as jde:
                        logger.warning(f"JSON object decode error with pattern {pattern}: {str(jde)}")
                        continue

            # Last resort: look for any JSON-like content
            try:
                # Find anything that looks like JSON (between { and } or [ and ])
                json_like_match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', result_text)
                if json_like_match:
                    json_str = json_like_match.group(1)
                    # Clean up potential issues (replace escaped newlines, etc.)
                    json_str = json_str.replace('\\n', '\n').replace('\\"', '"')
                    json_data = json.loads(json_str)
                    processing_steps = self._record_processing_step(
                        processing_steps, 
                        "json_parsing_complete",
                        pattern_used="last_resort"
                    )
                    return json_data, processing_steps
            except Exception as e:
                logger.warning(f"Last resort JSON parsing failed: {str(e)}")
                
            # If we get here, no valid JSON was found
            raise ValueError("No valid JSON found in LLM response")
            
        except Exception as e:
            logger.error(f"Failed to parse JSON from LLM response: {str(e)}")
            logger.error(f"Response content: {result_text[:500]}...")
            processing_steps = self._record_processing_step(
                processing_steps, 
                "json_parsing_error",
                error=str(e)
            )
            return None, processing_steps