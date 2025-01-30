import os
from pathlib import Path
from typing import Optional
import json
from datetime import datetime

def ensure_dir(file_path: str) -> None:
    directory = os.path.dirname(file_path)
    if directory and not os.path.exists(directory):
        os.makedirs(directory)

def get_audio_path(filename: str) -> str:
    audio_dir = Path("audio_output")
    audio_dir.mkdir(exist_ok=True)
    return str(audio_dir / filename)

def create_response(success: bool, data: Optional[dict] = None, error: Optional[str] = None) -> dict:
    response = {
        "success": success,
        "timestamp": datetime.now().isoformat()
    }
    if data:
        response["data"] = data
    if error:
        response["error"] = error
    return response 