// ============ MAIN APPLICATION ==========
import { transformVideoUrl, toCentralTime, formatCentralTime, formatDateKey, parseEpisodeDetails, escapeHtml, showToast, trapFocus, debounce } from './utils/helpers.js';
import { VideoControls } from './utils/videoControls.js';
import { NowPlayingCard } from './components/NowPlayingCard.js';
import { VirtualPlaylist } from './components/VirtualPlaylist.js';
import { QueueManager } from './components/QueueManager.js';
import { CalendarView } from './components/CalendarView.js';

// Storage Keys
const STORAGE_KEYS = {
    PLAYBACK_POSITIONS: 'ajn_playback_positions',
    DARK_MODE: 'darkMode',
    VIEW_MODE: 'ajn_view_mode'
};

// Global State
let allEpisodes = [];
let currentPlaylist = [];
let currentIndex = 0;
let playbackPositions = {};
let saveTimeout = null;
let currentSearchTerm = '';
let selectedCalendarDate = null;

// Components
let nowPlayingCard = null;
let virtualPlaylist = null;
let queueManager = null;
let calendarView = null;

// DOM Elements
const playlistStats = document.getElementById('playlistStats');
const searchInput = document.getElementById('globalSearchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const activeFilters = document.getElementById('activeFilters');
const listViewBtn = document.getElementById('listViewBtn');
const gridViewBtn = document.getElementById('gridViewBtn');
const darkModeToggle = document.getElementById('darkModeToggle');

// Constants
const API_URL = 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/AJNHourlyVideo.xml';

// ============ PLAYBACK PERSISTENCE ==========
function loadPlaybackPositions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.PLAYBACK_POSITIONS);
        if (saved) {
            playbackPositions = JSON.parse(saved);
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

// Make available globally for VirtualPlaylist
window.getPlaybackPosition = getPlaybackPosition;

// ============ PLAYLIST MANAGEMENT ==========
function updatePlaylistStats() {
    if (!playlistStats) return;
    const uniqueDates = new Set(currentPlaylist.map(e => e.dateKey));
    let filterText = '';
    if (currentSearchTerm) filterText += ` 🔍 "${currentSearchTerm}"`;
    if (selectedCalendarDate) filterText += ` 📅 ${new Date(selectedCalendarDate).toLocaleDateString()}`;
    playlistStats.innerHTML = `${currentPlaylist.length.toLocaleString()} episodes • ${uniqueDates.size} days • CT${filterText}`;
}

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
    
    savePlaybackPosition(episode.id, 0, 0);
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

// Queue playback
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

// ============ LOAD EPISODES ==========
async function loadEpisodes() {
    showToast('Loading episodes...');
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        if (data.status !== 'ok') throw new Error('Failed to load RSS feed');
        
        allEpisodes = data.items.map((item, idx) => {
            const utcDate = new Date(item.pubDate);
            const centralDate = toCentralTime(utcDate);
            const { show, hour } = parseEpisodeDetails(item.title);
            return {
                id: idx,
                title: item.title,
                description: item.description ? item.description.replace(/<[^>]*>/g, '') : 'No description',
                centralDate: centralDate,
                dateKey: formatDateKey(centralDate),
                show: show,
                hour: hour,
                videoUrl: transformVideoUrl(item.link)
            };
        });
        
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
    } catch (error) {
        console.error('Error loading episodes:', error);
        if (playlistStats) playlistStats.innerHTML = '❌ Failed to load';
        showToast('Failed to load episodes', 4000);
    }
}

// ============ INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('AJN Hourly Archive - Initializing...');
    
    document.body.classList.add('preload');
    setTimeout(() => document.body.classList.remove('preload'), 100);
    
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
    
    // Initialize Now Playing Card
    nowPlayingCard = new NowPlayingCard('nowPlayingSection');
    nowPlayingCard.setOnNext(() => {
        if (queueManager && queueManager.queue.length > 0) {
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
    
    loadSavedViewMode();
    loadEpisodes();
    
    console.log('Application initialized - Modular ES6 architecture');
});