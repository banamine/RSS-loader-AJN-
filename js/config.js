// ============ CENTRALIZED CONFIGURATION ==========
// Single source of truth for all constants

export const CONFIG = {
    // Layout constants
    LAYOUT: {
        ROW_HEIGHT: 80,
        GRID_ROW_HEIGHT: 220,
        BUFFER: 5,
        HEADER_HEIGHT: 70,
        QUEUE_MAX_HEIGHT: 300
    },
    
    // Video constants
    VIDEO: {
        ASPECT_RATIO: 16 / 9,
        SKIP_SECONDS: 10,
        RESUME_THRESHOLD: 2 // seconds from end to mark as completed
    },
    
    // Performance constants
    PERFORMANCE: {
        DEBOUNCE_DELAY: 300,
        SCROLL_THROTTLE: 16,
        CACHE_TIMEOUT: 5 * 60 * 1000, // 5 minutes
        MAX_RETRIES: 20,
        RETRY_DELAY: 50
    },
    
    // UI constants
    UI: {
        TOAST_DURATION: 3000,
        SKELETON_ROW_COUNT: 8,
        FLYOUT_ANIMATION_DURATION: 150
    },
    
    // Feed URLs
    FEEDS: {
        HOURLY_VIDEO: 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/AJNHourlyVideo.xml',
        HOURLY_AUDIO: 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/AJNHourlyAudio.xml',
        ALEX_JONES_SHOW: 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/AlexJonesShow.xml',
        WAR_ROOM: 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/WarRoom.xml'
    },
    
    // Storage keys
    STORAGE_KEYS: {
        APP_STATE: 'ajn-app-state',
        QUEUE: 'ajn-user-queue',
        DARK_MODE: 'darkMode',
        VIEW_MODE: 'ajn_view_mode',
        PLAYBACK_POSITIONS: 'ajn_playback_positions_v2'
    },
    
    // CSS Variables mapping
    CSS_VARS: {
        rowHeight: '--row-height',
        gridRowHeight: '--grid-row-height',
        headerHeight: '--header-height',
        queueMaxHeight: '--queue-max-height'
    }
};

// Helper to apply CSS variables to document root
export function applyCssVariables() {
    const root = document.documentElement;
    root.style.setProperty(CONFIG.CSS_VARS.rowHeight, `${CONFIG.LAYOUT.ROW_HEIGHT}px`);
    root.style.setProperty(CONFIG.CSS_VARS.gridRowHeight, `${CONFIG.LAYOUT.GRID_ROW_HEIGHT}px`);
    root.style.setProperty(CONFIG.CSS_VARS.headerHeight, `${CONFIG.LAYOUT.HEADER_HEIGHT}px`);
    root.style.setProperty(CONFIG.CSS_VARS.queueMaxHeight, `${CONFIG.LAYOUT.QUEUE_MAX_HEIGHT}px`);
}

// Export individual constants for convenience
export const ROW_HEIGHT = CONFIG.LAYOUT.ROW_HEIGHT;
export const GRID_ROW_HEIGHT = CONFIG.LAYOUT.GRID_ROW_HEIGHT;
export const BUFFER = CONFIG.LAYOUT.BUFFER;
export const SKIP_SECONDS = CONFIG.VIDEO.SKIP_SECONDS;
export const DEBOUNCE_DELAY = CONFIG.PERFORMANCE.DEBOUNCE_DELAY;
export const TOAST_DURATION = CONFIG.UI.TOAST_DURATION;