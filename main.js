// ============ MAIN APPLICATION - ROOT-LEVEL IMPORTS ==========
// All files are in the root directory (same as index.html)
// Using ./ prefix for same-directory imports

// Import from root-level files that actually exist
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
    formatDateKey,
    trapFocus,
    debounce
} from './helpers.js';

// Note: The following files exist but are NOT imported because they're not needed for basic functionality:
// - xsltWorkerManager.js (advanced feature)
// - idGenerator.js (advanced feature)
// - stateManager.js (advanced feature)
// - feedService.js (advanced feature)
// - VirtualPlaylist.js (advanced feature - using simple rendering instead)

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing AJN Hourly Archive...");
    console.log("Files detected at root level - using simple renderer");
    
    // DOM Elements
    const videoPlayer = document.getElementById('videoPlayer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const nextBtn = document.getElementById('nextBtn');
    const currentTitle = document.getElementById('currentTitle');
    const playlistStats = document.getElementById('playlistStats');
    const searchInput = document.getElementById('globalSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    const gridViewBtn = document.getElementById('gridViewBtn');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const calendarToggleBtn = document.getElementById('calendarToggleBtn');
    const closeCalendarBtn = document.getElementById('closeCalendarBtn');
    const calendarOverlay = document.getElementById('calendarOverlay');
    const calendarPrevMonth = document.getElementById('calendarPrevMonth');
    const calendarNextMonth = document.getElementById('calendarNextMonth');
    const calendarMonthTitle = document.getElementById('calendarMonthTitle');
    const calendarGrid = document.getElementById('calendarGrid');
    const progressBar = document.getElementById('progressBar');
    const currentTimeDisplay = document.getElementById('currentTime');
    const durationDisplay = document.getElementById('duration');
    const skipBackBtn = document.getElementById('skipBackBtn');
    const skipForwardBtn = document.getElementById('skipForwardBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const shareBtn = document.getElementById('shareBtn');
    const autoplayToggle = document.getElementById('autoplayToggle');
    const queueHeader = document.getElementById('queueHeader');
    const queueContainer = document.getElementById('queueContainer');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    const queueStats = document.getElementById('queueStats');
    
    // State
    let allEpisodes = [];
    let currentPlaylist = [];
    let currentIndex = 0;
    let videoControls = null;
    let currentCalendarDate = new Date();
    let userQueue = [];
    
    // Constants
    const API_URL = 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.alexjones.media/AJNHourlyVideo.xml';
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Initialize VideoControls (single instance)
    if (videoPlayer && progressBar && playPauseBtn && currentTimeDisplay && durationDisplay) {
        videoControls = new VideoControls(
            videoPlayer, progressBar, playPauseBtn, currentTimeDisplay, durationDisplay
        );
        console.log("VideoControls initialized");
    } else {
        console.warn("VideoControls elements not found", {
            videoPlayer: !!videoPlayer,
            progressBar: !!progressBar,
            playPauseBtn: !!playPauseBtn,
            currentTimeDisplay: !!currentTimeDisplay,
            durationDisplay: !!durationDisplay
        });
    }
    
    // Queue functions
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
        if (queueStats) queueStats.textContent = `${userQueue.length} item${userQueue.length !== 1 ? 's' : ''}`;
    }
    
    function renderQueue() {
        if (!queueContainer) return;
        
        if (userQueue.length === 0) {
            queueContainer.innerHTML = '<div class="empty-queue" style="padding: 16px; text-align: center; color: var(--text-secondary);">Queue is empty</div>';
            return;
        }
        
        queueContainer.innerHTML = userQueue.map((item, idx) => `
            <div class="queue-item" data-index="${idx}">
                <span class="drag-handle">⠿</span>
                <div class="queue-info" onclick="window.playFromQueue(${idx})" style="flex:1; cursor:pointer;">
                    <div class="queue-title">${escapeHtml(item.title)}</div>
                    <div class="queue-date">${escapeHtml(item.show)} ${escapeHtml(item.hour)}</div>
                </div>
                <button onclick="window.removeFromQueue(${idx})" style="background:none; border:none; cursor:pointer;">×</button>
            </div>
        `).join('');
    }
    
    function addToQueue(episode) {
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
            currentTitle.textContent = item.title;
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
    
    // Make queue functions global for onclick handlers
    window.playFromQueue = playFromQueue;
    window.removeFromQueue = removeFromQueue;
    window.addToQueueGlobal = addToQueue;
    
    // Play episode function
    function playEpisode(index) {
        if (index < 0 || index >= currentPlaylist.length) return;
        currentIndex = index;
        const episode = currentPlaylist[currentIndex];
        if (currentTitle) currentTitle.textContent = episode.title;
        
        if (videoControls) {
            videoControls.loadEpisode(episode.videoUrl, true);
        }
        
        // Update active state in UI
        document.querySelectorAll('.playlist-item.list-item').forEach((item, i) => {
            if (i === currentIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    // Next episode
    function nextEpisode() {
        if (userQueue.length > 0) {
            const nextItem = userQueue[0];
            userQueue.splice(0, 1);
            saveQueue();
            renderQueue();
            if (currentTitle) currentTitle.textContent = nextItem.title;
            if (videoControls) videoControls.loadEpisode(nextItem.videoUrl, true);
            showToast('Playing next from queue');
        } else if (currentIndex + 1 < currentPlaylist.length) {
            playEpisode(currentIndex + 1);
            showToast('Playing next episode...');
        } else {
            showToast('End of playlist');
        }
    }
    
    // Video event handlers
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            if (videoControls) videoControls.togglePlayPause();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', nextEpisode);
    }
    
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
    
    if (videoControls && autoplayToggle) {
        videoControls.setOnEnd(() => {
            if (autoplayToggle.checked) {
                nextEpisode();
            }
        });
    }
    
    // Download and Share
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
    
    // Process raw episodes
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
    
    // Render playlist (simple version - no virtual scrolling)
    function renderPlaylist() {
        const playlistContainer = document.getElementById('playlistContainer');
        if (!playlistContainer) return;
        
        if (!currentPlaylist.length) {
            playlistContainer.innerHTML = '<div class="empty-state">📭 No episodes found</div>';
            return;
        }
        
        playlistContainer.innerHTML = currentPlaylist.map((ep, idx) => {
            const isActive = idx === currentIndex;
            const flyoutId = `flyout-${idx}`;
            
            return `
                <div class="playlist-item list-item ${isActive ? 'active' : ''}" data-index="${idx}" style="position: relative; display: flex; align-items: center; gap: 16px; padding: 16px; border-bottom: 1px solid var(--border); cursor: pointer;">
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
                </div>
            `;
        }).join('');
        
        // Add event listeners
        document.querySelectorAll('.playlist-item.list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu') && !e.target.closest('.add-to-queue-btn')) {
                    const index = parseInt(item.dataset.index);
                    if (!isNaN(index)) playEpisode(index);
                }
            });
        });
        
        // Flyout triggers
        document.querySelectorAll('.menu-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const flyoutId = trigger.getAttribute('data-flyout');
                const menu = document.getElementById(flyoutId);
                if (menu) {
                    document.querySelectorAll('.flyout-menu').forEach(m => {
                        if (m.id !== flyoutId) m.style.display = 'none';
                    });
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                }
            });
        });
        
        // Action handlers
        document.querySelectorAll('.flyout-menu-item, .add-to-queue-btn').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.getAttribute('data-action');
                const index = parseInt(item.getAttribute('data-index'));
                
                if (action === 'download') {
                    const episode = currentPlaylist[index];
                    if (episode) {
                        const link = document.createElement('a');
                        link.href = episode.videoUrl;
                        link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
                        link.click();
                        showToast('Download started');
                    }
                } else if (action === 'share') {
                    const episode = currentPlaylist[index];
                    if (episode && navigator.share) {
                        navigator.share({ title: episode.title, url: episode.videoUrl });
                    } else if (episode) {
                        navigator.clipboard.writeText(episode.videoUrl);
                        showToast('Link copied');
                    }
                } else if (action === 'queue') {
                    const episode = currentPlaylist[index];
                    if (episode) addToQueue(episode);
                } else if (action === 'details') {
                    const episode = currentPlaylist[index];
                    if (episode) {
                        alert(`Title: ${episode.title}\nShow: ${episode.show} ${episode.hour}\nDate: ${episode.formattedDate}`);
                    }
                }
                
                // Close flyout if it was a flyout item
                const flyout = item.closest('.flyout-menu');
                if (flyout) flyout.style.display = 'none';
            });
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
    
    // Apply filters
    function applyFilters() {
        let filtered = [...allEpisodes];
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        
        if (searchTerm) {
            filtered = filtered.filter(ep => 
                ep.title.toLowerCase().includes(searchTerm) || 
                ep.description.toLowerCase().includes(searchTerm)
            );
        }
        
        currentPlaylist = filtered;
        currentIndex = 0;
        
        renderPlaylist();
        
        const uniqueDates = new Set(currentPlaylist.map(e => e.dateKey));
        if (playlistStats) {
            playlistStats.innerHTML = `${currentPlaylist.length} episodes • ${uniqueDates.size} days`;
        }
        
        if (currentPlaylist.length > 0 && videoControls) {
            const episode = currentPlaylist[0];
            if (currentTitle) currentTitle.textContent = episode.title;
            videoControls.loadEpisode(episode.videoUrl, false);
        }
    }
    
    // Search
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applyFilters();
            if (clearSearchBtn) {
                clearSearchBtn.classList.toggle('visible', searchInput.value.length > 0);
            }
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            clearSearchBtn.classList.remove('visible');
            applyFilters();
        });
    }
    
    // Calendar functions
    function renderCalendar() {
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
        
        if (calendarGrid) calendarGrid.innerHTML = html;
        
        document.querySelectorAll('.calendar-day[data-date]').forEach(day => {
            day.addEventListener('click', () => {
                const dateKey = day.getAttribute('data-date');
                if (searchInput) searchInput.value = '';
                if (clearSearchBtn) clearSearchBtn.classList.remove('visible');
                
                const filtered = allEpisodes.filter(ep => ep.dateKey === dateKey);
                currentPlaylist = filtered;
                currentIndex = 0;
                
                renderPlaylist();
                
                const formattedDate = new Date(dateKey).toLocaleDateString();
                if (playlistStats) {
                    playlistStats.innerHTML = `${currentPlaylist.length} episodes • Filtered to ${formattedDate}`;
                }
                
                if (currentPlaylist.length > 0 && videoControls) {
                    const episode = currentPlaylist[0];
                    if (currentTitle) currentTitle.textContent = episode.title;
                    videoControls.loadEpisode(episode.videoUrl, false);
                }
                
                if (calendarOverlay) {
                    calendarOverlay.classList.remove('is-visible');
                }
                
                showToast(`Showing ${currentPlaylist.length} episodes for ${formattedDate}`);
            });
        });
    }
    
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
    
    // View mode toggle
    if (listViewBtn && gridViewBtn) {
        listViewBtn.addEventListener('click', () => {
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
            const container = document.getElementById('playlistContainer');
            if (container) container.classList.remove('grid-view');
        });
        
        gridViewBtn.addEventListener('click', () => {
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
            const container = document.getElementById('playlistContainer');
            if (container) container.classList.add('grid-view');
        });
    }
    
    // Dark mode
    function initDarkMode() {
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
    
    // Queue toggle
    if (queueHeader && queueContainer) {
        queueHeader.addEventListener('click', () => {
            queueContainer.classList.toggle('expanded');
        });
    }
    
    // Clear queue button
    if (clearQueueBtn) {
        clearQueueBtn.addEventListener('click', () => {
            userQueue = [];
            saveQueue();
            renderQueue();
            showToast('Queue cleared');
        });
    }
    
    // Load episodes
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
            
            renderPlaylist();
            
            const uniqueDates = new Set(currentPlaylist.map(e => e.dateKey));
            if (playlistStats) {
                playlistStats.innerHTML = `${currentPlaylist.length} episodes • ${uniqueDates.size} days`;
            }
            
            if (currentPlaylist.length > 0 && videoControls) {
                const episode = currentPlaylist[0];
                if (currentTitle) currentTitle.textContent = episode.title;
                videoControls.loadEpisode(episode.videoUrl, false);
            }
            
            showToast(`Loaded ${allEpisodes.length} episodes`);
            console.log('Application ready - All root-level imports resolved');
            
        } catch (error) {
            console.error('Error loading episodes:', error);
            const playlistContainer = document.getElementById('playlistContainer');
            if (playlistContainer) {
                playlistContainer.innerHTML = `<div class="error-state" style="text-align: center; padding: 40px; color: var(--primary);">❌ Failed to load episodes: ${error.message}</div>`;
            }
            showToast('Failed to load episodes');
        }
    }
    
    // Initialize
    initDarkMode();
    loadQueue();
    loadEpisodes();
    
    console.log("Main.js loaded - Using root-level imports only");
});