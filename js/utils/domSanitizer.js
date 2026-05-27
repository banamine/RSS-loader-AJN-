// ============ DOM-BASED HTML SANITIZER ==========
// No regex, no eval - uses browser's own DOM parsing

/**
 * Safely strips HTML tags using DOM methods (no regex)
 * This is safer than regex-based stripping which can be bypassed
 */
export function stripHtml(html) {
    if (!html || typeof html !== 'string') return '';
    
    // Use browser's DOM parser - safe because we never insert into document
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Get text content - automatically strips all HTML tags
    // This is the safest approach as it uses the browser's own parsing
    return doc.body.textContent || '';
}

/**
 * Safely extracts text from potential HTML content
 * Preserves line breaks and basic formatting as spaces
 */
export function sanitizeText(html) {
    if (!html || typeof html !== 'string') return '';
    
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = doc.body.textContent || '';
    
    // Normalize whitespace (replace multiple spaces with single space)
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Sanitizes episode description for safe display
 * Converts HTML to plain text safely
 */
export function sanitizeDescription(html, maxLength = 500) {
    if (!html) return 'No description available';
    
    let sanitized = stripHtml(html);
    
    // Trim to max length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength) + '...';
    }
    
    return sanitized || 'No description available';
}

/**
 * Safe alternative to innerHTML for text content
 * Use this when you need to set text that might contain HTML entities
 */
export function setSafeText(element, text) {
    if (!element) return;
    
    // Use textContent - automatically escapes HTML
    if (element.textContent !== undefined) {
        element.textContent = text;
    } else {
        element.innerText = text;
    }
}

/**
 * Creates a DOM element with sanitized text content
 * Safe alternative to using innerHTML with user data
 */
export function createSafeElement(tag, text, className = '') {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
}