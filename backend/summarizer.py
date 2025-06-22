import google.generativeai as genai

genai.configure(api_key="AIzaSyADT2XPzUcY40XAzmCRSukwLknKcdv6JX4")

model = genai.GenerativeModel("gemini-pro")

def summarize_text(text):
    prompt = f"Summarize the following into clean, point-form study notes:\n\n{text}"
    response = model.generate_content(prompt)
    return response.text
