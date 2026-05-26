// ============ HELPER FUNCTIONS ============

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

// Format time (seconds to MM:SS)
export function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
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