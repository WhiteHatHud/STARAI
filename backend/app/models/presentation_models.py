from datetime import datetime, timezone
from typing import Annotated, List, Optional, Literal, Dict, Any
from pydantic import BaseModel, BeforeValidator, Field
from bson import ObjectId
from fastapi import HTTPException

Tone = Literal["default", "casual", "professional", "funny", "educational", "sales_pitch"]
Verbosity = Literal["concise", "standard", "heavy"]
VisualStyle = Literal["photorealistic", "illustration", "abstract", "3d", "line_art"]

def validate_object_id(id_value):
    if not id_value:
        return None
    
    if isinstance(id_value, str) and id_value.startswith("temp_"):
        return str(ObjectId())
    
    if isinstance(id_value, str):
        try:
            return str(ObjectId(id_value))
        except:
            return str(ObjectId())
            
    return str(ObjectId())

PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]

class SlideLayoutModel(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    json_schema: dict


class PresentationLayoutModel(BaseModel):
    name: str
    ordered: bool = Field(default=False)
    slides: List[SlideLayoutModel]

    def get_slide_layout_index(self, slide_layout_id: str) -> int:
        for index, slide in enumerate(self.slides):
            if slide.id == slide_layout_id:
                return index
        raise HTTPException(
            status_code=404, detail=f"Slide layout {slide_layout_id} not found"
        )

    def to_presentation_structure(self):
        return PresentationStructureModel(
            slides=[index for index in range(len(self.slides))]
        )

    def to_string(self):
        message = f"## Presentation Layout\n\n"
        for index, slide in enumerate(self.slides):
            message += f"### Slide Layout: {index}: \n"
            message += f"- Name: {slide.name or slide.json_schema.get('title')} \n"
            message += f"- Description: {slide.description} \n\n"
        return message


class SlideOutlineModel(BaseModel):
    title: str
    content: str
    speaker_notes: str


class PresentationOutlineModel(BaseModel):
    slides: List[SlideOutlineModel]

    def to_string(self):
        message = ""
        for i, slide in enumerate(self.slides):
            message += f"## Slide {i+1}:\n"
            message += f"  - Content: {slide.content} \n"
        return message

class PresentationStructureModel(BaseModel):
    slides: List[int] = Field(description="List of slide layout indexes")


class PresentationModel(BaseModel):
    """Full presentation model for MongoDB"""
    id: Optional[PyObjectId] = Field(alias="_id", default_factory=lambda: str(ObjectId()))
    user_id: Optional[PyObjectId] = None
    content: str = None
    n_slides: int = None
    language: str = None
    title: Optional[str] = None
    file_paths: Optional[List[str]] = Field(default_factory=list)
    outlines: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    layout: Optional[Dict[str, Any]] = None
    structure: Optional[Dict[str, Any]] = None
    instructions: Optional[str] = None
    tone: Optional[Tone] = None
    verbosity: Optional[Verbosity] = None
    include_table_of_contents: bool = False
    include_title_slide: bool = True
    web_search: bool = False
    visual_style: Optional[VisualStyle] = None


    def get_new_presentation(self, user_id: str):
        return PresentationModel(
            id=str(ObjectId()),
            user_id=user_id,
            content=self.content,
            n_slides=self.n_slides,
            language=self.language,
            title=self.title,
            file_paths=self.file_paths,
            outlines=self.outlines,
            layout=self.layout,
            structure=self.structure,
            instructions=self.instructions,
            tone=self.tone,
            verbosity=self.verbosity,
            include_table_of_contents=self.include_table_of_contents,
            include_title_slide=self.include_title_slide,
            web_search=self.web_search,
            visual_style=self.visual_style,
        )

    def get_presentation_outline(self):
        if not self.outlines:
            return None
        return PresentationOutlineModel(**self.outlines)

    def get_layout(self):
        if not self.layout:
            return None
        return PresentationLayoutModel(**self.layout)

    def set_layout(self, layout: PresentationLayoutModel):
        self.layout = layout.model_dump(mode='json')

    def get_structure(self):
        if not self.structure:
            return None
        return PresentationStructureModel(**self.structure)

    def set_structure(self, structure: PresentationStructureModel):
        self.structure = structure.model_dump(mode='json')