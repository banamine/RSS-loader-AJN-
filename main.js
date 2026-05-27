// ============ MAIN APPLICATION - ORCHESTRATION ==========
import { feedService } from './js/services/feedService.js';
import { stateManager } from './js/state/stateManager.js';
import { VideoControls } from './js/components/VideoControls.js';
import { VirtualList } from './js/components/VirtualList.js';
import { CalendarView } from './js/components/CalendarView.js';
import { 
    escapeHtml, 
    formatCentralTime, 
    formatDateKey, 
    toCentralTime, 
    transformVideoUrl, 
    parseEpisodeDetails,
    debounce,
    showToast
} from './js/utils/helpers.js';

// Constants
const RSS_URL = 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/AJNHourlyVideo.xml';
let videoControls = null;
let virtualList = null;
let calendarView = null;

// Process raw episodes into structured objects
function processRawEpisodes(rawEpisodes) {
    return rawEpisodes.map((ep, idx) => {
        const utcDate = new Date(ep.pubDate);
        const centralDate = toCentralTime(utcDate);
        const { show, hour } = parseEpisodeDetails(ep.title);
        return {
            id: `ep_${idx}_${Date.now()}`,
            title: ep.title || 'Untitled Episode',
            description: ep.description ? ep.description.replace(/<[^>]*>/g, '') : 'No description',
            pubDate: ep.pubDate,
            centralDate: centralDate,
            dateKey: formatDateKey(centralDate),
            formattedDate: formatCentralTime(centralDate),
            show: show,
            hour: hour,
            videoUrl: transformVideoUrl(ep.link || ep.enclosure?.url || '')
        };
    });
}

// Render function for virtual list items
function renderPlaylistItem(episode, index) {
    const isActive = episode.id === stateManager.getState().nowPlayingId;
    const flyoutId = `flyout-${episode.id}`;
    
    const div = document.createElement('div');
    div.className = `playlist-item ${isActive ? 'active' : ''}`;
    div.dataset.id = episode.id;
    div.dataset.index = index;
    
    div.innerHTML = `
        <div class="menu-trigger" data-flyout="${flyoutId}">⋮</div>
        <div class="flyout-menu" id="${flyoutId}">
            <div class="flyout-menu-item" data-action="download">⬇️ Download</div>
            <div class="flyout-menu-item" data-action="share">📤 Share</div>
            <div class="flyout-menu-item" data-action="queue">📋 Add to Queue</div>
            <div class="flyout-menu-divider"></div>
            <div class="flyout-menu-item" data-action="details">📄 Details</div>
        </div>
        <div class="playlist-thumbnail">🎬</div>
        <div class="playlist-info">
            <div class="playlist-title">${escapeHtml(episode.title)}</div>
            <div class="playlist-date">📅 ${episode.formattedDate}</div>
            <div class="playlist-duration">🎬 ${episode.show} ${episode.hour}</div>
        </div>
    `;
    
    return div;
}

// Handle playlist item actions
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
            const episode = stateManager.getState().filteredEpisodes[index];
            
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
                showToast(`Added to queue`);
            } else if (action === 'details' && episode) {
                alert(`Title: ${episode.title}\nShow: ${episode.show} ${episode.hour}\nDate: ${episode.formattedDate}`);
            }
            
            const flyout = actionBtn.closest('.flyout-menu');
            if (flyout) flyout.style.display = 'none';
        }
        
        // Close flyouts on outside click
        if (!e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu')) {
            document.querySelectorAll('.flyout-menu').forEach(f => f.style.display = 'none');
        }
    });
}

// Render queue
function renderQueue() {
    const queueContainer = document.getElementById('queueContainer');
    const queueStats = document.getElementById('queueStats');
    const state = stateManager.getState();
    
    if (!queueContainer) return;
    
    if (state.queue.length === 0) {
        queueContainer.innerHTML = '<div class="empty-queue">Queue is empty</div>';
    } else {
        queueContainer.innerHTML = state.queue.map((item, idx) => `
            <div class="queue-item" data-index="${idx}">
                <span class="drag-handle">⠿</span>
                <div class="queue-info" data-action="play-queue" data-index="${idx}">
                    <div class="queue-title">${escapeHtml(item.title)}</div>
                    <div class="queue-date">${item.show} ${item.hour}</div>
                </div>
                <button class="remove-queue-item" data-action="remove-queue" data-index="${idx}">×</button>
            </div>
        `).join('');
    }
    
    if (queueStats) queueStats.textContent = `${state.queue.length} items`;
}

// Setup queue actions
function setupQueueActions() {
    document.addEventListener('click', (e) => {
        const playBtn = e.target.closest('[data-action="play-queue"]');
        if (playBtn) {
            const index = parseInt(playBtn.dataset.index);
            const episode = stateManager.getState().queue[index];
            if (episode) {
                stateManager.setState({ nowPlayingId: episode.id });
                if (videoControls) videoControls.loadEpisode(episode.videoUrl, true);
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
            stateManager.clearQueue();
            renderQueue();
        });
    }
}

// Setup search
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const debouncedSearch = debounce((e) => {
            stateManager.setState({ searchTerm: e.target.value });
        }, 300);
        searchInput.addEventListener('input', debouncedSearch);
    }
}

// Setup view mode
function setupViewMode() {
    const listBtn = document.getElementById('listViewBtn');
    const gridBtn = document.getElementById('gridViewBtn');
    
    if (listBtn) {
        listBtn.addEventListener('click', () => {
            stateManager.setViewMode('list');
            listBtn.classList.add('active');
            gridBtn.classList.remove('active');
            if (virtualList) virtualList.refresh();
        });
    }
    
    if (gridBtn) {
        gridBtn.addEventListener('click', () => {
            stateManager.setViewMode('grid');
            gridBtn.classList.add('active');
            listBtn.classList.remove('active');
            if (virtualList) virtualList.refresh();
        });
    }
}

// Setup dark mode
function setupDarkMode() {
    const darkBtn = document.getElementById('darkModeToggle');
    if (darkBtn) {
        darkBtn.addEventListener('click', () => {
            stateManager.toggleDarkMode();
            darkBtn.textContent = stateManager.getState().darkMode ? '☀️ Light' : '🌙 Dark';
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
                stateManager.setState({ filterDate: date });
                showToast(`Filtered to ${date}`);
            }
        });
    }
    
    if (calendarToggleBtn) {
        calendarToggleBtn.addEventListener('click', () => {
            if (calendarView) calendarView.toggle();
        });
    }
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
    
    if (skipBackBtn) skipBackBtn.addEventListener('click', () => videoControls.skip(-10));
    if (skipForwardBtn) skipForwardBtn.addEventListener('click', () => videoControls.skip(10));
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const state = stateManager.getState();
            const currentIndex = state.filteredEpisodes.findIndex(ep => ep.id === state.nowPlayingId);
            if (currentIndex !== -1 && currentIndex + 1 < state.filteredEpisodes.length) {
                stateManager.setState({ nowPlayingId: state.filteredEpisodes[currentIndex + 1].id });
            } else if (state.queue.length > 0) {
                const nextFromQueue = state.queue[0];
                stateManager.removeFromQueue(0);
                stateManager.setState({ nowPlayingId: nextFromQueue.id });
                renderQueue();
            }
        });
    }
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const episode = stateManager.getNowPlaying();
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
            const episode = stateManager.getNowPlaying();
            if (episode && navigator.share) {
                navigator.share({ title: episode.title, url: episode.videoUrl });
            } else if (episode) {
                navigator.clipboard.writeText(episode.videoUrl);
                showToast('Link copied');
            }
        });
    }
    
    if (videoControls) {
        videoControls.setOnEnd(() => {
            if (autoplayToggle && autoplayToggle.checked) {
                nextBtn.click();
            }
        });
    }
}

// Load episodes
async function loadEpisodes() {
    stateManager.setState({ loading: true });
    
    try {
        const result = await feedService.fetchFeed(RSS_URL);
        
        if (result.success && result.episodes) {
            const processedEpisodes = processRawEpisodes(result.episodes);
            processedEpisodes.sort((a, b) => b.centralDate - a.centralDate);
            
            stateManager.setState({
                episodes: processedEpisodes,
                filteredEpisodes: processedEpisodes,
                loading: false,
                nowPlayingId: processedEpisodes.length > 0 ? processedEpisodes[0].id : null
            });
            
            if (calendarView) calendarView.setEpisodes(processedEpisodes);
            showToast(`Loaded ${processedEpisodes.length} episodes`);
        } else {
            throw new Error(result.error || 'Failed to load feed');
        }
    } catch (error) {
        console.error('Failed to load episodes:', error);
        stateManager.setState({ loading: false, error: error.message });
        showToast(`Failed to load: ${error.message}`);
    }
}

// Initialize virtual list
function initVirtualList() {
    const container = document.getElementById('playlistContainer');
    if (!container) return;
    
    virtualList = new VirtualList(container, {
        rowHeight: 80,
        buffer: 5,
        renderItem: renderPlaylistItem,
        onItemClick: (index) => {
            const episode = stateManager.getState().filteredEpisodes[index];
            if (episode) {
                stateManager.setState({ nowPlayingId: episode.id });
                if (videoControls) videoControls.loadEpisode(episode.videoUrl, true);
                updateNowPlayingDisplay(episode);
            }
        }
    });
}

// Update now playing display
function updateNowPlayingDisplay(episode) {
    const titleEl = document.getElementById('currentTitle');
    const metaEl = document.getElementById('nowPlayingMeta');
    
    if (titleEl) titleEl.textContent = episode.title;
    if (metaEl) metaEl.textContent = `${episode.show} ${episode.hour} • ${episode.formattedDate}`;
}

// Subscribe to state changes
function subscribeToState() {
    stateManager.subscribe((state) => {
        // Update virtual list
        if (virtualList) {
            virtualList.setItems(state.filteredEpisodes);
        }
        
        // Update now playing video
        const nowPlaying = state.episodes.find(ep => ep.id === state.nowPlayingId);
        if (nowPlaying && videoControls) {
            if (videoControls.video?.src !== nowPlaying.videoUrl) {
                videoControls.loadEpisode(nowPlaying.videoUrl, true);
                updateNowPlayingDisplay(nowPlaying);
            }
        }
        
        // Update queue display
        renderQueue();
        
        // Update view mode class
        const container = document.getElementById('playlistContainer');
        if (container) {
            container.classList.toggle('grid-view', state.viewMode === 'grid');
        }
        
        // Update loading state
        if (state.loading) {
            const loadingEl = document.getElementById('playlistContainer');
            if (loadingEl && !state.filteredEpisodes.length) {
                loadingEl.innerHTML = '<div class="loading-state"><div class="loader"></div><div>Loading episodes...</div></div>';
            }
        }
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AJN Hourly Archive...');
    
    // Apply saved dark mode
    if (stateManager.getState().darkMode) {
        document.body.classList.add('dark');
    }
    
    // Setup components
    setupVideoControls();
    setupSearch();
    setupViewMode();
    setupDarkMode();
    setupCalendar();
    setupQueueActions();
    setupPlaylistActions();
    
    // Initialize virtual list
    initVirtualList();
    
    // Subscribe to state
    subscribeToState();
    
    // Load queue from storage
    stateManager.loadQueueFromStorage();
    renderQueue();
    
    // Load episodes
    loadEpisodes();
    
    console.log('Application ready');
});