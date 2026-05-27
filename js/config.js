// ============ CONFIGURATION - WITH CORS PROXY OPTION ==========

// Helper function to get proxied URL if needed
function getFeedUrl(originalUrl) {
    // Use CORS proxy if direct fetch fails
    const useProxy = true; // Set to true if you're getting HTML instead of RSS
    if (useProxy) {
        return `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`;
    }
    return originalUrl;
}

const CONFIG = {
    LAYOUT: { ROW_HEIGHT: 80, GRID_ROW_HEIGHT: 220, BUFFER: 5, HEADER_HEIGHT: 70, QUEUE_MAX_HEIGHT: 300 },
    VIDEO: { ASPECT_RATIO: 16 / 9, SKIP_SECONDS: 10, RESUME_THRESHOLD: 2 },
    PERFORMANCE: { DEBOUNCE_DELAY: 300, SCROLL_THROTTLE: 16, CACHE_TIMEOUT: 5 * 60 * 1000, MAX_RETRIES: 20, RETRY_DELAY: 50 },
    UI: { TOAST_DURATION: 3000, SKELETON_ROW_COUNT: 8, FLYOUT_ANIMATION_DURATION: 150 },
    FEEDS: {
        HOURLY_VIDEO: getFeedUrl('https://rss.alexjones.media/AJNHourlyVideo.xml'),
        HOURLY_AUDIO: getFeedUrl('https://rss.alexjones.media/AJNHourlyAudio.xml'),
        ALEX_JONES_SHOW: getFeedUrl('https://rss.alexjones.media/AlexJonesShow.xml'),
        WAR_ROOM: getFeedUrl('https://rss.alexjones.media/WarRoom.xml')
    },
    STORAGE_KEYS: { APP_STATE: 'ajn-app-state', QUEUE: 'ajn-user-queue', DARK_MODE: 'darkMode', VIEW_MODE: 'ajn_view_mode', PLAYBACK_POSITIONS: 'ajn_playback_positions_v2' }
};

function applyCssVariables() {
    const root = document.documentElement;
    root.style.setProperty('--row-height', `${CONFIG.LAYOUT.ROW_HEIGHT}px`);
    root.style.setProperty('--grid-row-height', `${CONFIG.LAYOUT.GRID_ROW_HEIGHT}px`);
    root.style.setProperty('--header-height', `${CONFIG.LAYOUT.HEADER_HEIGHT}px`);
    root.style.setProperty('--queue-max-height', `${CONFIG.LAYOUT.QUEUE_MAX_HEIGHT}px`);
}

// Make available globally
window.CONFIG = CONFIG;
window.applyCssVariables = applyCssVariables;
