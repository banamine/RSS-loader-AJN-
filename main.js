// ============ MAIN APPLICATION - COMPLETE REFACTORED VERSION ==========
import { transformVideoUrl, toCentralTime, formatCentralTime, formatDateKey, parseEpisodeDetails, escapeHtml, showToast, trapFocus, debounce } from './utils/helpers.js';
import { generateStableEpisodeId, migratePlaybackPositions, isValidEpisodeId } from './utils/idGenerator.js';
import { VideoControls } from './utils/videoControls.js';
import { NowPlayingCard } from './components/NowPlayingCard.js';
import { VirtualPlaylist } from './components/VirtualPlaylist.js';
import { QueueManager } from './components/QueueManager.js';
import { CalendarView, attachCalendarToggle } from './components/CalendarView.js';
import { getWorkerManager } from './utils/xsltWorkerManager.js';
import { getFeedService } from './services/feedService.js';

// Storage Keys
const STORAGE_KEYS = {
    PLAYBACK_POSITIONS: 'ajn_playback_positions_v2', // Versioned for migration
    DARK_MODE: 'darkMode',
    VIEW_MODE: 'ajn_view_mode',
    LAST_FEED_URL: 'ajn_last_feed_url',
    MIGRATION_FLAG: 'ajn_migration_complete'
};

// RSS Feed URLs
const FEED_URLS = {
    hourlyVideo: 'https://rss.alexjones.media/AJNHourlyVideo.xml',
    hourlyAudio: 'https://rss.alexjones.media/AJNHourlyAudio.xml',
    alexJonesShow: 'https://rss.alexjones.media/AlexJonesShow.xml',
    warRoom: 'https://rss.alexjones.media/WarRoom.xml',
    sundayNightLive: 'https://rss.alexjones.media/SundayNightLive.xml'
};

// Valid feed URLs for validation
const VALID_FEED_URLS = new Set(Object.values(FEED_URLS));

// Global State
let allEpisodes = [];
let currentPlaylist = [];
let currentIndex = 0;
let currentPlayingId = null; // Track by stable ID instead of index
let playbackPositions = {};
let saveTimeout = null;
let currentSearchTerm = '';
let selectedCalendarDate = null;
let currentFeedUrl = FEED_URLS.hourlyVideo;
let uniqueDatesCache = new Set();

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

// ============ PLAYBACK PERSISTENCE WITH STABLE IDs ==========
function loadPlaybackPositions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.PLAYBACK_POSITIONS);
        if (saved) {
            playbackPositions = JSON.parse(saved);
            console.log(`Loaded ${Object.keys(playbackPositions).length} playback positions`);
        }
    } catch (error) {
        console.error('Failed to load playback positions:', error);
        console.log('Corrupted data:', localStorage.getItem(STORAGE_KEYS.PLAYBACK_POSITIONS));
        // Backup corrupted data for debugging
        window.__LAST_BAD_STORAGE = localStorage.getItem(STORAGE_KEYS.PLAYBACK_POSITIONS);
        localStorage.removeItem(STORAGE_KEYS.PLAYBACK_POSITIONS);
        playbackPositions = {};
    }
}

function savePlaybackPosition(episodeId, position, duration) {
    if (!episodeId || !isValidEpisodeId(episodeId) || isNaN(position) || position < 0) return;
    
    // Minimum duration threshold: don't mark as completed for very short content
    const minValidDuration = Math.max(30, duration || 0);
    const isNearEnd = position >= minValidDuration - 2;
    
    if (duration && isNearEnd && minValidDuration >= 30) {
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
    if (!episodeId || !isValidEpisodeId(episodeId)) return 0;
    const saved = playbackPositions[episodeId];
    return saved && saved.position ? saved.position : 0;
}

// ============ MIGRATION FROM OLD INDEX-BASED STORAGE ==========
function migrateOldStorage(episodes) {
    const migrationComplete = localStorage.getItem(STORAGE_KEYS.MIGRATION_FLAG);
    if (migrationComplete === 'true') return;
    
    try {
        const oldPositions = localStorage.getItem('ajn_playback_positions');
        if (oldPositions) {
            const parsed = JSON.parse(oldPositions);
            const migrated = migratePlaybackPositions(parsed, episodes);
            
            // Merge migrated positions with existing
            Object.assign(playbackPositions, migrated);
            localStorage.setItem(STORAGE_KEYS.PLAYBACK_POSITIONS, JSON.stringify(playbackPositions));
            console.log(`Migrated ${Object.keys(migrated).length} playback positions`);
        }
        
        // Clear old storage
        localStorage.removeItem('ajn_playback_positions');
        localStorage.setItem(STORAGE_KEYS.MIGRATION_FLAG, 'true');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

// ============ EPISODE PROCESSING WITH STABLE IDs ==========
function processRawEpisodes(rawEpisodes) {
    return rawEpisodes.map((ep, idx) => {
        const pubDate = new Date(ep.pubDate);
        const centralDate = toCentralTime(pubDate);
        const { show, hour } = parseEpisodeDetails(ep.title);
        
        // Generate stable ID from metadata
        const stableId = generateStableEpisodeId({
            pubDate: ep.pubDate,
            title: ep.title,
            link: ep.link || ep.enclosure?.url
        });
        
        return {
            id: stableId,
            originalIndex: idx,
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

// Update unique dates cache
function updateUniqueDatesCache(episodes) {
    uniqueDatesCache.clear();
    episodes.forEach(ep => uniqueDatesCache.add(ep.dateKey));
}

function updatePlaylistStats() {
    if (!playlistStats) return;
    
    let filterText = '';
    if (currentSearchTerm) filterText += ` 🔍 "${escapeHtml(currentSearchTerm)}"`;
    if (selectedCalendarDate) filterText += ` 📅 ${new Date(selectedCalendarDate).toLocaleDateString()}`;
    
    playlistStats.innerHTML = `${currentPlaylist.length.toLocaleString()} episodes • ${uniqueDatesCache.size} days • CT${filterText}`;
}

// ============ APPLY FILTERS - PRESERVES CURRENT PLAYBACK ==========
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
    
    const previousPlayingId = currentPlayingId;
    const previousPlayingEpisode = allEpisodes.find(ep => ep.id === previousPlayingId);
    const isCurrentStillInResults = previousPlayingEpisode && filtered.some(ep => ep.id === previousPlayingId);
    
    currentPlaylist = filtered;
    
    if (isCurrentStillInResults) {
        // Current episode still in filtered results - keep playing it
        const newIndex = currentPlaylist.findIndex(ep => ep.id === previousPlayingId);
        if (newIndex !== -1) {
            currentIndex = newIndex;
        }
    } else {
        // Current episode filtered out - reset to first result without interrupting playback
        currentIndex = 0;
        if (currentPlaylist.length > 0 && nowPlayingCard && !nowPlayingCard.isPlaying()) {
            // Only auto-play if not already playing something
            const episode = currentPlaylist[0];
            nowPlayingCard.updateEpisode(episode, getPlaybackPosition(episode.id));
        }
    }
    
    updateUniqueDatesCache(currentPlaylist);
    
    if (virtualPlaylist) {
        virtualPlaylist.setItems(currentPlaylist);
        virtualPlaylist.setCurrentIndex(currentIndex);
    }
    
    updatePlaylistStats();
    updateActiveFiltersDisplay();
}

// ============ ACTIVE FILTERS DISPLAY - EVENT DELEGATION ==========
function updateActiveFiltersDisplay() {
    if (!activeFilters) return;
    activeFilters.innerHTML = '';
    
    if (currentSearchTerm) {
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        tag.dataset.filterType = 'search';
        tag.dataset.filterValue = currentSearchTerm;
        tag.innerHTML = `🔍 ${escapeHtml(currentSearchTerm)} <span class="remove-filter" data-filter="search">✖</span>`;
        activeFilters.appendChild(tag);
    }
    
    if (selectedCalendarDate) {
        const formattedDate = new Date(selectedCalendarDate).toLocaleDateString();
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        tag.dataset.filterType = 'calendar';
        tag.dataset.filterValue = selectedCalendarDate;
        tag.innerHTML = `📅 ${escapeHtml(formattedDate)} <span class="remove-filter" data-filter="calendar">✖</span>`;
        activeFilters.appendChild(tag);
    }
}

// Single delegated event listener for filter removal
if (activeFilters) {
    activeFilters.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-filter');
        if (!removeBtn) return;
        
        e.stopPropagation();
        const filterType = removeBtn.getAttribute('data-filter');
        
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
}

// ============ EPISODE ACTIONS - NO INLINE ONCLICK ==========
function playEpisode(index) {
    if (index < 0 || index >= currentPlaylist.length) return;
    
    currentIndex = index;
    const episode = currentPlaylist[currentIndex];
    currentPlayingId = episode.id;
    
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
    
    // Determine file extension from content-type or URL
    let extension = '.mp4';
    const url = episode.videoUrl;
    const urlExtension = url.split('.').pop().toLowerCase();
    
    if (['m4v', 'mp4', 'mov', 'avi', 'mkv'].includes(urlExtension)) {
        extension = `.${urlExtension}`;
    } else if (url.includes('m4v')) {
        extension = '.m4v';
    } else if (url.includes('mp4')) {
        extension = '.mp4';
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}${extension}`;
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
    if (episodeId && playbackPositions[episodeId]) {
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
            <div style="margin-bottom: 12px;"><strong>Show:</strong><br>${escapeHtml(episode.show)} ${escapeHtml(episode.hour)}</div>
            <div style="margin-bottom: 12px;"><strong>Date (CT):</strong><br>${escapeHtml(formatCentralTime(episode.centralDate))}</div>
            <div style="margin-bottom: 12px;"><strong>Description:</strong><br>${escapeHtml(episode.description)}</div>
            <button class="btn-primary close-modal-btn" style="margin-top: 16px; padding: 8px 16px;">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    const closeBtn = modal.querySelector('.close-modal-btn');
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    trapFocus(modal);
}

// Event delegation for playlist clicks (replaces inline onclick)
function setupPlaylistEventDelegation() {
    const playlistContainer = document.getElementById('playlistContainer');
    if (!playlistContainer) return;
    
    playlistContainer.addEventListener('click', (e) => {
        // Handle playlist item clicks (play episode)
        const listItem = e.target.closest('.playlist-item.list-item, .playlist-item.grid-item');
        if (listItem && !e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu') && !e.target.closest('.add-to-queue-btn')) {
            const indexAttr = listItem.getAttribute('data-index');
            if (indexAttr !== null) {
                const index = parseInt(indexAttr, 10);
                if (!isNaN(index)) playEpisode(index);
            }
        }
        
        // Handle add to queue buttons
        const addBtn = e.target.closest('.add-to-queue-btn');
        if (addBtn) {
            e.stopPropagation();
            const listItem = addBtn.closest('.playlist-item');
            if (listItem) {
                const indexAttr = listItem.getAttribute('data-index');
                if (indexAttr !== null) {
                    const index = parseInt(indexAttr, 10);
                    if (!isNaN(index)) addToQueue(index);
                }
            }
        }
    });
}

// ============ FEED SELECTOR ==========
function createFeedSelector() {
    const headerControls = document.querySelector('.header-controls');
    if (!headerControls) return;
    
    const select = document.createElement('select');
    select.id = 'feedSelector';
    select.className = 'feed-selector';
    select.setAttribute('aria-label', 'Select feed source');
    
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

// ============ LOAD EPISODES WITH PROGRESSIVE CHUNKING ==========
let processedCount = 0;

async function loadEpisodes(showProgress = true) {
    if (showProgress) showToast('Loading episodes...');
    
    if (virtualPlaylist) {
        virtualPlaylist.setItems([]);
        virtualPlaylist.showLoading();
    }
    
    processedCount = 0;
    
    try {
        const result = await feedService.fetchFeedWithProgress(
            currentFeedUrl,
            (progress) => {
                if (progress.type === 'chunk' && progress.episodesSoFar) {
                    // Only process NEW episodes (delta)
                    const newEpisodes = progress.episodesSoFar.slice(processedCount);
                    if (newEpisodes.length > 0) {
                        const processedNew = processRawEpisodes(newEpisodes);
                        
                        if (processedCount === 0) {
                            allEpisodes = processedNew;
                        } else {
                            allEpisodes.push(...processedNew);
                        }
                        
                        processedCount = progress.episodesSoFar.length;
                        currentPlaylist = [...allEpisodes];
                        updateUniqueDatesCache(currentPlaylist);
                        
                        if (virtualPlaylist) {
                            virtualPlaylist.setItems(currentPlaylist);
                        }
                        
                        if (currentPlaylist.length > 0 && currentPlayingId === null && nowPlayingCard) {
                            const firstEpisode = currentPlaylist[0];
                            nowPlayingCard.updateEpisode(firstEpisode, getPlaybackPosition(firstEpisode.id));
                            currentPlayingId = firstEpisode.id;
                        }
                        
                        updatePlaylistStats();
                    }
                }
            },
            { useChunking: true }
        );
        
        if (result.success && result.episodes) {
            if (processedCount === 0) {
                allEpisodes = processRawEpisodes(result.episodes);
            }
            
            allEpisodes.sort((a, b) => b.centralDate - a.centralDate);
            currentPlaylist = [...allEpisodes];
            updateUniqueDatesCache(currentPlaylist);
            
            // Migrate old storage if needed
            migrateOldStorage(allEpisodes);
            
            if (calendarView) calendarView.setEpisodes(allEpisodes);
            if (virtualPlaylist) virtualPlaylist.setItems(currentPlaylist);
            
            updatePlaylistStats();
            
            if (currentPlaylist.length > 0 && currentPlayingId === null && nowPlayingCard) {
                const firstEpisode = currentPlaylist[0];
                nowPlayingCard.updateEpisode(firstEpisode, getPlaybackPosition(firstEpisode.id));
                currentPlayingId = firstEpisode.id;
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

// ============ SEARCH WITH DEBOUNCE ==========
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

// ============ CLEAR ALL FILTERS ==========
function clearAllFilters() {
    currentSearchTerm = '';
    selectedCalendarDate = null;
    if (searchInput) searchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.classList.remove('visible');
    if (calendarView) calendarView.renderCalendar();
    applyFilters();
    showToast('All filters cleared');
}

// Add global clear filters function
window.clearAllFilters = clearAllFilters;

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

// ============ CALENDAR ==========
function onCalendarDateSelect(dateKey) {
    selectedCalendarDate = dateKey;
    // Do NOT clear search term - allow combined filters
    applyFilters();
    if (calendarView) calendarView.renderCalendar();
    showToast(`Filtered to ${new Date(dateKey).toLocaleDateString()}`);
}

// ============ QUEUE PLAYBACK ==========
function playFromQueue(item) {
    const episodeData = {
        id: item.id,
        title: item.title,
        show: item.show,
        hour: item.hour,
        centralDate: new Date(item.centralDate),
        videoUrl: item.videoUrl,
        description: item.description || ''
    };
    
    if (nowPlayingCard) {
        nowPlayingCard.updateEpisode(episodeData, getPlaybackPosition(item.id));
        currentPlayingId = item.id;
    }
    
    const indexInPlaylist = currentPlaylist.findIndex(ep => ep.id === item.id);
    if (indexInPlaylist !== -1) {
        currentIndex = indexInPlaylist;
        if (virtualPlaylist) virtualPlaylist.setCurrentIndex(currentIndex);
    }
}

// Make queue functions available
window.playFromQueue = playFromQueue;

// ============ INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('AJN Hourly Archive - Initializing...');
    
    document.body.classList.add('preload');
    setTimeout(() => document.body.classList.remove('preload'), 100);
    
    // Initialize services
    workerManager = getWorkerManager();
    feedService = getFeedService();
    
    try {
        await workerManager.init();
        console.log('Web Worker initialized');
    } catch (error) {
        console.error('Worker init failed:', error);
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
    
    // Attach calendar toggle button
    attachCalendarToggle();
    
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
    nowPlayingCard.isPlaying = function() {
        const video = document.getElementById('videoPlayer');
        return video && !video.paused;
    };
    
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
    
    // Setup event delegation (replaces inline onclick)
    setupPlaylistEventDelegation();
    
    // Setup view toggle buttons
    if (listViewBtn) listViewBtn.addEventListener('click', () => setViewMode('list'));
    if (gridViewBtn) gridViewBtn.addEventListener('click', () => setViewMode('grid'));
    
    // Create feed selector
    createFeedSelector();
    
    // Load saved feed URL (with Set-based validation)
    const savedFeedUrl = localStorage.getItem(STORAGE_KEYS.LAST_FEED_URL);
    if (savedFeedUrl && VALID_FEED_URLS.has(savedFeedUrl)) {
        currentFeedUrl = savedFeedUrl;
        const feedSelector = document.getElementById('feedSelector');
        if (feedSelector) feedSelector.value = currentFeedUrl;
    }
    
    loadSavedViewMode();
    await loadEpisodes(true);
    
    // Update document title dynamically
    const updateTitle = () => {
        if (currentPlaylist.length > 0 && currentPlayingId) {
            const currentEp = currentPlaylist.find(ep => ep.id === currentPlayingId);
            if (currentEp) {
                document.title = `${currentEp.show} - AJN Hourly Archive`;
                return;
            }
        }
        document.title = 'AJN Hourly Archive';
    };
    
    // Observe title updates
    const observer = new MutationObserver(updateTitle);
    const titleElement = document.getElementById('currentTitle');
    if (titleElement) observer.observe(titleElement, { childList: true, subtree: true });
    updateTitle();
    
    console.log('Application initialized - All high priority fixes applied');
});