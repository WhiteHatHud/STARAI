import json
import asyncio
import dirtyjson
import re
from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from pathlib import Path
from app.models.models import User
from app.core.auth import get_current_user
from app.repositories import slide_repo, document_repo
from app.models.presentation_models import PresentationModel, PresentationOutlineModel, PresentationLayoutModel, PresentationStructureModel, SlideOutlineModel
from app.models.sse_models import (
    SSECompleteResponse,
    SSEErrorResponse,
    SSEResponse,
    SSEStatusResponse,
)
from app.utils.slide_utils import generate_ppt_outline, get_presentation_title_from_outlines, generate_presentation_structure, select_toc_or_list_slide_layout_index

import logging
import tempfile
import os
import math
import random

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/create")
async def create_presentation(
    request_body: dict,
    current_user: User = Depends(get_current_user)
):
    presentation_id = slide_repo.create_presentation_for_user(request_body, current_user.id)
    return {"id": presentation_id}

@router.post("/outlines/stream/{id}")
async def stream_outlines(
    id: str,
    current_user: User = Depends(get_current_user)
):
    presentation = slide_repo.get_presentation(id)

    async def inner():
        yield SSEStatusResponse(
            status="Processing documents and generating presentation outlines..."
        ).to_string()
        
        additional_context = ""
        
        for doc in presentation.file_paths:
            document = await document_repo.choose_one_document(doc, current_user=current_user)
            additional_context += f"\nDocument Title: {document.name}\nContent: {document.content}\n"
        
        n_slides_to_generate = presentation.n_slides

        if presentation.include_table_of_contents:
            needed_toc_count = math.ceil((presentation.n_slides - 1) / 10)
            n_slides_to_generate -= math.ceil(
                (presentation.n_slides - needed_toc_count) / 10
            )

        presentation_outlines_text = ""

        async for chunk in generate_ppt_outline(
            presentation.content,
            n_slides_to_generate,
            presentation.language,
            additional_context,
            presentation.tone,
            presentation.verbosity,
            presentation.instructions,
            presentation.include_title_slide,
            presentation.web_search,
        ):
            # Give control to the event loop
            await asyncio.sleep(0)

            if isinstance(chunk, HTTPException):
                yield SSEErrorResponse(detail=chunk.detail).to_string()
                return

            yield SSEResponse(
                event="response",
                data=json.dumps({"type": "chunk", "chunk": chunk}),
            ).to_string()

            presentation_outlines_text += chunk

        try:
            presentation_outlines_json = dict(
                dirtyjson.loads(presentation_outlines_text)
            )
        except Exception as e:
            yield SSEErrorResponse(
                detail=f"Failed to generate presentation outlines. Please try again. {str(e)}",
            ).to_string()
            return

        presentation_outlines = PresentationOutlineModel(**presentation_outlines_json)

        presentation_outlines.slides = presentation_outlines.slides[
            :n_slides_to_generate
        ]

        presentation.outlines = presentation_outlines.model_dump()
        presentation.title = get_presentation_title_from_outlines(presentation_outlines)

        slide_repo.update_presentation(id, {
            "outlines": presentation.outlines,
            "title": presentation.title
        })

        yield SSECompleteResponse(
            key="presentation", value=presentation.model_dump(mode="json")
        ).to_string()

    return StreamingResponse(inner(), media_type="text/event-stream")

@router.put("/outlines/{id}")
def update_presentation_outlines(
    id: str,
    outlines: PresentationOutlineModel,
    current_user: User = Depends(get_current_user)
):
    updated = slide_repo.update_presentation(id, {"outlines": outlines.model_dump()})
    if not updated:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return {"status": "success"}

@router.put("/presentation/{id}")
def update_presentation(
    id: str,
    presentation_data: dict,
    current_user: User = Depends(get_current_user)
):
    updated = slide_repo.update_presentation(id, presentation_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return {"status": "success"}

@router.get("/presentations")
def get_presentations(
    current_user: User = Depends(get_current_user)
):
    presentations = slide_repo.get_presentations(current_user.id)
    return presentations

@router.get("/presentation/{id}")
def get_presentation_by_id(
    id: str,
    current_user: User = Depends(get_current_user)
):
    return slide_repo.get_presentation(id)

@router.post("/prepare/{id}")
async def prepare_presentation(
    id: str,
    layout: PresentationLayoutModel,
    current_user: User = Depends(get_current_user)
):
    presentation = slide_repo.get_presentation(id)
    title = presentation.title
    presentation_outline_model = presentation.get_presentation_outline()
    
    if not presentation_outline_model:
        raise HTTPException(status_code=400, detail="Presentation outlines are missing")
    
    total_slide_layouts = len(layout.slides)
    total_outlines = len(presentation_outline_model.slides)

    if layout.ordered:
        presentation_structure = layout.to_presentation_structure()
    else:
        result = await generate_presentation_structure(
                presentation_outline=presentation_outline_model,
                presentation_layout=layout,
                instructions=presentation.instructions,
            )
        presentation_structure = await generate_presentation_structure(
                presentation_outline=presentation_outline_model,
                presentation_layout=layout,
                instructions=presentation.instructions,
            )
        
    presentation_structure.slides = presentation_structure.slides[: len(presentation_outline_model.slides)]
    for index in range(total_outlines):
        random_slide_index = random.randint(0, total_slide_layouts - 1)
        if index >= total_outlines:
            presentation_structure.slides.append(random_slide_index)
            continue
        if presentation_structure.slides[index] >= total_slide_layouts:
            presentation_structure.slides[index] = random_slide_index

    if presentation.include_table_of_contents:
        n_toc_slides = presentation.n_slides - total_outlines
        toc_slide_layout_index = select_toc_or_list_slide_layout_index(layout)
        if toc_slide_layout_index != -1:
            outline_index = 1 if presentation.include_title_slide else 0
            for i in range(n_toc_slides):
                outlines_to = outline_index + 10
                if total_outlines == outlines_to:
                    outlines_to -= 1

                presentation_structure.slides.insert(
                    i + 1 if presentation.include_title_slide else i,
                    toc_slide_layout_index,
                )
                toc_outline = f"Table of Contents\n\n"

                for outline in presentation_outline_model.slides[
                    outline_index:outlines_to
                ]:
                    page_number = (
                        outline_index - i + n_toc_slides + 1
                        if presentation.include_title_slide
                        else outline_index - i + n_toc_slides
                    )
                    toc_outline += f"Slide page number: {page_number}\n Slide Content: {outline.content[:100]}\n\n"
                    outline_index += 1

                outline_index += 1

                presentation_outline_model.slides.insert(
                    i + 1 if presentation.include_title_slide else i,
                    SlideOutlineModel(
                        content=toc_outline,
                    ),
                )

    # Update presentation with MongoDB operations instead of SQL
    presentation.outlines = presentation_outline_model.model_dump(mode="json")
    presentation.title = title or presentation.title
    presentation.set_layout(layout)
    presentation.set_structure(presentation_structure)
    
    # Update in MongoDB using slide_repo
    update_data = {
        "outlines": presentation.outlines,
        "title": presentation.title,
        "layout": presentation.layout,
        "structure": presentation.structure,
        "updated_at": presentation.updated_at
    }
    
    slide_repo.update_presentation(id, update_data)

    return presentation

    
@router.put("/presentation/{id}/layout")
def set_presentation_layout(
    id: str,
    layout: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Set the presentation layout (PresentationLayoutModel)
    
    Expected format:
    {
        "name": "Template Name",
        "ordered": false,
        "slides": [
            {
                "id": "template:layout-id",
                "name": "Layout Name",
                "description": "Layout description",
                "json_schema": {...}
            }
        ]
    }
    """
    try:
        # Validate that presentation exists and belongs to user
        presentation = slide_repo.get_presentation(id)
        if presentation.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this presentation")
        
        # Validate layout structure
        if not layout.get("name"):
            raise HTTPException(status_code=400, detail="Layout must have a name")
        
        if "ordered" not in layout:
            raise HTTPException(status_code=400, detail="Layout must specify 'ordered' field")
        
        if not layout.get("slides") or not isinstance(layout["slides"], list):
            raise HTTPException(status_code=400, detail="Layout must have a 'slides' array")
        
        if len(layout["slides"]) == 0:
            raise HTTPException(status_code=400, detail="Layout must have at least one slide")
        
        # Validate each slide
        for i, slide in enumerate(layout["slides"]):
            if not slide.get("id"):
                raise HTTPException(status_code=400, detail=f"Slide {i} missing 'id'")
            if not slide.get("json_schema"):
                raise HTTPException(status_code=400, detail=f"Slide {i} missing 'json_schema'")
        
        # Update presentation with layout
        updated = slide_repo.update_presentation(id, {"layout": layout})
        if not updated:
            raise HTTPException(status_code=404, detail="Presentation not found")
        
        return {
            "status": "success",
            "message": f"Layout '{layout['name']}' applied successfully",
            "slide_count": len(layout["slides"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting presentation layout: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to set presentation layout: {str(e)}")

@router.put("/presentation/{id}/structure")
def set_presentation_structure(
    id: str,
    structure: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Set the presentation structure (PresentationStructureModel)
    
    Expected format:
    {
        "slides": [0, 1, 2, 3, ...]  // Array of layout indices
    }
    """
    try:
        # Validate that presentation exists and belongs to user
        presentation = slide_repo.get_presentation(id)
        if presentation.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this presentation")
        
        # Validate structure
        if not structure.get("slides") or not isinstance(structure["slides"], list):
            raise HTTPException(status_code=400, detail="Structure must have a 'slides' array")
        
        # Validate that indices are valid if layout exists
        if presentation.layout:
            layout_slide_count = len(presentation.layout.get("slides", []))
            for idx in structure["slides"]:
                if not isinstance(idx, int) or idx < 0 or idx >= layout_slide_count:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid slide index {idx}. Must be between 0 and {layout_slide_count - 1}"
                    )
        
        # Update presentation with structure
        updated = slide_repo.update_presentation(id, {"structure": structure})
        if not updated:
            raise HTTPException(status_code=404, detail="Presentation not found")
        
        return {
            "status": "success",
            "message": "Presentation structure set successfully",
            "slide_count": len(structure["slides"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting presentation structure: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to set presentation structure: {str(e)}")

# Helper functions for template processing
async def _load_template_settings(settings_path: Path, template_name: str) -> dict:
    """Load template settings from settings.json"""
    try:
        if settings_path.exists():
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
                settings["isDefault"] = settings.get("default", False)
                settings["isOrdered"] = settings.get("ordered", False)
                return settings
        else:
            logger.warning(f"No settings.json found for template {template_name}")
            return {
                "description": f"{template_name.title()} presentation layouts",
                "ordered": False,
                "default": False,
                "isDefault": False,
                "isOrdered": False
            }
    except (json.JSONDecodeError, Exception) as e:
        logger.error(f"Error loading settings for {template_name}: {e}")
        return {
            "description": f"{template_name.title()} presentation layouts",
            "ordered": False,
            "default": False,
            "isDefault": False,
            "isOrdered": False
        }

def _extract_layout_name(jsx_content: str, jsx_file: str) -> str:
    """Extract layout name from JSX content or filename"""
    # Check for exported layoutName constant first
    layout_name_match = re.search(r'export\s+const\s+layoutName\s*=\s*[\'"]([^\'"]+)[\'"]', jsx_content)
    if layout_name_match:
        return layout_name_match.group(1)
    
    # Fallback to other patterns
    patterns = [
        r'export\s+default\s+function\s+(\w+)',
        r'const\s+(\w+)\s*=\s*\(',
        r'function\s+(\w+)\s*\(',
        r'export\s+const\s+(\w+)\s*='
    ]
    
    for pattern in patterns:
        match = re.search(pattern, jsx_content)
        if match:
            name = match.group(1)
            return re.sub(r'([A-Z])', r' \1', name).strip().title()
    
    return jsx_file.replace('.jsx', '').replace('_', ' ').title()

def _extract_schema_from_jsx(jsx_content: str) -> dict:
    """Extract schema information from JSX content"""
    # Check for exported Schema constant first
    if 'export const Schema' in jsx_content or 'export const schema' in jsx_content:
        return {"hasSchema": True, "raw": "Schema exported"}
    
    schema_patterns = [
        r'const\s+\w+Schema\s*=\s*z\.object',
        r'const\s+schema\s*=\s*({[^}]+})',
        r'PropTypes\s*=\s*({[^}]+})',
        r'\.propTypes\s*=\s*({[^}]+})'
    ]
    
    for pattern in schema_patterns:
        match = re.search(pattern, jsx_content, re.DOTALL)
        if match:
            try:
                return {"raw": match.group(0) if match.lastindex is None else match.group(1), "hasSchema": True}
            except:
                continue
    
    return {"hasSchema": False, "raw": None}

async def _extract_layout_metadata(jsx_path: Path, template_id: str, jsx_file: str) -> dict:
    """Extract metadata from .jsx layout file"""
    try:
        with open(jsx_path, 'r', encoding='utf-8') as f:
            jsx_content = f.read()
        
        layout_name = _extract_layout_name(jsx_content, jsx_file)
        layout_id = f"{template_id}:{jsx_file.replace('.jsx', '').lower()}"
        schema_info = _extract_schema_from_jsx(jsx_content)
        
        # Try to extract layoutId and layoutDescription if exported
        layout_id_match = re.search(r'export\s+const\s+layoutId\s*=\s*[\'"]([^\'"]+)[\'"]', jsx_content)
        if layout_id_match:
            layout_id = f"{template_id}:{layout_id_match.group(1)}"
        
        layout_desc_match = re.search(r'export\s+const\s+layoutDescription\s*=\s*[\'"]([^\'"]+)[\'"]', jsx_content)
        description = layout_desc_match.group(1) if layout_desc_match else f"{layout_name} layout for {template_id} template"
        
        return {
            "layoutId": layout_id,
            "layoutName": layout_name,
            "fileName": jsx_file,
            "templateID": template_id,
            "schema": schema_info,
            "description": description
        }
        
    except Exception as e:
        logger.error(f"Error extracting metadata from {jsx_path}: {e}")
        return None

@router.get("/templates")
async def get_templates():
    """Get all available presentation templates and their layout files"""
    try:
        # Templates are accessible at /app/presentation_templates in Docker
        templates_directory = Path("/app/presentation_templates")
        
        if not templates_directory.exists():
            raise HTTPException(status_code=404, detail="presentation_templates directory not found")
        
        all_templates = []
        
        for template_path in templates_directory.iterdir():
            if not template_path.is_dir() or template_path.name.startswith('.'):
                continue
                
            template_name = template_path.name
            template_id = template_name.lower()
            
            try:
                jsx_files = [
                    f.name for f in template_path.iterdir()
                    if f.is_file() 
                    and f.suffix == '.jsx'
                    and not f.name.startswith('.')
                    and f.name != 'settings.json'
                ]
                
                settings_path = template_path / "settings.json"
                settings = await _load_template_settings(settings_path, template_name)
                
                layouts = []
                for jsx_file in jsx_files:
                    layout_info = await _extract_layout_metadata(
                        template_path / jsx_file, 
                        template_id, 
                        jsx_file
                    )
                    if layout_info:
                        layouts.append(layout_info)
                
                if layouts:
                    all_templates.append({
                        "templateID": template_id,
                        "templateName": template_name,
                        "files": jsx_files,
                        "layouts": layouts,
                        "settings": settings,
                        "layoutCount": len(layouts)
                    })
                    
            except Exception as error:
                logger.error(f"Error processing template directory {template_name}: {error}")
                continue
        
        all_templates.sort(key=lambda x: (not x["settings"].get("default", False), x["templateName"]))
        
        return {
            "templates": all_templates,
            "totalTemplates": len(all_templates),
            "defaultTemplates": ["general", "modern", "standard", "swift"]
        }
        
    except Exception as error:
        logger.error(f"Error reading presentation-templates directory: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to read presentation-templates directory"
        )

@router.get("/layouts/{template_id}")
async def get_layouts_by_template(
    template_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all layouts for a specific template"""
    try:
        templates_directory = Path("/app/presentation_templates") / template_id
        
        if not templates_directory.exists():
            raise HTTPException(status_code=404, detail=f"Template {template_id} not found")
        
        jsx_files = [
            f for f in templates_directory.iterdir()
            if f.is_file() and f.suffix == '.jsx' and not f.name.startswith('.')
        ]
        
        layouts = []
        for jsx_file in jsx_files:
            layout_info = await _extract_layout_metadata(jsx_file, template_id, jsx_file.name)
            if layout_info:
                layouts.append(layout_info)
        
        return {
            "templateID": template_id,
            "layouts": layouts,
            "count": len(layouts)
        }
        
    except Exception as e:
        logger.error(f"Error getting layouts for template {template_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve layouts")
