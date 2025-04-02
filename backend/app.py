from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import PyPDF2
import os
from dotenv import load_dotenv
import tempfile

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure Google Gemini API
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-pro')

def extract_text_from_pdf(pdf_file):
    """Extract text from uploaded PDF file."""
    pdf_reader = PyPDF2.PdfReader(pdf_file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()
    return text

def generate_summary(text):
    """Generate a summary of the PDF content."""
    prompt = f"""Please provide a concise summary of the following text, including a brief description and key points:

{text[:4000]}  # Limiting text length for API

Please format the response as:
Description: [brief description]
Key Points:
1. [point 1]
2. [point 2]
..."""

    response = model.generate_content(prompt)
    return response.text

def generate_questions(text):
    """Generate relevant questions based on the PDF content."""
    prompt = f"""Based on the following text, generate 5 relevant questions that would help understand the content better:

{text[:4000]}

Please format the response as a list of questions, one per line."""

    response = model.generate_content(prompt)
    return response.text.split('\n')

def answer_query(text, query):
    """Answer user queries based on the PDF content."""
    prompt = f"""Based on the following text, please answer the question. If the answer cannot be found in the text, please say so.

Text:
{text[:4000]}

Question: {query}

Please provide a clear and concise answer."""

    response = model.generate_content(prompt)
    return response.text

@app.route('/api/process-pdf', methods=['POST'])
def process_pdf():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.endswith('.pdf'):
        return jsonify({'error': 'File must be a PDF'}), 400

    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            file.save(temp_file.name)
            text = extract_text_from_pdf(temp_file.name)
        
        # Generate summary and questions
        summary = generate_summary(text)
        questions = generate_questions(text)
        
        # Clean up temporary file
        os.unlink(temp_file.name)
        
        return jsonify({
            'summary': summary,
            'questions': questions
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/query', methods=['POST'])
def handle_query():
    data = request.json
    if not data or 'query' not in data or 'text' not in data:
        return jsonify({'error': 'Missing query or text'}), 400
    
    try:
        answer = answer_query(data['text'], data['query'])
        return jsonify({'answer': answer})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 