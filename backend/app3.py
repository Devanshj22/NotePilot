import os
import subprocess
import platform
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
import google.generativeai as genai

# -------------- CONFIGURATION --------------
# Replace YOUR_ACTUAL_API_KEY_HERE with your real API key
API_KEY = "AIzaSyADT2XPzUcY40XAzmCRSukwLknKcdv6JX4"
genai.configure(api_key=API_KEY)

INPUT_FOLDER = "input_pdfs"
TEMP_IMAGES_FOLDER = "temp_images"
DOWNLOADS_FOLDER = os.path.join(os.path.expanduser("~"), "Downloads")
MAX_CHUNK_SIZE = 15000

# -------------- USER OPTIONS --------------

def get_user_format_choice():
    """Let user choose what type of study material they want"""
    print("\n" + "="*50)
    print("📚 What type of study material do you want?")
    print("="*50)
    
    formats = {
        "1": "🎯 Smart Cheat Sheet (organized reference guide)",
        "2": "📋 Summary Notes (detailed explanations)"
    }
    
    for key, description in formats.items():
        print(f"{key}. {description}")
    
    while True:
        choice = input("\nEnter your choice (1-2): ").strip()
        if choice in formats:
            return choice
        print("Please enter a number from 1-2.")

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

# -------------- PDF PROCESSING --------------

def find_pdf():
    """Find and select a PDF file from the input folder"""
    if not os.path.exists(INPUT_FOLDER):
        os.makedirs(INPUT_FOLDER)
        print(f"Created folder '{INPUT_FOLDER}'. Please put a PDF file inside.")
        return None

    files = [f for f in os.listdir(INPUT_FOLDER) if f.lower().endswith('.pdf')]
    if not files:
        print("No PDFs found in input_pdfs. Add a PDF and try again.")
        return None

    if len(files) == 1:
        selected_file = files[0]
        print(f"Found PDF: {selected_file}")
    else:
        print("Found PDF files:")
        for idx, f in enumerate(files, 1):
            print(f"{idx}. {f}")
        
        while True:
            try:
                choice = int(input(f"Select a PDF (1-{len(files)}): ")) - 1
                if 0 <= choice < len(files):
                    selected_file = files[choice]
                    break
                else:
                    print(f"Please enter a number between 1 and {len(files)}")
            except ValueError:
                print("Please enter a valid number")
    
    return os.path.join(INPUT_FOLDER, selected_file)

def convert_pdf_to_images(pdf_path):
    """Convert PDF pages to images for OCR processing"""
    try:
        os.makedirs(TEMP_IMAGES_FOLDER, exist_ok=True)
        print("Converting PDF to images...")
        pages = convert_from_path(pdf_path, dpi=300)
        
        for idx, page in enumerate(pages, 1):
            img_path = os.path.join(TEMP_IMAGES_FOLDER, f"page_{idx:03d}.jpg")
            page.save(img_path, "JPEG", quality=95)
            print(f"Saved: page_{idx:03d}.jpg")

        return len(pages)
    
    except Exception as e:
        print(f"Error converting PDF to images: {e}")
        return 0

def extract_text_from_images():
    """Extract text from images using OCR"""
    try:
        images = sorted([f for f in os.listdir(TEMP_IMAGES_FOLDER) if f.lower().endswith('.jpg')])
        if not images:
            print("No images found for text extraction!")
            return ""
        
        full_text = ""
        print("Extracting text from images...")

        for img in images:
            img_path = os.path.join(TEMP_IMAGES_FOLDER, img)
            print(f"Processing: {img}")
            
            try:
                image = Image.open(img_path)
                text = pytesseract.image_to_string(image, config='--oem 3 --psm 6')
                full_text += f"\n--- Page {img} ---\n{text}\n"
            except Exception as e:
                print(f"Error processing {img}: {e}")
                continue

        return full_text.strip()
    
    except Exception as e:
        print(f"Error during text extraction: {e}")
        return ""

# -------------- AI GENERATION --------------

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

# -------------- SAVING OUTPUT --------------

def save_text(content, filename="StudyMaterial.txt"):
    """Save content as text file"""
    try:
        os.makedirs(DOWNLOADS_FOLDER, exist_ok=True)
        path = os.path.join(DOWNLOADS_FOLDER, filename)
        
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        
        print(f"✅ Text file saved: {path}")
        return path
    
    except Exception as e:
        print(f"❌ Error saving text file: {e}")
        return None

def save_pdf(content, filename="StudyMaterial.pdf"):
    """Save content as PDF file"""
    try:
        from fpdf import FPDF
        import textwrap

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
        os.makedirs(DOWNLOADS_FOLDER, exist_ok=True)
        pdf_path = os.path.join(DOWNLOADS_FOLDER, filename)
        pdf.output(pdf_path)
        
        print(f"✅ PDF file saved: {pdf_path}")
        return pdf_path

    except ImportError:
        print("❌ FPDF library not found. Install with: pip install fpdf2")
        return None
    except Exception as e:
        print(f"❌ PDF generation failed: {e}")
        return None

# -------------- UTILITIES --------------

def open_file(filepath):
    """Open file with default system application"""
    if not filepath or not os.path.exists(filepath):
        return
        
    try:
        if platform.system() == "Darwin":  # macOS
            subprocess.run(["open", filepath], check=True)
        elif platform.system() == "Windows":
            os.startfile(filepath)
        elif platform.system() == "Linux":
            subprocess.run(["xdg-open", filepath], check=True)
        else:
            print(f"Cannot auto-open file on this system: {filepath}")
    except Exception as e:
        print(f"Cannot open file: {e}")

def cleanup():
    """Remove temporary files"""
    try:
        if os.path.exists(TEMP_IMAGES_FOLDER):
            for file in os.listdir(TEMP_IMAGES_FOLDER):
                file_path = os.path.join(TEMP_IMAGES_FOLDER, file)
                os.remove(file_path)
            os.rmdir(TEMP_IMAGES_FOLDER)
            print("🧹 Temporary files cleaned up.")
    except Exception as e:
        print(f"Warning: Could not clean up temporary files: {e}")

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
    
    if missing_deps:
        print("❌ Missing dependencies:")
        for dep in missing_deps:
            print(f"  - {dep}")
        print("\nInstall missing packages with:")
        print("  pip install pdf2image pytesseract google-generativeai fpdf2")
        print("  # Also install tesseract-ocr system package")
        return False
    
    return True

# -------------- MAIN FUNCTION --------------

def main():
    """Main program function"""
    print("🎓 Smart Study Generator")
    print("Transform your PDFs into personalized study materials!\n")
    
    # Check dependencies
    if not check_dependencies():
        print("Please install missing dependencies and try again.")
        return
    
    # Check API key
    if API_KEY == "YOUR_API_KEY_HERE" or not API_KEY:
        print("❌ Please set your Gemini API key!")
        print("Either:")
        print("1. Set environment variable: export GEMINI_API_KEY='your_key_here'")
        print("2. Replace 'YOUR_API_KEY_HERE' in the script with your actual key")
        return
    
    try:
        # Step 1: Find PDF
        pdf_path = find_pdf()
        if not pdf_path:
            return
        
        # Step 2: Get user format preference
        format_choice = get_user_format_choice()
        
        print(f"\n🔄 Processing your PDF: {os.path.basename(pdf_path)}")
        
        # Step 3: Convert PDF to images
        num_pages = convert_pdf_to_images(pdf_path)
        if num_pages == 0:
            print("❌ Failed to convert PDF to images!")
            return
        
        # Step 4: Extract text
        text = extract_text_from_images()
        if not text.strip():
            print("❌ No text extracted from PDF!")
            return
        
        print(f"✅ Extracted text from {num_pages} pages")
        
        # Step 5: Generate study material
        print(f"🤖 Creating your personalized study material...")
        study_material = generate_study_material(text, format_choice)
        
        if not study_material.strip():
            print("❌ Failed to generate study material!")
            return
        
        # Step 6: Save files
        print("💾 Saving your study material...")
        text_path = save_text(study_material)
        pdf_path = save_pdf(study_material)
        
        # Step 7: Open files
        if text_path:
            open_file(text_path)
        if pdf_path:
            open_file(pdf_path)
        
        print("\n✅ All done! Your personalized study material is ready!")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Process interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
    finally:
        cleanup()

# -------------- RUN PROGRAM --------------
if __name__ == "__main__":
    main()





















