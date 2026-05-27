// ============ MAIN APPLICATION - CORRECTED IMPORTS FOR ROOT-LEVEL FILES ==========
// All files are at the root level (same directory as index.html)
// Import using the exact filenames as they appear in your directory

// Core imports - these files exist at root level
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

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing AJN Hourly Archive...");
    
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
    
    // State
    let allEpisodes = [];
    let currentPlaylist = [];
    let currentIndex = 0;
    let videoControls = null;
    let currentCalendarDate = new Date();
    
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
        console.warn("VideoControls elements not found");
    }
    
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
        if (currentIndex + 1 < currentPlaylist.length) {
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
    
    // Render playlist
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
                <div class="playlist-item list-item ${isActive ? 'active' : ''}" data-index="${idx}">
                    <div class="menu-trigger" data-flyout="${flyoutId}">⋮</div>
                    <div class="flyout-menu" id="${flyoutId}">
                        <div class="flyout-menu-item" data-action="download" data-index="${idx}">⬇️ Download</div>
                        <div class="flyout-menu-item" data-action="share" data-index="${idx}">📤 Share</div>
                        <div class="flyout-menu-divider"></div>
                        <div class="flyout-menu-item" data-action="details" data-index="${idx}">📄 Details</div>
                    </div>
                    <div class="playlist-thumbnail">🎬</div>
                    <div class="playlist-info">
                        <div class="playlist-title">${escapeHtml(ep.title)}</div>
                        <div class="playlist-date">📅 ${ep.formattedDate}</div>
                        <div class="playlist-duration">🎬 ${ep.show} ${ep.hour}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add event listeners
        document.querySelectorAll('.playlist-item.list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu')) {
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
                        if (m.id !== flyoutId) m.classList.remove('active');
                    });
                    menu.classList.toggle('active');
                }
            });
        });
        
        // Action handlers
        document.querySelectorAll('.flyout-menu-item').forEach(item => {
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
                } else if (action === 'details') {
                    const episode = currentPlaylist[index];
                    if (episode) {
                        alert(`Title: ${episode.title}\nShow: ${episode.show} ${episode.hour}\nDate: ${episode.formattedDate}`);
                    }
                }
                
                item.closest('.flyout-menu').classList.remove('active');
            });
        });
        
        // Close flyouts on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-trigger')) {
                document.querySelectorAll('.flyout-menu').forEach(menu => {
                    menu.classList.remove('active');
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
        WEEKDAYS.forEach(day => { weekdaysHtml += `<div class="calendar-weekday">${day}</div>`; });
        const calendarWeekdays = document.querySelector('.calendar-weekdays');
        if (calendarWeekdays) calendarWeekdays.innerHTML = weekdaysHtml;
        
        let html = '';
        let dayCounter = 1;
        
        for (let i = 0; i < startDay; i++) {
            html += '<div class="calendar-day other-month"></div>';
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dateKey = formatDateKey(currentDate);
            const dayEpisodes = allEpisodes.filter(ep => ep.dateKey === dateKey);
            const isToday = dateKey === todayKey;
            const hasEpisodes = dayEpisodes.length > 0;
            
            html += `
                <div class="calendar-day ${hasEpisodes ? 'has-episode' : ''} ${isToday ? 'today' : ''}"
                     data-date="${dateKey}">
                    <div class="calendar-day-number">${day}</div>
                    ${hasEpisodes ? '<div class="dot-indicator"></div>' : ''}
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
    const queueHeader = document.getElementById('queueHeader');
    const queueContainer = document.getElementById('queueContainer');
    if (queueHeader && queueContainer) {
        queueHeader.addEventListener('click', () => {
            queueContainer.classList.toggle('expanded');
        });
    }
    
    // Clear queue button
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    if (clearQueueBtn) {
        clearQueueBtn.addEventListener('click', () => {
            const queueContainer = document.getElementById('queueContainer');
            if (queueContainer) {
                queueContainer.innerHTML = '';
                const queueStats = document.getElementById('queueStats');
                if (queueStats) queueStats.textContent = '0 items';
                showToast('Queue cleared');
            }
        });
    }
    
    // Load episodes
    async function loadEpisodes() {
        const playlistContainer = document.getElementById('playlistContainer');
        if (playlistContainer) {
            playlistContainer.innerHTML = '<div class="loading-state"><div class="loader"></div><div>Loading episodes...</div></div>';
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
            console.log('Application ready - All imports resolved');
            
        } catch (error) {
            console.error('Error loading episodes:', error);
            const playlistContainer = document.getElementById('playlistContainer');
            if (playlistContainer) {
                playlistContainer.innerHTML = `<div class="error-state">❌ Failed to load episodes: ${error.message}</div>`;
            }
            showToast('Failed to load episodes');
        }
    }
    
    // Initialize
    initDarkMode();
    loadEpisodes();
    
    console.log("Main.js loaded - Using root-level imports");
});