// PDF Viewer and Chat Interface JavaScript

// Global variables
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.0;
let canvas = document.getElementById('pdf-canvas');
let ctx = canvas.getContext('2d');
let currentPDF = null;
let pdfData = null;
let textLayerDiv = null;
let selectedText = '';
let chatHistory = [];
let allPagesRendered = false;
let canvasElements = []; // Array to store all canvas elements
let searchResults = [];
let currentSearchIndex = -1;

// DOM Elements
const prevButton = document.getElementById('prev-page');
const nextButton = document.getElementById('next-page');
const currentPageSpan = document.getElementById('current-page');
const totalPagesSpan = document.getElementById('total-pages');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const resetZoomButton = document.getElementById('reset-zoom');
const zoomLevelSpan = document.getElementById('zoom-level');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-btn');
const downloadButton = document.getElementById('download-btn');
const backButton = document.getElementById('back-to-home');
const pdfTitle = document.getElementById('pdf-title');
const chatInput = document.getElementById('chat-input');
const sendMessageButton = document.getElementById('send-message');
const chatMessages = document.getElementById('chat-messages');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notification-message');
const notificationClose = document.getElementById('notification-close');
const pdfContainer = document.querySelector('.pdf-container');
const exportChatButton = document.getElementById('export-chat');
const deleteChatButton = document.getElementById('delete-chat');
const resizer = document.getElementById('resizer');
const pdfViewerSection = document.querySelector('.pdf-viewer-section');
const chatSection = document.querySelector('.chat-section');

// Initialize the viewer
document.addEventListener('DOMContentLoaded', function() {
    // Add custom styles for clean headings
    addCustomStyles();
    
    // Reset notification state
    if (notification) {
        notification.classList.remove('show');
        if (notificationMessage) {
            notificationMessage.textContent = '';
        }
    }
    
    // Initialize canvas and context
    canvas = document.getElementById('pdf-canvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
    } else {
        console.error("PDF canvas element not found");
        showNotification("Error: PDF canvas element not found", "error");
        return;
    }
    
    // Check if PDF data is in sessionStorage
    const storedPdfData = sessionStorage.getItem('pdfData');
    const storedPdfName = sessionStorage.getItem('pdfName');
    
    if (storedPdfData) {
        // Load the PDF from stored data
        pdfData = storedPdfData;
        if (storedPdfName) {
            pdfTitle.textContent = storedPdfName;
        }
        loadPdfFromData(storedPdfData);
    } else {
        // Show message that no PDF was loaded
        showNotification("No PDF loaded. Please upload a PDF from the home page.", "error");
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up resizer
    setupResizer();
});

// Set up all event listeners
function setupEventListeners() {
    // PDF navigation
    prevButton.addEventListener('click', onPrevPage);
    nextButton.addEventListener('click', onNextPage);
    
    // Zoom controls
    zoomInButton.addEventListener('click', zoomIn);
    zoomOutButton.addEventListener('click', zoomOut);
    resetZoomButton.addEventListener('click', resetZoom);
    
    // Search functionality
    searchButton.addEventListener('click', search);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            search();
        }
    });
    
    // Adjust search input width based on content
    searchInput.addEventListener('input', function() {
        if (this.value.trim() === '') {
            clearSearchHighlights();
            // Reset to default width
            document.querySelector('.pdf-search').style.maxWidth = '220px';
        } else {
            // Adjust width based on content length (20px per character with a min of 220px and max of 320px)
            const textLength = this.value.length;
            const newWidth = Math.max(220, Math.min(320, 220 + (textLength * 8)));
            document.querySelector('.pdf-search').style.maxWidth = `${newWidth}px`;
        }
    });
    
    // Download PDF
    downloadButton.addEventListener('click', downloadPdf);
    
    // Back to home
    backButton.addEventListener('click', function() {
        window.location.href = 'index.html';
    });
    
    // Chat functionality
    if (sendMessageButton) {
        sendMessageButton.addEventListener('click', sendMessage);
    } else {
        console.error("Send message button not found");
    }
    
    if (chatInput) {
        // Handle Enter key for sending message
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Auto-resize chat input based on content
        chatInput.addEventListener('input', autoResizeChatInput);
        
        // Ensure the chat input is properly initialized
        chatInput.value = '';
        chatInput.style.height = 'auto';
        chatInput.style.display = 'block'; // Make sure it's visible
        
        // Focus the chat input
        setTimeout(() => {
            chatInput.focus();
        }, 500);
        
        // Initial call to set correct height
        autoResizeChatInput.call(chatInput);
    } else {
        console.error("Chat input element not found");
    }
    
    // Export and delete chat
    if (exportChatButton) exportChatButton.addEventListener('click', exportChat);
    if (deleteChatButton) deleteChatButton.addEventListener('click', clearChat);
    
    // Notification close
    if (notificationClose) {
        notificationClose.addEventListener('click', function() {
            notification.classList.remove('show');
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Check if no input is focused
        if (document.activeElement === document.body || document.activeElement === document.documentElement) {
            if (e.key === 'ArrowLeft' || e.key === 'p') {
                onPrevPage();
            } else if (e.key === 'ArrowRight' || e.key === 'n') {
                onNextPage();
            } else if (e.key === '+' || e.key === '=') {
                zoomIn();
            } else if (e.key === '-') {
                zoomOut();
            } else if (e.key === '0') {
                resetZoom();
            }
        }
    });
    
    // Add button press effect to all buttons
    document.querySelectorAll('button').forEach(button => {
        addButtonPressEffect(button);
    });
    
    // Add text selection event listener
    document.addEventListener('mouseup', handleHighlight);
    
    // Set up toggle PDF button for responsive views
    setupTogglePdfButton();
}

// Auto-resize textarea based on content
function autoResizeChatInput() {
    // Reset height to auto to get the correct scrollHeight
    this.style.height = 'auto';
    
    // Get the scrollHeight (actual content height)
    const scrollHeight = this.scrollHeight;
    
    // Calculate new height (with min and max constraints)
    const newHeight = Math.min(Math.max(scrollHeight, 48), 150);
    
    // Apply the new height
    this.style.height = newHeight + 'px';
    
    // Show/hide scrollbar based on content
    if (scrollHeight > 150) {
        this.style.overflowY = 'auto';
    } else {
        this.style.overflowY = 'hidden';
    }
    
    // Adjust chat container to make room for expanded input
    const chatMessages = document.querySelector('.chat-messages');
    if (chatMessages) {
        const inputContainer = document.querySelector('.chat-input-container');
        const inputHeight = inputContainer.offsetHeight;
        chatMessages.style.height = `calc(100% - ${inputHeight}px)`;
    }
}

// Setup resizer for adjusting panel widths
function setupResizer() {
    let isResizing = false;
    
    if (!resizer) {
        console.error("Resizer element not found");
        return;
    }
    
    resizer.addEventListener('mousedown', function(e) {
        isResizing = true;
        resizer.classList.add('active');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        
        const containerRect = document.querySelector('.pdf-chat-container').getBoundingClientRect();
        const containerWidth = containerRect.width;
        const mouseX = e.clientX - containerRect.left;
        
        // Calculate percentages
        const pdfSectionWidth = Math.max(30, Math.min(70, (mouseX / containerWidth) * 100));
        const chatSectionWidth = 100 - pdfSectionWidth;
        
        // Apply new widths
        pdfViewerSection.style.width = `${pdfSectionWidth}%`;
        chatSection.style.width = `${chatSectionWidth}%`;
        
        // Re-render PDF with new container size
        if (pdfDoc) {
            renderPage(pageNum);
        }
    });
    
    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// Add button press effect
function addButtonPressEffect(button) {
    button.addEventListener('mousedown', function() {
        this.classList.add('button-press');
    });
    
    button.addEventListener('mouseup mouseout', function() {
        this.classList.remove('button-press');
    });
}

// Add this new function after the loadPdfFromData function
function displayPdfSummary() {
    // Clear existing chat messages
    chatMessages.innerHTML = '';
    
    // Add welcome message with QuPDF branding
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'message system-message welcome-message';
    welcomeMessage.innerHTML = `
        <div class="">
            <div class="welcome-header">
                <h2>Welcome to <img src="assests/QuPDF.svg" alt="QuPDF Logo" class="welcome-logo-text"></h2>
            </div>
            <p class="welcome-text">Your intelligent PDF companion is ready to help you explore and understand your document.</p>
        </div>
    `;
    chatMessages.appendChild(welcomeMessage);
    
    // Add a divider between welcome message and summary
    const divider = document.createElement('div');
    divider.className = 'message-divider';
    chatMessages.appendChild(divider);
    
    // Add system message with dummy summary
    const systemMessage = document.createElement('div');
    systemMessage.className = 'message system-message summary-message';
    systemMessage.innerHTML = `
        <div class="message-content">
            <div class="summary-header">
                <h3>Document Summary</h3>
            </div>
            <div class="summary-content">
                <div class="summary-section">
                    <h4>Overview</h4>
                    <p>This is a placeholder summary of your PDF document. In the next phase, this will be replaced with an AI-generated summary using Python backend processing.</p>
                </div>
                <div class="summary-section">
                    <h4>Key Points</h4>
                    <ul>
                        <li>Document overview and scope</li>
                        <li>Main topics covered in detail</li>
                        <li>Key findings and conclusions</li>
                        <li>Important statistics or data points</li>
                        <li>Methodology and approach</li>
                        <li>Recommendations and next steps</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    chatMessages.appendChild(systemMessage);
    
    // Add to chat history
    chatHistory.push({
        sender: 'system',
        message: 'Welcome message and PDF Summary displayed',
        messageType: 'system',
        timestamp: new Date().toISOString()
    });
}

// Load PDF from base64 data
async function loadPdfFromData(base64Data) {
    try {
        // Clear existing content and reset variables
        pageNum = 1;
        scale = 1.0;
        pageRendering = false;
        allPagesRendered = false;
        
        // Validate input
        if (!base64Data || typeof base64Data !== 'string') {
            throw new Error('Invalid PDF data');
        }

        // Convert base64 to Blob
        const binary = atob(base64Data);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        const pdfBlob = new Blob([array], { type: 'application/pdf' });

        // Create a File object from the Blob
        const pdfFile = new File([pdfBlob], 'document.pdf', { type: 'application/pdf' });

        // Start loading PDF immediately (don't wait for summary)
        const loadingTask = pdfjsLib.getDocument({ data: array });
        
        // Load PDF in parallel with summary generation
        loadingTask.promise.then(function(pdf) {
            pdfDoc = pdf;
            totalPagesSpan.textContent = pdf.numPages;
            currentPageSpan.textContent = pageNum;

            // Render all pages immediately
            renderAllPages();
        }).catch(function(error) {
            console.error('Error loading PDF:', error);
            showNotification('Error loading PDF. Please try again.', 'error');
        });

        // Add initial summary with loading animation to chat
        displayPdfSummaryWithLoading();

        // Process PDF with backend in parallel
        processSummaryInBackground(pdfFile);

    } catch (error) {
        console.error('Error loading PDF:', error);
        showNotification('Error loading PDF. Please try again.', 'error');
    }
}

// Display PDF summary with loading animations
function displayPdfSummaryWithLoading() {
    // Clear existing chat messages
    chatMessages.innerHTML = '';
    
    // Add welcome message with QuPDF branding
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'message system-message welcome-message';
    welcomeMessage.innerHTML = `
        <div class="">
            <div class="welcome-header">
                <h2>Welcome to <img src="assests/QuPDF.svg" alt="QuPDF Logo" class="welcome-logo-text"></h2>
            </div>
            <p class="welcome-text">Your intelligent PDF companion is ready to help you explore and understand your document.</p>
        </div>
    `;
    chatMessages.appendChild(welcomeMessage);
    
    // Add a divider between welcome message and summary
    const divider = document.createElement('div');
    divider.className = 'message-divider';
    chatMessages.appendChild(divider);
    
    // Add system message with loading animation for summary
    const systemMessage = document.createElement('div');
    systemMessage.className = 'message system-message summary-message';
    systemMessage.innerHTML = `
        <div class="message-content">
            <div class="summary-header">
                <h3>Document Summary</h3>
            </div>
            <div class="summary-content">
                <div class="summary-section">
                    <h4>Overview</h4>
                    <div class="summary-loading">
                        <div class="loading-spinner-container">
                            <div class="loading-spinner">
                                <div></div><div></div><div></div><div></div>
                            </div>
                            <p>Generating summary...</p>
                        </div>
                    </div>
                </div>
                <div class="summary-section">
                    <h4>Key Points</h4>
                    <div class="typing-indicator chat-typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    chatMessages.appendChild(systemMessage);
    
    // Add to chat history
    chatHistory.push({
        sender: 'system',
        message: 'Welcome message and PDF Summary displayed',
        messageType: 'system',
        timestamp: new Date().toISOString()
    });
}

// Process summary in background
async function processSummaryInBackground(pdfFile) {
    try {
        console.log('Starting PDF processing with backend');
        const processedData = await window.backendIntegration.processPDFWithBackend(pdfFile);
        console.log('Received processed data:', processedData);
        
        if (processedData) {
            // Update UI with processed data - replace loading animations with real content
            if (processedData.summary) {
                console.log('Summary data received:', processedData.summary);
                
                // Find the existing summary elements in the DOM
                const summaryMessage = document.querySelector('.summary-message');
                if (!summaryMessage) {
                    console.error('Could not find summary message element');
                    return;
                }
                
                const summarySection = summaryMessage.querySelector('.summary-section:nth-of-type(1)');
                const keyPointsSection = summaryMessage.querySelector('.summary-section:nth-of-type(2)');
                
                // Remove loading animations
                const loadingElement = summarySection.querySelector('.summary-loading');
                const typingIndicator = keyPointsSection.querySelector('.typing-indicator');
                
                if (loadingElement) {
                    // Replace loading with actual content
                    const overviewContent = document.createElement('p');
                    
                    // Clean and prepare the summary
                    let summaryText = processedData.summary;
                    
                    // Remove "Key Points:" section if present in the summary
                    const keyPointsIndex = summaryText.indexOf('\n\nKey Points:');
                    if (keyPointsIndex > -1) {
                        summaryText = summaryText.substring(0, keyPointsIndex);
                    }
                    
                    overviewContent.textContent = summaryText;
                    summarySection.replaceChild(overviewContent, loadingElement);
                }
                
                if (typingIndicator) {
                    // Create a list for key points
                    const keyPointsList = document.createElement('ul');
                    
                    // Add new key points
                    if (processedData.keyPoints && processedData.keyPoints.length > 0) {
                        processedData.keyPoints.forEach(point => {
                            // Remove any asterisks or bullet points from the beginning
                            let cleanedPoint = point.replace(/^\s*\*\s+/g, '').trim();
                            
                            const li = document.createElement('li');
                            li.textContent = cleanedPoint;
                            keyPointsList.appendChild(li);
                        });
                    } else {
                        // Fall back to extracting key points from the summary if needed
                        console.log('Extracting key points from summary');
                        const sentences = summaryText.split(/[.!?]+/).filter(s => s.trim().length > 0);
                        
                        // Get 5-6 key points
                        const keyPoints = sentences.slice(0, Math.min(6, sentences.length)).map(s => s.trim());
                        
                        keyPoints.forEach(point => {
                            // Remove any asterisks or bullet points
                            let cleanedPoint = point.replace(/^\s*\*\s+/g, '').trim();
                            
                            const li = document.createElement('li');
                            li.textContent = cleanedPoint;
                            keyPointsList.appendChild(li);
                        });
                    }
                    
                    // Replace typing indicator with key points list
                    keyPointsSection.replaceChild(keyPointsList, typingIndicator);
                }
                
                console.log('Summary updated successfully');
            } else {
                console.warn('No summary data in processed response');
                // Replace loading animations with fallback content
                replaceLoadingWithFallbackContent();
            }
        } else {
            console.warn('No processed data received');
            // Replace loading animations with fallback content
            replaceLoadingWithFallbackContent();
        }
    } catch (error) {
        console.error('Error processing PDF with backend:', error);
        // Replace loading animations with fallback content
        replaceLoadingWithFallbackContent();
    }
}

// Function to replace loading animations with fallback content
function replaceLoadingWithFallbackContent() {
    const summaryMessage = document.querySelector('.summary-message');
    if (!summaryMessage) return;
    
    const summarySection = summaryMessage.querySelector('.summary-section:nth-of-type(1)');
    const keyPointsSection = summaryMessage.querySelector('.summary-section:nth-of-type(2)');
    
    // Remove loading spinner and add fallback content
    const loadingElement = summarySection.querySelector('.summary-loading');
    if (loadingElement) {
        const fallbackOverview = document.createElement('p');
        fallbackOverview.textContent = "Unable to generate a summary for this document. The document may be encrypted, scanned, or contain primarily non-text elements.";
        summarySection.replaceChild(fallbackOverview, loadingElement);
    }
    
    // Remove typing indicator and add fallback key points
    const typingIndicator = keyPointsSection.querySelector('.typing-indicator');
    if (typingIndicator) {
        const fallbackList = document.createElement('ul');
        
        const fallbackPoints = [
            "Try navigating through the document using the navigation controls",
            "Use the search feature to find specific information",
            "Highlight important text using the highlight tool",
            "Ask specific questions about the document content",
            "Download the PDF if you need to save it locally"
        ];
        
        fallbackPoints.forEach(point => {
            const li = document.createElement('li');
            li.textContent = point;
            fallbackList.appendChild(li);
        });
        
        keyPointsSection.replaceChild(fallbackList, typingIndicator);
    }
}

// Clear the PDF container
function clearPdfContainer() {
    // Remove all existing canvases and text layers
    while (pdfContainer.firstChild) {
        pdfContainer.removeChild(pdfContainer.firstChild);
    }
}

// Render all pages in a vertical layout
function renderAllPages() {
    if (!pdfDoc) return;
    
    clearPdfContainer();
    
    // Create a loader container
    const loaderContainer = document.createElement('div');
    loaderContainer.className = 'pdf-loader-container';
    loaderContainer.innerHTML = `
        <div class="pdf-global-loader">
            <div class="pdf-loader-spinner"></div>
            <div class="pdf-loader-text">Preparing your document...</div>
            <div class="pdf-loader-progress">
                <div class="pdf-loader-progress-bar"></div>
            </div>
        </div>
    `;
    
    // Create a wrapper div for the pages
    const pagesWrapper = document.createElement('div');
    pagesWrapper.className = 'pdf-pages-wrapper';
    pdfContainer.appendChild(pagesWrapper);
    
    // Add the loader to the PDF container
    pdfContainer.appendChild(loaderContainer);
    
    const progressBar = loaderContainer.querySelector('.pdf-loader-progress-bar');
    const progressText = loaderContainer.querySelector('.pdf-loader-text');
    
    const totalPages = pdfDoc.numPages;
    let pagesRendered = 0;
    
    // Render each page
    for (let i = 1; i <= totalPages; i++) {
        renderPageToContainer(i, pagesWrapper, function() {
            pagesRendered++;
            
            // Update progress
            const percent = Math.round((pagesRendered / totalPages) * 100);
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `Rendering pages... ${pagesRendered} of ${totalPages}`;
            
            if (pagesRendered === totalPages) {
                // All pages rendered
                allPagesRendered = true;
                
                // Fade out and remove the loader
                loaderContainer.classList.add('fade-out');
                setTimeout(() => {
                    if (loaderContainer.parentNode) {
                        loaderContainer.parentNode.removeChild(loaderContainer);
                    }
                }, 500);
            }
        });
    }
}

// Render a specific page to the container
function renderPageToContainer(pageNumber, container, callback) {
    pdfDoc.getPage(pageNumber).then(function(page) {
        // Create page container
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container';
        pageContainer.setAttribute('data-page-number', pageNumber);
        
        // Create canvas for this page
        const pageCanvas = document.createElement('canvas');
        pageCanvas.className = 'pdf-page-canvas';
        
        // Get page viewport with current scale
        const viewport = page.getViewport({ scale: scale });
        
        // Set a higher pixel density factor for sharper rendering (2.0 means 2x the pixels)
        const pixelDensity = 2.0;
        
        // Calculate dimensions with pixel density for higher quality rendering
        const scaledWidth = Math.floor(viewport.width * pixelDensity);
        const scaledHeight = Math.floor(viewport.height * pixelDensity);
        
        // Set canvas dimensions to the higher resolution
        pageCanvas.height = scaledHeight;
        pageCanvas.width = scaledWidth;
        
        // But keep the display size at the original viewport dimensions
        pageCanvas.style.width = `${viewport.width}px`;
        pageCanvas.style.height = `${viewport.height}px`;
        pageContainer.style.width = `${viewport.width}px`;
        pageContainer.style.height = `${viewport.height}px`;
        
        // Get canvas context
        const pageCtx = pageCanvas.getContext('2d');
        
        // Apply settings for crisper text rendering
        pageCtx.imageSmoothingEnabled = true;
        pageCtx.imageSmoothingQuality = 'high';
        
        // Add canvas to page container
        pageContainer.appendChild(pageCanvas);
        
        // Add to container before rendering
        container.appendChild(pageContainer);
        
        // Create a scaled viewport for rendering at higher resolution
        const scaledViewport = page.getViewport({ scale: scale * pixelDensity });
        
        // Render PDF page with higher resolution viewport
        const renderContext = {
            canvasContext: pageCtx,
            viewport: scaledViewport,
            enableWebGL: true,
            renderInteractiveForms: true
        };
        
        const renderTask = page.render(renderContext);
        
        // Store canvas element
        canvasElements[pageNumber - 1] = pageCanvas;
        
        // Wait for rendering to finish
        renderTask.promise.then(function() {
            // Create text layer for this page
            createTextLayerForPage(page, viewport, pageContainer);
            
            // Add page number indicator
            const pageNumberIndicator = document.createElement('div');
            pageNumberIndicator.className = 'page-number-indicator';
            pageNumberIndicator.textContent = 'Page ' + pageNumber;
            pageContainer.appendChild(pageNumberIndicator);
            
            // Call the callback when rendering is complete
            if (callback) callback();
        }).catch(function(error) {
            console.error(`Error rendering page ${pageNumber}:`, error);
            if (callback) callback();
        });
    }).catch(function(error) {
        console.error(`Error getting page ${pageNumber}:`, error);
        if (callback) callback();
    });
}

// Create text layer for a specific page
function createTextLayerForPage(page, viewport, container) {
    // Create text layer div
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;
    
    // Add the text layer to the container
    container.appendChild(textLayerDiv);
    
    // Get text content
    page.getTextContent().then(function(textContent) {
        // Create text layer with PDF.js
        pdfjsLib.renderTextLayer({
            textContent: textContent,
            container: textLayerDiv,
            viewport: viewport,
            textDivs: [],
            enhanceTextSelection: true,
            includeWhitespace: true
        });
    });
}

// Update zoom for all pages
function updateZoomForAllPages() {
    if (!pdfDoc || canvasElements.length === 0) return;
    
    // Store current scroll position
    const container = document.querySelector('.pdf-container');
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    const containerHeight = container.clientHeight;
    
    // Calculate center point
    const centerY = scrollTop + (containerHeight / 2);
    const scrollRatio = centerY / container.scrollHeight;
    
    // Show a notification for large documents
    if (pdfDoc.numPages > 10) {
        showNotification('Updating PDF display...', 'info');
    }
    
    // Re-render all pages with new scale
    renderAllPages();
    
    // After re-rendering, scroll to maintain relative position
    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight * scrollRatio;
        container.scrollLeft = scrollLeft * (scale / (scale - 0.25));
        
        // Show completion notification for large documents
        if (pdfDoc.numPages > 10) {
            setTimeout(() => {
                showNotification('PDF display updated', 'success');
            }, 500);
        }
    });
}

// Zoom in
function zoomIn() {
    if (!pdfDoc) {
        console.error('No PDF document loaded');
        return;
    }
    
    if (scale >= 3) {
        zoomInButton.classList.add('disabled-btn');
        setTimeout(() => {
            zoomInButton.classList.remove('disabled-btn');
        }, 300);
        return;
    }
    
    scale += 0.25;
    updateZoomLevel();
    updateZoomForAllPages();
}

// Zoom out
function zoomOut() {
    if (!pdfDoc) {
        console.error('No PDF document loaded');
        return;
    }
    
    if (scale <= 0.5) {
        zoomOutButton.classList.add('disabled-btn');
        setTimeout(() => {
            zoomOutButton.classList.remove('disabled-btn');
        }, 300);
        return;
    }
    
    scale -= 0.25;
    updateZoomLevel();
    updateZoomForAllPages();
}

// Reset zoom
function resetZoom() {
    if (!pdfDoc) {
        console.error('No PDF document loaded');
        return;
    }
    
    scale = 1.0;
    updateZoomLevel();
    updateZoomForAllPages();
}

// Update zoom level display
function updateZoomLevel() {
    zoomLevelSpan.textContent = `${Math.round(scale * 100)}%`;
}

// Search in PDF
function search() {
    if (!pdfDoc) {
        showNotification('No PDF loaded to search', 'error');
        return;
    }
    
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
        searchInput.classList.add('error-shake');
        setTimeout(() => {
            searchInput.classList.remove('error-shake');
        }, 500);
        return;
    }
    
    // Show loading spinner in search button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.classList.add('searching');
    }
    
    // Clear previous highlights and reset search state
    clearSearchHighlights();
    searchResults = [];
    currentSearchIndex = -1;
    
    showNotification(`Searching for "${searchTerm}"...`, 'info');
    
    // Search through all pages
    const promises = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        promises.push(searchInPage(i, searchTerm));
    }
    
    Promise.all(promises).then(results => {
        // Collect all search results
        results.forEach((result, pageIndex) => {
            if (result.matches.length > 0) {
                searchResults.push(...result.matches.map(match => ({
                    ...match,
                    pageNumber: pageIndex + 1
                })));
            }
        });
        
        // Remove loading spinner
        if (searchBtn) {
            searchBtn.classList.remove('searching');
        }
        
        if (searchResults.length > 0) {
            showNotification(`Found ${searchResults.length} matches`, 'success');
            showSearchControls(searchResults.length);
            navigateToSearchResult(0); // Go to first result
        } else {
            showNotification(`No matches found for "${searchTerm}"`, 'info');
            hideSearchControls();
        }
    }).catch(error => {
        console.error('Search error:', error);
        showNotification('Error during search. Please try again.', 'error');
        
        // Remove loading spinner on error
        if (searchBtn) {
            searchBtn.classList.remove('searching');
        }
    });
}

// Search in a specific page
function searchInPage(pageIndex, searchTerm) {
    return new Promise((resolve) => {
        pdfDoc.getPage(pageIndex).then(page => {
            page.getTextContent().then(textContent => {
                const matches = [];
                const pageContainer = document.querySelector(`.pdf-page-container[data-page-number="${pageIndex}"]`);
                const textLayer = pageContainer ? pageContainer.querySelector('.textLayer') : null;
                
                if (!textLayer) {
                    resolve({ page: pageIndex, matches: [] });
                    return;
                }
                
                textContent.items.forEach((item, index) => {
                    const text = item.str;
                    const regex = new RegExp(searchTerm, 'gi');
                    let match;
                    
                    while ((match = regex.exec(text)) !== null) {
                        // Find the corresponding text element in the text layer
                        const textElement = textLayer.children[index];
                        if (textElement) {
                            // Create highlight span
                            const highlightSpan = document.createElement('span');
                            highlightSpan.className = 'search-highlight';
                            highlightSpan.textContent = match[0];
                            
                            // Replace the text with highlighted version
                            const originalText = textElement.textContent;
                            const beforeMatch = originalText.substring(0, match.index);
                            const afterMatch = originalText.substring(match.index + match[0].length);
                            
                            textElement.innerHTML = '';
                            if (beforeMatch) {
                                textElement.appendChild(document.createTextNode(beforeMatch));
                            }
                            textElement.appendChild(highlightSpan);
                            if (afterMatch) {
                                textElement.appendChild(document.createTextNode(afterMatch));
                            }
                            
                            matches.push({
                                text: match[0],
                                index: index,
                                position: item.transform,
                                element: highlightSpan
                            });
                        }
                    }
                });
                
                resolve({
                    page: pageIndex,
                    matches: matches
                });
            });
        }).catch(error => {
            console.error(`Error searching page ${pageIndex}:`, error);
            resolve({
                page: pageIndex,
                matches: []
            });
        });
    });
}

// Highlight search terms in text layer
function highlightSearchTermInTextLayer(textLayer, searchTerm) {
    const textDivs = textLayer.querySelectorAll('span');
    const regex = new RegExp(searchTerm, 'gi');
    
    textDivs.forEach(div => {
        const text = div.textContent;
        if (regex.test(text)) {
            div.classList.add('search-highlight');
        }
    });
}

// Clear search highlights
function clearSearchHighlights() {
    // Remove all search highlights
    document.querySelectorAll('.search-highlight').forEach(el => {
        // Get the parent text element
        const textElement = el.parentNode;
        if (textElement) {
            // Replace the highlight span with its text content
            const textNode = document.createTextNode(el.textContent);
            textElement.replaceChild(textNode, el);
            // Normalize the text element to combine adjacent text nodes
            textElement.normalize();
        }
    });
    
    hideSearchControls();
    searchResults = [];
    currentSearchIndex = -1;
}

// Scroll to specific page
function scrollToPage(pageNumber) {
    const pageContainer = document.querySelector(`.pdf-page-container[data-page-number="${pageNumber}"]`);
    if (pageContainer) {
        pageContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Update current page display
        currentPageSpan.textContent = pageNumber;
        
        // Highlight the page briefly
        pageContainer.classList.add('page-highlight');
        setTimeout(() => {
            pageContainer.classList.remove('page-highlight');
        }, 2000);
    }
}

// Handle navigation buttons for scrolling to pages
function onPrevPage() {
    if (!pdfDoc) return;
    
    const currentPage = parseInt(currentPageSpan.textContent);
    if (currentPage > 1) {
        scrollToPage(currentPage - 1);
    } else {
        // Visual feedback for being on first page
        prevButton.classList.add('disabled-btn');
        setTimeout(() => {
            prevButton.classList.remove('disabled-btn');
        }, 300);
    }
}

function onNextPage() {
    if (!pdfDoc) return;
    
    const currentPage = parseInt(currentPageSpan.textContent);
    if (currentPage < pdfDoc.numPages) {
        scrollToPage(currentPage + 1);
    } else {
        // Visual feedback for being on last page
        nextButton.classList.add('disabled-btn');
        setTimeout(() => {
            nextButton.classList.remove('disabled-btn');
        }, 300);
    }
}

// Handle text highlighting
function handleHighlight(event) {
    if (!isHighlightMode) return;
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (!selectedText) return;
    
    try {
        const range = selection.getRangeAt(0);
        const pageElement = event.target.closest('.pdf-page-container');
        
        if (!pageElement) return;
        
        const pageNumber = parseInt(pageElement.getAttribute('data-page-number'));
        
        // Create highlight element
        const highlight = document.createElement('span');
        highlight.className = 'highlight';
        highlight.textContent = selectedText;
        
        // Get the text layer
        const textLayer = pageElement.querySelector('.textLayer');
        if (!textLayer) return;
        
        // Wrap the selected text in the highlight span
        range.surroundContents(highlight);
        
        // Store highlight data
        highlights.push({
            text: selectedText,
            pageNumber: pageNumber,
            element: highlight,
            position: {
                top: highlight.offsetTop,
                left: highlight.offsetLeft,
                width: highlight.offsetWidth,
                height: highlight.offsetHeight
            }
        });
        
        // Clear the selection
        selection.removeAllRanges();
        
        // Show success notification
        const truncatedText = selectedText.length > 30 ? selectedText.substring(0, 30) + '...' : selectedText;
        showNotification(`Text highlighted: "${truncatedText}"`, 'success');
    } catch (error) {
        console.error('Error highlighting text:', error);
        showNotification('Error highlighting text. Please try again.', 'error');
    }
}

// Toggle highlight mode
function toggleHighlightMode() {
    isHighlightMode = !isHighlightMode;
    const highlightBtn = document.getElementById('highlight-btn');
    const pdfContainer = document.querySelector('.pdf-container');
    
    if (isHighlightMode) {
        // Enable highlight mode
        highlightBtn.classList.add('highlight-active');
        pdfContainer.classList.add('highlight-mode');
        document.body.style.cursor = 'text';
        showNotification('Highlight mode enabled. Select text to highlight.', 'info');
        
        // Make text layer more visible in highlight mode
        document.querySelectorAll('.textLayer').forEach(layer => {
            layer.style.opacity = '0.2';
        });
    } else {
        // Disable highlight mode
        highlightBtn.classList.remove('highlight-active');
        pdfContainer.classList.remove('highlight-mode');
        document.body.style.cursor = 'default';
        showNotification('Highlight mode disabled', 'info');
        
        // Reset text layer opacity
        document.querySelectorAll('.textLayer').forEach(layer => {
            layer.style.opacity = '0.2';
        });
    }
}

// Clear highlights
function clearHighlights() {
    if (highlights.length === 0) {
        showNotification('No highlights to clear', 'info');
        return;
    }
    
    // Remove all highlight elements
    highlights.forEach(highlight => {
        if (highlight.element && highlight.element.parentNode) {
            const text = highlight.element.textContent;
            const textNode = document.createTextNode(text);
            highlight.element.parentNode.replaceChild(textNode, highlight.element);
        }
    });
    
    // Clear highlights array
    highlights = [];
    showNotification('All highlights have been cleared', 'success');
}

// Download PDF with highlights
async function downloadPdf() {
    if (!pdfData) {
        showNotification('PDF data not available for download.', 'error');
        return;
    }
    
    try {
        // Add download animation
        downloadButton.classList.add('downloading');
        
        // Convert base64 to Uint8Array more reliably
        let pdfBytes;
        try {
            // First decode base64
            const binaryString = window.atob(pdfData);
            // Convert to Uint8Array
            pdfBytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                pdfBytes[i] = binaryString.charCodeAt(i);
            }
        } catch (e) {
            console.error('Base64 decode error:', e);
            throw new Error('Failed to decode PDF data');
        }
        
        // Validate PDF bytes
        if (!pdfBytes || pdfBytes.length === 0) {
            throw new Error('Invalid PDF data');
        }

        // If there are no highlights, download the original PDF directly
        if (!highlights || highlights.length === 0) {
            // Create blob and download
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            // Get filename from title or use default
            const fileName = (pdfTitle?.textContent || 'document')
                .replace(/[^a-z0-9]/gi, '_') // Replace special chars with underscore
                .toLowerCase() + '.pdf';
            
            // Create and trigger download
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            
            // Trigger download
            a.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                downloadButton.classList.remove('downloading');
                showNotification(`PDF "${fileName}" downloaded successfully!`, 'success');
            }, 100);
            return;
        }
        
        // If there are highlights, use pdf-lib to add them
        try {
            // Create a new PDF document
            const PDFLib = await import('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');
            const modifiedPdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
            
            // Apply highlights to each page if they exist
            const pages = modifiedPdfDoc.getPages();
            for (const highlight of highlights) {
                if (!highlight.pageNumber || !highlight.position) continue;
                
                const pageIndex = highlight.pageNumber - 1;
                if (pageIndex < 0 || pageIndex >= pages.length) continue;
                
                const page = pages[pageIndex];
                
                // Create highlight annotation
                page.drawRectangle({
                    x: highlight.position.left,
                    y: page.getHeight() - (highlight.position.top + highlight.position.height),
                    width: highlight.position.width,
                    height: highlight.position.height,
                    color: PDFLib.rgb(1, 0.898, 0.212), // #ffe536 in RGB
                    opacity: 0.4
                });
            }
            
            // Save the modified PDF
            const modifiedPdfBytes = await modifiedPdfDoc.save();
            
            // Create blob and download
            const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            // Get filename from title or use default
            const fileName = (pdfTitle?.textContent || 'document')
                .replace(/[^a-z0-9]/gi, '_') // Replace special chars with underscore
                .toLowerCase() + '_with_highlights.pdf';
            
            // Create and trigger download
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            
            // Trigger download
            a.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                downloadButton.classList.remove('downloading');
                showNotification(`PDF "${fileName}" downloaded successfully!`, 'success');
            }, 100);
            
        } catch (error) {
            console.error('Error modifying PDF with highlights:', error);
            // If pdf-lib fails, fall back to downloading original PDF
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            const fileName = (pdfTitle?.textContent || 'document')
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase() + '.pdf';
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                downloadButton.classList.remove('downloading');
                showNotification(`Original PDF "${fileName}" downloaded successfully!`, 'success');
            }, 100);
        }
        
    } catch (error) {
        console.error('Error downloading PDF:', error);
        downloadButton.classList.remove('downloading');
        showNotification(`Error downloading PDF: ${error.message}. Please try again.`, 'error');
    }
}

// Export chat functionality
function exportChat() {
    if (chatHistory.length === 0) {
        showNotification('No chat messages to export.', 'warning');
        return;
    }
    
    // Add button press effect
    addButtonPressEffect(exportChatButton);
    
    // Create a text representation of the chat
    let chatText = `Chat with PDF: ${pdfTitle.textContent}\n`;
    chatText += `Date: ${new Date().toLocaleString()}\n\n`;
    
    chatHistory.forEach(msg => {
        const sender = msg.sender === 'user' ? 'You' : 'QuPDF AI';
        chatText += `${sender}: ${msg.message}\n\n`;
    });
    
    // Create a blob and download
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'QuPDF Chat.txt';
    a.click();
    
    URL.revokeObjectURL(url);
    
    showNotification('Chat exported successfully!', 'info');
}

// Clear chat functionality
function clearChat() {
    // Add button press effect
    addButtonPressEffect(deleteChatButton);
    
    // Clear chat messages
    chatMessages.innerHTML = '';
    
    // Add system message
    const systemMessage = document.createElement('div');
    systemMessage.className = 'message system-message';
    systemMessage.innerHTML = `        <div class="message-content">
            <p>Chat has been cleared. Ask me anything about your PDF document.</p>
        </div>
    `;
    chatMessages.appendChild(systemMessage);
    
    // Clear chat history
    chatHistory = [];
    
    showNotification('Chat cleared successfully!', 'info');
}

// Process AI response to remove repetitive content
function processResponseForRepetition(text) {
    if (!text) return text;
    
    // Create a deep copy of the original text to work with
    let processedText = text;
    
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
        processedText = processedText.replace(pattern, replacement);
    }
    
    // Step 2: Remove paragraphs that are nearly identical (similar content with minor variations)
    const paragraphs = processedText.split(/\n\n+/);
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

// Send a chat message
async function sendMessage() {
    // Get message text
    const messageText = chatInput.value.trim();
    
    // Check if message is empty
    if (messageText === '') {
        // Visual feedback for empty message
        chatInput.classList.add('error-shake');
        setTimeout(() => {
            chatInput.classList.remove('error-shake');
        }, 500);
        return;
    }
    
    // Add user message to chat
    addMessageToChat(messageText, 'user');
    
    // Clear input
    chatInput.value = '';
    
    // Reset input height
    chatInput.style.height = '48px';
    chatInput.style.overflowY = 'hidden';
    
    // Adjust chat container height
    const chatMessages = document.querySelector('.chat-messages');
    const inputContainer = document.querySelector('.chat-input-container');
    if (chatMessages && inputContainer) {
        const inputHeight = inputContainer.offsetHeight;
        chatMessages.style.height = `calc(100% - ${inputHeight}px)`;
    }
    
    // Focus on input again
    chatInput.focus();
    
    // Scroll to bottom of chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
        // Get PDF text from the current document (or use a placeholder if extraction fails)
        let pdfText = '';
        try {
            if (pdfDoc) {
                for (let i = 1; i <= pdfDoc.numPages; i++) {
                    const page = await pdfDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    pdfText += textContent.items.map(item => item.str).join(' ');
                }
            }
        } catch (error) {
            console.error('Error extracting PDF text:', error);
            // If text extraction fails, use placeholder text so the mock backend can still respond
            pdfText = "Document text extraction failed. Using placeholder text for query processing.";
        }

        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message ai-message typing-indicator';
        typingIndicator.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Process the query with a small delay to show typing animation
        setTimeout(async () => {
            try {
                // Check if backend integration is available
                if (window.backendIntegration && typeof window.backendIntegration.sendQueryToBackend === 'function') {
                    // Process the query using backend integration
                    const answer = await window.backendIntegration.sendQueryToBackend(messageText, pdfText);
                    
                    // Remove typing indicator (for redundancy, in case it wasn't already removed)
                    if (typingIndicator.parentNode) {
                        typingIndicator.parentNode.removeChild(typingIndicator);
                    }
                    
                    // Calculate a more natural typing delay based on response length
                    const typingDelay = Math.min(Math.max(500, answer.length * 2), 3000);
                    
                    // Add AI response to chat after a typing delay
                    setTimeout(() => {
                        addMessageToChat(answer, 'ai');
                    }, typingDelay);
                } else {
                    // Fall back to local simulation if backend integration is not available
                    console.log("Backend integration not available, using local simulation");
                    // Remove the typing indicator since simulateAiResponse creates its own
                    if (typingIndicator.parentNode) {
                        typingIndicator.parentNode.removeChild(typingIndicator);
                    }
                    // Use the local simulation function
                    simulateAiResponse(messageText);
                }
            } catch (error) {
                console.error('Error processing message:', error);
                // Remove typing indicator in case of error
                if (typingIndicator.parentNode) {
                    typingIndicator.parentNode.removeChild(typingIndicator);
                }
                addMessageToChat('Sorry, I encountered an error while processing your query.', 'ai');
            }
        }, 500);

    } catch (error) {
        console.error('Error in sendMessage:', error);
        addMessageToChat('Sorry, I encountered an error while processing your query.', 'ai');
    }
}

// Add a message to the chat
function addMessageToChat(message, sender = 'user', messageType = '') {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    
    if (messageType) {
        messageElement.classList.add(`${messageType}-message`);
    }
    
    // Don't add duplicate consecutive messages
    if (chatHistory.length > 0) {
        const lastMessage = chatHistory[chatHistory.length - 1];
        if (lastMessage.sender === sender && lastMessage.message === message) {
            // Skip duplicate consecutive message
            return;
        }
    }
    
    // Create a container for the message content
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    
    // Process and display the message
    displayMessage(message, sender, contentElement);
    
    // Add copy button for non-user messages
    if (sender !== 'user') {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
        
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(message);
                copyButton.classList.add('copied');
                copyButton.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
                setTimeout(() => {
                    copyButton.classList.remove('copied');
                    copyButton.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        });
        
        messageElement.appendChild(copyButton);
    }
    
    // Add the message content to the message element
    messageElement.appendChild(contentElement);
    
    // Add the message to the chat
    chatMessages.appendChild(messageElement);
    
    // Scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Save to chat history
    chatHistory.push({ 
        sender, 
        message,
        messageType,
        timestamp: new Date().toISOString() 
    });
}

// Function to display message content - handles formatting
function displayMessage(message, sender, container) {
    console.log("Displaying message:", message);
    
    if (typeof message === 'string') {
        // Enhanced formatting based on message sender
        if (sender === 'user') {
            // Simple formatting for user messages
            const formattedMessage = message.replace(/\n/g, '<br>');
            container.innerHTML = `<p>${formattedMessage}</p>`;
        } else if (sender === 'ai' || sender === 'system') {
            // Enhanced formatting for AI messages
            let formattedMessage = message;
            
            // Basic markdown formatting
            // Convert headers (##, ###, etc.)
            formattedMessage = formattedMessage.replace(/^### (.*?)$/gm, '<h3 class="message-heading">$1</h3>');
            formattedMessage = formattedMessage.replace(/^## (.*?)$/gm, '<h2 class="message-heading">$1</h2>');
            formattedMessage = formattedMessage.replace(/^# (.*?)$/gm, '<h1 class="message-heading">$1</h1>');
            
            // Convert bold (**text**)
            formattedMessage = formattedMessage.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            // Convert italic (*text*)
            formattedMessage = formattedMessage.replace(/\*(.*?)\*/g, '<em>$1</em>');
            
            // Convert bullet points
            formattedMessage = formattedMessage.replace(/^- (.*?)$/gm, '<li class="bullet-item">$1</li>');
            formattedMessage = formattedMessage.replace(/(<li.*?>.*?<\/li>)\s*(<li.*?>)/g, '$1$2');
            formattedMessage = formattedMessage.replace(/(<li.*?>.*?<\/li>)+/g, '<ul class="message-bullet-list">$&</ul>');
            
            // Convert numbered lists
            formattedMessage = formattedMessage.replace(/^\d+\. (.*?)$/gm, '<li class="numbered-item">$1</li>');
            formattedMessage = formattedMessage.replace(/(<li class="numbered-item".*?>.*?<\/li>)\s*(<li class="numbered-item".*?>)/g, '$1$2');
            formattedMessage = formattedMessage.replace(/(<li class="numbered-item".*?>.*?<\/li>)+/g, '<ol class="message-numbered-list">$&</ol>');
            
            // Handle code blocks with syntax highlighting
            formattedMessage = formattedMessage.replace(/```(.*?)\n([\s\S]*?)```/g, function(match, language, code) {
                return `<pre class="code-block${language ? ' language-' + language : ''}"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
            });
            
            // Handle inline code
            formattedMessage = formattedMessage.replace(/`(.*?)`/g, '<code>$1</code>');
            
            // Wrap plain text paragraphs (text not already wrapped in HTML tags)
            formattedMessage = formattedMessage.replace(/^(?!<[a-z][a-z0-9]*>)(.+?)(?!<\/[a-z][a-z0-9]*>)$/gm, '<p class="regular-paragraph">$1</p>');
            
            // Convert newlines to <br> for any remaining text
            formattedMessage = formattedMessage.replace(/\n/g, '<br>');
            
            // Set the formatted content
            container.innerHTML = formattedMessage;
            
            // Add special styling to AI response if needed
            if (sender === 'ai') {
                container.classList.add('ai-content');
            } else if (sender === 'system') {
                container.classList.add('system-content');
            }
        } else {
            // Default formatting for other message types
            const formattedMessage = message.replace(/\n/g, '<br>');
            container.innerHTML = `<p>${formattedMessage}</p>`;
        }
    } else {
        // Fallback for non-string input
        container.innerHTML = `<p>Error displaying message</p>`;
        console.error("Invalid message format:", message);
    }
}

// Simulate AI response
function simulateAiResponse(userMessage) {
    // Add typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message ai-message typing-indicator';
    typingIndicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Simulate initial thinking delay
    setTimeout(() => {
        // Remove typing indicator after initial delay
        if (typingIndicator.parentNode) {
            typingIndicator.parentNode.removeChild(typingIndicator);
        }
        
        let response = '';
        let messageType = 'ai';
        
        // Generate response based on user message
        if (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi')) {
            response = "Hello! I'm your QuPDF assistant. How can I help you with this document today?";
        } else if (userMessage.toLowerCase().includes('help')) {
            response = "# QuPDF Help Guide\n\nI can help you understand the content of your PDF. With QuPDF, you can:\n\n- Ask questions about specific pages\n- Search for information within the document\n- Request summaries of sections\n- Use highlighting tools to mark important parts\n\nWhat would you like help with today?";
        } else if (userMessage.toLowerCase().includes('thank')) {
            response = "You're welcome! If you have any more questions about your document, feel free to ask. QuPDF is here to help you make the most of your PDFs.";
            messageType = 'success';
        } else if (userMessage.toLowerCase().includes('error') || userMessage.toLowerCase().includes('problem') || userMessage.toLowerCase().includes('issue')) {
            response = "## Troubleshooting Guide\n\nI notice you're mentioning an issue. Here are some common solutions:\n\n1. **PDF Display Issues**: Try using the zoom controls or navigating to a different page\n2. **Search Problems**: Ensure your search term is correctly spelled\n3. **Slow Performance**: Large PDFs may take longer to process\n\nIf problems persist, please refresh the page. QuPDF is designed to provide a smooth experience with your documents.";
            messageType = 'warning';
        } else if (userMessage.toLowerCase().includes('not working') || userMessage.toLowerCase().includes('broken')) {
            response = "I'm sorry to hear something isn't working properly with QuPDF. Could you provide more details about the problem so I can try to help you resolve it?";
            messageType = 'error';
        } else if (userMessage.toLowerCase().includes('zoom')) {
            response = "### Using Zoom Controls\n\nYou can use the zoom controls in the QuPDF toolbar above the document:\n- Click the **+** button to zoom in\n- Click the **-** button to zoom out\n- Click the reset button to return to the default zoom level";
        } else if (userMessage.toLowerCase().includes('features') || userMessage.toLowerCase().includes('can you do')) {
            response = "# QuPDF Features\n\nQuPDF offers several powerful features:\n\n## Document Interaction\n- **Intelligent Chat**: Ask questions about your PDF content\n- **Easy Navigation**: Move between pages seamlessly\n- **Text Search**: Find specific information quickly\n\n## Advanced Features\n- **Highlighting**: Mark important sections of text\n- **Document Summaries**: Get quick overviews of content\n- **Export Conversations**: Save your chat for future reference\n\nWhat would you like to explore first?";
        } else {
            response = "## Document Analysis\n\nI've analyzed the document using QuPDF's intelligent processing and found relevant information related to your question. The document discusses this topic in detail, particularly on pages 2-3 where key concepts are explained.\n\n```\nSample code or important text might appear here in a formatted block\n```\n\nWould you like me to elaborate on any specific aspect?";
        }
        
        // Calculate a more natural typing delay based on response length
        const typingDelay = Math.min(Math.max(500, response.length * 2), 3000);
        
        // Add AI response to chat after the typing delay
        setTimeout(() => {
            addMessageToChat(response, 'ai', messageType);
        }, typingDelay);
        
    }, 1500);
}

// Show notification
function showNotification(message, type = 'info') {
    // Don't show notifications with empty messages
    if (!message || message.trim() === '') {
        console.warn("Attempted to show notification with empty message");
        return;
    }
    
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');
    
    if (!notification || !notificationMessage) {
        console.error("Notification elements not found");
        return;
    }
    
    // Set the notification icon based on type
    const notificationIcon = notification.querySelector('.notification-icon');
    if (notificationIcon) {
        // Update icon path based on notification type
        switch(type) {
            case 'error':
                notificationIcon.innerHTML = `
                    <path fill="none" d="M0 0h24v24H0z" />
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                `;
                break;
            case 'warning':
                notificationIcon.innerHTML = `
                    <path fill="none" d="M0 0h24v24H0z" />
                    <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                `;
                break;
            case 'success':
                notificationIcon.innerHTML = `
                    <path fill="none" d="M0 0h24v24H0z" />
                    <path fill="currentColor" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" />
                `;
                break;
            default:
                notificationIcon.innerHTML = `
                    <path fill="none" d="M0 0h24v24H0z" />
                    <path fill="currentColor" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" />
                `;
        }
    }
    
    // Set the message text content
    notificationMessage.textContent = message;
    
    // Remove existing classes
    notification.classList.remove('error', 'info', 'success', 'warning');
    
    // Add appropriate class
    notification.classList.add(type);
    
    // Show notification
    notification.classList.add('show');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Add search navigation functions
function showSearchControls(totalResults) {
    const searchDiv = document.querySelector('.pdf-search');
    const searchTerm = searchInput.value.trim();
    
    // Adjust container width based on term length for better fit
    if (searchTerm) {
        const textLength = searchTerm.length;
        // Calculate width - longer terms need more space for the controls
        const newWidth = Math.max(250, Math.min(350, 250 + (textLength * 8)));
        searchDiv.style.maxWidth = `${newWidth}px`;
    } else {
        searchDiv.style.maxWidth = '250px';
    }
    
    // Create or update search controls
    let controls = document.querySelector('.search-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'search-controls';
        controls.innerHTML = `
            <button class="search-nav-btn" id="prev-result" title="Previous result">
                <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
            </button>
            <span class="search-count">${currentSearchIndex + 1} of ${totalResults}</span>
            <button class="search-nav-btn" id="next-result" title="Next result">
                <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
            </button>
        `;
        searchDiv.appendChild(controls);
        
        // Add event listeners
        document.getElementById('prev-result').addEventListener('click', () => navigateToSearchResult(currentSearchIndex - 1));
        document.getElementById('next-result').addEventListener('click', () => navigateToSearchResult(currentSearchIndex + 1));
    } else {
        // Update the search count if controls already exist
        const searchCount = controls.querySelector('.search-count');
        if (searchCount) {
            searchCount.textContent = `${currentSearchIndex + 1} of ${totalResults}`;
        }
    }
    
    controls.classList.add('visible');
    
    // Hide the search button when controls are visible
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.style.display = 'none';
    }
}

function hideSearchControls() {
    const controls = document.querySelector('.search-controls');
    if (controls) {
        controls.classList.remove('visible');
    }
    
    // Show the search button again
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.style.display = '';
    }
    
    // Reset the search container width
    const searchDiv = document.querySelector('.pdf-search');
    if (searchDiv) {
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            const textLength = searchTerm.length;
            // Adjust to the input text without controls
            const newWidth = Math.max(220, Math.min(320, 220 + (textLength * 8)));
            searchDiv.style.maxWidth = `${newWidth}px`;
        } else {
            searchDiv.style.maxWidth = '220px';
        }
    }
}

function navigateToSearchResult(index) {
    if (searchResults.length === 0) return;
    
    // Remove current highlight class
    if (currentSearchIndex !== -1 && searchResults[currentSearchIndex]?.element) {
        searchResults[currentSearchIndex].element.classList.remove('current');
    }
    
    // Update index with wrapping
    currentSearchIndex = (index + searchResults.length) % searchResults.length;
    
    const result = searchResults[currentSearchIndex];
    if (!result) return;
    
    // Scroll to the page containing the result
    scrollToPage(result.pageNumber);
    
    // Update search count display
    const searchCount = document.querySelector('.search-count');
    if (searchCount) {
        searchCount.textContent = `${currentSearchIndex + 1} of ${searchResults.length}`;
    }
    
    // Update navigation buttons
    updateSearchNavButtons();
    
    // Highlight current result
    setTimeout(() => {
        if (result.element) {
            result.element.classList.add('current');
            result.element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, 100);
}

function updateSearchNavButtons() {
    const prevButton = document.getElementById('prev-result');
    const nextButton = document.getElementById('next-result');
    
    if (prevButton && nextButton) {
        prevButton.disabled = searchResults.length <= 1;
        nextButton.disabled = searchResults.length <= 1;
        
        // Add visual feedback for button state
        if (searchResults.length <= 1) {
            prevButton.classList.add('disabled');
            nextButton.classList.add('disabled');
        } else {
            prevButton.classList.remove('disabled');
            nextButton.classList.remove('disabled');
        }
    }
}

// Function to reprocess the current PDF (called after API key is added)
window.reprocessCurrentPDF = function() {
    if (pdfData) {
        // Clear chat messages
        chatMessages.innerHTML = '';
        
        // Add initial system message
        const systemMessage = document.createElement('div');
        systemMessage.className = 'message system-message';
        systemMessage.innerHTML = `
            <div class="message-content">
                <p>Hello! I'm your AI assistant. Ask me anything about your PDF document.</p>
            </div>
        `;
        chatMessages.appendChild(systemMessage);
        
        // Reload PDF with new API key
        loadPdfFromData(pdfData);
    }
};

// Function to handle toggle PDF button for mobile and tablet views
function setupTogglePdfButton() {
    const toggleButton = document.getElementById('toggle-pdf-button');
    const pdfViewerSection = document.querySelector('.pdf-viewer-section');
    
    if (!toggleButton || !pdfViewerSection) return;
    
    // Initial state check
    function updateButtonState() {
        const isPdfHidden = pdfViewerSection.classList.contains('hidden-pdf');
        toggleButton.textContent = isPdfHidden ? 'View PDF' : 'Close PDF';
    }
    
    // Toggle visibility of PDF viewer
    toggleButton.addEventListener('click', function() {
        pdfViewerSection.classList.toggle('hidden-pdf');
        updateButtonState();
    });
    
    // Handle initial state based on screen size
    function checkScreenSize() {
        // Only for mobile and tablet views
        if (window.innerWidth <= 1024) {
            toggleButton.style.display = 'block';
            
            // On initial load, hide PDF on mobile by default
            if (window.innerWidth <= 768 && !sessionStorage.getItem('pdfToggleState')) {
                pdfViewerSection.classList.add('hidden-pdf');
                updateButtonState();
            }
        } else {
            toggleButton.style.display = 'none';
            pdfViewerSection.classList.remove('hidden-pdf');
        }
    }
    
    // Check on load and resize
    checkScreenSize();
    updateButtonState();
    
    window.addEventListener('resize', function() {
        checkScreenSize();
        updateButtonState();
    });
    
    // Store state in session storage
    toggleButton.addEventListener('click', function() {
        sessionStorage.setItem('pdfToggleState', pdfViewerSection.classList.contains('hidden-pdf') ? 'hidden' : 'visible');
    });
    
    // Apply stored state if available
    const storedState = sessionStorage.getItem('pdfToggleState');
    if (storedState) {
        if (storedState === 'hidden') {
            pdfViewerSection.classList.add('hidden-pdf');
        } else {
            pdfViewerSection.classList.remove('hidden-pdf');
        }
        updateButtonState();
    }
} 

// Add this new function after setupEventListeners()
function addCustomStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .clean-heading {
            margin-top: 18px;
            margin-bottom: 0;
            padding: 5px 0;
            font-size: 18px;
            font-weight: bold;
            color: #333;
            font-family: sans-serif;
            display: inline;
        }
        .clean-heading strong {
            font-weight: bold;
            color: #776cff;
            font-size: 18px;
            display: inline;
            line-height: 1.4;
        }
        .post-heading-content {
            display: block;
            margin-top: 5px;
            margin-bottom: 20px;
        }
        .inline-heading {
            display: inline;
            margin-top: 25px;
            margin-bottom: 15px;
        }
        .inline-heading + .post-heading-content {
            margin-bottom: 25px;
        }
        .inline-heading strong {
            color: #776cff;
            font-size: 16px;
            display: inline;
        }
        /* Add additional styles for better response formatting */
        .message-content p {
            // margin-bottom: 20px;
            line-height: 1.5;
        }
        .message-content p + p {
            margin-top: 15px;
        }
        .message-content div + p {
            margin-top: 15px;
        }
        .message-content ul, .message-content ol {
            // margin-bottom: 25px;
            padding-left: 25px;
            margin-top: 10px;
        }
        .message-content li {
            margin-bottom: 8px;
            padding-left: 5px;
        }
        .message-content li:last-child {
            margin-bottom: 15px;
        }
        .message-content strong {
            font-weight: bold;
            color: #333;
        }
        .message-content br {
            display: block;
            margin-top: 5px;
            content: "";
        }
    `;
    document.head.appendChild(style);
} 