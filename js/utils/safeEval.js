// ============ MAIN.JS - WITH SECURITY HARDENING ==========
import { CONFIG, applyCssVariables } from './js/config.js';
import { feedService } from './js/services/feedService.js';
import { stateManager } from './js/state/stateManager.js';
import { VideoControls } from './js/components/VideoControls.js';
import { VirtualList } from './js/components/VirtualList.js';
import { CalendarView } from './js/components/CalendarView.js';
import { SkeletonLoader } from './js/components/SkeletonLoader.js';
import { initKeyboardNavigation } from './js/utils/keyboardNavigation.js';
import { sanitizeUrl, validateShareUrl, isValidVideoUrl } from './js/utils/urlSanitizer.js';
import { sanitizeDescription, setSafeText, createSafeElement } from './js/domSanitizer.js';
import { executeAction } from './js/safeEval.js';
import { 
    formatCentralTime, 
    formatDateKey, 
    toCentralTime, 
    transformVideoUrl, 
    parseEpisodeDetails,
    debounce,
    showToast,
    generateStableEpisodeId
} from './js/utils/helpers.js';

// Constants
const RSS_URL = CONFIG.FEEDS.HOURLY_VIDEO;

// Global references
let videoControls = null;
let virtualList = null;
let calendarView = null;
let skeletonLoader = null;
let keyboardNav = null;
let allEpisodes = [];

// Apply CSS variables
applyCssVariables();

// Process raw episodes with sanitization
function processRawEpisodes(rawEpisodes) {
    if (!rawEpisodes || !rawEpisodes.length) return [];
    
    return rawEpisodes.map((ep, idx) => {
        const utcDate = new Date(ep.pubDate);
        const centralDate = toCentralTime(utcDate);
        const { show, hour } = parseEpisodeDetails(ep.title);
        
        // Sanitize all user-supplied content
        const sanitizedTitle = sanitizeDescription(ep.title, 200);
        const sanitizedDescription = sanitizeDescription(ep.description, 500);
        
        // Validate and sanitize URL
        let videoUrl = transformVideoUrl(ep.videoUrl || ep.link || '');
        if (!isValidVideoUrl(videoUrl)) {
            videoUrl = '#';
            console.warn(`Invalid video URL for episode: ${ep.title?.substring(0, 50)}`);
        }
        
        const stableId = ep.id || generateStableEpisodeId({
            videoUrl: videoUrl,
            title: sanitizedTitle,
            pubDate: ep.pubDate
        });
        
        return {
            id: stableId,
            title: sanitizedTitle,
            description: sanitizedDescription,
            pubDate: ep.pubDate,
            centralDate: centralDate,
            dateKey: formatDateKey(centralDate),
            formattedDate: formatCentralTime(centralDate),
            show: sanitizeDescription(show, 50),
            hour: sanitizeDescription(hour, 20),
            videoUrl: videoUrl
        };
    });
}

// Render playlist item with safe DOM creation
function renderPlaylistItem(episode, index) {
    const flyoutId = `flyout-${episode.id}`;
    const div = document.createElement('div');
    div.className = 'playlist-item';
    div.dataset.id = episode.id;
    div.dataset.index = index;
    div.setAttribute('role', 'option');
    div.setAttribute('aria-selected', 'false');
    div.setAttribute('tabindex', '-1');
    
    // Build the DOM structure safely (not using innerHTML with user data)
    const menuTrigger = document.createElement('div');
    menuTrigger.className = 'menu-trigger';
    menuTrigger.setAttribute('data-flyout', flyoutId);
    menuTrigger.setAttribute('aria-label', 'More options');
    menuTrigger.textContent = '⋮';
    
    const flyoutMenu = document.createElement('div');
    flyoutMenu.className = 'flyout-menu';
    flyoutMenu.id = flyoutId;
    flyoutMenu.setAttribute('role', 'menu');
    
    // Create menu items safely
    const downloadItem = createSafeElement('div', '⬇️ Download', 'flyout-menu-item');
    downloadItem.setAttribute('data-action', 'download');
    downloadItem.setAttribute('data-id', episode.id);
    downloadItem.setAttribute('role', 'menuitem');
    
    const shareItem = createSafeElement('div', '📤 Share', 'flyout-menu-item');
    shareItem.setAttribute('data-action', 'share');
    shareItem.setAttribute('data-id', episode.id);
    shareItem.setAttribute('role', 'menuitem');
    
    const queueItem = createSafeElement('div', '📋 Add to Queue', 'flyout-menu-item');
    queueItem.setAttribute('data-action', 'queue');
    queueItem.setAttribute('data-id', episode.id);
    queueItem.setAttribute('role', 'menuitem');
    
    const divider = document.createElement('div');
    divider.className = 'flyout-menu-divider';
    
    const detailsItem = createSafeElement('div', '📄 Details', 'flyout-menu-item');
    detailsItem.setAttribute('data-action', 'details');
    detailsItem.setAttribute('data-id', episode.id);
    detailsItem.setAttribute('role', 'menuitem');
    
    flyoutMenu.appendChild(downloadItem);
    flyoutMenu.appendChild(shareItem);
    flyoutMenu.appendChild(queueItem);
    flyoutMenu.appendChild(divider);
    flyoutMenu.appendChild(detailsItem);
    
    const thumbnail = document.createElement('div');
    thumbnail.className = 'playlist-thumbnail';
    thumbnail.setAttribute('aria-hidden', 'true');
    thumbnail.textContent = '🎬';
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'playlist-info';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'playlist-title';
    titleDiv.textContent = episode.title;
    
    const dateDiv = document.createElement('div');
    dateDiv.className = 'playlist-date';
    dateDiv.textContent = `📅 ${episode.formattedDate}`;
    
    const durationDiv = document.createElement('div');
    durationDiv.className = 'playlist-duration';
    durationDiv.textContent = `🎬 ${episode.show} ${episode.hour}`;
    
    infoDiv.appendChild(titleDiv);
    infoDiv.appendChild(dateDiv);
    infoDiv.appendChild(durationDiv);
    
    div.appendChild(menuTrigger);
    div.appendChild(flyoutMenu);
    div.appendChild(thumbnail);
    div.appendChild(infoDiv);
    
    return div;
}

// ... rest of the code remains similar but uses sanitized data ...

// Share button handler with URL validation
function handleShare(episode) {
    if (!episode) return;
    
    const validatedUrl = validateShareUrl(episode.videoUrl);
    if (!validatedUrl) {
        showToast('Cannot share: Invalid URL');
        return;
    }
    
    if (navigator.share) {
        navigator.share({
            title: episode.title,
            url: validatedUrl
        }).catch(e => console.log('Share cancelled'));
    } else {
        navigator.clipboard.writeText(validatedUrl);
        showToast('Link copied');
    }
}

// Download handler with URL validation
function handleDownload(episode) {
    if (!episode) return;
    
    const validatedUrl = sanitizeUrl(episode.videoUrl);
    if (validatedUrl === '#' || !isValidVideoUrl(validatedUrl)) {
        showToast('Cannot download: Invalid video URL');
        return;
    }
    
    const link = document.createElement('a');
    link.href = validatedUrl;
    link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
    }, 100);
    
    showToast(`Downloading: ${episode.title.substring(0, 50)}...`);
}

// Initialize app with security hardening
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AJN Hourly Archive with security hardening...');
    
    // Apply CSS variables
    applyCssVariables();
    
    // Setup with sanitized handlers
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
    initKeyboardNav();
    
    loadAndInitialize();
    
    console.log('Application ready - Security hardening active (no unsafe-eval, URL validation, DOM sanitization)');
});