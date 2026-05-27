// ============ MAIN APPLICATION - NO IMPORTS, ALL GLOBALS ==========
// All dependencies are already loaded as globals via index.html script order

// Constants from config.js (already global)
const RSS_URL = CONFIG.FEEDS.HOURLY_VIDEO;
const ROW_HEIGHT_VALUE = CONFIG.LAYOUT.ROW_HEIGHT;

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
        
        const stableId = generateStableEpisodeId({
            videoUrl: ep.videoUrl,
            title: ep.title,
            pubDate: ep.pubDate
        });
        
        return {
            id: stableId,
            title: ep.title || 'Untitled Episode',
            description: sanitizeDescription(ep.description || 'No description', 500),
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

// Initialize skeleton loader
function initSkeletonLoader() {
    skeletonLoader = new SkeletonLoader('playlistContainer', {
        rowCount: CONFIG.UI.SKELETON_ROW_COUNT,
        rowHeight: ROW_HEIGHT_VALUE
    });
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
            
            // Apply filters from state
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

// Render queue
function renderQueue() {
    const state = stateManager.getState();
    const queueContainer = document.getElementById('queueContainer');
    const queueStats = document.getElementById('queueStats');
    
    if (!queueContainer) return;
    
    if (!state.queue || state.queue.length === 0) {
        queueContainer.innerHTML = '<div class="empty-queue">Queue is empty. Use "Add to Queue" on episodes.</div>';
    } else {
        queueContainer.innerHTML = state.queue.map((item, idx) => `
            <div class="queue-item" data-index="${idx}">
                <span class="drag-handle" aria-label="Drag to reorder">⠿</span>
                <div class="queue-info" data-action="play-queue" data-index="${idx}" role="button" tabindex="0">
                    <div class="queue-title">${escapeHtml(item.title)}</div>
                    <div class="queue-date">${item.show} ${item.hour}</div>
                </div>
                <button class="remove-queue-item" data-action="remove-queue" data-index="${idx}" aria-label="Remove from queue">×</button>
            </div>
        `).join('');
    }
    
    if (queueStats) queueStats.textContent = `${state.queue?.length || 0} items`;
}

// Setup video controls
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
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const currentItems = virtualList?.getCurrentItems() || [];
            if (currentItems.length === 0) return;
            
            const currentState = stateManager.getState();
            const currentPlayingId = currentState.nowPlayingId;
            
            if (currentPlayingId) {
                const currentIndex = currentItems.findIndex(ep => ep.id === currentPlayingId);
                if (currentIndex !== -1 && currentIndex + 1 < currentItems.length) {
                    const nextEpisode = currentItems[currentIndex + 1];
                    videoControls.loadEpisode(nextEpisode.videoUrl, true);
                    updateNowPlayingDisplay(nextEpisode);
                    stateManager.setNowPlaying(nextEpisode.id);
                    virtualList.scrollToIndex(currentIndex + 1);
                    if (virtualList.setFocusedIndex) virtualList.setFocusedIndex(currentIndex + 1);
                }
            } else if (currentItems.length > 0) {
                const firstEpisode = currentItems[0];
                videoControls.loadEpisode(firstEpisode.videoUrl, true);
                updateNowPlayingDisplay(firstEpisode);
                stateManager.setNowPlaying(firstEpisode.id);
            }
        });
    }
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const currentState = stateManager.getState();
            const currentPlayingId = currentState.nowPlayingId;
            if (currentPlayingId) {
                const episode = allEpisodes.find(ep => ep.id === currentPlayingId);
                if (episode && episode.videoUrl && episode.videoUrl !== '#') {
                    const link = document.createElement('a');
                    link.href = episode.videoUrl;
                    link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    setTimeout(() => { if (link.parentNode) link.parentNode.removeChild(link); }, 100);
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
            if (autoplayToggle.checked && nextBtn) nextBtn.click();
        });
    }
}

// Setup search
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const initialState = stateManager.getState();
        searchInput.value = initialState.searchTerm;
        
        const debouncedSearch = debounce((e) => {
            stateManager.setSearchTerm(e.target.value);
            applyFilters();
        }, 300);
        searchInput.addEventListener('input', debouncedSearch);
    }
}

// Apply filters from state
function applyFilters() {
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
    if (keyboardNav) keyboardNav.updateItems();
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value !== state.searchTerm) {
        searchInput.value = state.searchTerm;
    }
}

// Setup view mode
function setupViewMode() {
    const listBtn = document.getElementById('listViewBtn');
    const gridBtn = document.getElementById('gridViewBtn');
    const playlistContainer = document.getElementById('playlistContainer');
    
    const initialState = stateManager.getState();
    
    if (initialState.viewMode === 'grid') {
        gridBtn?.classList.add('active');
        listBtn?.classList.remove('active');
        playlistContainer?.classList.add('grid-view');
    } else {
        listBtn?.classList.add('active');
        gridBtn?.classList.remove('active');
        playlistContainer?.classList.remove('grid-view');
    }
    
    if (listBtn) {
        listBtn.addEventListener('click', () => {
            stateManager.setViewMode('list');
            listBtn.classList.add('active');
            gridBtn.classList.remove('active');
            if (playlistContainer) playlistContainer.classList.remove('grid-view');
            if (virtualList) virtualList.refresh();
        });
    }
    
    if (gridBtn) {
        gridBtn.addEventListener('click', () => {
            stateManager.setViewMode('grid');
            gridBtn.classList.add('active');
            listBtn.classList.remove('active');
            if (playlistContainer) playlistContainer.classList.add('grid-view');
            if (virtualList) virtualList.refresh();
        });
    }
}

// Setup dark mode
function setupDarkMode() {
    const darkBtn = document.getElementById('darkModeToggle');
    const initialState = stateManager.getState();
    
    if (initialState.darkMode) {
        document.body.classList.add('dark');
        if (darkBtn) darkBtn.textContent = '☀️ Light';
    }
    
    if (darkBtn) {
        darkBtn.addEventListener('click', () => {
            stateManager.toggleDarkMode();
            const isDark = stateManager.getState().darkMode;
            darkBtn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
        });
    }
}

// Setup calendar
function setupCalendar() {
    const calendarContainer = document.getElementById('calendarContainer');
    const calendarToggleBtn = document.getElementById('calendarToggleBtn');
    
    if (calendarContainer) {
        calendarView = new CalendarView(calendarContainer, {
            onDateSelect: (date) => {
                stateManager.setFilterDate(date);
                applyFilters();
                showToast(`Filtered to ${date}`);
                calendarView.hide();
            }
        });
    }
    
    if (calendarToggleBtn) {
        calendarToggleBtn.addEventListener('click', () => {
            if (calendarView) calendarView.toggle();
        });
    }
}

// Setup playlist actions (event delegation)
function setupPlaylistActions() {
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.menu-trigger');
        if (trigger) {
            e.stopPropagation();
            const flyoutId = trigger.dataset.flyout;
            const flyout = document.getElementById(flyoutId);
            if (flyout) {
                document.querySelectorAll('.flyout-menu').forEach(f => {
                    if (f.id !== flyoutId) f.style.display = 'none';
                });
                flyout.style.display = flyout.style.display === 'block' ? 'none' : 'block';
            }
        }
        
        const actionBtn = e.target.closest('.flyout-menu-item');
        if (actionBtn) {
            e.stopPropagation();
            const action = actionBtn.dataset.action;
            const row = actionBtn.closest('.playlist-item');
            const index = row ? parseInt(row.dataset.index) : -1;
            const episode = virtualList?.getCurrentItems()?.[index];
            
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
                stateManager.addToQueue(episode);
                renderQueue();
                showToast('Added to queue');
            } else if (action === 'details' && episode) {
                alert(`Title: ${episode.title}\nShow: ${episode.show} ${episode.hour}\nDate: ${episode.formattedDate}`);
            }
            
            const flyout = actionBtn.closest('.flyout-menu');
            if (flyout) flyout.style.display = 'none';
        }
        
        if (!e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu')) {
            document.querySelectorAll('.flyout-menu').forEach(f => f.style.display = 'none');
        }
    });
}

// Setup queue actions
function setupQueueActions() {
    document.addEventListener('click', (e) => {
        const playBtn = e.target.closest('[data-action="play-queue"]');
        if (playBtn) {
            const index = parseInt(playBtn.dataset.index);
            const episode = stateManager.getState().queue?.[index];
            if (episode && videoControls) {
                videoControls.loadEpisode(episode.videoUrl, true);
                updateNowPlayingDisplay(episode);
                stateManager.setNowPlaying(episode.id);
            }
        }
        
        const removeBtn = e.target.closest('[data-action="remove-queue"]');
        if (removeBtn) {
            const index = parseInt(removeBtn.dataset.index);
            stateManager.removeFromQueue(index);
            renderQueue();
        }
    });
    
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    if (clearQueueBtn) {
        clearQueueBtn.addEventListener('click', () => {
            if (confirm('Clear all items from queue?')) {
                stateManager.clearQueue();
                renderQueue();
                showToast('Queue cleared');
            }
        });
    }
}

// Initialize keyboard navigation
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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AJN Hourly Archive...');
    
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
    initKeyboardNav();
    
    loadAndInitialize();
    
    console.log('Application ready');
});