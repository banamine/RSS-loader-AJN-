// ============ MAIN APPLICATION WITH WORKER INTEGRATION ==========
import { transformVideoUrl, toCentralTime, formatCentralTime, formatDateKey, parseEpisodeDetails, escapeHtml, showToast, trapFocus, debounce } from './utils/helpers.js';
import { VideoControls } from './utils/videoControls.js';
import { NowPlayingCard } from './components/NowPlayingCard.js';
import { VirtualPlaylist } from './components/VirtualPlaylist.js';
import { QueueManager } from './components/QueueManager.js';
import { CalendarView } from './components/CalendarView.js';
import { getWorkerManager, XsltWorkerManager } from './utils/xsltWorkerManager.js';
import { getFeedService, FeedService } from './services/feedService.js';

// Storage Keys
const STORAGE_KEYS = {
    PLAYBACK_POSITIONS: 'ajn_playback_positions',
    DARK_MODE: 'darkMode',
    VIEW_MODE: 'ajn_view_mode',
    LAST_FEED_URL: 'ajn_last_feed_url'
};

// RSS Feed URLs
const FEED_URLS = {
    hourlyVideo: 'https://rss.alexjones.media/AJNHourlyVideo.xml',
    hourlyAudio: 'https://rss.alexjones.media/AJNHourlyAudio.xml',
    alexJonesShow: 'https://rss.alexjones.media/AlexJonesShow.xml',
    warRoom: 'https://rss.alexjones.media/WarRoom.xml',
    sundayNightLive: 'https://rss.alexjones.media/SundayNightLive.xml'
};

// Global State
let allEpisodes = [];
let currentPlaylist = [];
let currentIndex = 0;
let playbackPositions = {};
let saveTimeout = null;
let currentSearchTerm = '';
let selectedCalendarDate = null;
let currentFeedUrl = FEED_URLS.hourlyVideo;

// Components
let nowPlayingCard = null;
let virtualPlaylist = null;
let queueManager = null;
let calendarView = null;
let feedService = null;
let workerManager = null;

// DOM Elements
const playlistStats = document.getElementById('playlistStats');
const searchInput = document.getElementById('globalSearchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const activeFilters = document.getElementById('activeFilters');
const listViewBtn = document.getElementById('listViewBtn');
const gridViewBtn = document.getElementById('gridViewBtn');
const darkModeToggle = document.getElementById('darkModeToggle');

// ============ PLAYBACK PERSISTENCE ==========
function loadPlaybackPositions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.PLAYBACK_POSITIONS);
        if (saved) {
            playbackPositions = JSON.parse(saved);
            console.log(`Loaded ${Object.keys(playbackPositions).length} playback positions`);
        }
    } catch (error) {
        playbackPositions = {};
    }
}

function savePlaybackPosition(episodeId, position, duration) {
    if (!episodeId || isNaN(position) || position < 0) return;
    if (duration && position >= duration - 2) {
        delete playbackPositions[episodeId];
    } else {
        playbackPositions[episodeId] = {
            position: Math.floor(position),
            timestamp: Date.now(),
            duration: duration || 0
        };
    }
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        localStorage.setItem(STORAGE_KEYS.PLAYBACK_POSITIONS, JSON.stringify(playbackPositions));
    }, 500);
}

function getPlaybackPosition(episodeId) {
    const saved = playbackPositions[episodeId];
    return saved && saved.position ? saved.position : 0;
}

window.getPlaybackPosition = getPlaybackPosition;

// ============ EPISODE PROCESSING ==========
function processRawEpisodes(rawEpisodes) {
    return rawEpisodes.map((ep, idx) => {
        const pubDate = new Date(ep.pubDate);
        const centralDate = toCentralTime(pubDate);
        const { show, hour } = parseEpisodeDetails(ep.title);
        
        return {
            id: idx,
            title: ep.title || 'Untitled Episode',
            description: ep.description || 'No description available',
            pubDateUTC: pubDate,
            centralDate: centralDate,
            dateKey: formatDateKey(centralDate),
            show: show,
            hour: hour,
            videoUrl: transformVideoUrl(ep.link || ep.enclosure?.url || ''),
            originalLink: ep.link || ep.enclosure?.url || ''
        };
    });
}

// ============ LOAD EPISODES WITH WORKER ==========
async function loadEpisodes(showProgress = true) {
    if (showProgress) {
        showToast('Loading episodes...');
    }
    
    // Show loading state in playlist
    if (virtualPlaylist) {
        virtualPlaylist.setItems([]);
        virtualPlaylist.showLoading();
    }
    
    try {
        const result = await feedService.fetchFeedWithProgress(
            currentFeedUrl,
            (progress) => {
                if (progress.type === 'chunk' && virtualPlaylist) {
                    // Progressive rendering as chunks arrive
                    const partialEpisodes = processRawEpisodes(progress.episodesSoFar || []);
                    virtualPlaylist.setItems(partialEpisodes);
                    if (partialEpisodes.length > 0 && currentIndex === 0) {
                        nowPlayingCard?.updateEpisode(partialEpisodes[0], getPlaybackPosition(partialEpisodes[0].id));
                    }
                    updatePlaylistStatsPartial(partialEpisodes.length, progress.totalChunks);
                }
            },
            { useChunking: true }
        );
        
        if (result.success && result.episodes) {
            allEpisodes = processRawEpisodes(result.episodes);
            allEpisodes.sort((a, b) => b.centralDate - a.centralDate);
            currentPlaylist = [...allEpisodes];
            
            if (calendarView) calendarView.setEpisodes(allEpisodes);
            if (virtualPlaylist) virtualPlaylist.setItems(currentPlaylist);
            
            updatePlaylistStats();
            
            if (currentPlaylist.length > 0 && nowPlayingCard) {
                const firstEpisode = currentPlaylist[0];
                nowPlayingCard.updateEpisode(firstEpisode, getPlaybackPosition(firstEpisode.id));
            }
            
            showToast(`Loaded ${allEpisodes.length.toLocaleString()} episodes`);
        } else if (result.error) {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Error loading episodes:', error);
        if (playlistStats) playlistStats.innerHTML = '❌ Failed to load';
        showToast(`Failed to load: ${error.message}`, 4000);
        
        if (virtualPlaylist) {
            virtualPlaylist.showError(error.message);
        }
    }
}

function updatePlaylistStatsPartial(loadedCount, totalChunks) {
    if (playlistStats) {
        playlistStats.innerHTML = `Loading: ${loadedCount.toLocaleString()} episodes so far...`;
    }
}

function updatePlaylistStats() {
    if (!playlistStats) return;
    const uniqueDates = new Set(currentPlaylist.map(e => e.dateKey));
    let filterText = '';
    if (currentSearchTerm) filterText += ` 🔍 "${currentSearchTerm}"`;
    if (selectedCalendarDate) filterText += ` 📅 ${new Date(selectedCalendarDate).toLocaleDateString()}`;
    playlistStats.innerHTML = `${currentPlaylist.length.toLocaleString()} episodes • ${uniqueDates.size} days • CT${filterText}`;
}

// ============ FEED SELECTOR ==========
function createFeedSelector() {
    const headerControls = document.querySelector('.header-controls');
    if (!headerControls) return;
    
    const select = document.createElement('select');
    select.id = 'feedSelector';
    select.className = 'feed-selector';
    select.setAttribute('aria-label', 'Select feed source');
    select.style.cssText = 'padding: 6px 12px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-primary);';
    
    select.innerHTML = `
        <option value="${FEED_URLS.hourlyVideo}">📺 Network Feed (Video)</option>
        <option value="${FEED_URLS.hourlyAudio}">🎧 Network Feed (Audio)</option>
        <option value="${FEED_URLS.alexJonesShow}">🎙️ Alex Jones Show</option>
        <option value="${FEED_URLS.warRoom}">⚔️ War Room</option>
        <option value="${FEED_URLS.sundayNightLive}">🌙 Sunday Night Live</option>
    `;
    
    select.value = currentFeedUrl;
    
    select.addEventListener('change', async (e) => {
        currentFeedUrl = e.target.value;
        localStorage.setItem(STORAGE_KEYS.LAST_FEED_URL, currentFeedUrl);
        await loadEpisodes(true);
    });
    
    headerControls.insertBefore(select, darkModeToggle);
}

// ============ APPLY FILTERS ==========
function applyFilters() {
    let filtered = [...allEpisodes];
    
    if (currentSearchTerm) {
        const term = currentSearchTerm.toLowerCase();
        filtered = filtered.filter(ep => 
            ep.title.toLowerCase().includes(term) || 
            ep.description.toLowerCase().includes(term)
        );
    }
    
    if (selectedCalendarDate) {
        filtered = filtered.filter(ep => ep.dateKey === selectedCalendarDate);
    }
    
    currentPlaylist = filtered;
    currentIndex = 0;
    
    if (virtualPlaylist) {
        virtualPlaylist.setItems(currentPlaylist);
        virtualPlaylist.setCurrentIndex(0);
    }
    
    updatePlaylistStats();
    updateActiveFiltersDisplay();
    
    if (currentPlaylist.length > 0 && nowPlayingCard) {
        const episode = currentPlaylist[0];
        nowPlayingCard.updateEpisode(episode, getPlaybackPosition(episode.id));
    }
}

function updateActiveFiltersDisplay() {
    if (!activeFilters) return;
    activeFilters.innerHTML = '';
    
    if (currentSearchTerm) {
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        tag.innerHTML = `🔍 ${escapeHtml(currentSearchTerm)} <span class="remove-filter" data-filter="search">✖</span>`;
        activeFilters.appendChild(tag);
    }
    
    if (selectedCalendarDate) {
        const formattedDate = new Date(selectedCalendarDate).toLocaleDateString();
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        tag.innerHTML = `📅 ${formattedDate} <span class="remove-filter" data-filter="calendar">✖</span>`;
        activeFilters.appendChild(tag);
    }
    
    document.querySelectorAll('.remove-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const filterType = btn.getAttribute('data-filter');
            if (filterType === 'search') {
                currentSearchTerm = '';
                if (searchInput) searchInput.value = '';
                if (clearSearchBtn) clearSearchBtn.classList.remove('visible');
                applyFilters();
            } else if (filterType === 'calendar') {
                selectedCalendarDate = null;
                if (calendarView) calendarView.renderCalendar();
                applyFilters();
            }
        });
    });
}

// ============ EPISODE ACTIONS ==========
function playEpisode(index) {
    if (index < 0 || index >= currentPlaylist.length) return;
    
    currentIndex = index;
    const episode = currentPlaylist[currentIndex];
    
    if (nowPlayingCard) {
        nowPlayingCard.updateEpisode(episode, getPlaybackPosition(episode.id));
    }
    
    if (virtualPlaylist) {
        virtualPlaylist.setCurrentIndex(currentIndex);
    }
}

function downloadEpisode(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    const link = document.createElement('a');
    link.href = episode.videoUrl;
    link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
    link.click();
    showToast('Download started');
    if (virtualPlaylist) virtualPlaylist.closeAllFlyouts();
}

function shareEpisode(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    if (navigator.share) {
        navigator.share({ title: episode.title, url: episode.videoUrl });
    } else {
        navigator.clipboard.writeText(episode.videoUrl);
        showToast('Link copied');
    }
    if (virtualPlaylist) virtualPlaylist.closeAllFlyouts();
}

function addToQueue(index) {
    const episode = currentPlaylist[index];
    if (episode && queueManager) {
        queueManager.addToQueue(episode);
    }
    if (virtualPlaylist) virtualPlaylist.closeAllFlyouts();
}

function clearResumePoint(episodeId) {
    if (playbackPositions[episodeId]) {
        delete playbackPositions[episodeId];
        localStorage.setItem(STORAGE_KEYS.PLAYBACK_POSITIONS, JSON.stringify(playbackPositions));
        if (virtualPlaylist) virtualPlaylist.render();
        showToast('Resume point cleared');
    }
}

function viewDetails(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    
    modal.innerHTML = `
        <div class="modal-content">
            <h3 style="margin-bottom: 16px; color: var(--primary);">Episode Details</h3>
            <div style="margin-bottom: 12px;"><strong>Title:</strong><br>${escapeHtml(episode.title)}</div>
            <div style="margin-bottom: 12px;"><strong>Show:</strong><br>${episode.show} ${episode.hour}</div>
            <div style="margin-bottom: 12px;"><strong>Date (CT):</strong><br>${formatCentralTime(episode.centralDate)}</div>
            <div style="margin-bottom: 12px;"><strong>Description:</strong><br>${escapeHtml(episode.description)}</div>
            <button class="btn-primary" style="margin-top: 16px; padding: 8px 16px;">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    const closeBtn = modal.querySelector('.btn-primary');
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    trapFocus(modal);
}

// Make global for onclick handlers
window.onItemClick = playEpisode;
window.onDownload = downloadEpisode;
window.onShare = shareEpisode;
window.onAddToQueue = addToQueue;
window.onClearResume = clearResumePoint;
window.onViewDetails = viewDetails;
window.toggleFlyout = (event, index, trigger) => {
    if (virtualPlaylist) virtualPlaylist.toggleFlyout(event, index, trigger);
};

function playFromQueue(item) {
    const episodeData = {
        id: item.id,
        title: item.title,
        show: item.show,
        hour: item.hour,
        centralDate: new Date(item.centralDate),
        videoUrl: item.videoUrl,
        description: ''
    };
    
    if (nowPlayingCard) {
        nowPlayingCard.updateEpisode(episodeData, getPlaybackPosition(item.id));
    }
    
    const indexInPlaylist = currentPlaylist.findIndex(ep => ep.id === item.id);
    if (indexInPlaylist !== -1) {
        currentIndex = indexInPlaylist;
        if (virtualPlaylist) virtualPlaylist.setCurrentIndex(currentIndex);
    }
}

window.playFromQueue = playFromQueue;
window.removeFromQueue = (index) => {
    if (queueManager) queueManager.removeFromQueue(index);
};

// ============ VIEW MODE ==========
function setViewMode(mode) {
    if (virtualPlaylist) {
        virtualPlaylist.setViewMode(mode);
        localStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode);
        
        if (mode === 'list') {
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
        } else {
            listViewBtn.classList.remove('active');
            gridViewBtn.classList.add('active');
        }
    }
}

function loadSavedViewMode() {
    const savedMode = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
    if (savedMode === 'grid') {
        setViewMode('grid');
    } else {
        setViewMode('list');
    }
}

// ============ DARK MODE ==========
function initDarkMode() {
    const isDark = localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true';
    if (isDark) {
        document.body.classList.add('dark');
        if (darkModeToggle) darkModeToggle.textContent = '☀️ Light';
    }
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            const dark = document.body.classList.contains('dark');
            localStorage.setItem(STORAGE_KEYS.DARK_MODE, dark);
            darkModeToggle.textContent = dark ? '☀️ Light' : '🌙 Dark';
        });
    }
}

// ============ SEARCH ==========
function setupSearch() {
    if (!searchInput) return;
    
    const debouncedSearch = debounce(() => {
        currentSearchTerm = searchInput.value;
        if (clearSearchBtn) clearSearchBtn.classList.toggle('visible', currentSearchTerm.length > 0);
        applyFilters();
    }, 200);
    
    searchInput.addEventListener('input', debouncedSearch);
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            currentSearchTerm = '';
            searchInput.value = '';
            clearSearchBtn.classList.remove('visible');
            applyFilters();
        });
    }
}

// ============ CALENDAR ==========
function onCalendarDateSelect(dateKey) {
    selectedCalendarDate = dateKey;
    currentSearchTerm = '';
    if (searchInput) searchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.classList.remove('visible');
    applyFilters();
    if (calendarView) calendarView.renderCalendar();
    showToast(`Filtered to ${new Date(dateKey).toLocaleDateString()}`);
}

// ============ INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('AJN Hourly Archive - Initializing with Web Worker support...');
    
    document.body.classList.add('preload');
    setTimeout(() => document.body.classList.remove('preload'), 100);
    
    // Initialize services
    workerManager = getWorkerManager();
    feedService = getFeedService();
    
    // Initialize worker
    try {
        await workerManager.init();
        console.log('Web Worker initialized successfully');
    } catch (error) {
        console.error('Worker initialization failed, falling back to main thread:', error);
        showToast('Using fallback mode - some features may be slower', 5000);
    }
    
    initDarkMode();
    loadPlaybackPositions();
    setupSearch();
    
    // Initialize Queue Manager
    const queueSection = document.getElementById('queueSection');
    if (queueSection) {
        queueManager = new QueueManager('queueSection');
        queueManager.setOnPlay(playFromQueue);
        window.queueManager = queueManager;
    }
    
    // Initialize Calendar
    const calendarSection = document.getElementById('calendarSection');
    if (calendarSection) {
        calendarView = new CalendarView('calendarSection', { onDateSelect: onCalendarDateSelect });
    }
    
    // Initialize Virtual Playlist
    virtualPlaylist = new VirtualPlaylist('playlistContainer', {
        rowHeight: 80,
        buffer: 5,
        viewMode: 'list'
    });
    
    virtualPlaylist.setCallbacks({
        onItemClick: playEpisode,
        onDownload: downloadEpisode,
        onShare: shareEpisode,
        onAddToQueue: addToQueue,
        onClearResume: clearResumePoint
    });
    
    virtualPlaylist.showLoading = function() {
        if (this.virtualList) {
            this.virtualList.innerHTML = '<div class="loading-state"><div class="loader"></div><div style="margin-top: 12px;">Loading episodes...</div></div>';
        }
    };
    
    virtualPlaylist.showError = function(message) {
        if (this.virtualList) {
            this.virtualList.innerHTML = `<div class="error-state">❌ ${escapeHtml(message)}</div>`;
        }
    };
    
    // Initialize Now Playing Card
    nowPlayingCard = new NowPlayingCard('nowPlayingSection');
    nowPlayingCard.setOnNext(() => {
        if (queueManager && queueManager.queue && queueManager.queue.length > 0) {
            const nextItem = queueManager.queue[0];
            queueManager.removeFromQueue(0);
            playFromQueue(nextItem);
        } else if (currentIndex + 1 < currentPlaylist.length) {
            playEpisode(currentIndex + 1);
        } else {
            showToast('End of playlist');
        }
    });
    
    // Setup view toggle buttons
    if (listViewBtn) listViewBtn.addEventListener('click', () => setViewMode('list'));
    if (gridViewBtn) gridViewBtn.addEventListener('click', () => setViewMode('grid'));
    
    // Create feed selector
    createFeedSelector();
    
    // Load saved feed URL
    const savedFeedUrl = localStorage.getItem(STORAGE_KEYS.LAST_FEED_URL);
    if (savedFeedUrl && FEED_URLS[Object.keys(FEED_URLS).find(key => FEED_URLS[key] === savedFeedUrl)]) {
        currentFeedUrl = savedFeedUrl;
        const feedSelector = document.getElementById('feedSelector');
        if (feedSelector) feedSelector.value = currentFeedUrl;
    }
    
    loadSavedViewMode();
    await loadEpisodes(true);
    
    console.log('Application initialized - Web Worker architecture active');
});