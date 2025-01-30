import requests
import json
from typing import Dict, Any, Optional

class ElevenLabsAPI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.elevenlabs.io/v1"
        self.headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }

    def text_to_speech(self, 
                      text: str, 
                      voice_id: str = "21m00Tcm4TlvDq8ikWAM", 
                      model_id: str = "eleven_multilingual_v2",
                      return_json: bool = True) -> Dict[str, Any]:
        url = f"{self.base_url}/text-to-speech/{voice_id}"
        
        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }

        try:
            response = requests.post(url, json=payload, headers=self.headers)
            response.raise_for_status()
            
            audio_content = response.content
            audio_path = self.save_audio(audio_content)
            
            if return_json:
                return {
                    "success": True,
                    "audio_path": audio_path,
                    "metadata": {
                        "text": text,
                        "voice_id": voice_id,
                        "model_id": model_id,
                        "content_type": response.headers.get('Content-Type'),
                        "content_length": len(audio_content)
                    }
                }
            return audio_content
            
        except requests.exceptions.RequestException as e:
            error_response = {
                "success": False,
                "error": str(e),
                "status_code": getattr(e.response, 'status_code', None),
                "details": getattr(e.response, 'text', None)
            }
            return error_response

    def get_voices(self) -> Dict[str, Any]:
        url = f"{self.base_url}/voices"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return {
                "success": True,
                "voices": response.json()
            }
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": str(e)
            }

    def save_audio(self, audio_content: bytes, filename: Optional[str] = None) -> str:
        from .utils.audio_utils import get_audio_path
        if filename is None:
            import uuid
            filename = f"audio_{uuid.uuid4()}.mp3"
        
        output_path = get_audio_path(filename)
        with open(output_path, "wb") as f:
            f.write(audio_content)
        return output_path 