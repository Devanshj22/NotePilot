from flask import Flask, request, jsonify, send_file
import os
import shutil
import uuid
import threading
import time
import traceback
from werkzeug.utils import secure_filename
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
import google.generativeai as genai
from flask_cors import CORS

# ---- CONFIG ----
app = Flask(__name__)
CORS(app)

API_KEY = os.getenv('GEMINI_API_KEY', "AIzaSyADT2XPzUcY40XAzmCRSukwLknKcdv6JX4")
genai.configure(api_key=API_KEY)

UPLOAD_FOLDER = 'uploads'
TEMP_IMAGES_FOLDER = 'temp_images'
OUTPUT_FOLDER = 'user_outputs'
MAX_CHUNK_SIZE = 15000

for folder in [UPLOAD_FOLDER, TEMP_IMAGES_FOLDER, OUTPUT_FOLDER]:
    os.makedirs(folder, exist_ok=True)

processing_status = {}

# --- HELPER FUNCTIONS ---
def create_custom_prompt(format_choice, chunk):
    prompts = {
        "1": """Create a SMART CHEAT SHEET with:
- ## Quick Reference section with key formulas
- Clear section headers (## and ###)
- Bullet points (-) for key facts
- **Bold** for important terms
- Formulas on separate lines
- Scannable layout""",
        "2": """Create DETAILED SUMMARY NOTES with:
- Comprehensive explanations
- Examples for each concept
- Step-by-step processes
- Background information
- Complete coverage of topics"""
    }
    return f"{prompts.get(format_choice, prompts['1'])}\n\nTransform this content:\n{chunk}"

def convert_pdf_to_images(pdf_path, session_id):
    try:
        print(f"Converting PDF to images for session {session_id}")
        temp_folder = os.path.join(TEMP_IMAGES_FOLDER, session_id)
        os.makedirs(temp_folder, exist_ok=True)
        pages = convert_from_path(pdf_path, dpi=300)
        paths = []
        for idx, page in enumerate(pages, 1):
            img_path = os.path.join(temp_folder, f"page_{idx}.jpg")
            page.save(img_path, "JPEG", quality=95)
            paths.append(img_path)
        print(f"Successfully converted {len(pages)} pages")
        return paths
    except Exception as e:
        print(f"Error converting PDF: {str(e)}")
        raise e

def extract_text(image_paths):
    try:
        print(f"Extracting text from {len(image_paths)} images")
        full_text = ""
        for img in image_paths:
            text = pytesseract.image_to_string(Image.open(img), config='--oem 3 --psm 6')
            full_text += text + "\n"
        print(f"Extracted {len(full_text)} characters of text")
        return full_text.strip()
    except Exception as e:
        print(f"Error extracting text: {str(e)}")
        raise e

def generate_ai_output(text, format_choice):
    try:
        print("Generating AI summary...")
        model = genai.GenerativeModel("gemini-1.5-flash")
        study_material = ""
        chunks = [text[i:i+MAX_CHUNK_SIZE] for i in range(0, len(text), MAX_CHUNK_SIZE)]
        print(f"Processing {len(chunks)} text chunks")
        
        for i, chunk in enumerate(chunks):
            print(f"Processing chunk {i+1}/{len(chunks)}")
            prompt = create_custom_prompt(format_choice, chunk)
            response = model.generate_content(prompt)
            study_material += response.text + "\n\n"
        
        print("AI summary generation completed")
        return study_material.strip()
    except Exception as e:
        print(f"Error generating AI output: {str(e)}")
        raise e

# --- BACKGROUND PROCESSING ---
def process_pdf(session_id, filepath, format_choice):
    try:
        print(f"Starting processing for session {session_id}")
        processing_status[session_id] = {"status": "processing", "step": "initializing"}
        
        # Step 1: Convert PDF to images
        processing_status[session_id]["step"] = "converting_pdf"
        images = convert_pdf_to_images(filepath, session_id)
        
        # Step 2: Extract text
        processing_status[session_id]["step"] = "extracting_text"
        text = extract_text(images)
        
        if not text.strip():
            raise Exception("No text could be extracted from the PDF")
        
        # Step 3: Generate AI summary
        processing_status[session_id]["step"] = "generating_summary"
        result = generate_ai_output(text, format_choice)
        
        # Step 4: Save ONLY text output (NO PDF)
        processing_status[session_id]["step"] = "saving_files"
        session_folder = os.path.join(OUTPUT_FOLDER, session_id)
        os.makedirs(session_folder, exist_ok=True)

        txt_path = os.path.join(session_folder, "output.txt")
        
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(result)

        # Mark as completed - NO PDF CREATION
        processing_status[session_id] = {"status": "completed", "txt": txt_path}
        
        # Cleanup
        shutil.rmtree(os.path.join(TEMP_IMAGES_FOLDER, session_id), ignore_errors=True)
        print(f"Processing completed for session {session_id}")

    except Exception as e:
        error_msg = str(e)
        print(f"Error processing session {session_id}: {error_msg}")
        print(f"Full traceback: {traceback.format_exc()}")
        processing_status[session_id] = {"status": "error", "message": error_msg}

# --- FLASK ROUTES ---
@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        print("Upload request received")
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        format_choice = request.form.get('format', '1')
        session_id = str(uuid.uuid4())
        filename = f"{session_id}_{secure_filename(file.filename)}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        print(f"File saved: {filename}, Session ID: {session_id}")
        
        thread = threading.Thread(target=process_pdf, args=(session_id, filepath, format_choice))
        thread.start()
        
        return jsonify({"session_id": session_id})
    
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/status/<session_id>')
def check_status(session_id):
    status = processing_status.get(session_id, {"status": "not_found"})
    print(f"Status check for {session_id}: {status}")
    return jsonify(status)

@app.route('/download/<session_id>/<file_type>')
def download(session_id, file_type):
    try:
        status = processing_status.get(session_id)
        if not status or status.get("status") != "completed":
            return "File not ready", 404

        if file_type == "txt":
            path = status.get("txt")
            if not path or not os.path.exists(path):
                return "File not found", 404
            return send_file(path, as_attachment=True, download_name="StudyMaterial.txt")
        else:
            return "Only text files available", 404
            
    except Exception as e:
        print(f"Download error: {str(e)}")
        return f"Download error: {str(e)}", 500

if __name__ == '__main__':
    print("🚀 Starting Flask server...")
    print("📝 Text-only mode (no PDF creation)")
    print("✅ Make sure you have installed:")
    print("   - tesseract-ocr")
    print("   - poppler-utils")
    app.run(debug=True, port=8000)
