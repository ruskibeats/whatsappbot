from flask import Flask, request, jsonify
from src.text_to_speech import ElevenLabsAPI
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
api = ElevenLabsAPI(os.getenv("ELEVENLABS_API_KEY"))

@app.route('/tts', methods=['POST'])
def text_to_speech_webhook():
    try:
        data = request.json
        text = data.get('text')
        voice_id = data.get('voice_id', "21m00Tcm4TlvDq8ikWAM")
        model_id = data.get('model_id', "eleven_multilingual_v2")
        
        if not text:
            return jsonify({
                "success": False,
                "error": "No text provided"
            }), 400
            
        result = api.text_to_speech(
            text=text,
            voice_id=voice_id,
            model_id=model_id
        )
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/voices', methods=['GET'])
def get_voices_webhook():
    try:
        result = api.get_voices()
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) 