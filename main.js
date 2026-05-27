// ============ MAIN.JS - FINAL VERIFIED VERSION ==========
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

// Global references
let videoControls = null;
let virtualList = null;
let calendarView = null;
let allEpisodes = [];

// Process raw episodes
function processRawEpisodes(rawEpisodes) {
    if (!rawEpisodes || !rawEpisodes.length) return [];
    
    return rawEpisodes.map((ep, idx) => {
        const utcDate = new Date(ep.pubDate);
        const centralDate = toCentralTime(utcDate);
        const { show, hour } = parseEpisodeDetails(ep.title);
        return {
            id: `ep_${idx}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
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

// Render playlist item
function renderPlaylistItem(episode, index) {
    const flyoutId = `flyout-${episode.id}`;
    const div = document.createElement('div');
    div.className = 'playlist-item';
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
            }
        }
    });
    console.log('VirtualList component created');
}

// Load episodes
async function loadAndInitialize() {
    const playlistContainer = document.getElementById('playlistContainer');
    if (playlistContainer) {
        playlistContainer.innerHTML = '<div class="loading-state"><div class="loader"></div><div>Loading episodes...</div></div>';
    }
    
    try {
        console.log('Fetching RSS feed...');
        const result = await feedService.fetchFeed(RSS_URL);
        
        if (result.success && result.episodes) {
            allEpisodes = processRawEpisodes(result.episodes);
            allEpisodes.sort((a, b) => b.centralDate - a.centralDate);
            
            console.log(`Loaded ${allEpisodes.length} episodes`);
            
            if (virtualList) virtualList.setItems(allEpisodes);
            if (calendarView) calendarView.setEpisodes(allEpisodes);
            
            if (allEpisodes.length > 0) {
                updateNowPlayingDisplay(allEpisodes[0]);
                if (videoControls) videoControls.loadEpisode(allEpisodes[0].videoUrl, false);
            }
            
            showToast(`Loaded ${allEpisodes.length} episodes`);
        } else {
            throw new Error(result.error || 'Failed to load feed');
        }
    } catch (error) {
        console.error('Failed to load episodes:', error);
        if (playlistContainer) {
            playlistContainer.innerHTML = `<div class="error-state">❌ Failed to load: ${error.message}</div>`;
        }
        showToast(`Failed to load: ${error.message}`);
    }
}

// Render queue
function renderQueue() {
    const state = stateManager.getState();
    const queueContainer = document.getElementById('queueContainer');
    const queueStats = document.getElementById('queueStats');
    
    if (!queueContainer) return;
    
    if (!state.queue || state.queue.length === 0) {
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
            if (virtualList && allEpisodes.length) {
                const currentVideo = videoControls?.video;
                if (currentVideo) {
                    const currentSrc = currentVideo.src;
                    const currentIndex = allEpisodes.findIndex(ep => ep.videoUrl === currentSrc);
                    if (currentIndex !== -1 && currentIndex + 1 < allEpisodes.length) {
                        const nextEpisode = allEpisodes[currentIndex + 1];
                        videoControls.loadEpisode(nextEpisode.videoUrl, true);
                        updateNowPlayingDisplay(nextEpisode);
                        virtualList.scrollToIndex(currentIndex + 1);
                    }
                }
            }
        });
    }
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const currentSrc = videoControls?.video?.src;
            const episode = allEpisodes.find(ep => ep.videoUrl === currentSrc);
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
            const currentSrc = videoControls?.video?.src;
            const episode = allEpisodes.find(ep => ep.videoUrl === currentSrc);
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
        const debouncedSearch = debounce((e) => {
            const term = e.target.value.toLowerCase();
            const filtered = term ? allEpisodes.filter(ep => 
                ep.title.toLowerCase().includes(term) || 
                ep.description.toLowerCase().includes(term)
            ) : allEpisodes;
            if (virtualList) virtualList.setItems(filtered);
        }, 300);
        searchInput.addEventListener('input', debouncedSearch);
    }
}

// Setup view mode
function setupViewMode() {
    const listBtn = document.getElementById('listViewBtn');
    const gridBtn = document.getElementById('gridViewBtn');
    const playlistContainer = document.getElementById('playlistContainer');
    
    if (listBtn) {
        listBtn.addEventListener('click', () => {
            listBtn.classList.add('active');
            gridBtn.classList.remove('active');
            if (playlistContainer) playlistContainer.classList.remove('grid-view');
            if (virtualList) virtualList.refresh();
        });
    }
    
    if (gridBtn) {
        gridBtn.addEventListener('click', () => {
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
    const isDark = localStorage.getItem('darkMode') === 'true';
    
    if (isDark) {
        document.body.classList.add('dark');
        if (darkBtn) darkBtn.textContent = '☀️ Light';
    }
    
    if (darkBtn) {
        darkBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            const dark = document.body.classList.contains('dark');
            localStorage.setItem('darkMode', dark);
            darkBtn.textContent = dark ? '☀️ Light' : '🌙 Dark';
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
                const filtered = allEpisodes.filter(ep => ep.dateKey === date);
                if (virtualList) virtualList.setItems(filtered);
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

// Setup playlist actions
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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AJN Hourly Archive...');
    
    setupDarkMode();
    setupVideoControls();
    setupSearch();
    setupViewMode();
    setupCalendar();
    setupPlaylistActions();
    setupQueueActions();
    
    stateManager.loadQueueFromStorage();
    renderQueue();
    
    initVirtualList();
    loadAndInitialize();
    
    console.log('Application ready');
});