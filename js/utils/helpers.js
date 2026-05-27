// ============ HELPER FUNCTIONS - GLOBAL SCOPE ==========

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toCentralTime(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

function formatCentralTime(date) {
    if (!date) return 'Date unknown';
    return date.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatShortDate(date) {
    if (!date) return 'Unknown';
    return date.toLocaleDateString('en-US', {
        timeZone: 'America/Chicago',
        month: 'short',
        day: 'numeric'
    });
}

function transformVideoUrl(originalUrl) {
    if (!originalUrl) return '#';
    const filename = originalUrl.substring(originalUrl.lastIndexOf('/') + 1);
    if (filename.endsWith('.m4v') || filename.endsWith('.mp4')) {
        return `https://ajn.archives.pub/hourly-m4v/${filename}`;
    }
    return originalUrl;
}

function parseEpisodeDetails(title) {
    const warRoomMatch = title.match(/WarRoom[- ]Hr(\d+)/i);
    const alexMatch = title.match(/Alex[- ]Jones[- ]Show[- ]Hr(\d+)/i);
    if (warRoomMatch) return { show: 'War Room', hour: `Hour ${warRoomMatch[1]}` };
    if (alexMatch) return { show: 'Alex Jones Show', hour: `Hour ${alexMatch[1]}` };
    return { show: 'Episode', hour: '' };
}

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function showToast(message, duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}