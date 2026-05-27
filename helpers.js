// ============ HELPER FUNCTIONS - USING NAMED EXPORTS ==========
// All exports are named exports for consistency

// Transform video URL to playable format
export function transformVideoUrl(originalUrl) {
    if (!originalUrl) return '#';
    const filename = originalUrl.substring(originalUrl.lastIndexOf('/') + 1);
    if (filename.endsWith('.m4v') || filename.endsWith('.mp4')) {
        return `https://ajn.archives.pub/hourly-m4v/${filename}`;
    }
    return originalUrl;
}

// Convert to Central Time
export function toCentralTime(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

// Format date for display
export function formatCentralTime(date) {
    if (!date) return 'Date unknown';
    return date.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Format short date
export function formatShortDate(date) {
    if (!date) return 'Unknown';
    return date.toLocaleDateString('en-US', {
        timeZone: 'America/Chicago',
        month: 'short',
        day: 'numeric'
    });
}

// Format time (seconds to MM:SS)
export function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Parse episode details from title
export function parseEpisodeDetails(title) {
    const warRoomMatch = title.match(/WarRoom[- ]Hr(\d+)/i);
    const alexMatch = title.match(/Alex[- ]Jones[- ]Show[- ]Hr(\d+)/i);
    if (warRoomMatch) {
        return { show: 'War Room', hour: `Hour ${warRoomMatch[1]}` };
    }
    if (alexMatch) {
        return { show: 'Alex Jones Show', hour: `Hour ${alexMatch[1]}` };
    }
    if (title.match(/Nightline/i)) {
        return { show: 'Nightline', hour: '' };
    }
    return { show: 'Episode', hour: '' };
}

// Escape HTML to prevent XSS
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Show toast notification
export function showToast(message, duration = 3000) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), duration);
}

// Format date key for comparison (YYYY-MM-DD)
export function formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Trap focus within an element for accessibility
export function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) {
        element.setAttribute('tabindex', '0');
        element.focus();
        const handler = (e) => {
            if (e.key === 'Escape') {
                if (element.parentNode) element.remove();
            }
        };
        element.addEventListener('keydown', handler);
        return () => element.removeEventListener('keydown', handler);
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const previousActiveElement = document.activeElement;

    const handler = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        } else if (e.key === 'Escape') {
            if (element.parentNode) {
                element.remove();
                if (previousActiveElement && previousActiveElement.focus) {
                    previousActiveElement.focus();
                }
            }
        }
    };

    element.addEventListener('keydown', handler);
    firstElement.focus();
    
    return () => {
        element.removeEventListener('keydown', handler);
        if (previousActiveElement && previousActiveElement.focus) {
            previousActiveElement.focus();
        }
    };
}

// Debounce function for performance
export function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Generate stable episode ID
export function generateStableEpisodeId(episode) {
    const { pubDate, title, link } = episode;
    const normalizedString = [
        pubDate || '',
        (title || '').trim(),
        (link || '').split('?')[0]
    ].join('|').toLowerCase();
    
    let hash = 2166136261;
    for (let i = 0; i < normalizedString.length; i++) {
        hash ^= normalizedString.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
        hash >>>= 0;
    }
    
    return hash.toString(16).padStart(8, '0');
}