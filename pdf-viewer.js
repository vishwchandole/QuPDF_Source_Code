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
let highlights = [];
let isHighlightMode = false;
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
const highlightButton = document.getElementById('highlight-btn');
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
const shareChatButton = document.getElementById('share-chat');
const exportChatButton = document.getElementById('export-chat');
const deleteChatButton = document.getElementById('delete-chat');
const resizer = document.getElementById('resizer');
const pdfViewerSection = document.querySelector('.pdf-viewer-section');
const chatSection = document.querySelector('.chat-section');

// Initialize the viewer
document.addEventListener('DOMContentLoaded', function() {
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
    
    // Highlight functionality
    highlightButton.addEventListener('click', toggleHighlightMode);
    
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
        
        // Initial call to set correct height
        autoResizeChatInput.call(chatInput);
    } else {
        console.error("Chat input element not found");
    }
    
    // Share, export, and delete chat
    if (shareChatButton) shareChatButton.addEventListener('click', shareChat);
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
}

// Auto-resize textarea based on content
function autoResizeChatInput() {
    // Reset height to auto to get the correct scrollHeight
    this.style.height = 'auto';
    
    // Get the scrollHeight (actual content height)
    const scrollHeight = this.scrollHeight;
    
    // Calculate new height (with min and max constraints)
    const newHeight = Math.min(Math.max(scrollHeight, 36), 100);
    
    // Apply the new height
    this.style.height = newHeight + 'px';
    
    // Show/hide scrollbar based on content
    if (scrollHeight > 100) {
        this.style.overflowY = 'auto';
    } else {
        this.style.overflowY = 'hidden';
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

        // Add initial summary to chat
        displayPdfSummary();

        // Process PDF with backend
        try {
            console.log('Starting PDF processing with backend');
            const processedData = await window.backendIntegration.processPDFWithBackend(pdfFile);
            console.log('Received processed data:', processedData);
            
            if (processedData) {
                // Update UI with processed data - replace dummy content with real content
                if (processedData.summary) {
                    console.log('Summary data received:', processedData.summary);
                    
                    // Find the existing summary elements in the DOM using more specific selectors
                    const summaryMessage = document.querySelector('.summary-message');
                    if (!summaryMessage) {
                        console.error('Could not find summary message element');
                        return;
                    }
                    
                    const overviewElement = summaryMessage.querySelector('.summary-section:nth-of-type(1) p');
                    const keyPointsList = summaryMessage.querySelector('.summary-section:nth-of-type(2) ul');
                    
                    console.log('Found summary elements:', {
                        overviewElement: !!overviewElement,
                        keyPointsList: !!keyPointsList
                    });
                    
                    if (overviewElement && keyPointsList) {
                        // Clean and prepare the summary
                        let summaryText = processedData.summary;
                        
                        // Remove "Key Points:" section if present in the summary
                        const keyPointsIndex = summaryText.indexOf('\n\nKey Points:');
                        if (keyPointsIndex > -1) {
                            summaryText = summaryText.substring(0, keyPointsIndex);
                        }
                        
                        // Update the overview paragraph directly with the clean summary
                        console.log('Updating overview with text:', summaryText);
                        overviewElement.textContent = summaryText;
                        
                        // Clear existing key points
                        keyPointsList.innerHTML = '';
                        
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
                        
                        console.log('Summary updated successfully');
                    } else {
                        console.error('Could not find summary elements to update');
                    }
                } else {
                    console.warn('No summary data in processed response');
                }
            } else {
                console.warn('No processed data received');
            }
        } catch (error) {
            console.error('Error processing PDF with backend:', error);
            // Continue with PDF display even if backend processing fails
        }

        // Load PDF using PDF.js
        showNotification('Loading PDF...', 'info');
        const loadingTask = pdfjsLib.getDocument({ data: array });

        loadingTask.promise.then(function(pdf) {
            pdfDoc = pdf;
            totalPagesSpan.textContent = pdf.numPages;
            currentPageSpan.textContent = pageNum;

            // Render all pages
            renderAllPages();
            
            showNotification('PDF loaded successfully!', 'success');
        }).catch(function(error) {
            console.error('Error loading PDF:', error);
            showNotification('Error loading PDF. Please try again.', 'error');
        });

    } catch (error) {
        console.error('Error loading PDF:', error);
        showNotification('Error loading PDF. Please try again.', 'error');
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
        
        // Set canvas dimensions
        pageCanvas.height = viewport.height;
        pageCanvas.width = viewport.width;
        pageContainer.style.width = `${viewport.width}px`;
        pageContainer.style.height = `${viewport.height}px`;
        
        // Get canvas context
        const pageCtx = pageCanvas.getContext('2d');
        
        // Add canvas to page container
        pageContainer.appendChild(pageCanvas);
        
        // Add to container before rendering
        container.appendChild(pageContainer);
        
        // Render PDF page
        const renderContext = {
            canvasContext: pageCtx,
            viewport: viewport
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
    
    // Re-render all pages with new scale
    renderAllPages();
    
    // After re-rendering, scroll to maintain relative position
    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight * scrollRatio;
        container.scrollLeft = scrollLeft * (scale / (scale - 0.25));
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
        
        if (searchResults.length > 0) {
            showNotification(`Found ${searchResults.length} matches`, 'info');
            showSearchControls(searchResults.length);
            navigateToSearchResult(0); // Go to first result
        } else {
            showNotification(`No matches found for "${searchTerm}"`, 'info');
            hideSearchControls();
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

// Share chat functionality
function shareChat() {
    if (chatHistory.length === 0) {
        showNotification('No chat messages to share.', 'warning');
        return;
    }
    
    // Add button press effect
    addButtonPressEffect(shareChatButton);
    
    // In a real app, you'd implement sharing functionality
    // For this demo, we'll just show a notification
    showNotification('Chat sharing functionality would be implemented here.', 'info');
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
        const sender = msg.sender === 'user' ? 'You' : 'AI';
        chatText += `${sender}: ${msg.message}\n\n`;
    });
    
    // Create a blob and download
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat-export.txt';
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

// Send a chat message
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessageToChat(message, 'user');
    chatInput.value = '';
    autoResizeChatInput.call(chatInput);

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

        // Send query to backend with delay to show typing indicator
        setTimeout(async () => {
            // Remove typing indicator
            if (typingIndicator.parentNode) {
                typingIndicator.parentNode.removeChild(typingIndicator);
            }

            try {
                // Send query to backend
                const answer = await window.backendIntegration.sendQueryToBackend(message, pdfText);
                addMessageToChat(answer, 'ai');
            } catch (error) {
                console.error('Error processing message:', error);
                addMessageToChat('Sorry, I encountered an error while processing your query.', 'ai');
            }
        }, 1500);

    } catch (error) {
        console.error('Error in sendMessage:', error);
        addMessageToChat('Sorry, I encountered an error while processing your query.', 'ai');
    }
}

// Add a message to the chat
function addMessageToChat(message, sender, messageType = '') {
    const messageElement = document.createElement('div');
    
    // Set appropriate message class based on sender and messageType
    if (messageType) {
        messageElement.className = `message ${messageType}-message`;
    } else {
        messageElement.className = `message ${sender}-message`;
    }
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    
    // Check if the message contains code blocks
    if (message.includes('```')) {
        // Split by code blocks first
        const parts = message.split(/```(\w*)/);
        
        let inCodeBlock = false;
        let language = '';
        let currentText = '';
        
        parts.forEach((part, index) => {
            // If this part is a language identifier
            if (index % 2 === 1) {
                language = part;
                inCodeBlock = true;
                return;
            }
            
            // If we're in a code block
            if (inCodeBlock) {
                // Find the closing backticks
                const endIndex = part.indexOf('```');
                if (endIndex !== -1) {
                    // Extract the code content
                    const code = part.substring(0, endIndex).trim();
                    
                    // Create code block element
                    const codeBlock = document.createElement('div');
                    codeBlock.className = 'code-block';
                    
                    // Add language label if available
                    if (language) {
                        const langLabel = document.createElement('div');
                        langLabel.className = 'code-language';
                        langLabel.textContent = language;
                        codeBlock.appendChild(langLabel);
                    }
                    
                    // Create pre and code elements for proper formatting
                    const pre = document.createElement('pre');
                    const codeElem = document.createElement('code');
                    if (language) {
                        codeElem.className = `language-${language}`;
                    }
                    codeElem.textContent = code;
                    pre.appendChild(codeElem);
                    codeBlock.appendChild(pre);
                    
                    // Add buttons for copy and run (if applicable)
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'code-buttons';
                    
                    const copyButton = document.createElement('button');
                    copyButton.className = 'code-btn copy-btn';
                    copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> Copy';
                    copyButton.addEventListener('click', function() {
                        navigator.clipboard.writeText(code).then(() => {
                            copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Copied!';
                            setTimeout(() => {
                                copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> Copy';
                            }, 2000);
                        });
                    });
                    buttonContainer.appendChild(copyButton);
                    codeBlock.appendChild(buttonContainer);
                    
                    // Add the code block to content
                    contentElement.appendChild(codeBlock);
                    
                    // Process any remaining text after the code block
                    if (endIndex + 3 < part.length) {
                        currentText = part.substring(endIndex + 3);
                    } else {
                        currentText = '';
                    }
                    
                    inCodeBlock = false;
                }
            } else {
                // For regular text content
                currentText = part;
            }
            
            // Process any accumulated regular text
            if (currentText.trim()) {
                // Process the message for proper formatting
                // First replace any double newlines with a special marker to preserve paragraph breaks
                const formattedText = currentText.replace(/\n\n+/g, '||PARAGRAPH||');
                
                // Then handle single newlines
                const withLineBreaks = formattedText.replace(/\n/g, '||LINEBREAK||');
                
                // Split by paragraph marker
                const paragraphs = withLineBreaks.split('||PARAGRAPH||');
                
                paragraphs.forEach(paragraph => {
                    if (paragraph.trim()) {
                        // For each paragraph, create a separate element
                        const p = document.createElement('p');
                        
                        // Check if this is a heading
                        if (paragraph.trim().match(/^(#+)\s+(.+)$/)) {
                            const headingMatch = paragraph.trim().match(/^(#+)\s+(.+)$/);
                            const headingLevel = Math.min(headingMatch[1].length, 6);
                            const headingText = headingMatch[2];
                            
                            // Create heading element
                            const heading = document.createElement(`h${headingLevel}`);
                            heading.textContent = headingText;
                            contentElement.appendChild(heading);
                            return;
                        }
                        
                        // Check if this is a section like "✅ Explanation:"
                        if (paragraph.trim().startsWith('✅')) {
                            p.className = 'explanation-section';
                        }
                        
                        // Handle line breaks within paragraphs
                        if (paragraph.includes('||LINEBREAK||')) {
                            const lines = paragraph.split('||LINEBREAK||');
                            
                            // Check if this appears to be a list
                            if (lines.some(line => line.trim().match(/^(\d+\.|\-|\•|\*)\s+/))) {
                                // Create a list element
                                const isList = lines[0].trim().match(/^(\d+\.)\s+/) ? 'ol' : 'ul';
                                const list = document.createElement(isList);
                                
                                lines.forEach(line => {
                                    const trimmedLine = line.trim();
                                    if (trimmedLine) {
                                        // Remove the list marker
                                        const listContent = trimmedLine.replace(/^(\d+\.|\-|\•|\*)\s+/, '');
                                        const li = document.createElement('li');
                                        li.textContent = listContent;
                                        list.appendChild(li);
                                    }
                                });
                                
                                contentElement.appendChild(list);
                            } else {
                                // Regular paragraph with line breaks
                                p.innerHTML = lines
                                    .map(line => line.trim().replace(/^\s*\*\s+/g, ''))
                                    .filter(line => line.length > 0)
                                    .join('<br>');
                                contentElement.appendChild(p);
                            }
                        } else {
                            // Regular paragraph
                            p.textContent = paragraph.trim().replace(/^\s*\*\s+/g, '');
                            contentElement.appendChild(p);
                        }
                    }
                });
            }
        });
    } else {
        // Process regular messages (no code blocks)
        // First replace any double newlines with a special marker to preserve paragraph breaks
        const formattedMessage = message.replace(/\n\n+/g, '||PARAGRAPH||');
        
        // Then handle single newlines
        const withLineBreaks = formattedMessage.replace(/\n/g, '||LINEBREAK||');
        
        // Split by paragraph marker
        const paragraphs = withLineBreaks.split('||PARAGRAPH||');
        
        paragraphs.forEach(paragraph => {
            if (paragraph.trim()) {
                // For each paragraph, create a separate element
                const p = document.createElement('p');
                
                // Check if this is a heading
                if (paragraph.trim().match(/^(#+)\s+(.+)$/)) {
                    const headingMatch = paragraph.trim().match(/^(#+)\s+(.+)$/);
                    const headingLevel = Math.min(headingMatch[1].length, 6);
                    const headingText = headingMatch[2];
                    
                    // Create heading element
                    const heading = document.createElement(`h${headingLevel}`);
                    heading.textContent = headingText;
                    contentElement.appendChild(heading);
                    return;
                }
                
                // Handle line breaks within paragraphs
                if (paragraph.includes('||LINEBREAK||')) {
                    const lines = paragraph.split('||LINEBREAK||');
                    
                    // Check if this appears to be a list
                    if (lines.some(line => line.trim().match(/^(\d+\.|\-|\•|\*)\s+/))) {
                        // Create a list element
                        const isList = lines[0].trim().match(/^(\d+\.)\s+/) ? 'ol' : 'ul';
                        const list = document.createElement(isList);
                        
                        lines.forEach(line => {
                            const trimmedLine = line.trim();
                            if (trimmedLine) {
                                // Remove the list marker
                                const listContent = trimmedLine.replace(/^(\d+\.|\-|\•|\*)\s+/, '');
                                const li = document.createElement('li');
                                li.textContent = listContent;
                                list.appendChild(li);
                            }
                        });
                        
                        contentElement.appendChild(list);
                    } else {
                        // Regular paragraph with line breaks
                        p.innerHTML = lines
                            .map(line => line.trim().replace(/^\s*\*\s+/g, ''))
                            .filter(line => line.length > 0)
                            .join('<br>');
                        contentElement.appendChild(p);
                    }
                } else {
                    // Regular paragraph
                    p.textContent = paragraph.trim().replace(/^\s*\*\s+/g, '');
                    contentElement.appendChild(p);
                }
            }
        });
    }
    
    messageElement.appendChild(contentElement);
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add to chat history
    chatHistory.push({ 
        sender, 
        message,
        messageType,
        timestamp: new Date().toISOString() 
    });
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
    
    // Simulate typing delay
    setTimeout(() => {
        // Remove typing indicator
        if (typingIndicator.parentNode) {
            typingIndicator.parentNode.removeChild(typingIndicator);
        }
        
        let response = '';
        let messageType = 'ai';
        
        // Generate response based on user message
        if (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi')) {
            response = "Hello! I'm your PDF assistant. How can I help you with this document today?";
        } else if (userMessage.toLowerCase().includes('help')) {
            response = "I can help you understand the content of your PDF. You can ask me questions about specific pages, search for information, or request summaries of sections.";
        } else if (userMessage.toLowerCase().includes('thank')) {
            response = "You're welcome! If you have any more questions about the PDF, feel free to ask.";
            messageType = 'success';
        } else if (userMessage.toLowerCase().includes('error') || userMessage.toLowerCase().includes('problem') || userMessage.toLowerCase().includes('issue')) {
            response = "I notice you're mentioning an issue. If you're having problems with the PDF display, try using the zoom controls or navigating to a different page. If problems persist, please refresh the page.";
            messageType = 'warning';
        } else if (userMessage.toLowerCase().includes('not working') || userMessage.toLowerCase().includes('broken')) {
            response = "I'm sorry to hear something isn't working properly. Could you provide more details about the problem so I can try to help you resolve it?";
            messageType = 'error';
        } else if (userMessage.toLowerCase().includes('zoom')) {
            response = "You can use the zoom controls in the toolbar above the PDF. Click the + button to zoom in, the - button to zoom out, or the reset button to return to the default zoom level.";
        } else if (userMessage.toLowerCase().includes('navigate') || userMessage.toLowerCase().includes('page')) {
            response = "To navigate between pages, use the previous and next buttons in the toolbar. You can also see your current page number and the total number of pages displayed in the center.";
        } else if (userMessage.toLowerCase().includes('search')) {
            response = "You can search for text in the PDF using the search box in the toolbar. Type your search term and press Enter or click the search icon to find matches within the document.";
        } else if (userMessage.toLowerCase().includes('highlight')) {
            response = "To highlight text, click the highlight button in the toolbar, then select the text you want to highlight in the PDF. Click the highlight button again to exit highlight mode.";
        } else if (userMessage.toLowerCase().includes('download')) {
            response = "You can download the PDF by clicking the download button in the toolbar. This will save the current PDF to your device.";
        } else if (userMessage.toLowerCase().includes('share') || userMessage.toLowerCase().includes('export')) {
            response = "You can share or export this chat using the buttons at the top of the chat panel. The share button allows you to share the conversation, while the export button lets you download the chat as a text file.";
            messageType = 'system';
        } else if (userMessage.toLowerCase().includes('clear') || userMessage.includes('delete')) {
            response = "You can clear the chat history by clicking the trash icon at the top of the chat panel. This will remove all messages and start a new conversation.";
            messageType = 'system';
        } else {
            response = "I've analyzed the document and found relevant information related to your question. The document discusses this topic in detail, particularly on pages 2-3 where key concepts are explained. Would you like me to elaborate on any specific aspect?";
        }
        
        // Add AI response to chat
        addMessageToChat(response, 'ai', messageType);
        
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
    
    // Create or update search controls
    let controls = document.querySelector('.search-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'search-controls';
        controls.innerHTML = `
            <span class="search-count">0 of ${totalResults}</span>
            <button class="search-nav-btn" id="prev-result" title="Previous result">
                <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
            </button>
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
    }
    
    controls.classList.add('visible');
}

function hideSearchControls() {
    const controls = document.querySelector('.search-controls');
    if (controls) {
        controls.classList.remove('visible');
    }
}

function navigateToSearchResult(index) {
    if (searchResults.length === 0) return;
    
    // Remove current highlight class
    if (currentSearchIndex !== -1 && searchResults[currentSearchIndex].element) {
        searchResults[currentSearchIndex].element.classList.remove('current');
    }
    
    // Update index with wrapping
    currentSearchIndex = (index + searchResults.length) % searchResults.length;
    
    const result = searchResults[currentSearchIndex];
    
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
