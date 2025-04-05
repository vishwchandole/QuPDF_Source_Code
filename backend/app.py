from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import PyPDF2
import os
from dotenv import load_dotenv
import tempfile
import re

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

def post_process_response(text):
    """Process the response to eliminate repetitive content"""
    if not text:
        return text
    
    import re
    
    # Step 1: Enhanced removal of repetitive phrases using more sophisticated patterns
    phrases_to_remove = [
        # Common introductory phrases
        (r'(I appreciate your query[^.]*\.)\s*(I appreciate your|Let me|Based on)', r'\1 '),
        (r'(Based on the (?:document|text|content)[^.]*\.)\s*(?:Based on|According to|As mentioned)', r'\1 '),
        (r'(According to the (?:document|text|content)[^.]*\.)\s*(?:Based on|According to|As mentioned)', r'\1 '),
        (r'(Looking at the (?:document|text|content)[^.]*\.)\s*(?:Based on|According to|As mentioned)', r'\1 '),
        (r'(From the (?:document|text|content)[^.]*\.)\s*(?:Based on|According to|As mentioned)', r'\1 '),
        (r'(Let me (?:explain|help you understand)[^.]*\.)\s*(?:Let me|I\'ll|To)', r'\1 '),
        (r'(I can help you with that[^.]*\.)\s*(?:Let me|I\'ll|To)', r'\1 '),
        
        # Repeated exact sentences
        (r'([^.!?]+[.!?])\s*\1', r'\1'),
        
        # Repeated explanatory phrases
        (r'(This means[^.]*\.)\s*(?:This means|In other words|That is)', r'\1 '),
        (r'(In other words[^.]*\.)\s*(?:This means|In other words|That is)', r'\1 '),
        (r'(To clarify[^.]*\.)\s*(?:This means|In other words|To clarify)', r'\1 '),
    ]
    
    processed_text = text
    
    # Apply all phrase removals
    for pattern, replacement in phrases_to_remove:
        processed_text = re.sub(pattern, replacement, processed_text, flags=re.IGNORECASE)
    
    # Step 2: Remove paragraphs that are nearly identical (similar content with minor variations)
    paragraphs = re.split(r'\n\n+', processed_text)
    unique_paragraphs = []
    
    for para in paragraphs:
        current_para = para.strip()
        if not current_para:
            continue
            
        is_duplicate = False
        
        # Check if this paragraph is similar to any previous one
        for existing_para in unique_paragraphs:
            # Calculate similarity score (percentage of words in common)
            current_words = set([w.lower() for w in re.findall(r'\b\w{4,}\b', current_para)])
            existing_words = set([w.lower() for w in re.findall(r'\b\w{4,}\b', existing_para)])
            
            if not current_words or not existing_words:
                continue
                
            # Find common words
            common_words = current_words.intersection(existing_words)
            
            # Calculate similarity as percentage of words in common
            similarity_score = len(common_words) / min(len(current_words), len(existing_words))
            
            # If more than 60% similar, consider it a duplicate
            if similarity_score > 0.6:
                is_duplicate = True
                break
                
        if not is_duplicate:
            unique_paragraphs.append(current_para)
    
    # Step 3: Process code blocks to avoid duplication
    result_text = '\n\n'.join(unique_paragraphs)
    
    # Extract and process all code blocks
    code_blocks = []
    for match in re.finditer(r'```([\w]*)\n([\s\S]*?)```', result_text):
        # Create a normalized version for comparison (remove whitespace, comments, etc.)
        code = match.group(2).strip()
        normalized = re.sub(r'\s+', ' ', code)
        normalized = re.sub(r'//[^\n]*', '', normalized)  # Remove JavaScript/C-style single line comments
        normalized = re.sub(r'/\*[\s\S]*?\*/', '', normalized)  # Remove JavaScript/C-style multi-line comments
        normalized = re.sub(r'#[^\n]*', '', normalized)  # Remove Python/Ruby style comments
        normalized = normalized.lower()
        
        code_blocks.append({
            'full_match': match.group(0),
            'language': match.group(1),
            'code': code,
            'normalized': normalized,
            'start': match.start(),
            'end': match.end()
        })
    
    # Identify duplicate code blocks
    duplicates_to_remove = set()
    for i in range(len(code_blocks)):
        for j in range(i + 1, len(code_blocks)):
            # If code blocks have the same language and very similar content
            if (code_blocks[i]['language'] == code_blocks[j]['language'] and
                (code_blocks[i]['normalized'] == code_blocks[j]['normalized'] or
                 code_blocks[i]['normalized'] in code_blocks[j]['normalized'] or
                 code_blocks[j]['normalized'] in code_blocks[i]['normalized'])):
                
                # Keep the longer code block, remove the shorter one
                if len(code_blocks[i]['code']) >= len(code_blocks[j]['code']):
                    duplicates_to_remove.add(j)
                else:
                    duplicates_to_remove.add(i)
    
    # Remove duplicate code blocks (in reverse order of position to maintain indices)
    for idx in sorted([i for i in duplicates_to_remove], key=lambda x: code_blocks[x]['start'], reverse=True):
        full_match = code_blocks[idx]['full_match']
        result_text = result_text.replace(full_match, '')
    
    # Step 4: Clean up consecutive headings (## headings with no content between them)
    result_text = re.sub(r'(?:^|\n)(#+\s+.*?)(?:\n#+\s+)', r'\1\n\n', result_text)
    
    # Step 5: Remove repeated sentences at the end of one paragraph and beginning of next
    result_text = re.sub(r'([^.!?]+[.!?])\s*\n\n\1', r'\1\n\n', result_text, flags=re.IGNORECASE)
    
    # Step 6: Find and remove repetitive explanations of the same concept
    concepts = [
        'function', 'method', 'class', 'object', 'array', 'variable', 'constant', 
        'loop', 'conditional', 'if', 'for', 'while', 'parameter', 'argument', 
        'return', 'value', 'string', 'boolean', 'number', 'integer', 'float'
    ]
    
    for concept in concepts:
        concept_pattern = fr'[^.!?]*\b{concept}\b[^.!?]*[.!?]'
        concept_matches = re.findall(concept_pattern, result_text, re.IGNORECASE)
        
        # If multiple sentences about the same concept, keep only the most detailed ones
        if len(concept_matches) > 1:
            # Sort by length (assuming longer explanations are more detailed)
            concept_matches.sort(key=len, reverse=True)
            
            # Keep the top 2 most detailed explanations, remove others
            for duplicate in concept_matches[2:]:
                result_text = result_text.replace(duplicate, '')
    
    # Final cleanup of multiple blank lines and whitespace
    result_text = re.sub(r'\n{3,}', '\n\n', result_text)
    result_text = re.sub(r'\s+$', '', result_text, flags=re.MULTILINE)  # Remove trailing whitespace from lines
    
    return result_text.strip()

def answer_query(text, query):
    """Answer user queries based on the PDF content."""
    prompt = f"""Based on the following text, please answer the question. If the answer cannot be found in the text, please say so.

Text:
{text[:4000]}

Question: {query}

GUIDELINES FOR YOUR RESPONSE:
1. Provide a clear, concise answer based on the document content.
2. If answering a programming question:
   - Provide code examples in the SPECIFIC language mentioned (e.g., Python, JavaScript, Java, C++, etc.)
   - Use proper formatting with triple backticks and language name
   - Include multiple approaches when relevant
   - Keep explanations brief and focused
   - NEVER repeat the same code example or explanation twice
3. FORMAT PROPERLY:
   - Use headings with ## for main topics
   - Use bullet points for lists
   - Separate sections with new lines
   - DO NOT repeat the same content, explanations, or phrases multiple times in the response
   - Keep ONE clear introduction and avoid reintroducing topics
4. IMPORTANT: Keep responses focused and NEVER use redundant phrases like "I appreciate your query"
5. If the document only briefly mentions the topic without detail, say "This document only briefly mentions the topic" and provide a helpful, well-structured explanation.

Your concise answer without repetition:"""

    response = model.generate_content(prompt)
    # Post-process the response to remove repetitive content
    processed_response = post_process_response(response.text)
    return processed_response

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