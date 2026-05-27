// ============ URL SANITIZER ==========

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'ftp:', 'mailto:'];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.mov', '.avi', '.mkv', '.webm'];

function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url, window.location.href);
        return ALLOWED_PROTOCOLS.includes(parsed.protocol);
    } catch (e) {
        return false;
    }
}

function isValidVideoUrl(url) {
    if (!isValidUrl(url)) return false;
    try {
        const parsed = new URL(url);
        const pathname = parsed.pathname.toLowerCase();
        return ALLOWED_VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
    } catch (e) {
        return false;
    }
}

function sanitizeUrl(url, fallback = '#') {
    if (!url || typeof url !== 'string') return fallback;
    try {
        const parsed = new URL(url, window.location.href);
        if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) return url;
    } catch (e) {}
    console.warn(`Blocked unsafe URL: ${url.substring(0, 100)}`);
    return fallback;
}

function validateShareUrl(url) {
    if (!url) return null;
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        return trimmedUrl;
    }
    console.warn('Blocked sharing of non-http/https URL');
    return null;
}