// ============ HELPER FUNCTIONS ============

// Transform video URL to playable format
function transformVideoUrl(originalUrl) {
    if (!originalUrl) return '#';
    const filename = originalUrl.substring(originalUrl.lastIndexOf('/') + 1);
    if (filename.endsWith('.m4v') || filename.endsWith('.mp4')) {
        return `https://ajn.archives.pub/hourly-m4v/${filename}`;
    }
    return originalUrl;
}

// Convert to Central Time
function toCentralTime(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

// Format date for display
function formatCentralTime(date) {
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
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Parse episode details from title
function parseEpisodeDetails(title) {
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
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Show toast notification
function showToast(message, duration = 3000) {
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

// Debounce function for performance
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
