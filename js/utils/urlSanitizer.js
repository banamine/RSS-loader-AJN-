// ============ URL SANITIZER - PROTOCOL WHITELIST ==========
// Prevents XSS via javascript: or data: URLs

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'ftp:', 'mailto:'];

// Allowed video file extensions
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.mov', '.avi', '.mkv', '.webm'];

/**
 * Validates a URL against allowed protocols
 */
export function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
        const parsed = new URL(url, window.location.href);
        return ALLOWED_PROTOCOLS.includes(parsed.protocol);
    } catch (e) {
        // Invalid URL format
        return false;
    }
}

/**
 * Validates a URL for video content
 */
export function isValidVideoUrl(url) {
    if (!isValidUrl(url)) return false;
    
    try {
        const parsed = new URL(url);
        const pathname = parsed.pathname.toLowerCase();
        return ALLOWED_VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
    } catch (e) {
        return false;
    }
}

/**
 * Sanitizes a URL for safe use in href/src attributes
 */
export function sanitizeUrl(url, fallback = '#') {
    if (!url || typeof url !== 'string') return fallback;
    
    // Check protocol
    try {
        const parsed = new URL(url, window.location.href);
        if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
            return url;
        }
    } catch (e) {
        // Fall through to fallback
    }
    
    console.warn(`Blocked unsafe URL: ${url.substring(0, 100)}`);
    return fallback;
}

/**
 * Validates share URL for navigator.share() API
 */
export function validateShareUrl(url) {
    if (!url) return null;
    
    // Only allow http/https for sharing
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        return trimmedUrl;
    }
    
    console.warn('Blocked sharing of non-http/https URL');
    return null;
}