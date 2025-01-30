import unittest
from unittest.mock import patch, MagicMock
from src.text_to_speech import ElevenLabsAPI

class TestElevenLabsAPI(unittest.TestCase):
    def setUp(self):
        self.api = ElevenLabsAPI("fake_api_key")

    @patch('requests.post')
    def test_text_to_speech_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"fake_audio_content"
        mock_post.return_value = mock_response

        audio = self.api.text_to_speech("Test text")
        self.assertEqual(audio["success"], True)

    @patch('requests.post')
    def test_text_to_speech_failure(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Error message"
        mock_post.return_value = mock_response

        result = self.api.text_to_speech("Test text")
        self.assertEqual(result["success"], False)

if __name__ == '__main__':
    unittest.main() 