from flask import Flask, request, render_template, send_file, jsonify, session
import os
import tempfile
import shutil
from werkzeug.utils import secure_filename
import uuid
import subprocess
import platform
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
import google.generativeai as genai
from fpdf import FPDF
import textwrap
import threading
import time

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this'  # Change this to a random secret key

# -------------- CONFIGURATION --------------
# Replace with your actual API key or use environment variable
API_KEY = os.getenv('GEMINI_API_KEY', "AIzaSyADT2XPzUcY40XAzmCRSukwLknKcdv6JX4")
genai.configure(api_key=API_KEY)

# Flask-specific folders
UPLOAD_FOLDER = 'flask_uploads'
TEMP_IMAGES_FOLDER = 'flask_temp_images'
OUTPUT_FOLDER = 'flask_output'
MAX_CHUNK_SIZE = 15000
ALLOWED_EXTENSIONS = {'pdf'}

# Create necessary directories
for folder in [UPLOAD_FOLDER, TEMP_IMAGES_FOLDER, OUTPUT_FOLDER]:
    os.makedirs(folder, exist_ok=True)

# Store processing status for each session
processing_status = {}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_custom_prompt(format_choice, chunk):
    """Create AI prompt based on user choices"""
    
    # Format-specific instructions
    format_prompts = {
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
    
    base_prompt = f"""
{format_prompts.get(format_choice, format_prompts["1"])}

FORMATTING RULES:
- Use ## for main sections
- Use ### for subsections
- Use bullet points (-) for lists
- Use **bold** for important terms
- Put formulas on separate lines
- Create clear visual hierarchy

Make it visually appealing and well-organized.

Transform this content:

{chunk}
"""
    
    return base_prompt

def convert_pdf_to_images(pdf_path, session_id):
    """Convert PDF pages to images for OCR processing"""
    try:
        session_temp_folder = os.path.join(TEMP_IMAGES_FOLDER, session_id)
        os.makedirs(session_temp_folder, exist_ok=True)
        
        print(f"Converting PDF to images for session {session_id}...")
        pages = convert_from_path(pdf_path, dpi=300)
        
        image_paths = []
        for idx, page in enumerate(pages, 1):
            img_path = os.path.join(session_temp_folder, f"page_{idx:03d}.jpg")
            page.save(img_path, "JPEG", quality=95)
            image_paths.append(img_path)
            print(f"Saved: page_{idx:03d}.jpg")

        return image_paths
    
    except Exception as e:
        print(f"Error converting PDF to images: {e}")
        return []

def extract_text_from_images(image_paths):
    """Extract text from images using OCR"""
    try:
        if not image_paths:
            print("No images found for text extraction!")
            return ""
        
        full_text = ""
        print("Extracting text from images...")

        for img_path in image_paths:
            print(f"Processing: {os.path.basename(img_path)}")
            
            try:
                image = Image.open(img_path)
                text = pytesseract.image_to_string(image, config='--oem 3 --psm 6')
                full_text += f"\n--- Page {os.path.basename(img_path)} ---\n{text}\n"
            except Exception as e:
                print(f"Error processing {img_path}: {e}")
                continue

        return full_text.strip()
    
    except Exception as e:
        print(f"Error during text extraction: {e}")
        return ""

def generate_study_material(text, format_choice):
    """Generate study material based on user choices"""
    try:
        if not text.strip():
            print("No text available for processing!")
            return ""
        
        model = genai.GenerativeModel("gemini-1.5-flash")
        study_material = ""

        # Split text into manageable chunks
        chunks = [text[i:i+MAX_CHUNK_SIZE] for i in range(0, len(text), MAX_CHUNK_SIZE)]
        print(f"Generating study material in {len(chunks)} part(s)...")

        for idx, chunk in enumerate(chunks, 1):
            print(f"Processing chunk {idx}/{len(chunks)}...")
            
            try:
                prompt = create_custom_prompt(format_choice, chunk)
                response = model.generate_content(prompt)
                
                if response.text:
                    study_material += response.text + "\n\n"
                else:
                    print(f"Warning: Empty response for chunk {idx}")
                    
            except Exception as e:
                print(f"Error processing chunk {idx}: {e}")
                continue

        return study_material.strip()
    
    except Exception as e:
        print(f"Error in AI generation: {e}")
        return ""

def save_text(content, filepath):
    """Save content as text file"""
    try:
        with open(filepath, 'w', encoding='utf-8') as file:
            file.write(content)
        
        print(f"✅ Text file saved: {filepath}")
        return True
    
    except Exception as e:
        print(f"❌ Error saving text file: {e}")
        return False

def save_pdf(content, filepath):
    """Save content as PDF file"""
    try:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_margins(left=20, top=20, right=20)
        pdf.set_auto_page_break(auto=True, margin=20)
        
        # Add title
        pdf.set_font("Arial", "B", 16)
        pdf.cell(0, 15, "Study Material", ln=True, align='C')
        pdf.ln(10)
        
        # Process content
        pdf.set_font("Arial", size=10)
        lines = content.split('\n')
        
        for line in lines:
            if not line.strip():
                pdf.ln(3)
                continue
            
            # Clean line for PDF compatibility
            clean_line = line.encode('latin-1', 'ignore').decode('latin-1')
            
            # Handle headers
            if clean_line.startswith('##'):
                pdf.set_font("Arial", "B", 12)
                header_text = clean_line.replace('#', '').strip()
                pdf.cell(0, 8, header_text, ln=True)
                pdf.set_font("Arial", size=10)
                pdf.ln(2)
            elif clean_line.startswith('#'):
                pdf.set_font("Arial", "B", 14)
                header_text = clean_line.replace('#', '').strip()
                pdf.cell(0, 10, header_text, ln=True)
                pdf.set_font("Arial", size=10)
                pdf.ln(3)
            else:
                # Wrap long lines
                wrapped_lines = textwrap.wrap(clean_line, width=90)
                for wrapped_line in wrapped_lines:
                    pdf.cell(0, 6, wrapped_line, ln=True)

        # Save PDF
        pdf.output(filepath)
        
        print(f"✅ PDF file saved: {filepath}")
        return True

    except Exception as e:
        print(f"❌ PDF generation failed: {e}")
        return False

def cleanup_session(session_id):
    """Remove temporary files for a session"""
    try:
        session_temp_folder = os.path.join(TEMP_IMAGES_FOLDER, session_id)
        if os.path.exists(session_temp_folder):
            shutil.rmtree(session_temp_folder)
            print(f"🧹 Cleaned up temporary files for session {session_id}")
    except Exception as e:
        print(f"Warning: Could not clean up temporary files for session {session_id}: {e}")

def check_dependencies():
    """Check if required dependencies are available"""
    missing_deps = []
    
    try:
        import pdf2image
    except ImportError:
        missing_deps.append("pdf2image")
    
    try:
        import pytesseract
        # Test if tesseract is actually available
        pytesseract.get_tesseract_version()
    except (ImportError, pytesseract.TesseractNotFoundError):
        missing_deps.append("pytesseract and/or tesseract-ocr")
    
    try:
        import google.generativeai
    except ImportError:
        missing_deps.append("google-generativeai")
    
    return missing_deps

def process_pdf_async(session_id, pdf_path, format_choice):
    """Process PDF asynchronously"""
    try:
        processing_status[session_id] = {
            "status": "processing", 
            "step": "Starting PDF processing...",
            "timestamp": time.time()
        }
        
        # Step 1: Convert PDF to images
        processing_status[session_id]["step"] = "Converting PDF to images..."
        image_paths = convert_pdf_to_images(pdf_path, session_id)
        if not image_paths:
            processing_status[session_id] = {
                "status": "error", 
                "message": "Failed to convert PDF to images",
                "timestamp": time.time()
            }
            return
        
        # Step 2: Extract text
        processing_status[session_id]["step"] = "Extracting text from images..."
        text = extract_text_from_images(image_paths)
        if not text.strip():
            processing_status[session_id] = {
                "status": "error", 
                "message": "No text extracted from PDF",
                "timestamp": time.time()
            }
            return
        
        print(f"✅ Extracted text from {len(image_paths)} pages")
        
        # Step 3: Generate study material
        processing_status[session_id]["step"] = "Generating study material with AI..."
        study_material = generate_study_material(text, format_choice)
        
        if not study_material.strip():
            processing_status[session_id] = {
                "status": "error", 
                "message": "Failed to generate study material",
                "timestamp": time.time()
            }
            return
        
        # Step 4: Save files
        processing_status[session_id]["step"] = "Saving your study material..."
        
        # Create session output directory
        session_output_dir = os.path.join(OUTPUT_FOLDER, session_id)
        os.makedirs(session_output_dir, exist_ok=True)
        
        # Save as text
        text_path = os.path.join(session_output_dir, "StudyMaterial.txt")
        save_text(study_material, text_path)
        
        # Save as PDF
        pdf_path = os.path.join(session_output_dir, "StudyMaterial.pdf")
        save_pdf(study_material, pdf_path)
        
        processing_status[session_id] = {
            "status": "completed",
            "text_file": text_path,
            "pdf_file": pdf_path,
            "timestamp": time.time()
        }
        
        print("✅ All done! Study material is ready!")
        
        # Clean up temporary files
        cleanup_session(session_id)
        
    except Exception as e:
        processing_status[session_id] = {
            "status": "error", 
            "message": f"Processing failed: {str(e)}",
            "timestamp": time.time()
        }
        print(f"❌ Processing error: {e}")

# -------------- FLASK ROUTES --------------

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and start processing"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file selected'}), 400
    
    file = request.files['file']
    format_choice = request.form.get('format', '1')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        # Generate unique session ID
        session_id = str(uuid.uuid4())
        session['session_id'] = session_id
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        upload_path = os.path.join(UPLOAD_FOLDER, f"{session_id}_{filename}")
        file.save(upload_path)
        
        print(f"📁 File uploaded: {filename} (Session: {session_id})")
        
        # Start processing in background
        thread = threading.Thread(
            target=process_pdf_async,
            args=(session_id, upload_path, format_choice)
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({'session_id': session_id}), 200
    
    return jsonify({'error': 'Invalid file type. Please upload a PDF.'}), 400

@app.route('/status/<session_id>')
def get_status(session_id):
    """Get processing status for a session"""
    status = processing_status.get(session_id, {"status": "not_found"})
    return jsonify(status)

@app.route('/download/<session_id>/<file_type>')
def download_file(session_id, file_type):
    """Download generated files"""
    if session_id not in processing_status:
        return "Session not found", 404
    
    status = processing_status[session_id]
    if status.get("status") != "completed":
        return "File not ready", 404
    
    if file_type == 'txt':
        file_path = status.get('text_file')
        mimetype = 'text/plain'
        filename = 'StudyMaterial.txt'
    elif file_type == 'pdf':
        file_path = status.get('pdf_file')
        mimetype = 'application/pdf'
        filename = 'StudyMaterial.pdf'
    else:
        return "Invalid file type", 404
    
    if not file_path or not os.path.exists(file_path):
        return "File not found", 404
    
    return send_file(file_path, as_attachment=True, download_name=filename, mimetype=mimetype)

@app.route('/health')
def health_check():
    """Health check endpoint"""
    missing_deps = check_dependencies()
    
    if missing_deps:
        return jsonify({
            'status': 'error',
            'message': 'Missing dependencies',
            'missing': missing_deps
        }), 500
    
    if API_KEY == "YOUR_API_KEY_HERE" or not API_KEY:
        return jsonify({
            'status': 'error',
            'message': 'API key not configured'
        }), 500
    
    return jsonify({
        'status': 'healthy',
        'message': 'All dependencies available'
    })

@app.route('/cleanup')
def cleanup_old_files():
    """Clean up old files (call this periodically)"""
    try:
        current_time = time.time()
        cleanup_count = 0
        
        # Clean up old uploads (older than 2 hours)
        for filename in os.listdir(UPLOAD_FOLDER):
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            if current_time - os.path.getctime(file_path) > 7200:  # 2 hours
                os.remove(file_path)
                cleanup_count += 1
        
        # Clean up old output directories (older than 2 hours)
        for dirname in os.listdir(OUTPUT_FOLDER):
            dir_path = os.path.join(OUTPUT_FOLDER, dirname)
            if os.path.isdir(dir_path) and current_time - os.path.getctime(dir_path) > 7200:
                shutil.rmtree(dir_path)
                cleanup_count += 1
        
        # Clean up old processing status (older than 2 hours)
        old_sessions = []
        for session_id, status in processing_status.items():
            if current_time - status.get('timestamp', current_time) > 7200:
                old_sessions.append(session_id)
        
        for session_id in old_sessions:
            del processing_status[session_id]
            cleanup_count += 1
        
        return jsonify({
            'status': 'success',
            'cleaned_items': cleanup_count
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# -------------- ERROR HANDLERS --------------

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Page not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# -------------- STARTUP CHECK --------------

def startup_check():
    """Check system requirements on startup"""
    print("🎓 Smart Study Generator - Flask Server")
    print("=" * 50)
    
    # Check dependencies
    missing_deps = check_dependencies()
    if missing_deps:
        print("❌ Missing dependencies:")
        for dep in missing_deps:
            print(f"  - {dep}")
        print("\nInstall missing packages with:")
        print("  pip install pdf2image pytesseract google-generativeai fpdf2")
        print("  # Also install tesseract-ocr system package")
        return False
    
    # Check API key
    if API_KEY == "YOUR_API_KEY_HERE" or not API_KEY:
        print("❌ Please set your Gemini API key!")
        print("Either:")
        print("1. Set environment variable: export GEMINI_API_KEY='your_key_here'")
        print("2. Replace the API_KEY value in the script with your actual key")
        return False
    
    print("✅ All dependencies available")
    print("✅ API key configured")
    print("🚀 Server starting...")
    return True

# -------------- MAIN --------------

if __name__ == '__main__':
    if startup_check():
        # Run the Flask app
        app.run(
            debug=True, 
            host='0.0.0.0', 
            port=8000,
            threaded=True
        )
    else:
        print("❌ Startup check failed. Please fix the issues above.")