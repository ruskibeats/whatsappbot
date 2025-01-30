import requests
import json

class ElevenLabsAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://api.elevenlabs.io/v1"
        self.headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }

    def text_to_speech(self, text, voice_id="21m00Tcm4TlvDq8ikWAM", model_id="eleven_multilingual_v2"):
        url = f"{self.base_url}/text-to-speech/{voice_id}"
        
        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }

        response = requests.post(url, json=payload, headers=self.headers)
        
        if response.status_code == 200:
            return response.content
        else:
            raise Exception(f"Error: {response.status_code}, {response.text}")

    def save_audio(self, audio_content, filename="output.mp3"):
        with open(filename, "wb") as f:
            f.write(audio_content) 