import re
from typing import Optional, List
from app.models.presentation_models import PresentationOutlineModel, PresentationLayoutModel, PresentationStructureModel
from app.core.sagemaker_manager import sagemaker_manager
from fastapi import HTTPException
from app.models.dynamic_models import get_presentation_structure_model_with_n_slides
import json
import logging

logger = logging.getLogger(__name__)

def get_presentation_title_from_outlines(
    presentation_outlines: PresentationOutlineModel,
) -> str:
    if not presentation_outlines.slides:
        return "Untitled Presentation"

    first_content = presentation_outlines.slides[0].content or ""

    if re.match(r"^\s*#{1,6}\s*Page\s+\d+\b", first_content):
        first_content = re.sub(
            r"^\s*#{1,6}\s*Page\s+\d+\b[\s,:\-]*",
            "",
            first_content,
            count=1,
        )

    return (
        first_content[:100]
        .replace("#", "")
        .replace("/", "")
        .replace("\\", "")
        .replace("\n", " ")
    )

def get_messages(
    content: str,
    n_slides: int,
    language: Optional[str] = None,
    additional_context: Optional[str] = None,
    tone: Optional[str] = None,
    verbosity: Optional[str] = None,
    instructions: Optional[str] = None,
    include_title_slide: bool = True,
):
    """Build messages for presentation outline generation"""
    system_prompt = f"""You are an expert presentation designer. Create a detailed outline for a {n_slides}-slide presentation.

Requirements:
- Generate exactly {n_slides} slides
- Language: {language or 'English'}
- Tone: {tone or 'professional'}
- Verbosity: {verbosity or 'standard'}
- Include title slide: {include_title_slide}

{f'Additional instructions: {instructions}' if instructions else ''}

Return the response as a JSON object with this structure:
{{
  "title": "Presentation Title",
  "slides": [
    {{
      "slide_number": 1,
      "title": "Slide Title",
      "content": "Slide content in markdown format",
      "speaker_notes": "Notes for the speaker"
    }}
  ]
}}"""

    user_content = f"Topic: {content}"
    if additional_context:
        user_content += f"\n\nAdditional Context:\n{additional_context}"

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "parameters": {
            "max_new_tokens": 4000,
            "temperature": 0.7,
            "top_p": 0.9,
            "return_full_text": False
        }
    }

async def generate_ppt_outline(
    content: str,
    n_slides: int,
    language: Optional[str] = None,
    additional_context: Optional[str] = None,
    tone: Optional[str] = None,
    verbosity: Optional[str] = None,
    instructions: Optional[str] = None,
    include_title_slide: bool = True,
    web_search: bool = False,
):
    """Generate presentation outline using SageMaker"""
    try:
        endpoint_name = "Qwen3-235B-A22B-Instruct-2507-9"
        
        messages = get_messages(
            content,
            n_slides,
            language,
            additional_context,
            tone,
            verbosity,
            instructions,
            include_title_slide,
        )

        # Stream the response from SageMaker
        async for chunk in sagemaker_manager.stream_invoke(
            messages=messages,
            endpoint_name=endpoint_name,
            content_type='application/json'
        ):
            if chunk:
                yield chunk
                
    except Exception as e:
        logger.error(f"Error generating presentation outline: {str(e)}")
        yield HTTPException(status_code=500, detail=f"Failed to generate outline: {str(e)}")
        
def find_slide_layout_index_by_regex(
    layout: PresentationLayoutModel, patterns: List[str]
) -> int:
    def _find_index(pattern: str) -> int:
        regex = re.compile(pattern, re.IGNORECASE)
        for index, slide_layout in enumerate(layout.slides):
            candidates = [
                slide_layout.id or "",
                (slide_layout.name or ""),
                (slide_layout.description or ""),
                (slide_layout.json_schema.get("title") if slide_layout.json_schema else ""),
            ]
            for text in candidates:
                if text and regex.search(text):
                    return index
        return -1

    for pattern in patterns:
        match_index = _find_index(pattern)
        if match_index != -1:
            return match_index

    return -1


def select_toc_or_list_slide_layout_index(
    layout: PresentationLayoutModel,
) -> int:
    toc_patterns = [
        r"\btable\s*of\s*contents\b",
        r"\btable[- ]?of[- ]?contents\b",
        r"\bagenda\b",
        r"\bcontents\b",
        r"\boutline\b",
        r"\bindex\b",
        r"\btoc\b",
    ]

    list_patterns = [
        r"\b(bullet(ed)?\s*list|bullets?)\b",
        r"\b(numbered\s*list|ordered\s*list|unordered\s*list)\b",
        r"\blist\b",
    ]

    toc_index = find_slide_layout_index_by_regex(layout, toc_patterns)
    if toc_index != -1:
        return toc_index

    return find_slide_layout_index_by_regex(layout, list_patterns)

def get_structure_messages(
    presentation_layout: PresentationLayoutModel,
    n_slides: int,
    data: str,
    instructions: Optional[str] = None,
):
    """Build messages for presentation structure generation"""
    system_prompt = f"""You're a professional presentation designer with creative freedom to design engaging presentations.

{presentation_layout.to_string()}

# DESIGN PHILOSOPHY
- Create visually compelling and varied presentations
- Match layout to content purpose and audience needs
- Prioritize engagement over rigid formatting rules

# Layout Selection Guidelines
1. **Content-driven choices**: Let the slide's purpose guide layout selection
- Opening/closing → Title layouts
- Processes/workflows → Visual process layouts  
- Comparisons/contrasts → Side-by-side layouts
- Data/metrics → Chart/graph layouts
- Concepts/ideas → Image + text layouts
- Key insights → Emphasis layouts

2. **Visual variety**: Aim for diverse, engaging presentation flow
- Mix text-heavy and visual-heavy slides naturally
- Use your judgment on when repetition serves the content
- Balance information density across slides

3. **Audience experience**: Consider how slides work together
- Create natural transitions between topics
- Use layouts that enhance comprehension
- Design for maximum impact and retention

**Trust your design instincts. Focus on creating the most effective presentation for the content and audience.**

{f"# User Instruction: {instructions}" if instructions else ""}

User instruction should be taken into account while creating the presentation structure, except for number of slides.

Select layout index for each of the {n_slides} slides based on what will best serve the presentation's goals.

Return the response as a JSON object with this structure:
{{
  "slides": [0, 1, 2, ...]
}}

Where each number represents the layout index for that slide."""

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": data}
        ],
        "parameters": {
            "max_new_tokens": 2000,
            "temperature": 0.7,
            "top_p": 0.9,
            "return_full_text": False
        }
    }

async def generate_presentation_structure(
    presentation_outline: PresentationOutlineModel,
    presentation_layout: PresentationLayoutModel,
    instructions: Optional[str] = None,
) -> PresentationStructureModel:
    """Generate presentation structure using SageMaker LLM"""
    
    try:
        endpoint_name = "Qwen3-235B-A22B-Instruct-2507-9"
        
        messages = get_structure_messages(
            presentation_layout,
            len(presentation_outline.slides),
            presentation_outline.to_string(),
            instructions,
        )

        response_text = ""
        async for chunk in sagemaker_manager.stream_invoke(
            messages=messages,
            endpoint_name=endpoint_name,
            content_type='application/json'
        ):
            if chunk:
                response_text += chunk
                
        try:
            response_data = json.loads(response_text)
            return PresentationStructureModel(**response_data)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {response_text}")
            # Fallback: create a simple sequential structure
            return PresentationStructureModel(
                slides=list(range(min(len(presentation_layout.slides), len(presentation_outline.slides))))
            )
            
    except Exception as e:
        logger.error(f"Error generating presentation structure: {str(e)}")
        # Fallback: create a simple sequential structure
        return PresentationStructureModel(
            slides=list(range(min(len(presentation_layout.slides), len(presentation_outline.slides))))
        )