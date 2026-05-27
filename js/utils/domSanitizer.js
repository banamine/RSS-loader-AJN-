// ============ DOM SANITIZER ==========

function stripHtml(html) {
    if (!html || typeof html !== 'string') return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
}

function sanitizeText(html) {
    if (!html || typeof html !== 'string') return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = doc.body.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
}

function sanitizeDescription(html, maxLength = 500) {
    if (!html) return 'No description available';
    let sanitized = stripHtml(html);
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength) + '...';
    }
    return sanitized || 'No description available';
}

function setSafeText(element, text) {
    if (!element) return;
    if (element.textContent !== undefined) {
        element.textContent = text;
    } else {
        element.innerText = text;
    }
}

function createSafeElement(tag, text, className = '') {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
}