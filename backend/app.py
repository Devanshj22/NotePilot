from flask import Flask, request, jsonify
from flask_cors import CORS
from pdf2image import convert_from_path
import pytesseract
import os

from summarizer import summarize_text

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/upload', methods=['POST'])
def upload_pdf():
    print("📥 PDF upload received.")
    file = request.files.get('pdf')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400

    filepath = os.path.join(UPLOAD_FOLDER, 'input.pdf')
    file.save(filepath)
    print(f"✅ Saved file at {filepath}")

    try:
        images = convert_from_path(filepath)
    except Exception as e:
        return jsonify({'error': f'PDF to image conversion failed: {str(e)}'}), 500

    all_text = ""
    for img in images:
        all_text += pytesseract.image_to_string(img) + "\n"

    if not all_text.strip():
        return jsonify({'error': 'OCR returned no text'}), 500

    try:
        summary = summarize_text(all_text)
    except Exception as e:
        return jsonify({'error': f'Summarization failed: {str(e)}'}), 500

    return jsonify({'summary': summary})

if __name__ == '__main__':
    app.run(debug=True)
