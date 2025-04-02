# QuPDF - PDF Viewer with AI Chat

QuPDF is a web application that allows users to view PDF documents and interact with an AI assistant to get summaries, ask questions, and receive answers based on the PDF content.

## Features

- PDF viewing with zoom and navigation controls
- Text search within PDF documents
- Text highlighting functionality
- AI-powered PDF summary generation
- AI-generated suggested questions
- Interactive chat interface for asking questions about the PDF content
- Share and export chat functionality

## Prerequisites

- Python 3.7 or higher
- Google Gemini API key
- Modern web browser with JavaScript enabled

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd qupdf
```

2. Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt
```

3. Set up environment variables:
   - Create a `.env` file in the `backend` directory
   - Add your Google Gemini API key:
     ```
     GOOGLE_API_KEY=your_api_key_here
     ```

4. Start the backend server:
```bash
cd backend
python app.py
```

5. Open the frontend:
   - Navigate to the project root directory
   - Open `index.html` in your web browser

## Usage

1. Upload a PDF file through the home page
2. View the PDF in the viewer interface
3. Use the AI chat interface to:
   - Get a summary of the PDF content
   - View suggested questions
   - Ask your own questions about the content

## Technologies Used

- Frontend:
  - HTML5
  - CSS3
  - JavaScript
  - PDF.js for PDF rendering

- Backend:
  - Python
  - Flask
  - Google Gemini API
  - PyPDF2 for PDF text extraction

## Security Notes

- Never commit your `.env` file or expose your API keys
- The application processes PDFs locally and only sends text content to the AI API
- All communication with the backend is done over HTTP (consider using HTTPS in production)

## License

[Your chosen license] 