// ============ MAIN APPLICATION - WITH RE-INITIALIZATION AFTER RENDERS ==========
import { VideoControls } from './videoControls.js';
import { 
    showToast, 
    escapeHtml, 
    formatCentralTime, 
    formatShortDate, 
    formatTime, 
    toCentralTime, 
    transformVideoUrl, 
    parseEpisodeDetails, 
    formatDateKey
} from './helpers.js';

// Global reference to video controls - will be recreated after each render
let videoControls = null;
let currentVideoPlayer = null;
let currentProgressBar = null;
let currentPlayPauseBtn = null;
let currentTimeDisplay = null;
let currentDurationDisplay = null;

// State
let allEpisodes = [];
let currentPlaylist = [];
let currentIndex = 0;
let currentCalendarDate = new Date();
let userQueue = [];
let currentSearchTerm = '';
let currentViewMode = 'list';
let currentFilterDate = null;

// Constants
const API_URL = 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/AJNHourlyVideo.xml';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ============ RE-INITIALIZATION FUNCTION ============
// This must be called AFTER any DOM update that affects video player elements
function reinitializeVideoControls() {
    // Re-query DOM elements (they may have been recreated)
    currentVideoPlayer = document.getElementById('videoPlayer');
    currentProgressBar = document.getElementById('progressBar');
    currentPlayPauseBtn = document.getElementById('playPauseBtn');
    currentTimeDisplay = document.getElementById('currentTime');
    currentDurationDisplay = document.getElementById('duration');
    
    if (currentVideoPlayer && currentProgressBar && currentPlayPauseBtn && 
        currentTimeDisplay && currentDurationDisplay) {
        
        // Destroy old controls if they exist
        if (videoControls) {
            videoControls.destroy();
        }
        
        // Create new controls instance
        videoControls = new VideoControls(
            currentVideoPlayer, 
            currentProgressBar, 
            currentPlayPauseBtn, 
            currentTimeDisplay, 
            currentDurationDisplay
        );
        
        // Re-attach event handlers
        if (currentPlayPauseBtn) {
            // Remove existing listeners to avoid duplicates
            const newBtn = currentPlayPauseBtn.cloneNode(true);
            currentPlayPauseBtn.parentNode.replaceChild(newBtn, currentPlayPauseBtn);
            currentPlayPauseBtn = newBtn;
            
            currentPlayPauseBtn.addEventListener('click', () => {
                if (videoControls) videoControls.togglePlayPause();
            });
        }
        
        if (videoControls) {
            videoControls.setOnEnd(() => {
                const autoplayToggle = document.getElementById('autoplayToggle');
                if (autoplayToggle && autoplayToggle.checked) {
                    nextEpisode();
                }
            });
        }
        
        console.log("VideoControls re-initialized successfully");
        return true;
    } else {
        console.warn("VideoControls re-initialization failed - elements not found", {
            videoPlayer: !!currentVideoPlayer,
            progressBar: !!currentProgressBar,
            playPauseBtn: !!currentPlayPauseBtn,
            currentTimeDisplay: !!currentTimeDisplay,
            durationDisplay: !!currentDurationDisplay
        });
        return false;
    }
}

// ============ DEFENSIVE UI UPDATE FUNCTIONS ============
function updateNowPlayingTitle(title) {
    const titleEl = document.getElementById('currentTitle');
    if (titleEl) {
        titleEl.textContent = title;
    } else {
        console.warn('currentTitle element not found, skipping UI update');
    }
}

function updatePlaylistStats(count, uniqueDays, filterInfo = '') {
    const statsEl = document.getElementById('playlistStats');
    if (statsEl) {
        statsEl.innerHTML = `${count} episodes • ${uniqueDays} days${filterInfo}`;
    }
}

// ============ QUEUE FUNCTIONS ============
function loadQueue() {
    try {
        const saved = localStorage.getItem('userQueue');
        if (saved) {
            userQueue = JSON.parse(saved);
            console.log(`Loaded ${userQueue.length} items from queue`);
        }
    } catch (error) {
        console.error('Failed to load queue:', error);
        userQueue = [];
    }
    renderQueue();
}

function saveQueue() {
    localStorage.setItem('userQueue', JSON.stringify(userQueue));
    const queueStatsEl = document.getElementById('queueStats');
    if (queueStatsEl) queueStatsEl.textContent = `${userQueue.length} item${userQueue.length !== 1 ? 's' : ''}`;
}

function renderQueue() {
    const queueContainer = document.getElementById('queueContainer');
    if (!queueContainer) return;
    
    if (userQueue.length === 0) {
        queueContainer.innerHTML = '<div class="empty-queue" style="padding: 16px; text-align: center; color: var(--text-secondary);">Queue is empty</div>';
        return;
    }
    
    queueContainer.innerHTML = userQueue.map((item, idx) => `
        <div class="queue-item" data-index="${idx}" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border);">
            <span class="drag-handle" style="cursor: grab;">⠿</span>
            <div class="queue-info" data-action="play-from-queue" data-index="${idx}" style="flex: 1; cursor: pointer;">
                <div class="queue-title" style="font-weight: 500; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.title)}</div>
                <div class="queue-date" style="font-size: 0.65rem; color: var(--text-secondary);">${escapeHtml(item.show)} ${escapeHtml(item.hour)}</div>
            </div>
            <button class="remove-queue-item" data-index="${idx}" style="background: none; border: none; cursor: pointer; font-size: 1rem;">×</button>
        </div>
    `).join('');
    
    // Add event listeners for queue items
    document.querySelectorAll('.queue-info[data-action="play-from-queue"]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(el.dataset.index);
            if (!isNaN(idx)) playFromQueue(idx);
        });
    });
    
    document.querySelectorAll('.remove-queue-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            if (!isNaN(idx)) removeFromQueue(idx);
        });
    });
}

function addToQueue(episode) {
    if (!episode) return;
    const queueItem = {
        id: episode.id,
        title: episode.title,
        show: episode.show,
        hour: episode.hour,
        videoUrl: episode.videoUrl,
        centralDate: episode.centralDate
    };
    userQueue.push(queueItem);
    saveQueue();
    renderQueue();
    showToast(`Added "${episode.title.substring(0, 40)}..." to queue`);
}

function playFromQueue(index) {
    const item = userQueue[index];
    if (item && videoControls) {
        updateNowPlayingTitle(item.title);
        videoControls.loadEpisode(item.videoUrl, true);
        showToast(`Now playing from queue: ${item.title.substring(0, 40)}...`);
    }
}

function removeFromQueue(index) {
    userQueue.splice(index, 1);
    saveQueue();
    renderQueue();
    showToast('Removed from queue');
}

// ============ PLAYLIST FUNCTIONS ============
function playEpisode(index) {
    if (index < 0 || index >= currentPlaylist.length) {
        console.warn(`Invalid episode index: ${index}`);
        return;
    }
    
    currentIndex = index;
    const episode = currentPlaylist[currentIndex];
    
    // Defensive UI update
    updateNowPlayingTitle(episode.title);
    
    if (videoControls) {
        videoControls.loadEpisode(episode.videoUrl, true);
    }
    
    // Re-render playlist to update active state (but don't re-initialize controls here)
    renderPlaylist(false); // false = skip video controls re-init
}

function nextEpisode() {
    if (userQueue.length > 0) {
        const nextItem = userQueue[0];
        userQueue.splice(0, 1);
        saveQueue();
        renderQueue();
        updateNowPlayingTitle(nextItem.title);
        if (videoControls) videoControls.loadEpisode(nextItem.videoUrl, true);
        showToast('Playing next from queue');
    } else if (currentIndex + 1 < currentPlaylist.length) {
        playEpisode(currentIndex + 1);
        showToast('Playing next episode...');
    } else {
        showToast('End of playlist');
    }
}

// ============ RENDER PLAYLIST WITH OPTIONAL CONTROLS RE-INIT ============
function renderPlaylist(shouldReinitControls = false) {
    const playlistContainer = document.getElementById('playlistContainer');
    if (!playlistContainer) return;
    
    if (!currentPlaylist.length) {
        playlistContainer.innerHTML = '<div class="empty-state" style="text-align: center; padding: 40px;">📭 No episodes found</div>';
        if (shouldReinitControls) reinitializeVideoControls();
        return;
    }
    
    // Get existing rows or create new container
    let listContainer = playlistContainer.querySelector('.playlist-rows');
    if (!listContainer) {
        listContainer = document.createElement('div');
        listContainer.className = 'playlist-rows';
        playlistContainer.innerHTML = '';
        playlistContainer.appendChild(listContainer);
    }
    
    // Get current rows map for diffing
    const existingRows = new Map();
    listContainer.querySelectorAll('.playlist-item').forEach(row => {
        const id = row.dataset.id;
        if (id !== undefined) existingRows.set(id, row);
    });
    
    // Create document fragment for new/changed rows
    const fragment = document.createDocumentFragment();
    const processedIds = new Set();
    
    currentPlaylist.forEach((ep, idx) => {
        const isActive = idx === currentIndex;
        const rowId = `ep-${ep.id}`;
        processedIds.add(rowId);
        
        let row = existingRows.get(rowId);
        
        if (row) {
            // Update existing row - only change what's needed
            if (isActive && !row.classList.contains('active')) {
                row.classList.add('active');
            } else if (!isActive && row.classList.contains('active')) {
                row.classList.remove('active');
            }
            
            // Update data-index
            row.dataset.index = idx;
            
            // Update title if changed
            const titleEl = row.querySelector('.playlist-title');
            if (titleEl && titleEl.textContent !== ep.title) {
                titleEl.textContent = ep.title;
            }
            
            // Update date if changed
            const dateEl = row.querySelector('.playlist-date');
            const newDate = `📅 ${ep.formattedDate}`;
            if (dateEl && dateEl.textContent !== newDate) {
                dateEl.textContent = newDate;
            }
            
            // Update duration if changed
            const durationEl = row.querySelector('.playlist-duration');
            const newDuration = `🎬 ${ep.show} ${ep.hour}`;
            if (durationEl && durationEl.textContent !== newDuration) {
                durationEl.textContent = newDuration;
            }
            
            fragment.appendChild(row);
        } else {
            // Create new row
            row = document.createElement('div');
            row.className = `playlist-item list-item ${isActive ? 'active' : ''}`;
            row.dataset.id = rowId;
            row.dataset.index = idx;
            row.setAttribute('data-episode-id', ep.id);
            
            const flyoutId = `flyout-${ep.id}`;
            
            row.innerHTML = `
                <div class="menu-trigger" data-flyout="${flyoutId}" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); opacity: 0; transition: opacity 0.2s; cursor: pointer;">⋮</div>
                <div class="flyout-menu" id="${flyoutId}" style="position: absolute; right: 12px; top: 50px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; z-index: 100; display: none; min-width: 140px;">
                    <div class="flyout-menu-item" data-action="download" data-index="${idx}" style="padding: 8px 12px; cursor: pointer;">⬇️ Download</div>
                    <div class="flyout-menu-item" data-action="share" data-index="${idx}" style="padding: 8px 12px; cursor: pointer;">📤 Share</div>
                    <div class="flyout-menu-divider" style="height: 1px; background: var(--border); margin: 4px 0;"></div>
                    <div class="flyout-menu-item" data-action="queue" data-index="${idx}" style="padding: 8px 12px; cursor: pointer;">📋 Add to Queue</div>
                    <div class="flyout-menu-item" data-action="details" data-index="${idx}" style="padding: 8px 12px; cursor: pointer;">📄 Details</div>
                </div>
                <div class="playlist-thumbnail" style="width: 48px; height: 48px; background: linear-gradient(135deg, var(--primary-light), var(--border)); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">🎬</div>
                <div class="playlist-info" style="flex: 1; min-width: 0;">
                    <div class="playlist-title" style="font-weight: 500; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(ep.title)}</div>
                    <div class="playlist-date" style="font-size: 0.7rem; color: var(--text-secondary);">📅 ${ep.formattedDate}</div>
                    <div class="playlist-duration" style="font-size: 0.65rem; color: var(--text-tertiary);">🎬 ${ep.show} ${ep.hour}</div>
                </div>
                <button class="add-to-queue-btn" data-action="queue" data-index="${idx}" style="padding: 4px 8px; font-size: 0.65rem; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 4px; cursor: pointer;">📋 Add</button>
            `;
            
            fragment.appendChild(row);
        }
    });
    
    // Remove rows that no longer exist
    existingRows.forEach((row, id) => {
        if (!processedIds.has(id)) {
            row.remove();
        }
    });
    
    // Append fragment with new/changed rows
    if (fragment.children.length > 0) {
        listContainer.appendChild(fragment);
    }
    
    // Attach event listeners using delegation (only once)
    attachPlaylistEventDelegation();
    
    // Re-initialize video controls if requested (only on full page loads, not on playlist updates)
    if (shouldReinitControls) {
        reinitializeVideoControls();
    }
}

// Event delegation for playlist (attached once to container)
let delegationAttached = false;
function attachPlaylistEventDelegation() {
    if (delegationAttached) return;
    delegationAttached = true;
    
    const playlistContainer = document.getElementById('playlistContainer');
    if (!playlistContainer) return;
    
    // Play item click
    playlistContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.playlist-item');
        if (item && !e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu') && !e.target.closest('.add-to-queue-btn')) {
            const indexAttr = item.dataset.index;
            if (indexAttr !== undefined) {
                const index = parseInt(indexAttr, 10);
                if (!isNaN(index)) playEpisode(index);
            }
        }
    });
    
    // Flyout trigger
    playlistContainer.addEventListener('click', (e) => {
        const trigger = e.target.closest('.menu-trigger');
        if (trigger) {
            e.stopPropagation();
            const flyoutId = trigger.getAttribute('data-flyout');
            const menu = document.getElementById(flyoutId);
            if (menu) {
                document.querySelectorAll('.flyout-menu').forEach(m => {
                    if (m.id !== flyoutId) m.style.display = 'none';
                });
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            }
        }
    });
    
    // Action buttons
    playlistContainer.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            e.stopPropagation();
            const action = actionBtn.getAttribute('data-action');
            const indexAttr = actionBtn.getAttribute('data-index');
            
            if (indexAttr !== null) {
                const index = parseInt(indexAttr, 10);
                if (!isNaN(index)) {
                    const episode = currentPlaylist[index];
                    if (action === 'download' && episode) {
                        const link = document.createElement('a');
                        link.href = episode.videoUrl;
                        link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
                        link.click();
                        showToast('Download started');
                    } else if (action === 'share' && episode) {
                        if (navigator.share) {
                            navigator.share({ title: episode.title, url: episode.videoUrl });
                        } else {
                            navigator.clipboard.writeText(episode.videoUrl);
                            showToast('Link copied');
                        }
                    } else if (action === 'queue' && episode) {
                        addToQueue(episode);
                    } else if (action === 'details' && episode) {
                        alert(`Title: ${episode.title}\nShow: ${episode.show} ${episode.hour}\nDate: ${episode.formattedDate}`);
                    }
                }
            }
            
            // Close flyout
            const flyout = actionBtn.closest('.flyout-menu');
            if (flyout) flyout.style.display = 'none';
        }
    });
    
    // Close flyouts on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-trigger')) {
            document.querySelectorAll('.flyout-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    });
}

// ============ PROCESS EPISODES ============
function processRawEpisodes(rawEpisodes) {
    return rawEpisodes.map((ep, idx) => {
        const utcDate = new Date(ep.pubDate);
        const centralDate = toCentralTime(utcDate);
        const { show, hour } = parseEpisodeDetails(ep.title);
        return {
            id: idx,
            title: ep.title || 'Untitled Episode',
            description: ep.description ? ep.description.replace(/<[^>]*>/g, '') : 'No description',
            centralDate: centralDate,
            dateKey: formatDateKey(centralDate),
            formattedDate: formatCentralTime(centralDate),
            shortDate: formatShortDate(centralDate),
            show: show,
            hour: hour,
            videoUrl: transformVideoUrl(ep.link)
        };
    });
}

// ============ FILTER FUNCTIONS ============
function applyFilters() {
    let filtered = [...allEpisodes];
    
    if (currentSearchTerm) {
        const term = currentSearchTerm.toLowerCase();
        filtered = filtered.filter(ep => 
            ep.title.toLowerCase().includes(term) || 
            ep.description.toLowerCase().includes(term)
        );
    }
    
    if (currentFilterDate) {
        filtered = filtered.filter(ep => ep.dateKey === currentFilterDate);
    }
    
    currentPlaylist = filtered;
    currentIndex = 0;
    
    renderPlaylist(false); // Don't reinit controls on filter
    
    const uniqueDates = new Set(currentPlaylist.map(e => e.dateKey));
    let filterInfo = '';
    if (currentSearchTerm) filterInfo += ` 🔍 "${currentSearchTerm}"`;
    if (currentFilterDate) filterInfo += ` 📅 ${new Date(currentFilterDate).toLocaleDateString()}`;
    
    updatePlaylistStats(currentPlaylist.length, uniqueDates.size, filterInfo);
    
    if (currentPlaylist.length > 0 && videoControls) {
        const episode = currentPlaylist[0];
        updateNowPlayingTitle(episode.title);
        videoControls.loadEpisode(episode.videoUrl, false);
    }
}

// ============ SEARCH SETUP ============
function setupSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value;
            if (clearSearchBtn) {
                clearSearchBtn.classList.toggle('visible', currentSearchTerm.length > 0);
            }
            applyFilters();
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            const searchInput = document.getElementById('globalSearchInput');
            if (searchInput) searchInput.value = '';
            currentSearchTerm = '';
            clearSearchBtn.classList.remove('visible');
            applyFilters();
        });
    }
}

// ============ CALENDAR FUNCTIONS ============
function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    const calendarMonthTitle = document.getElementById('calendarMonthTitle');
    if (!calendarGrid) return;
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayKey = formatDateKey(today);
    
    if (calendarMonthTitle) {
        calendarMonthTitle.textContent = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    
    let weekdaysHtml = '';
    WEEKDAYS.forEach(day => { weekdaysHtml += `<div class="calendar-weekday" style="text-align: center; padding: 8px; font-weight: 600;">${day}</div>`; });
    const calendarWeekdays = document.querySelector('.calendar-weekdays');
    if (calendarWeekdays) calendarWeekdays.innerHTML = weekdaysHtml;
    
    let html = '';
    let dayCounter = 1;
    
    for (let i = 0; i < startDay; i++) {
        html += '<div class="calendar-day other-month" style="min-height: 80px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; opacity: 0.4;"></div>';
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dateKey = formatDateKey(currentDate);
        const dayEpisodes = allEpisodes.filter(ep => ep.dateKey === dateKey);
        const isToday = dateKey === todayKey;
        const hasEpisodes = dayEpisodes.length > 0;
        
        html += `
            <div class="calendar-day ${hasEpisodes ? 'has-episode' : ''} ${isToday ? 'today' : ''}" 
                 data-date="${dateKey}"
                 style="min-height: 80px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; position: relative;">
                <div class="calendar-day-number" style="font-weight: 600;">${day}</div>
                ${hasEpisodes ? '<div class="dot-indicator" style="width: 6px; height: 6px; background: var(--primary); border-radius: 50%; margin-top: 4px;"></div>' : ''}
            </div>
        `;
    }
    
    calendarGrid.innerHTML = html;
    
    document.querySelectorAll('.calendar-day[data-date]').forEach(day => {
        day.addEventListener('click', () => {
            const dateKey = day.getAttribute('data-date');
            currentFilterDate = dateKey;
            const searchInput = document.getElementById('globalSearchInput');
            const clearSearchBtn = document.getElementById('clearSearchBtn');
            if (searchInput) searchInput.value = '';
            currentSearchTerm = '';
            if (clearSearchBtn) clearSearchBtn.classList.remove('visible');
            applyFilters();
            const calendarOverlay = document.getElementById('calendarOverlay');
            if (calendarOverlay) calendarOverlay.classList.remove('is-visible');
            showToast(`Filtered to ${new Date(dateKey).toLocaleDateString()}`);
        });
    });
}

function setupCalendar() {
    const calendarToggleBtn = document.getElementById('calendarToggleBtn');
    const closeCalendarBtn = document.getElementById('closeCalendarBtn');
    const calendarOverlay = document.getElementById('calendarOverlay');
    const calendarPrevMonth = document.getElementById('calendarPrevMonth');
    const calendarNextMonth = document.getElementById('calendarNextMonth');
    
    function toggleCalendar() {
        if (calendarOverlay) {
            calendarOverlay.classList.toggle('is-visible');
            if (calendarOverlay.classList.contains('is-visible')) {
                renderCalendar();
            }
        }
    }
    
    function closeCalendar() {
        if (calendarOverlay) {
            calendarOverlay.classList.remove('is-visible');
        }
    }
    
    if (calendarToggleBtn) calendarToggleBtn.addEventListener('click', toggleCalendar);
    if (closeCalendarBtn) closeCalendarBtn.addEventListener('click', closeCalendar);
    
    if (calendarPrevMonth) {
        calendarPrevMonth.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar();
        });
    }
    
    if (calendarNextMonth) {
        calendarNextMonth.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar();
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeCalendar();
    });
}

// ============ VIEW MODE TOGGLE ============
function setupViewMode() {
    const listViewBtn = document.getElementById('listViewBtn');
    const gridViewBtn = document.getElementById('gridViewBtn');
    
    if (listViewBtn && gridViewBtn) {
        listViewBtn.addEventListener('click', () => {
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
            currentViewMode = 'list';
            const container = document.getElementById('playlistContainer');
            if (container) container.classList.remove('grid-view');
            renderPlaylist(false);
        });
        
        gridViewBtn.addEventListener('click', () => {
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
            currentViewMode = 'grid';
            const container = document.getElementById('playlistContainer');
            if (container) container.classList.add('grid-view');
            renderPlaylist(false);
        });
    }
}

// ============ DARK MODE ============
function setupDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) document.body.classList.add('dark');
    if (darkModeToggle) {
        darkModeToggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            const dark = document.body.classList.contains('dark');
            localStorage.setItem('darkMode', dark);
            darkModeToggle.textContent = dark ? '☀️ Light' : '🌙 Dark';
        });
    }
}

// ============ QUEUE UI TOGGLE ============
function setupQueueUI() {
    const queueHeader = document.getElementById('queueHeader');
    const queueContainer = document.getElementById('queueContainer');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    
    if (queueHeader && queueContainer) {
        queueHeader.addEventListener('click', () => {
            queueContainer.classList.toggle('expanded');
        });
    }
    
    if (clearQueueBtn) {
        clearQueueBtn.addEventListener('click', () => {
            userQueue = [];
            saveQueue();
            renderQueue();
            showToast('Queue cleared');
        });
    }
}

// ============ LOAD EPISODES ============
async function loadEpisodes() {
    const playlistContainer = document.getElementById('playlistContainer');
    if (playlistContainer) {
        playlistContainer.innerHTML = '<div class="loading-state" style="text-align: center; padding: 40px;"><div class="loader" style="display: inline-block; width: 30px; height: 30px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.6s linear infinite;"></div><div style="margin-top: 12px;">Loading episodes...</div></div>';
    }
    
    try {
        console.log('Fetching RSS feed from:', API_URL);
        const response = await fetch(API_URL);
        const data = await response.json();
        
        if (data.status !== 'ok') {
            throw new Error('Failed to load RSS feed: ' + (data.message || 'Unknown error'));
        }
        
        console.log(`Received ${data.items?.length || 0} episodes from feed`);
        
        allEpisodes = processRawEpisodes(data.items || []);
        allEpisodes.sort((a, b) => b.centralDate - a.centralDate);
        currentPlaylist = [...allEpisodes];
        
        renderPlaylist(true); // Pass true to reinitialize controls after first render
        
        const uniqueDates = new Set(currentPlaylist.map(e => e.dateKey));
        updatePlaylistStats(currentPlaylist.length, uniqueDates.size);
        
        if (currentPlaylist.length > 0 && videoControls) {
            const episode = currentPlaylist[0];
            updateNowPlayingTitle(episode.title);
            videoControls.loadEpisode(episode.videoUrl, false);
        }
        
        showToast(`Loaded ${allEpisodes.length} episodes`);
        console.log('Application ready - Controls re-initialization active');
        
    } catch (error) {
        console.error('Error loading episodes:', error);
        if (playlistContainer) {
            playlistContainer.innerHTML = `<div class="error-state" style="text-align: center; padding: 40px; color: var(--primary);">❌ Failed to load episodes: ${error.message}</div>`;
        }
        showToast('Failed to load episodes');
    }
}

// ============ SETUP SKIP BUTTONS ============
function setupSkipButtons() {
    const skipBackBtn = document.getElementById('skipBackBtn');
    const skipForwardBtn = document.getElementById('skipForwardBtn');
    
    if (skipBackBtn) {
        skipBackBtn.addEventListener('click', () => {
            if (videoControls) videoControls.skip(-10);
        });
    }
    
    if (skipForwardBtn) {
        skipForwardBtn.addEventListener('click', () => {
            if (videoControls) videoControls.skip(10);
        });
    }
}

// ============ SETUP DOWNLOAD/SHARE BUTTONS ============
function setupDownloadShareButtons() {
    const downloadBtn = document.getElementById('downloadBtn');
    const shareBtn = document.getElementById('shareBtn');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const episode = currentPlaylist[currentIndex];
            if (episode) {
                const link = document.createElement('a');
                link.href = episode.videoUrl;
                link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
                link.click();
                showToast('Download started');
            }
        });
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const episode = currentPlaylist[currentIndex];
            if (episode && navigator.share) {
                navigator.share({ title: episode.title, url: episode.videoUrl });
            } else if (episode) {
                navigator.clipboard.writeText(episode.videoUrl);
                showToast('Link copied');
            }
        });
    }
}

// ============ SETUP NEXT BUTTON ============
function setupNextButton() {
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', nextEpisode);
    }
}

// ============ INITIALIZE ============
function init() {
    console.log("Initializing application...");
    
    setupDarkMode();
    setupSearch();
    setupCalendar();
    setupViewMode();
    setupQueueUI();
    setupSkipButtons();
    setupDownloadShareButtons();
    setupNextButton();
    
    loadQueue();
    loadEpisodes(); // This will call renderPlaylist(true) and reinitialize controls
    
    console.log("Initialization complete");
}

// Start the application
init();