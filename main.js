// ============ MAIN.JS - WITH STABLE IDS AND FIXED NEXT BUTTON ==========

import { feedService } from './js/services/feedService.js';
import { stateManager } from './js/state/stateManager.js';
import { VideoControls } from './js/components/VideoControls.js';
import { VirtualList } from './js/components/VirtualList.js';
import { CalendarView } from './js/components/CalendarView.js';
import { SkeletonLoader } from './js/components/SkeletonLoader.js';
import { 
    escapeHtml, 
    formatCentralTime, 
    formatDateKey, 
    toCentralTime, 
    transformVideoUrl, 
    parseEpisodeDetails,
    debounce,
    showToast,
    generateStableEpisodeId,
    isValidEpisodeId
} from './js/utils/helpers.js';

// Constants
const RSS_URL = 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/AJNHourlyVideo.xml';

// Global references
let videoControls = null;
let virtualList = null;
let calendarView = null;
let skeletonLoader = null;
let allEpisodes = [];

// Process raw episodes with stable IDs
function processRawEpisodes(rawEpisodes) {
    if (!rawEpisodes || !rawEpisodes.length) return [];
    
    return rawEpisodes.map((ep, idx) => {
        const utcDate = new Date(ep.pubDate);
        const centralDate = toCentralTime(utcDate);
        const { show, hour } = parseEpisodeDetails(ep.title);
        
        // Use the stable ID from feedService, or generate one
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
        rowHeight: 80,
        buffer: 5,
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

// Initialize skeleton loader
function initSkeletonLoader() {
    skeletonLoader = new SkeletonLoader('playlistContainer', {
        rowCount: 8,
        rowHeight: 80
    });
}

// Setup video controls with FIXED Next button logic
function setupVideoControls() {
    videoControls = new VideoControls({
        videoId: 'mainVideo',
        progressId: 'progressBar',
        playPauseId: 'playPauseBtn',
        currentTimeId: 'currentTime',
        durationId: 'duration'
    });
    
    const skipBackBtn = document.getElementById('skipBackBtn');
    const skipForwardBtn = document.getElementById('skipForwardBtn');
    const nextBtn = document.getElementById('nextBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const shareBtn = document.getElementById('shareBtn');
    const autoplayToggle = document.getElementById('autoplayToggle');
    
    if (skipBackBtn) skipBackBtn.addEventListener('click', () => videoControls?.skip(-10));
    if (skipForwardBtn) skipForwardBtn.addEventListener('click', () => videoControls?.skip(10));
    
    // FIXED: Next button logic using stable episode.id instead of video.src
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const currentItems = virtualList?.getCurrentItems() || [];
            if (currentItems.length === 0) return;
            
            // Get current playing episode ID from state
            const currentState = stateManager.getState();
            const currentPlayingId = currentState.nowPlayingId;
            
            if (currentPlayingId) {
                // Find index by stable ID (not by video URL)
                const currentIndex = currentItems.findIndex(ep => ep.id === currentPlayingId);
                
                if (currentIndex !== -1 && currentIndex + 1 < currentItems.length) {
                    const nextEpisode = currentItems[currentIndex + 1];
                    videoControls.loadEpisode(nextEpisode.videoUrl, true);
                    updateNowPlayingDisplay(nextEpisode);
                    stateManager.setNowPlaying(nextEpisode.id);
                    virtualList.scrollToIndex(currentIndex + 1);
                    if (virtualList.setFocusedIndex) {
                        virtualList.setFocusedIndex(currentIndex + 1);
                    }
                } else if (currentState.queue?.length > 0) {
                    // Play from queue if available
                    const nextFromQueue = currentState.queue[0];
                    stateManager.removeFromQueue(0);
                    videoControls.loadEpisode(nextFromQueue.videoUrl, true);
                    updateNowPlayingDisplay(nextFromQueue);
                    stateManager.setNowPlaying(nextFromQueue.id);
                }
            } else if (currentItems.length > 0) {
                // No current playing, start from first
                const firstEpisode = currentItems[0];
                videoControls.loadEpisode(firstEpisode.videoUrl, true);
                updateNowPlayingDisplay(firstEpisode);
                stateManager.setNowPlaying(firstEpisode.id);
            }
        });
    }
    
    // FIXED: Download button with proper DOM injection
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const currentState = stateManager.getState();
            const currentPlayingId = currentState.nowPlayingId;
            
            if (currentPlayingId) {
                const episode = allEpisodes.find(ep => ep.id === currentPlayingId);
                if (episode && episode.videoUrl && episode.videoUrl !== '#') {
                    // Create download link and trigger
                    const link = document.createElement('a');
                    link.href = episode.videoUrl;
                    link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    
                    // Clean up after download starts
                    setTimeout(() => {
                        if (link.parentNode) link.parentNode.removeChild(link);
                    }, 100);
                    
                    showToast(`Downloading: ${episode.title.substring(0, 50)}...`);
                } else {
                    showToast('No valid video URL for download');
                }
            } else {
                showToast('No episode currently playing');
            }
        });
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const currentState = stateManager.getState();
            const currentPlayingId = currentState.nowPlayingId;
            const episode = allEpisodes.find(ep => ep.id === currentPlayingId);
            
            if (episode && navigator.share) {
                navigator.share({ title: episode.title, url: episode.videoUrl });
            } else if (episode) {
                navigator.clipboard.writeText(episode.videoUrl);
                showToast('Link copied');
            }
        });
    }
    
    if (videoControls && autoplayToggle) {
        videoControls.setOnEnd(() => {
            if (autoplayToggle.checked && nextBtn) {
                nextBtn.click();
            }
        });
    }
}

// Load episodes
async function loadAndInitialize() {
    if (skeletonLoader) skeletonLoader.show();
    
    try {
        console.log('Fetching RSS feed...');
        const result = await feedService.fetchFeed(RSS_URL);
        
        if (result.success && result.episodes) {
            allEpisodes = processRawEpisodes(result.episodes);
            allEpisodes.sort((a, b) => b.centralDate - a.centralDate);
            
            console.log(`Loaded ${allEpisodes.length} episodes with stable IDs`);
            
            stateManager.setEpisodes(allEpisodes);
            
            // Apply filters
            const state = stateManager.getState();
            let filtered = [...allEpisodes];
            if (state.searchTerm) {
                const term = state.searchTerm.toLowerCase();
                filtered = filtered.filter(ep => 
                    ep.title.toLowerCase().includes(term) || 
                    ep.description.toLowerCase().includes(term)
                );
            }
            if (state.filterDate) {
                filtered = filtered.filter(ep => ep.dateKey === state.filterDate);
            }
            
            if (virtualList) virtualList.setItems(filtered);
            if (calendarView) calendarView.setEpisodes(allEpisodes);
            
            // Restore now playing from state
            if (state.nowPlayingId) {
                const savedEpisode = allEpisodes.find(ep => ep.id === state.nowPlayingId);
                if (savedEpisode && videoControls) {
                    updateNowPlayingDisplay(savedEpisode);
                    videoControls.loadEpisode(savedEpisode.videoUrl, false);
                } else if (filtered.length > 0) {
                    updateNowPlayingDisplay(filtered[0]);
                    if (videoControls) videoControls.loadEpisode(filtered[0].videoUrl, false);
                    stateManager.setNowPlaying(filtered[0].id);
                }
            } else if (filtered.length > 0) {
                updateNowPlayingDisplay(filtered[0]);
                if (videoControls) videoControls.loadEpisode(filtered[0].videoUrl, false);
                stateManager.setNowPlaying(filtered[0].id);
            }
            
            showToast(`Loaded ${allEpisodes.length} episodes`);
        } else {
            throw new Error(result.error || 'Failed to load feed');
        }
    } catch (error) {
        console.error('Failed to load episodes:', error);
        showToast(`Failed to load: ${error.message}`);
    } finally {
        if (skeletonLoader) skeletonLoader.hide();
    }
}

// ... rest of the setup functions remain the same ...
// (setupSearch, setupViewMode, setupDarkMode, setupCalendar, 
//  setupPlaylistActions, setupQueueActions, renderQueue)

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AJN Hourly Archive with stable IDs...');
    
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
    
    loadAndInitialize();
    
    console.log('Application ready - Stable IDs enabled');
});