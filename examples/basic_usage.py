import os
from dotenv import load_dotenv
from src.text_to_speech import ElevenLabsAPI
from src.utils.audio_utils import get_audio_path

load_dotenv()

def main():
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("Please set ELEVENLABS_API_KEY in .env file")

    api = ElevenLabsAPI(api_key)
    
    text = "Hello, this is a test of the ElevenLabs API!"
    audio = api.text_to_speech(text)
    
    output_path = get_audio_path("test_speech.mp3")
    api.save_audio(audio, output_path)
    print(f"Audio saved to: {output_path}")

if __name__ == "__main__":
    main() 