// Global variables
let extractedData = {};
let textWrapEnabled = true;
let chartInstance = null;

// Regex patterns for data extraction
const patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
    phone: /\b(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    date: /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})|(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})|(\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/gi,
    number: /\b\d+(?:\.\d+)?\b/g
};

// Check if device is mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    setupFileUpload();
    setupImageUpload();
    setupRealtimeExtraction();
    loadTheme();
    adjustForMobile();
});

// Adjust UI for mobile devices
function adjustForMobile() {
    if (isMobile) {
        document.getElementById('documentText').style.height = '150px';
        document.getElementById('realtimeExtraction').checked = false;
    }
}

// Theme toggle
function toggleTheme() {
    try {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.textContent = isDarkMode ? '☀' : '🌙';
        themeToggle.setAttribute('aria-label', `Switch to ${isDarkMode ? 'light' : 'dark'} mode`);
        
        // Save theme preference
        try {
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        } catch (error) {
            console.warn('localStorage not available:', error);
            showNotification('Theme preference not saved (private browsing?)', 'warning');
        }
        
        showNotification(`Switched to ${isDarkMode ? 'dark' : 'light'} mode`);
    } catch (error) {
        console.error('Error toggling theme:', error);
        showNotification('Failed to toggle theme', 'error');
    }
}

// Load saved theme
function loadTheme() {
    try {
        const savedTheme = localStorage.getItem('theme');
        const themeToggle = document.getElementById('themeToggle');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.textContent = '☀';
            themeToggle.setAttribute('aria-label', 'Switch to light mode');
        } else {
            document.body.classList.remove('dark-mode');
            themeToggle.textContent = '🌙';
            themeToggle.setAttribute('aria-label', 'Switch to dark mode');
        }
    } catch (error) {
        console.warn('Error loading theme:', error);
        showNotification('Failed to load theme preference', 'warning');
    }
}

// Input method switching
function showInputMethod(method) {
    document.querySelectorAll('.input-method').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    
    const activeTab = document.querySelector(`[onclick="showInputMethod('${method}')"]`);
    document.getElementById(`${method}-input`).classList.add('active');
    activeTab.classList.add('active');
    activeTab.setAttribute('aria-selected', 'true');
}

// File upload setup
function setupFileUpload() {
    const fileUpload = document.querySelector('#file-input .file-upload');
    const fileInput = document.getElementById('fileInput');
    
    fileUpload.addEventListener('dragover', e => {
        e.preventDefault();
        fileUpload.classList.add('dragover');
    });
    
    fileUpload.addEventListener('dragleave', e => {
        e.preventDefault();
        fileUpload.classList.remove('dragover');
    });
    
    fileUpload.addEventListener('drop', e => {
        e.preventDefault();
        fileUpload.classList.remove('dragover');
        processFiles(Array.from(e.dataTransfer.files));
    });
    
    fileInput.addEventListener('change', () => processFiles(Array.from(fileInput.files)));
    
    fileUpload.addEventListener('touchstart', () => fileInput.click());
}

// Image upload setup
function setupImageUpload() {
    const imageUpload = document.querySelector('#image-input .file-upload');
    const imageInput = document.getElementById('imageInput');
    
    imageUpload.addEventListener('dragover', e => {
        e.preventDefault();
        imageUpload.classList.add('dragover');
    });
    
    imageUpload.addEventListener('dragleave', e => {
        e.preventDefault();
        imageUpload.classList.remove('dragover');
    });
    
    imageUpload.addEventListener('drop', e => {
        e.preventDefault();
        imageUpload.classList.remove('dragover');
        processImages(Array.from(e.dataTransfer.files));
    });
    
    imageInput.addEventListener('change', () => processImages(Array.from(imageInput.files)));
    
    imageUpload.addEventListener('touchstart', () => imageInput.click());
}

// Process uploaded files (including PDFs)
async function processFiles(files) {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    showLoading(true, 'Processing files...');
    let combinedText = '';
    
    for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
            showNotification(`File ${file.name} exceeds 10MB limit`, 'error');
            continue;
        }
        
        try {
            if (file.type === 'application/pdf') {
                const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
                let text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(item => item.str).join(' ') + '\n';
                }
                combinedText += `\n\n--- ${file.name} ---\n${text}`;
            } else {
                const text = await file.text();
                combinedText += `\n\n--- ${file.name} ---\n${text}`;
            }
        } catch (error) {
            showNotification(`Error processing ${file.name}`, 'error');
        }
    }
    
    document.getElementById('documentText').value += combinedText;
    showLoading(false);
    showNotification(`Processed ${files.length} file(s) successfully`);
}

// Process uploaded images with OCR
async function processImages(files) {
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const imagePreview = document.getElementById('imagePreview');
    const ocrProgress = document.getElementById('ocrProgress');
    ocrProgress.classList.add('show');
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = '<div class="progress-fill" style="width: 0%"></div>';
    ocrProgress.appendChild(progressBar);
    
    let combinedText = '';
    let processedCount = 0;
    const totalFiles = files.length;
    
    showLoading(true, 'Processing images with OCR...');
    
    const maxConcurrent = isMobile ? 1 : 2;
    const queue = Array.from(files);
    const processBatch = async () => {
        while (queue.length > 0) {
            const file = queue.shift();
            if (file.size > MAX_FILE_SIZE) {
                showNotification(`File ${file.name} exceeds 10MB limit`, 'error');
                continue;
            }
            
            if (!file.type.startsWith('image/')) {
                showNotification(`${file.name} is not an image file`, 'warning');
                continue;
            }
            
            try {
                const previewItem = createImagePreview(file);
                imagePreview.appendChild(previewItem);
                updateLoadingText(`Processing ${file.name}...`);
                
                const { data: { text } } = await Tesseract.recognize(file, 'eng', {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            const progress = Math.round(m.progress * 100);
                            updateImageStatus(previewItem, `Processing... ${progress}%`, 'processing');
                        }
                    }
                });
                
                combinedText += `\n\n--- ${file.name} (OCR) ---\n${text}`;
                updateImageStatus(previewItem, 'Completed ✓', 'completed');
                processedCount++;
                
                const progress = (processedCount / totalFiles) * 100;
                progressBar.querySelector('.progress-fill').style.width = `${progress}%`;
            } catch (error) {
                const previewItem = imagePreview.querySelector(`[data-filename="${file.name}"]`);
                if (previewItem) updateImageStatus(previewItem, 'Error ✗', 'error');
                showNotification(`Error processing ${file.name}`, 'error');
            }
        }
    };
    
    await Promise.all(Array(Math.min(maxConcurrent, queue.length)).fill().map(processBatch));
    
    document.getElementById('documentText').value += combinedText;
    showLoading(false);
    ocrProgress.classList.remove('show');
    showNotification(`Successfully processed ${processedCount} image(s) with OCR`);
}

// Create image preview element
function createImagePreview(file) {
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    previewItem.setAttribute('data-filename', file.name);
    
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = `Preview of ${file.name}`;
    img.onload = () => URL.revokeObjectURL(img.src);
    
    const filename = document.createElement('div');
    filename.className = 'filename';
    filename.textContent = file.name;
    
    const status = document.createElement('div');
    status.className = 'status processing';
    status.textContent = 'Queued...';
    
    previewItem.appendChild(img);
    previewItem.appendChild(filename);
    previewItem.appendChild(status);
    
    return previewItem;
}

// Update image processing status
function updateImageStatus(previewItem, statusText, statusClass) {
    const statusElement = previewItem.querySelector('.status');
    statusElement.textContent = statusText;
    statusElement.className = `status ${statusClass}`;
}

// Real-time extraction setup
function setupRealtimeExtraction() {
    document.getElementById('documentText').addEventListener('input', debounce(() => {
        if (document.getElementById('realtimeExtraction').checked) {
            extractAll();
        }
    }, isMobile ? 1000 : 500));
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Extract all text function
function extractAllText() {
    const text = document.getElementById('documentText').value;
    
    if (!text.trim()) {
        showNotification('Please add some content first!', 'warning');
        return;
    }
    
    extractedData.allText = text;
    displayAllText(text);
    showNotification('Complete text extracted successfully');
}

// Display all text function
function displayAllText(text) {
    const resultBox = document.getElementById('allTextResults');
    const textDisplay = document.getElementById('textDisplay');
    const countSpan = document.getElementById('allTextCount');
    
    resultBox.classList.add('show');
    
    if (!text || !text.trim()) {
        textDisplay.innerHTML = 'No text content available';
        textDisplay.className = 'text-display empty';
        countSpan.textContent = '0';
        return;
    }
    
    const charCount = text.length;
    const wordCount = text.trim().split(/\s+/).length;
    const lineCount = text.split('\n').length;
    
    countSpan.textContent = isMobile ? `${wordCount} words` : `${charCount} chars, ${wordCount} words, ${lineCount} lines`;
    textDisplay.textContent = text;
    textDisplay.className = textWrapEnabled ? 'text-display' : 'text-display no-wrap';
}

// Toggle text wrap
function toggleTextWrap() {
    textWrapEnabled = !textWrapEnabled;
    const textDisplay = document.getElementById('textDisplay');
    
    if (textDisplay && extractedData.allText) {
        textDisplay.className = textWrapEnabled ? 'text-display' : 'text-display no-wrap';
        showNotification(`Text wrap ${textWrapEnabled ? 'enabled' : 'disabled'}`);
    }
}

// Download text function
function downloadText() {
    if (!extractedData.allText) {
        showNotification('No text to download', 'warning');
        return;
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `extracted-text-${timestamp}.txt`;
    downloadFile(extractedData.allText, filename, 'text/plain');
    showNotification('Text file downloaded');
}

// Data extraction functions
function extractData(type) {
    const text = document.getElementById('documentText').value;
    
    if (!text.trim()) {
        showNotification('Please add some content first!', 'warning');
        return;
    }
    
    const pattern = patterns[type];
    const matches = text.match(pattern) || [];
    const results = [...new Set(matches)];
    
    extractedData[type] = results;
    displayResults(type, results);
}

function extractEmails() { extractData('email'); }
function extractUrls() { extractData('url'); }
function extractPhones() { extractData('phone'); }
function extractDates() { extractData('date'); }
function extractNumbers() { extractData('number'); }

function extractCustom() {
    const customPattern = document.getElementById('customPattern').value;
    const text = document.getElementById('documentText').value;
    
    if (!customPattern) {
        showNotification('Please enter a custom pattern', 'warning');
        return;
    }
    
    if (!text.trim()) {
        showNotification('Please add some content first!', 'warning');
        return;
    }
    
    try {
        const regex = new RegExp(customPattern, 'gi');
        const matches = text.match(regex) || [];
        const results = [...new Set(matches)];
        
        extractedData.custom = results;
        displayResults('custom', results);
        showNotification(`Found ${results.length} matches`);
    } catch (error) {
        showNotification('Invalid regex pattern', 'error');
    }
}

function extractAll() {
    const types = ['email', 'url', 'phone', 'date', 'number', 'custom'];
    types.forEach(type => {
        if (type === 'custom' && !document.getElementById('customPattern').value) return;
        extractData(type);
    });
    extractAllText();
    showNotification('Extracted all data types including complete text');
}

// Display results
function displayResults(type, results) {
    const resultBox = document.getElementById(`${type}Results`);
    const contentDiv = document.getElementById(`${type}Content`);
    const countSpan = document.getElementById(`${type}Count`);
    
    resultBox.classList.add('show');
    countSpan.textContent = results.length;
    
    if (results.length === 0) {
        contentDiv.innerHTML = '<div class="no-results">No results found</div>';
        return;
    }
    
    contentDiv.innerHTML = results.map(item => 
        `<div class="result-item" role="button" tabindex="0" onclick="copyToClipboard('${escapeHtml(item)}')" onkeypress="if(event.key === 'Enter') copyToClipboard('${escapeHtml(item)}')">${escapeHtml(item)}</div>`
    ).join('');
}

// Show analytics dashboard
function showAnalytics() {
    const dashboard = document.getElementById('analyticsDashboard');
    dashboard.style.display = 'block';
    
    const counts = {
        Emails: extractedData.email?.length || 0,
        URLs: extractedData.url?.length || 0,
        Phones: extractedData.phone?.length || 0,
        Dates: extractedData.date?.length || 0,
        Numbers: extractedData.number?.length || 0,
        Custom: extractedData.custom?.length || 0
    };
    
    if (chartInstance) chartInstance.destroy();
    
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                label: 'Extracted Items',
                data: Object.values(counts),
                backgroundColor: '#667eea',
                borderColor: '#764ba2',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: !isMobile,
            scales: {
                y: { beginAtZero: true, title: { display: !isMobile, text: 'Count' } },
                x: { title: { display: !isMobile, text: 'Data Type' } }
            },
            plugins: { legend: { display: false } }
        }
    });
    
    showNotification('Analytics dashboard updated');
}

// Export functionality
function exportResults(format) {
    if (Object.keys(extractedData).length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    let content, filename, mimeType;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    switch (format) {
        case 'json':
            content = JSON.stringify(extractedData, null, 2);
            filename = `extracted-data-${timestamp}.json`;
            mimeType = 'application/json';
            break;
        case 'csv':
            content = convertToCSV(extractedData);
            filename = `extracted-data-${timestamp}.csv`;
            mimeType = 'text/csv';
            break;
        case 'txt':
            content = convertToTXT(extractedData);
            filename = `extracted-data-${timestamp}.txt`;
            mimeType = 'text/plain';
            break;
    }
    
    downloadFile(content, filename, mimeType);
    showNotification(`Data exported as ${format.toUpperCase()}`);
}

function convertToCSV(data) {
    let csv = 'Type,Value,Index\n';
    Object.entries(data).forEach(([type, values]) => {
        if (type === 'allText') {
            const lines = values.split('\n');
            lines.forEach((line, index) => {
                if (line.trim()) {
                    const escapedLine = `"${line.replace(/"/g, '""').replace(/,/g, '\\,')}"`;
                    csv += `"${type}",${escapedLine},${index + 1}\n`;
                }
            });
        } else if (Array.isArray(values)) {
            values.forEach((value, index) => {
                const escapedValue = `"${value.replace(/"/g, '""').replace(/,/g, '\\,')}"`;
                csv += `"${type}",${escapedValue},${index + 1}\n`;
            });
        }
    });
    return csv;
}

function convertToTXT(data) {
    let txt = 'EXTRACTED DATA REPORT\n';
    txt += '='.repeat(50) + '\n';
    txt += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    Object.entries(data).forEach(([type, values]) => {
        if (type === 'allText') {
            txt += `COMPLETE TEXT:\n`;
            txt += '-'.repeat(30) + '\n';
            txt += values + '\n\n';
            txt += '='.repeat(50) + '\n\n';
        } else if (Array.isArray(values)) {
            txt += `${type.toUpperCase()} (${values.length} items):\n`;
            txt += '-'.repeat(30) + '\n';
            values.forEach((value, index) => {
                txt += `${index + 1}. ${value}\n`;
            });
            txt += '\n';
        }
    });
    return txt;
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyAllResults() {
    let allResults = '';
    
    if (extractedData.allText) {
        allResults += 'COMPLETE TEXT:\n';
        allResults += '='.repeat(30) + '\n';
        allResults += extractedData.allText + '\n\n';
    }
    
    Object.entries(extractedData).forEach(([type, values]) => {
        if (type !== 'allText' && Array.isArray(values) && values.length > 0) {
            allResults += `${type.toUpperCase()}:\n${values.join('\n')}\n\n`;
        }
    });
    
    if (allResults) {
        copyToClipboard(allResults);
        showNotification('All results copied to clipboard');
    } else {
        showNotification('No results to copy', 'warning');
    }
}

// Clear all data
function clearAll() {
    document.getElementById('documentText').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('ocrProgress').innerHTML = '';
    document.getElementById('customPattern').value = '';
    document.getElementById('realtimeExtraction').checked = false;
    
    extractedData = {};
    document.querySelectorAll('.result-box').forEach(box => box.classList.remove('show'));
    
    const textDisplay = document.getElementById('textDisplay');
    if (textDisplay) {
        textDisplay.innerHTML = '';
        textDisplay.className = 'text-display';
    }
    
    if (chartInstance) {
        chartInstance.destroy();
        document.getElementById('analyticsDashboard').style.display = 'none';
    }
    
    showNotification('All content cleared');
}

// Utility functions
function showLoading(show, text = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    loadingText.textContent = text;
    overlay.classList.toggle('show', show);
}

function updateLoadingText(text) {
    document.getElementById('loadingText').textContent = text;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) notification.remove();
    }, 3000);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!');
    }).catch(() => {
        fallbackCopyTextToClipboard(text);
    });
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification('Copied to clipboard!');
    } catch (err) {
        showNotification('Failed to copy', 'error');
    }
    
    document.body.removeChild(textArea);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        extractAll();
    }
    if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        extractAllText();
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        clearAll();
    }
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (extractedData.allText) downloadText();
    }
});

console.log('Advanced Data Extractor with OCR loaded successfully! 🚀📸📄');