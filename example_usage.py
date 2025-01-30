from text_to_speech import ElevenLabsAPI

# Initialize with your API key
api = ElevenLabsAPI("YOUR_API_KEY")

# Convert text to speech
text = "Hello, this is a test of the ElevenLabs API!"
audio = api.text_to_speech(text)

# Save the audio file
api.save_audio(audio, "test_speech.mp3") 