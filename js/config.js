// ============ CENTRALIZED CONFIGURATION ==========
window.CONFIG = {
    LAYOUT: {
        ROW_HEIGHT: 80,
        GRID_ROW_HEIGHT: 220,
        BUFFER: 5,
        HEADER_HEIGHT: 70,
        QUEUE_MAX_HEIGHT: 300
    },
    VIDEO: {
        ASPECT_RATIO: 16 / 9,
        SKIP_SECONDS: 10,
        RESUME_THRESHOLD: 2
    },
    PERFORMANCE: {
        DEBOUNCE_DELAY: 300,
        SCROLL_THROTTLE: 16,
        CACHE_TIMEOUT: 5 * 60 * 1000,
        MAX_RETRIES: 20,
        RETRY_DELAY: 50
    },
    UI: {
        TOAST_DURATION: 3000,
        SKELETON_ROW_COUNT: 8,
        FLYOUT_ANIMATION_DURATION: 150
    },
    FEEDS: {
        HOURLY_VIDEO: 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/AJNHourlyVideo.xml',
        HOURLY_AUDIO: 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/AJNHourlyAudio.xml',
        ALEX_JONES_SHOW: 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/AlexJonesShow.xml',
        WAR_ROOM: 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/WarRoom.xml'
    },
    STORAGE_KEYS: {
        APP_STATE: 'ajn-app-state',
        QUEUE: 'ajn-user-queue',
        DARK_MODE: 'darkMode',
        VIEW_MODE: 'ajn_view_mode',
        PLAYBACK_POSITIONS: 'ajn_playback_positions_v2'
    }
};

// Helper function
window.applyCssVariables = function() {
    const root = document.documentElement;
    root.style.setProperty('--row-height', `${CONFIG.LAYOUT.ROW_HEIGHT}px`);
    root.style.setProperty('--grid-row-height', `${CONFIG.LAYOUT.GRID_ROW_HEIGHT}px`);
    root.style.setProperty('--header-height', `${CONFIG.LAYOUT.HEADER_HEIGHT}px`);
    root.style.setProperty('--queue-max-height', `${CONFIG.LAYOUT.QUEUE_MAX_HEIGHT}px`);
};