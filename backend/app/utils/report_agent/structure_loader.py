import json
from pathlib import Path
from app.models.report_models import StudyType

STRUCTURES_PATH = Path(__file__).parent/"structures"

STUDY_TYPE_TO_FILENAME = {
    StudyType.STYLE_A: "style_a.json",
    StudyType.STYLE_B: "style_b.json",
    StudyType.STYLE_C: "style_c.json",
    StudyType.STYLE_SOF: "style_sof.json",
}

def get_structure_for_type(study_type):
    filename = STUDY_TYPE_TO_FILENAME.get(study_type, "style_a.json")
    filepath = STRUCTURES_PATH / filename
    print(f"path is: {STRUCTURES_PATH}")

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise RuntimeError(f"Failed to load structure for {study_type}: {e}")