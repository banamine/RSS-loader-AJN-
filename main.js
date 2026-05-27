// ============ MAIN.JS - WITH CENTRALIZED CONFIG ==========
import { CONFIG, ROW_HEIGHT, applyCssVariables } from './js/config.js';
import { feedService } from './js/services/feedService.js';
import { stateManager } from './js/state/stateManager.js';
import { VideoControls } from './js/components/VideoControls.js';
import { VirtualList } from './js/components/VirtualList.js';
import { CalendarView } from './js/components/CalendarView.js';
import { SkeletonLoader } from './js/components/SkeletonLoader.js';
import { initKeyboardNavigation } from './js/utils/keyboardNavigation.js';
import { 
    escapeHtml, 
    formatCentralTime, 
    formatDateKey, 
    toCentralTime, 
    transformVideoUrl, 
    parseEpisodeDetails,
    debounce,
    showToast,
    generateStableEpisodeId
} from './js/utils/helpers.js';

// Use centralized constants
const RSS_URL = CONFIG.FEEDS.HOURLY_VIDEO;
const ROW_HEIGHT_VALUE = ROW_HEIGHT;

// Global references
let videoControls = null;
let virtualList = null;
let calendarView = null;
let skeletonLoader = null;
let keyboardNav = null;
let allEpisodes = [];

// Apply CSS variables from config
applyCssVariables();

// Process raw episodes with stable IDs
function processRawEpisodes(rawEpisodes) {
    if (!rawEpisodes || !rawEpisodes.length) return [];
    
    return rawEpisodes.map((ep, idx) => {
        const utcDate = new Date(ep.pubDate);
        const centralDate = toCentralTime(utcDate);
        const { show, hour } = parseEpisodeDetails(ep.title);
        
        const stableId = ep.id || generateStableEpisodeId({
            videoUrl: ep.videoUrl,
            title: ep.title,
            pubDate: ep.pubDate
        });
        
        return {
            id: stableId,
            title: ep.title || 'Untitled Episode',
            description: ep.description || 'No description',
            pubDate: ep.pubDate,
            centralDate: centralDate,
            dateKey: formatDateKey(centralDate),
            formattedDate: formatCentralTime(centralDate),
            show: show,
            hour: hour,
            videoUrl: transformVideoUrl(ep.videoUrl || ep.link || '')
        };
    });
}

// Render playlist item
function renderPlaylistItem(episode, index) {
    const flyoutId = `flyout-${episode.id}`;
    const div = document.createElement('div');
    div.className = 'playlist-item';
    div.dataset.id = episode.id;
    div.dataset.index = index;
    div.setAttribute('role', 'option');
    div.setAttribute('aria-selected', 'false');
    div.setAttribute('tabindex', '-1');
    
    div.innerHTML = `
        <div class="menu-trigger" data-flyout="${flyoutId}" aria-label="More options">⋮</div>
        <div class="flyout-menu" id="${flyoutId}" role="menu">
            <div class="flyout-menu-item" data-action="download" data-id="${episode.id}" role="menuitem">⬇️ Download</div>
            <div class="flyout-menu-item" data-action="share" data-id="${episode.id}" role="menuitem">📤 Share</div>
            <div class="flyout-menu-item" data-action="queue" data-id="${episode.id}" role="menuitem">📋 Add to Queue</div>
            <div class="flyout-menu-divider"></div>
            <div class="flyout-menu-item" data-action="details" data-id="${episode.id}" role="menuitem">📄 Details</div>
        </div>
        <div class="playlist-thumbnail" aria-hidden="true">🎬</div>
        <div class="playlist-info">
            <div class="playlist-title">${escapeHtml(episode.title)}</div>
            <div class="playlist-date">📅 ${episode.formattedDate}</div>
            <div class="playlist-duration">🎬 ${episode.show} ${episode.hour}</div>
        </div>
    `;
    
    return div;
}

// Update now playing display
function updateNowPlayingDisplay(episode) {
    const titleEl = document.getElementById('currentTitle');
    const metaEl = document.getElementById('nowPlayingMeta');
    
    if (titleEl) titleEl.textContent = episode?.title || 'Select an episode';
    if (metaEl) metaEl.textContent = episode ? `${episode.show} ${episode.hour} • ${episode.formattedDate}` : '';
}

// Initialize virtual list
function initVirtualList() {
    virtualList = new VirtualList('playlistContainer', {
        rowHeight: ROW_HEIGHT_VALUE,
        buffer: CONFIG.LAYOUT.BUFFER,
        renderItem: renderPlaylistItem,
        onItemClick: (index) => {
            const episode = virtualList?.getCurrentItems()?.[index];
            if (episode && videoControls) {
                videoControls.loadEpisode(episode.videoUrl, true);
                updateNowPlayingDisplay(episode);
                stateManager.setNowPlaying(episode.id);
            }
        }
    });
    console.log('VirtualList component created');
}

// Initialize keyboard navigation (single entry point)
function initKeyboardNav() {
    if (virtualList) {
        keyboardNav = initKeyboardNavigation(virtualList, (index) => {
            const episode = virtualList?.getCurrentItems()?.[index];
            if (episode && videoControls) {
                videoControls.loadEpisode(episode.videoUrl, true);
                updateNowPlayingDisplay(episode);
                stateManager.setNowPlaying(episode.id);
            }
        });
    }
}

// Initialize skeleton loader
function initSkeletonLoader() {
    skeletonLoader = new SkeletonLoader('playlistContainer', {
        rowCount: CONFIG.UI.SKELETON_ROW_COUNT,
        rowHeight: ROW_HEIGHT_VALUE
    });
}

// ... rest of the setup functions (setupVideoControls, setupSearch, etc.) remain similar ...

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AJN Hourly Archive with centralized config...');
    
    // Apply CSS variables
    applyCssVariables();
    
    setupDarkMode();
    setupVideoControls();
    setupSearch();
    setupViewMode();
    setupCalendar();
    setupPlaylistActions();
    setupQueueActions();
    
    stateManager.loadQueueFromStorage();
    renderQueue();
    
    initSkeletonLoader();
    initVirtualList();
    initKeyboardNav(); // Single entry point for keyboard nav
    
    loadAndInitialize();
    
    console.log('Application ready - Config centralized, keyboard nav initialized');
});