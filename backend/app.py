from flask import Flask, request, jsonify
from flask_cors import CORS
from pdf2image import convert_from_path
import pytesseract
from summarizer import summarize_text
import os

app = Flask(__name__)
CORS(app)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/upload', methods=['POST'])
def upload_pdf():
    file = request.files['pdf']
    filepath = os.path.join(UPLOAD_FOLDER, 'input.pdf')
    file.save(filepath)

    images = convert_from_path(filepath)
    all_text = ""
    for img in images:
        all_text += pytesseract.image_to_string(img) + "\n\n"

    summary = summarize_text(all_text)
    return jsonify({'summary': summary})

if __name__ == '__main__':
    app.run(debug=True)
