// Backend Integration Functions

const BACKEND_URL = 'http://localhost:5000';
const MOCK_MODE = false; // Set to false to use Gemini API
// Set the Gemini API keys
let GEMINI_API_KEY = 'AIzaSyCZdSouccMkv6RxBXR9NGZLJ65VJ1GuyFM';
let ALTERNATE_GEMINI_API_KEY = 'AIzaSyBPR11n7NPvgFT8IfAc7D-_kptyWSzq1Io';
let useAlternateKey = false;

// Function to get the current API key
function getCurrentApiKey() {
    return useAlternateKey ? ALTERNATE_GEMINI_API_KEY : GEMINI_API_KEY;
}

// Function to switch to the alternate key
function switchToAlternateKey() {
    useAlternateKey = true;
    console.log('Switching to alternate Gemini API key');
    return ALTERNATE_GEMINI_API_KEY;
}

// Show notification function
function showNotification(message, type = 'info') {
    // Check if the notification function exists in the window object
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        // Fallback to console
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

// Helper function to read PDF file content
async function readPdfFile(pdfFile) {
    try {
        if (pdfFile instanceof Blob || pdfFile instanceof File) {
            return await pdfFile.arrayBuffer();
        } else {
            console.error('Invalid PDF file format', pdfFile);
            throw new Error('Invalid PDF file format');
        }
    } catch (error) {
        console.error('Error reading PDF file:', error);
        throw error;
    }
}

async function processPDFWithBackend(pdfFile) {
    try {
        // Always use Gemini API since we have a key
        if (GEMINI_API_KEY && !MOCK_MODE) {
            return await processWithGeminiAPI(pdfFile);
        }
        
        // Try using local backend if not in mock mode
        if (!MOCK_MODE) {
            try {
                const formData = new FormData();
                formData.append('file', pdfFile);

                const response = await fetch(`${BACKEND_URL}/api/process-pdf`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    return data;
                }
            } catch (error) {
                console.error('Error with local backend:', error);
                showNotification('Backend server not available. Using alternative processing method...', 'warning');
            }
        }

        // Fall back to mock data if all else fails
        console.log("Using sample data");
        return mockProcessPDF(pdfFile);
    } catch (error) {
        console.error('Error processing PDF:', error);
        showNotification('Error processing PDF. Using sample data instead.', 'warning');
        
        // Fall back to mock data if all methods fail
        return mockProcessPDF(pdfFile);
    }
}

async function sendQueryToBackend(query, pdfText) {
    try {
        // Always use Gemini API since we have a key
        if (GEMINI_API_KEY && !MOCK_MODE) {
            return await queryWithGeminiAPI(query, pdfText);
        }
        
        // Try using local backend if not in mock mode
        if (!MOCK_MODE) {
            try {
                const response = await fetch(`${BACKEND_URL}/api/query`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query: query,
                        text: pdfText
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    return data.answer;
                }
            } catch (error) {
                console.error('Error with local backend:', error);
                showNotification('Backend server not available. Using alternative processing method...', 'warning');
            }
        }

        // Fall back to mock response if both methods fail
        return mockQueryResponse(query, pdfText);
    } catch (error) {
        console.error('Error getting answer:', error);
        showNotification('Error processing query. Using sample responses.', 'warning');
        
        // Fall back to mock responses if the backend request fails
        return mockQueryResponse(query, pdfText);
    }
}

// Function to process PDF with Gemini API directly from frontend
async function processWithGeminiAPI(pdfFile) {
    try {
        const pdfData = await readPdfFile(pdfFile);
        const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
        
        let pdfText = '';
        
        // Get total number of pages
        const totalPages = pdf.numPages;
        
        // Extract text from each page silently - don't create UI elements
        // as that's now handled by the pdf-viewer.js
        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            pdfText += textContent.items.map(item => item.str).join(' ');
        }
        
        // Generate summary silently - don't update UI directly here
        const summaryPrompt = `Please analyze the following PDF text and provide:
1. An ultra-concise summary (25-50 words maximum) that captures the essence of the document
2. 4 very short key points (5-10 words each) from the document

Keep all responses extremely concise and to the point.

PDF TEXT:
${pdfText.substring(0, 15000)}... (truncated for length)`;

        let currentKey = getCurrentApiKey();
        let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${currentKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: summaryPrompt
                    }]
                }]
            })
        });

        // If we get a 429 (rate limit exceeded) or other API error and we haven't tried the alternate key yet
        if (!response.ok && !useAlternateKey) {
            const errorData = await response.json();
            console.error('Gemini API error with primary key:', errorData);
            
            // Switch to the alternate key and retry
            currentKey = switchToAlternateKey();
            
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${currentKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: summaryPrompt
                        }]
                    }]
                })
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API error:', errorData);
            throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const generatedText = data.candidates[0].content.parts[0].text;
        
        // Parse the response to extract summary and key points
        const sections = generatedText.split('\n\n');
        let summary = '';
        let keyPoints = [];
        
        // Extract the summary (first section typically)
        if (sections.length > 0) {
            // Remove bold markdown formatting and ensure full content display
            summary = sections[0]
                .replace(/^(Summary|1\.)\s*:?\s*/i, '')
                .replace(/\*\*/g, '')
                .trim();
        }
        
        // Extract key points (look for numbered or bullet points)
        for (let i = 1; i < sections.length; i++) {
            const section = sections[i];
            if (section.includes('Key Points') || 
                section.includes('•') || 
                /\d+\.\s+/.test(section)) {
                
                const lines = section.split('\n');
                for (const line of lines) {
                    // Remove any markdown formatting, bullet points, and asterisks
                    const pointText = line
                        .replace(/^(\d+\.|•|\*)\s+/g, '')
                        .replace(/^\s*\*\s+/g, '')  // Remove asterisks at the beginning
                        .replace(/\*\*/g, '')
                        .trim();
                    if (pointText && !pointText.match(/^(Key Points|Points):?$/i)) {
                        keyPoints.push(pointText);
                    }
                }
                
                // If we found key points, break the loop
                if (keyPoints.length > 0) {
                    break;
                }
            }
        }
        
        // If we still don't have any key points and have more than one section,
        // use subsequent sections as key points
        if (keyPoints.length === 0 && sections.length > 1) {
            keyPoints = sections.slice(1, 6).map(s => s
                .replace(/^\s*\*\s+/g, '')  // Remove asterisks at the beginning
                .replace(/\*\*/g, '')
                .trim());
        }
        
        // Ensure we have 5-6 key points if possible
        if (keyPoints.length < 5 && sections.length > keyPoints.length) {
            // Extract more key points from additional sections
            const additionalPoints = sections.slice(keyPoints.length + 1)
                .map(s => s.replace(/\*\*/g, '').trim())
                .filter(s => s.length > 0);
                
            keyPoints = [...keyPoints, ...additionalPoints].slice(0, 6);
        }
        
        // Format the summary with key points, ensuring minimal space between points but maintaining readability
        const formattedSummary = summary + (keyPoints.length > 0 ? 
            '\n\nKey Points:\n' + keyPoints.map(point => point).join('\n') : 
            '');
        
        // Return the processed data - UI updates happen in pdf-viewer.js
        return {
            summary: formattedSummary,
            keyPoints: keyPoints
        };
    } catch (error) {
        console.error('Error processing with Gemini API:', error);
        return mockProcessPDF(pdfFile);
    }
}

// Post-process API responses to remove repetitive content
function postProcessApiResponse(response) {
    if (!response) return response;
    
    // Create a working copy
    let processedResponse = response;
    
    // Step 1: Enhanced removal of repetitive phrases using more sophisticated patterns
    const phrasesToRemove = [
        // Common introductory phrases
        { pattern: /(I appreciate your query[^.]*\.)\s*(I appreciate your|Let me|Based on)/i, replacement: '$1 ' },
        { pattern: /(Based on the (?:document|text|content)[^.]*\.)\s*(?:Based on|According to|As mentioned)/i, replacement: '$1 ' },
        { pattern: /(According to the (?:document|text|content)[^.]*\.)\s*(?:Based on|According to|As mentioned)/i, replacement: '$1 ' },
        { pattern: /(Looking at the (?:document|text|content)[^.]*\.)\s*(?:Based on|According to|As mentioned)/i, replacement: '$1 ' },
        { pattern: /(From the (?:document|text|content)[^.]*\.)\s*(?:Based on|According to|As mentioned)/i, replacement: '$1 ' },
        { pattern: /(Let me (?:explain|help you understand)[^.]*\.)\s*(?:Let me|I'll|To)/i, replacement: '$1 ' },
        { pattern: /(I can help you with that[^.]*\.)\s*(?:Let me|I'll|To)/i, replacement: '$1 ' },
        
        // Repeated exact sentences
        { pattern: /([^.!?]+[.!?])\s*\1/gi, replacement: '$1' },
        
        // Repeated explanatory phrases
        { pattern: /(This means[^.]*\.)\s*(?:This means|In other words|That is)/i, replacement: '$1 ' },
        { pattern: /(In other words[^.]*\.)\s*(?:This means|In other words|That is)/i, replacement: '$1 ' },
        { pattern: /(To clarify[^.]*\.)\s*(?:This means|In other words|To clarify)/i, replacement: '$1 ' },
    ];
    
    // Apply all phrase removals
    for (const { pattern, replacement } of phrasesToRemove) {
        processedResponse = processedResponse.replace(pattern, replacement);
    }
    
    // Step 2: Remove paragraphs that are nearly identical (similar content with minor variations)
    const paragraphs = processedResponse.split(/\n\n+/);
    const uniqueParagraphs = [];
    
    for (let i = 0; i < paragraphs.length; i++) {
        const currentPara = paragraphs[i].trim();
        let isDuplicate = false;
        
        if (!currentPara) continue;
        
        // Check if this paragraph is similar to any previous one
        for (const existingPara of uniqueParagraphs) {
            // Calculate similarity score (percentage of words in common)
            const currentWords = new Set(currentPara.toLowerCase().split(/\s+/).filter(word => word.length > 3));
            const existingWords = new Set(existingPara.toLowerCase().split(/\s+/).filter(word => word.length > 3));
            
            // Find common words
            const commonWords = [...currentWords].filter(word => existingWords.has(word));
            
            // Calculate similarity as percentage of words in common
            const similarityScore = commonWords.length / Math.min(currentWords.size, existingWords.size);
            
            // If more than 60% similar, consider it a duplicate
            if (similarityScore > 0.6) {
                isDuplicate = true;
                break;
            }
        }
        
        if (!isDuplicate) {
            uniqueParagraphs.push(currentPara);
        }
    }
    
    // Step 3: Process code blocks to avoid duplication
    let resultText = uniqueParagraphs.join('\n\n');
    
    // Extract and process all code blocks
    const codeBlockPattern = /```([\w]*)\n([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;
    
    // Find all code blocks
    while ((match = codeBlockPattern.exec(resultText)) !== null) {
        codeBlocks.push({
            fullMatch: match[0],
            language: match[1],
            code: match[2].trim(),
            // Create a normalized version for comparison (remove whitespace, comments, etc.)
            normalized: match[2].trim()
                .replace(/\s+/g, ' ')
                .replace(/\/\/[^\n]*/g, '') // Remove JavaScript/C-style single line comments
                .replace(/\/\*[\s\S]*?\*\//g, '') // Remove JavaScript/C-style multi-line comments
                .replace(/#[^\n]*/g, '') // Remove Python/Ruby style comments
                .toLowerCase()
        });
    }
    
    // Identify duplicate code blocks
    const duplicatesToRemove = new Set();
    for (let i = 0; i < codeBlocks.length; i++) {
        for (let j = i + 1; j < codeBlocks.length; j++) {
            // If code blocks have the same language and very similar content
            if (codeBlocks[i].language === codeBlocks[j].language &&
                (codeBlocks[i].normalized === codeBlocks[j].normalized ||
                 codeBlocks[i].normalized.includes(codeBlocks[j].normalized) ||
                 codeBlocks[j].normalized.includes(codeBlocks[i].normalized))) {
                
                // Keep the longer code block, remove the shorter one
                if (codeBlocks[i].code.length >= codeBlocks[j].code.length) {
                    duplicatesToRemove.add(j);
                } else {
                    duplicatesToRemove.add(i);
                }
            }
        }
    }
    
    // Remove duplicate code blocks (in reverse order to maintain indices)
    [...duplicatesToRemove].sort((a, b) => b - a).forEach(index => {
        resultText = resultText.replace(codeBlocks[index].fullMatch, '');
    });
    
    // Step 4: Clean up consecutive headings (## headings with no content between them)
    resultText = resultText.replace(/(?:^|\n)(#+\s+.*?)(?:\n#+\s+)/g, '$1\n\n');
    
    // Step 5: Remove repeated sentences at the end of one paragraph and beginning of next
    resultText = resultText.replace(/([^.!?]+[.!?])\s*\n\n\1/gi, '$1\n\n');
    
    // Step 6: Find and remove repetitive explanations of the same concept
    const concepts = [
        'function', 'method', 'class', 'object', 'array', 'variable', 'constant', 
        'loop', 'conditional', 'if', 'for', 'while', 'parameter', 'argument', 
        'return', 'value', 'string', 'boolean', 'number', 'integer', 'float'
    ];
    
    for (const concept of concepts) {
        // Find all sentences containing this concept
        const conceptRegex = new RegExp(`[^.!?]*\\b${concept}\\b[^.!?]*[.!?]`, 'gi');
        const conceptMatches = resultText.match(conceptRegex) || [];
        
        // If multiple sentences about the same concept, keep only the most detailed ones
        if (conceptMatches.length > 1) {
            // Sort by length (assuming longer explanations are more detailed)
            conceptMatches.sort((a, b) => b.length - a.length);
            
            // Keep the top 2 most detailed explanations, remove others
            for (let i = 2; i < conceptMatches.length; i++) {
                resultText = resultText.replace(conceptMatches[i], '');
            }
        }
    }
    
    // Final cleanup of multiple blank lines and whitespace
    resultText = resultText
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s+$/gm, '')  // Remove trailing whitespace from lines
        .trim();
    
    return resultText;
}

// Function to clean up headings and ensure they don't have bullet points
function cleanupHeadings(text) {
    // First, convert all ### headings to ## for consistent heading level
    let processedText = text.replace(/(^|\n)###\s+/gm, '$1## ');
    
    // Remove any bullet points from headings (but preserve bullet points in regular text)
    processedText = processedText.replace(/(^|\n)(##)\s*[-*•]\s+/gm, '$1$2 ');
    
    // Next, ensure there's a newline before headings (except at the very beginning of the text)
    processedText = processedText.replace(/([^\n])\n(##\s+)/g, '$1\n\n$2');
    
    // Make sure all regular paragraphs that aren't headings or bullet points get bullet points
    // This regex looks for lines that don't start with ## or bullet point markers
    processedText = processedText.replace(/(^|\n)(?!(##\s+|[-*•]\s+))([^\n]+)/gm, '$1- $3');
    
    // Fix any cases where we might have accidentally doubled bullet points
    processedText = processedText.replace(/(^|\n)-\s+[-*•]\s+/gm, '$1- ');
    
    // Add extra spacing after sections (look for bullet points followed by headings)
    processedText = processedText.replace(/(^|\n)([-*•][^\n]+)(\n+)(##)/gm, '$1$2\n\n$4');
    
    return processedText;
}

// Mock functions for testing without a backend
function mockProcessPDF(pdfFile) {
    // Return a much shorter summary and very concise key points
    return {
        summary: "Technical report covering key methodology and findings with recommendations.",
        keyPoints: [
            "Structured data collection approach.",
            "Significant patterns in research results.",
            "Evidence-based conclusions presented.",
            "Actionable implementation recommendations."
        ]
    };
}

function mockQueryResponse(query, pdfText) {
    // Define responses for topics with detailed explanations
    const detailedResponses = {
        default: "Based on the document, I can see that this topic is discussed in detail across several sections. The document provides a thorough analysis with supporting evidence and refers to several authoritative sources. Would you like me to elaborate on any specific aspect of this topic?",
        
        hello: "Hello! I'm your AI assistant for this PDF document. How can I help you understand this content better?",
        
        summary: "This document provides a comprehensive overview of the topic with detailed analysis across several key areas.\n\nThe main findings suggest important implications for the field, and the authors have provided substantial evidence to support their conclusions.\n\nThe document is well-structured with clear sections covering methodology, results, discussion, and recommendations.",
        
        methodology: "The methodology described in this document involves a mixed-methods approach combining both qualitative and quantitative data collection.\n\nThe researchers used surveys, interviews, and statistical analysis to ensure comprehensive results. The sample size appears to be statistically significant, and appropriate controls were implemented to minimize bias.",
        
        findings: "The key findings from this document include several important discoveries that contribute to the field.\n\nThe data shows statistically significant results in the primary areas of investigation, with particularly strong correlations between the main variables studied.\n\nThese findings are consistent with previous research while also offering new insights.",
        
        recommendations: "The document provides several actionable recommendations based on the findings.\n\nImplementing new approaches\nThe document suggests implementing novel methodologies to address identified challenges.\n\nAllocating resources effectively\nPrioritizing resource allocation based on impact metrics is recommended.\n\nDeveloping enhanced frameworks\nEstablishing comprehensive analytical frameworks for future research and implementation.\n\nThese recommendations are prioritized according to feasibility and potential impact.",
        
        limitations: "The authors acknowledge several limitations in their research.\n\nSample size constraints\nCertain demographic groups had limited representation in the study.\n\nRegional biases\nData collection was focused on specific geographic areas, potentially limiting generalizability.\n\nTime constraints\nThe time-limited nature of the study prevented longitudinal analysis.\n\nFuture research recommendations include expanded sampling methodologies and longitudinal studies to address these limitations."
    };

    // Define brief mention responses with helpful explanations
    const briefMentionTopics = {
        'climate change': "This document only briefly mentions climate change. Here's a helpful explanation:\n\n\n\nIntroduction\nClimate change refers to long-term shifts in temperatures and weather patterns, primarily driven by human activities since the industrial revolution.\n\nCauses\nThe burning of fossil fuels like coal, oil, and gas produces heat-trapping greenhouse gases that warm the planet's surface and atmosphere.\n\nEffects\nRising global temperatures lead to melting ice caps, rising sea levels, and increasingly extreme weather events including droughts, floods, and severe storms.\n\nEcological Impact\nClimate change threatens biodiversity as ecosystems struggle to adapt to rapidly changing conditions, potentially leading to mass extinctions.\n\nHuman Impact\nChanging climate patterns affect agriculture, water resources, and human health, with disproportionate effects on vulnerable populations.",
        
        'artificial intelligence': "This document only briefly mentions artificial intelligence. Here's a helpful explanation:\n\n\n\nIntroduction\nArtificial Intelligence (AI) refers to computer systems designed to perform tasks that typically require human intelligence, including learning, reasoning, and problem-solving.\n\nTypes of AI\nNarrow AI is designed for specific tasks like voice recognition, while general AI aims to perform any intellectual task a human can do.\n\nMachine Learning\nA subset of AI where systems learn patterns from data without explicit programming, improving with experience.\n\nDeep Learning\nA specialized form of machine learning using neural networks with multiple layers to analyze complex patterns.\n\nApplications\nAI is used across industries including healthcare (diagnostics), finance (fraud detection), transportation (autonomous vehicles), and everyday consumer applications like virtual assistants.",
        
        'quantum physics': "This document only briefly mentions quantum physics. Here's a helpful explanation:\n\n\n\nIntroduction\nQuantum physics is a branch of physics that studies the behavior of matter and energy at the smallest scales, particularly at the level of atoms and subatomic particles.\n\nWave-Particle Duality\nAt the quantum level, particles like electrons and photons exhibit properties of both waves and particles simultaneously.\n\nQuantum Entanglement\nWhen particles become entangled, the state of one particle instantaneously affects the state of another, regardless of distance.\n\nQuantum Superposition\nParticles can exist in multiple states simultaneously until measured or observed.\n\nPractical Applications\nQuantum principles have led to technologies like lasers, transistors, and are foundational to developing quantum computers that could revolutionize computing power and cryptography.",
        
        'blockchain': "This document only briefly mentions blockchain. Here's a helpful explanation:\n\n\n\nIntroduction\nBlockchain is a distributed database or ledger technology where information is stored in blocks that are linked together in a secure, chronological chain.\n\nKey Characteristics\nEach block contains transaction data, a timestamp, and a cryptographic link to the previous block, making the data highly secure and resistant to modification.\n\nDecentralization\nBlockchain operates on a peer-to-peer network without central authority, with transactions verified by network consensus rather than a single entity.\n\nApplications Beyond Cryptocurrency\nWhile blockchain powers cryptocurrencies like Bitcoin, its applications extend to supply chain management, voting systems, smart contracts, and digital identity verification.\n\nSecurity Features\nThe distributed nature and cryptographic protection make blockchain highly secure against fraud and tampering, though not completely immune to all vulnerabilities.",
        
        'neural networks': "This document only briefly mentions neural networks. Here's a helpful explanation:\n\n\n\nIntroduction\nNeural networks are computing systems inspired by the human brain's biological neural networks, consisting of interconnected nodes or 'neurons' that process information.\n\nStructure\nA typical neural network contains an input layer that receives data, hidden layers that perform computations, and an output layer that produces results.\n\nLearning Process\nNeural networks learn through training with large datasets, adjusting connection weights between neurons to minimize errors and optimize outcomes.\n\nDeep Neural Networks\nNetworks with many hidden layers can identify complex patterns and relationships in data, powering advances in image recognition, natural language processing, and other domains.\n\nPractical Applications\nNeural networks drive technologies like facial recognition, language translation, recommendation systems, medical diagnostics, and autonomous vehicles.",
        
        'cryptocurrency': "This document only briefly mentions cryptocurrency. Here's a helpful explanation:\n\n\n\nIntroduction\nCryptocurrency is a digital or virtual currency that uses cryptography for security and operates on decentralized networks based on blockchain technology.\n\nDecentralized Nature\nUnlike traditional currencies issued by governments, cryptocurrencies typically operate independently of central banks, with transactions verified by network nodes through cryptography.\n\nPopular Cryptocurrencies\nBitcoin, created in 2009, was the first cryptocurrency. Others include Ethereum, which supports smart contracts, and stablecoins that attempt to maintain price stability.\n\nTransaction Process\nCryptocurrency transactions are recorded on a distributed public ledger called a blockchain, ensuring transparency and security.\n\nVolatility and Regulation\nCryptocurrencies are known for price volatility and face varying regulatory approaches across different countries, from full adoption to outright bans.",
        
        'python programming': "This document only briefly mentions Python programming. Here's a helpful explanation:\n\n\n\n## Python Programming\nPython is a high-level, interpreted programming language known for its readability and simplicity. It supports multiple programming paradigms including procedural, object-oriented, and functional programming.\n\n### Key Features\n- Simple, readable syntax with whitespace indentation\n- Dynamic typing and memory management\n- Extensive standard library and third-party packages\n- Cross-platform compatibility\n\n### Popular Applications\n\n#### Web Development\nFrameworks like Django and Flask enable building robust web applications efficiently.\n\n#### Data Science\nLibraries including Pandas, NumPy, and Matplotlib make Python ideal for data analysis.\n\n#### Machine Learning\nTensorFlow, PyTorch, and scikit-learn facilitate creating sophisticated models.\n\n```python\n# Simple Python example\ndef greet(name):\n    return f\"Hello, {name}!\"\n\nprint(greet(\"World\"))  # Output: Hello, World!\n```"
    };

    // Add programming-related topics with well-formatted code examples
    const codeExamples = {
        'python pattern': `## Python Pattern Programs

Method 1: Using Nested Loops

\`\`\`python
for i in range(1, 4):  
    for j in range(1, (5 if i == 3 else 1) + 1):  
        print(2 * (j + (i - 1) * (4 if i == 3 else 0)), end=(" " if i == 3 else "\\n"))  
\`\`\`

Explanation:
The outer loop controls the number of rows.
The inner loop determines how many elements are in each row.
The end parameter ensures correct spacing and line breaks.

Method 2: Using a Single Loop and String Formatting

\`\`\`python
output = ""  
for i in range(2, 20, 2):  
    output += str(i) + (" " if i < 18 else "")  
    if i == 2 or i == 8:  
        output += "\\n"  
print(output)  
\`\`\`

Explanation:
The loop iterates through even numbers from 2 to 18.
A formatted string is created, adding spaces and newlines for correct output structure.

Method 3: Using List Comprehension and join()

\`\`\`python
numbers = [str(i) for i in range(2, 20, 2)]  
print("\\n".join([" ".join(numbers[:1]), " ".join(numbers[1:5]), " ".join(numbers[5:])]))  
\`\`\`

Explanation:
List comprehension generates numbers as a list of strings.
The join() method structures the output properly with spaces and line breaks.

Expected Output:

\`\`\`
2  
4 6 8  
10 12 14 16 18  
\`\`\``,

        'javascript function': `## JavaScript Functions: An Overview

Introduction
Functions are one of the fundamental building blocks in JavaScript. They allow you to define reusable blocks of code that can be executed when needed.

Method 1: Function Declaration

\`\`\`javascript
// Function declaration
function calculateArea(width, height) {
    // Calculate area of rectangle
    const area = width * height;
    return area;
}

// Function call
const rectangleArea = calculateArea(5, 10);
console.log(rectangleArea); // Output: 50
\`\`\`

Explanation:
The function is declared using the 'function' keyword followed by a name.
Parameters (width, height) are specified in parentheses.
The function body contains the calculation logic.
The 'return' statement sends the result back to the caller.

Method 2: Function Expression

\`\`\`javascript
// Function expression
const calculatePerimeter = function(width, height) {
    // Calculate perimeter of rectangle
    return 2 * (width + height);
};

// Function call
const rectanglePerimeter = calculatePerimeter(5, 10);
console.log(rectanglePerimeter); // Output: 30
\`\`\`

Explanation:
The function is assigned to a variable as an expression.
No function name is required (it's an anonymous function).
Function expressions are not hoisted like function declarations.

Method 3: Arrow Functions (ES6+)

\`\`\`javascript
// Arrow function
const calculateVolume = (width, height, depth) => {
    // Calculate volume of cuboid
    return width * height * depth;
};

// Simplified arrow function (one-liner)
const calculateDiagonal = (width, height) => Math.sqrt(width**2 + height**2);

// Function calls
console.log(calculateVolume(5, 10, 3)); // Output: 150
console.log(calculateDiagonal(3, 4));   // Output: 5
\`\`\`

Explanation:
Arrow functions provide a more concise syntax for writing functions.
The 'return' keyword can be omitted for single-expression functions.
Arrow functions inherit 'this' from their surrounding context.`,

        'java classes': `## Java Classes and Objects

Java classes are templates for creating objects, providing initial values for state (member variables) and implementations of behavior (member functions).

Method 1: Basic Class Structure

\`\`\`java
// Define a simple Rectangle class
public class Rectangle {
    // Instance variables
    private double width;
    private double height;
    
    // Constructor
    public Rectangle(double width, double height) {
        this.width = width;
        this.height = height;
    }
    
    // Method to calculate area
    public double calculateArea() {
        return width * height;
    }
    
    // Method to calculate perimeter
    public double calculatePerimeter() {
        return 2 * (width + height);
    }
    
    // Getters and setters
    public double getWidth() {
        return width;
    }
    
    public void setWidth(double width) {
        this.width = width;
    }
    
    public double getHeight() {
        return height;
    }
    
    public void setHeight(double height) {
        this.height = height;
    }
}

// Using the Rectangle class
public class Main {
    public static void main(String[] args) {
        Rectangle rect = new Rectangle(5, 10);
        System.out.println("Area: " + rect.calculateArea());       // Output: Area: 50.0
        System.out.println("Perimeter: " + rect.calculatePerimeter()); // Output: Perimeter: 30.0
    }
}
\`\`\`

Method 2: Inheritance

\`\`\`java
// Parent class
public class Shape {
    protected String color;
    
    public Shape(String color) {
        this.color = color;
    }
    
    public String getColor() {
        return color;
    }
    
    // Method to be overridden by subclasses
    public double calculateArea() {
        return 0.0;
    }
}

// Child class
public class Circle extends Shape {
    private double radius;
    
    public Circle(String color, double radius) {
        super(color);
        this.radius = radius;
    }
    
    // Override the calculateArea method
    @Override
    public double calculateArea() {
        return Math.PI * radius * radius;
    }
}

// Usage
public class Main {
    public static void main(String[] args) {
        Circle circle = new Circle("Red", 5);
        System.out.println("Color: " + circle.getColor());     // Output: Color: Red
        System.out.println("Area: " + circle.calculateArea()); // Output: Area: 78.53981633974483
    }
}
\`\`\`

Explanation:
- Classes encapsulate data and behavior
- Constructors initialize objects
- Methods define behavior
- Inheritance allows creating specialized subclasses`,

        'cpp vectors': `## C++ Vectors

Vectors in C++ are sequence containers representing arrays that can change in size. They provide dynamic array functionality.

Method 1: Basic Vector Operations

\`\`\`cpp
#include <iostream>
#include <vector>

int main() {
    // Create an empty vector
    std::vector<int> numbers;
    
    // Add elements to the end
    numbers.push_back(10);
    numbers.push_back(20);
    numbers.push_back(30);
    
    // Access elements using index
    std::cout << "First element: " << numbers[0] << std::endl;  // Output: First element: 10
    
    // Get vector size
    std::cout << "Size: " << numbers.size() << std::endl;      // Output: Size: 3
    
    // Iterate through vector
    std::cout << "Elements: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;  // Output: Elements: 10 20 30
    
    // Remove last element
    numbers.pop_back();
    
    // Insert element at specific position
    numbers.insert(numbers.begin() + 1, 15);
    
    // Print modified vector
    std::cout << "Modified elements: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;  // Output: Modified elements: 10 15 20
    
    return 0;
}
\`\`\`

Method 2: Vector Algorithms with Standard Library

\`\`\`cpp
#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    // Initialize vector with values
    std::vector<int> numbers = {5, 2, 8, 1, 9, 3};
    
    // Sort the vector
    std::sort(numbers.begin(), numbers.end());
    
    // Print sorted vector
    std::cout << "Sorted: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;  // Output: Sorted: 1 2 3 5 8 9
    
    // Find element in vector
    auto it = std::find(numbers.begin(), numbers.end(), 5);
    if (it != numbers.end()) {
        std::cout << "Found 5 at position: " << (it - numbers.begin()) << std::endl;
    }
    
    // Sum all elements
    int sum = 0;
    for (int num : numbers) {
        sum += num;
    }
    std::cout << "Sum: " << sum << std::endl;  // Output: Sum: 28
    
    return 0;
}
\`\`\`

Explanation:
- Vectors are dynamic arrays that resize automatically
- push_back() adds elements to the end
- Access elements via [] operator or at()
- Standard library algorithms can operate on vectors
- Iterators provide a way to traverse elements`,

        'csharp linq': `## C# LINQ Examples

LINQ (Language Integrated Query) provides a consistent syntax for querying various data sources in C#.

Method 1: LINQ Query Syntax

\`\`\`csharp
using System;
using System.Collections.Generic;
using System.Linq;

class Program
{
    static void Main()
    {
        // Sample data
        List<int> numbers = new List<int> { 5, 10, 8, 3, 6, 12 };
        
        // Query syntax: Get even numbers greater than 5
        var evenNumbersQuery =
            from num in numbers
            where num > 5 && num % 2 == 0
            orderby num
            select num;
        
        // Display results
        Console.WriteLine("Even numbers greater than 5 (Query Syntax):");
        foreach (var num in evenNumbersQuery)
        {
            Console.Write($"{num} ");  // Output: 6 8 10 12
        }
        Console.WriteLine();
    }
}
\`\`\`

Method 2: LINQ Method Syntax

\`\`\`csharp
using System;
using System.Collections.Generic;
using System.Linq;

class Program
{
    static void Main()
    {
        // Sample data
        List<string> fruits = new List<string> 
        { 
            "apple", "banana", "orange", "grape", "kiwi", "pineapple" 
        };
        
        // Method syntax: Get fruits that have more than 5 characters
        var longFruits = fruits
            .Where(f => f.Length > 5)
            .OrderBy(f => f.Length)
            .Select(f => f);
        
        // Display results
        Console.WriteLine("Fruits with more than 5 characters:");
        foreach (var fruit in longFruits)
        {
            Console.WriteLine($"{fruit} ({fruit.Length} chars)");
        }
        // Output:
        // banana (6 chars)
        // orange (6 chars)
        // pineapple (9 chars)
        
        // LINQ aggregation methods
        int count = fruits.Count();
        string longest = fruits.OrderByDescending(f => f.Length).First();
        
        Console.WriteLine($"Total fruits: {count}");        // Output: Total fruits: 6
        Console.WriteLine($"Longest fruit: {longest}");     // Output: Longest fruit: pineapple
    }
}
\`\`\`

Method 3: LINQ with Complex Objects

\`\`\`csharp
using System;
using System.Collections.Generic;
using System.Linq;

class Student
{
    public int Id { get; set; }
    public string Name { get; set; }
    public int Age { get; set; }
    public List<string> Courses { get; set; }
}

class Program
{
    static void Main()
    {
        // Create sample data
        List<Student> students = new List<Student>
        {
            new Student { Id = 1, Name = "Alice", Age = 22, Courses = new List<string> { "Math", "Physics", "Chemistry" } },
            new Student { Id = 2, Name = "Bob", Age = 20, Courses = new List<string> { "History", "English", "Art" } },
            new Student { Id = 3, Name = "Charlie", Age = 22, Courses = new List<string> { "Physics", "Computer Science" } }
        };
        
        // Find students taking Physics
        var physicsStudents = students
            .Where(s => s.Courses.Contains("Physics"))
            .Select(s => s.Name);
        
        Console.WriteLine("Students taking Physics:");
        foreach (var name in physicsStudents)
        {
            Console.WriteLine(name);  // Output: Alice, Charlie
        }
        
        // Group students by age
        var studentsByAge = students
            .GroupBy(s => s.Age)
            .Select(g => new { Age = g.Key, Count = g.Count() });
        
        Console.WriteLine("\nStudents by age:");
        foreach (var group in studentsByAge)
        {
            Console.WriteLine($"Age {group.Age}: {group.Count} student(s)");
        }
        // Output:
        // Age 22: 2 student(s)
        // Age 20: 1 student(s)
    }
}
\`\`\`

Explanation:
- LINQ provides a unified way to query collections
- Query syntax resembles SQL
- Method syntax uses extension methods
- LINQ works with various data sources including collections, XML, and databases`,

        'data structures': `## Common Data Structures in Programming

Introduction
Data structures are specialized formats for organizing, processing, retrieving and storing data. Different data structures are suited for different kinds of applications, and some are highly specialized to specific tasks.

Arrays

\`\`\`python
# Creating and using arrays in Python
numbers = [1, 2, 3, 4, 5]
print(numbers[0])      # Access first element (Output: 1)
numbers.append(6)      # Add element to end
numbers.insert(2, 10)  # Insert element at index 2
print(numbers)         # Output: [1, 2, 10, 3, 4, 5, 6]
\`\`\`

Explanation:
Arrays store elements in contiguous memory locations.
They provide O(1) time complexity for access by index.
Insertion and deletion can be O(n) in worst case as elements may need to be shifted.

Linked Lists

\`\`\`python
# Implementing a linked list in Python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None
    
    def append(self, data):
        new_node = Node(data)
        if not self.head:
            self.head = new_node
            return
        
        current = self.head
        while current.next:
            current = current.next
        current.next = new_node
    
    def print_list(self):
        current = self.head
        while current:
            print(current.data, end=" -> ")
            current = current.next
        print("None")

# Usage
linked_list = LinkedList()
linked_list.append(1)
linked_list.append(2)
linked_list.append(3)
linked_list.print_list()  # Output: 1 -> 2 -> 3 -> None
\`\`\`

Explanation:
Linked lists store elements in nodes that point to the next node.
They provide O(1) insertion and deletion at known positions.
Access by index is O(n) as you must traverse from the head.

Hash Tables (Dictionaries)

\`\`\`python
# Using dictionaries in Python (hash tables)
student = {
    "name": "John",
    "age": 21,
    "major": "Computer Science",
    "gpa": 3.8
}

# Accessing elements
print(student["name"])  # Output: John

# Adding or modifying elements
student["year"] = "Senior"
student["gpa"] = 3.9

# Checking if a key exists
if "major" in student:
    print(f"Major: {student['major']}")
\`\`\`

Explanation:
Hash tables use a hash function to map keys to specific locations in memory.
They provide average O(1) time complexity for insertion, deletion, and lookup.
Hash collisions are handled through techniques like chaining or open addressing.

These are just a few of the many data structures used in programming. Each has its strengths and weaknesses, making them suitable for different scenarios based on the operations you need to perform.`
    };
    
    // Check if the query is about code examples
    for (const [topic, explanation] of Object.entries(codeExamples)) {
        if (query.toLowerCase().includes(topic)) {
            return explanation;
        }
    }
    
    // Check if the query matches any topic that's only briefly mentioned
    for (const [topic, explanation] of Object.entries(briefMentionTopics)) {
        if (query.toLowerCase().includes(topic)) {
            return explanation;
        }
    }

    // More sophisticated keyword matching for detailed responses
    if (query.toLowerCase().includes('hello') || query.toLowerCase().includes('hi')) {
        return detailedResponses.hello;
    } else if (query.toLowerCase().includes('summary') || query.toLowerCase().includes('summarize') || query.toLowerCase().includes('overview')) {
        return detailedResponses.summary;
    } else if (query.toLowerCase().includes('method') || query.toLowerCase().includes('approach') || query.toLowerCase().includes('how was') || query.toLowerCase().includes('how did')) {
        return detailedResponses.methodology;
    } else if (query.toLowerCase().includes('find') || query.toLowerCase().includes('discover') || query.toLowerCase().includes('result') || query.toLowerCase().includes('what did') || query.toLowerCase().includes('data show')) {
        return detailedResponses.findings;
    } else if (query.toLowerCase().includes('recommend') || query.toLowerCase().includes('suggest') || query.toLowerCase().includes('should') || query.toLowerCase().includes('action')) {
        return detailedResponses.recommendations;
    } else if (query.toLowerCase().includes('limit') || query.toLowerCase().includes('constraint') || query.toLowerCase().includes('restriction') || query.toLowerCase().includes('weakness')) {
        return detailedResponses.limitations;
    } else {
        return detailedResponses.default;
    }
}

// Function to query Gemini API directly from frontend
async function queryWithGeminiAPI(query, pdfText) {
    try {
        // Note: typing indicator is now managed by the pdf-viewer.js
        // We just process the query here
        
        // Create a prompt for Gemini API with detailed formatting instructions
        const prompt = `I have a PDF document with the following text. Please answer the question based only on the information in this document.

Document text:
${pdfText.substring(0, 15000)}... (truncated for length)

Question: ${query}

FORMATTING INSTRUCTIONS - FOLLOW THESE EXACTLY:
1. If the document only briefly mentions the topic without providing a substantial explanation, respond with: "This document only briefly mentions the topic without providing a detailed explanation. Here's what you should know:" Then add a line break before starting your explanation.

2. FORMAT YOUR RESPONSE PROPERLY:
   - Format each information point as a bullet point (- ) EXCEPT for headings
   - Headings should be plain text prefixed with ## (no bullet points)
   - All headings should be treated with equal importance using ## (don't use ### for subheadings)
   - Add a blank line BEFORE each heading
   - After each heading section (a heading and its bullet points), add an extra blank line
   - Keep responses concise (under 100 words per section)
   - Use clear headings for different topics/sections
   - DO NOT use bullet points or asterisks (*) in headings
   - Separate sections with new lines for readability
   - Highlight key terms in **bold** when needed within bullet points
   - IMPORTANT: DO NOT REPEAT the same content, explanations, or phrases multiple times in the response

3. STRUCTURE YOUR RESPONSE WITH:
   - ONE clear introductory bullet point to start
   - Well-spaced, organized sections (with blank lines before headings)
   - Every paragraph of content except headings should be formatted as a bullet point
   - Add a blank line after each main section before starting a new heading
   - Code blocks should appear after a bullet point
   - AVOID explaining the same concept multiple times in different sections

4. For programming-related questions:
   - IMPORTANT: Provide code examples for the SPECIFIC programming language mentioned in the query (e.g., JavaScript, Python, Java, C++, etc.)
   - Use proper formatting with triple backticks and language name (e.g., \`\`\`javascript)
   - Include multiple approaches/methods when relevant
   - Add brief explanatory text as bullet points after each code example
   - Show expected output where helpful
   - NEVER repeat the same code example or explanation twice
   
5. EXAMPLE RESPONSE FORMAT:
   - This is an introductory paragraph that explains the main concept briefly as a bullet point.

   ## First Main Topic
   - First point about the main topic with explanation.
   - Second important point with **key terms** highlighted.
   - Third point providing additional details.

   ## Second Main Topic
   - Additional details about a specific aspect.
   - Another bullet point with more information.
   
   \`\`\`javascript
   // Code example if relevant
   function example() {
       return "result";
   }
   \`\`\`
   
   - Explanation of what the code does as a bullet point.

Your answer (ensure all text except headings is formatted as bullet points, and use ## for all headings):`;

        let currentKey = getCurrentApiKey();
        let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${currentKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.8,
                    topK: 40
                }
            })
        });

        // If we get a 429 (rate limit exceeded) or other API error and we haven't tried the alternate key yet
        if (!response.ok && !useAlternateKey) {
            const errorData = await response.json();
            console.error('Gemini API error with primary key:', errorData);
            
            // Switch to the alternate key and retry
            currentKey = switchToAlternateKey();
            
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${currentKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        topP: 0.8,
                        topK: 40
                    }
                })
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API error:', errorData);
            throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const rawResponse = data.candidates[0].content.parts[0].text;
        
        // Post-process the response to remove repetitive content
        let processedResponse = postProcessApiResponse(rawResponse);
        
        // Apply heading formatting to ensure blank lines before headings
        processedResponse = cleanupHeadings(processedResponse);
        
        return processedResponse;
    } catch (error) {
        console.error('Error querying with Gemini API:', error);
        return mockQueryResponse(query, pdfText);
    }
}

// Export functions
window.backendIntegration = {
    processPDFWithBackend,
    sendQueryToBackend
}; 