// ============ MAIN APPLICATION - COMPLETE WORKING VERSION ============

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM is ready. Initializing components...");
    
    // Global state
    let allEpisodes = [];
    let currentPlaylist = [];
    let currentIndex = 0;
    let videoControls = null;
    let currentEpisodeData = null;
    
    // DOM Elements
    const videoPlayer = document.getElementById('videoPlayer');
    const progressBar = document.getElementById('progressBar');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const currentTimeDisplay = document.getElementById('currentTime');
    const durationDisplay = document.getElementById('duration');
    const skipBackBtn = document.getElementById('skipBackBtn');
    const skipForwardBtn = document.getElementById('skipForwardBtn');
    const autoplayToggle = document.getElementById('autoplayToggle');
    const immersiveBtn = document.getElementById('immersiveViewBtn');
    const videoContainer = document.getElementById('videoThumbnailContainer');
    const currentTitle = document.getElementById('currentTitle');
    const playlistStats = document.getElementById('playlistStats');
    const playlistContainer = document.getElementById('playlistContainer');
    const scrollSpacer = document.getElementById('scrollSpacer');
    const virtualList = document.getElementById('virtualList');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const downloadBtn = document.getElementById('downloadBtn');
    const shareBtn = document.getElementById('shareBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // RSS Feed URL
    const RSS_URL = 'https://rss.alexjones.media/AJNHourlyVideo.xml';
    const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;
    
    // Helper functions
    function transformVideoUrl(originalUrl) {
        if (!originalUrl) return '#';
        const filename = originalUrl.substring(originalUrl.lastIndexOf('/') + 1);
        if (filename.endsWith('.m4v') || filename.endsWith('.mp4')) {
            return `https://ajn.archives.pub/hourly-m4v/${filename}`;
        }
        return originalUrl;
    }
    
    function toCentralTime(date) {
        return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    }
    
    function formatCentralTime(date) {
        return date.toLocaleString('en-US', {
            timeZone: 'America/Chicago',
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
    
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    function parseEpisodeDetails(title) {
        const warRoomMatch = title.match(/WarRoom[- ]Hr(\d+)/i);
        const alexMatch = title.match(/Alex[- ]Jones[- ]Show[- ]Hr(\d+)/i);
        
        if (warRoomMatch) {
            return { show: 'War Room', hour: `Hour ${warRoomMatch[1]}` };
        }
        if (alexMatch) {
            return { show: 'Alex Jones Show', hour: `Hour ${alexMatch[1]}` };
        }
        if (title.match(/Nightline/i)) {
            return { show: 'Nightline', hour: '' };
        }
        return { show: 'Episode', hour: '' };
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    function showToast(message, duration = 3000) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            background: var(--bg-surface); color: var(--text-primary);
            padding: 12px 20px; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 2000; animation: slideIn 0.3s ease;
            border-left: 3px solid var(--primary);
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }
    
    // Video Controls
    function initVideoControls() {
        let isSeeking = false;
        
        videoPlayer.addEventListener('timeupdate', () => {
            if (!isSeeking && videoPlayer.duration) {
                const percent = (videoPlayer.currentTime / videoPlayer.duration) * 100;
                progressBar.value = percent;
                currentTimeDisplay.textContent = formatTime(videoPlayer.currentTime);
            }
        });
        
        videoPlayer.addEventListener('loadedmetadata', () => {
            durationDisplay.textContent = formatTime(videoPlayer.duration);
            progressBar.max = 100;
        });
        
        progressBar.addEventListener('input', (e) => {
            isSeeking = true;
            const seekTime = (e.target.value / 100) * videoPlayer.duration;
            currentTimeDisplay.textContent = formatTime(seekTime);
        });
        
        progressBar.addEventListener('change', (e) => {
            const seekTime = (e.target.value / 100) * videoPlayer.duration;
            videoPlayer.currentTime = seekTime;
            isSeeking = false;
        });
        
        playPauseBtn.addEventListener('click', () => {
            if (videoPlayer.paused) {
                videoPlayer.play();
                playPauseBtn.innerHTML = '⏸ Pause';
            } else {
                videoPlayer.pause();
                playPauseBtn.innerHTML = '⏯ Play';
            }
        });
        
        videoPlayer.addEventListener('play', () => {
            playPauseBtn.innerHTML = '⏸ Pause';
        });
        
        videoPlayer.addEventListener('pause', () => {
            playPauseBtn.innerHTML = '⏯ Play';
        });
        
        skipBackBtn.addEventListener('click', () => {
            videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
            showToast('Back 10 seconds');
        });
        
        skipForwardBtn.addEventListener('click', () => {
            videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 10);
            showToast('Forward 10 seconds');
        });
        
        immersiveBtn.addEventListener('click', () => {
            if (videoContainer.requestFullscreen) {
                videoContainer.requestFullscreen();
            } else if (videoContainer.webkitRequestFullscreen) {
                videoContainer.webkitRequestFullscreen();
            }
        });
    }
    
    // Virtual Playlist rendering
    const ROW_HEIGHT = 80;
    const BUFFER = 5;
    
    function renderVirtualPlaylist() {
        if (!currentPlaylist.length) {
            virtualList.innerHTML = '<div class="empty-state" style="padding: 40px; text-align: center;">📭 No episodes found</div>';
            return;
        }
        
        const scrollTop = playlistContainer.scrollTop;
        const viewportHeight = playlistContainer.clientHeight;
        const totalHeight = currentPlaylist.length * ROW_HEIGHT;
        scrollSpacer.style.height = `${totalHeight}px`;
        
        const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
        const endIndex = Math.min(currentPlaylist.length - 1, Math.floor((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER);
        
        const offsetY = startIndex * ROW_HEIGHT;
        virtualList.style.transform = `translateY(${offsetY}px)`;
        
        const visibleItems = currentPlaylist.slice(startIndex, endIndex + 1);
        
        virtualList.innerHTML = visibleItems.map((ep, idx) => {
            const actualIndex = startIndex + idx;
            const isActive = actualIndex === currentIndex;
            const flyoutId = `flyout-${actualIndex}`;
            
            return `
                <div class="playlist-item ${isActive ? 'active' : ''}" 
                     data-index="${actualIndex}"
                     style="height: ${ROW_HEIGHT}px"
                     tabindex="0"
                     role="button"
                     aria-label="Play episode: ${escapeHtml(ep.title)}">
                    
                    <div class="menu-trigger" 
                         data-flyout="${flyoutId}"
                         onclick="event.stopPropagation(); document.getElementById('${flyoutId}').classList.toggle('active')">
                        ⋮
                    </div>
                    
                    <div class="flyout-menu" id="${flyoutId}" role="menu">
                        <div class="flyout-menu-item" onclick="event.stopPropagation(); downloadEpisode(${actualIndex})">⬇️ Download</div>
                        <div class="flyout-menu-item" onclick="event.stopPropagation(); shareEpisode(${actualIndex})">📤 Share</div>
                        <div class="flyout-menu-divider"></div>
                        <div class="flyout-menu-item" onclick="event.stopPropagation(); copyLink(${actualIndex})">🔗 Copy Link</div>
                        <div class="flyout-menu-item" onclick="event.stopPropagation(); viewDetails(${actualIndex})">📄 Details</div>
                    </div>
                    
                    <div class="playlist-thumbnail" aria-hidden="true">🎬</div>
                    <div class="playlist-info">
                        <div class="playlist-title">${escapeHtml(ep.title)}</div>
                        <div class="playlist-date">📅 ${formatCentralTime(ep.centralDate)}</div>
                        <div class="playlist-duration">🎬 ${ep.show} ${ep.hour}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Play episode
    function playEpisode(index) {
        if (index < 0 || index >= currentPlaylist.length) return;
        
        currentIndex = index;
        const episode = currentPlaylist[currentIndex];
        currentEpisodeData = episode;
        
        currentTitle.textContent = episode.title;
        videoPlayer.src = episode.videoUrl;
        videoPlayer.load();
        
        if (autoplayToggle.checked) {
            videoPlayer.play().catch(e => console.log('Autoplay prevented'));
        }
        
        renderVirtualPlaylist();
        
        // Update media session
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: episode.title,
                artist: episode.show,
                album: 'AJN Hourly Archive'
            });
        }
        
        document.title = `${episode.show} - AJN Hourly Archive`;
        localStorage.setItem('lastPlaylistIndex', currentIndex);
    }
    
    // Auto-play next episode
    videoPlayer.addEventListener('ended', () => {
        if (autoplayToggle.checked && currentIndex + 1 < currentPlaylist.length) {
            playEpisode(currentIndex + 1);
            showToast('▶ Auto-playing next episode');
        }
    });
    
    // Action handlers
    window.downloadEpisode = function(index) {
        const episode = currentPlaylist[index];
        if (!episode) return;
        
        const link = document.createElement('a');
        link.href = episode.videoUrl;
        link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
        link.click();
        showToast(`Downloading: ${episode.title.substring(0, 50)}...`);
        closeAllFlyouts();
    };
    
    window.shareEpisode = function(index) {
        const episode = currentPlaylist[index];
        if (!episode) return;
        
        if (navigator.share) {
            navigator.share({
                title: episode.title,
                text: episode.description.substring(0, 100),
                url: episode.videoUrl
            });
        } else {
            navigator.clipboard.writeText(episode.videoUrl);
            showToast('Link copied to clipboard');
        }
        closeAllFlyouts();
    };
    
    window.copyLink = function(index) {
        const episode = currentPlaylist[index];
        if (!episode) return;
        
        navigator.clipboard.writeText(episode.videoUrl);
        showToast('Link copied to clipboard');
        closeAllFlyouts();
    };
    
    window.viewDetails = function(index) {
        const episode = currentPlaylist[index];
        if (!episode) return;
        
        closeAllFlyouts();
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); display: flex; align-items: center;
            justify-content: center; z-index: 2000; backdrop-filter: blur(4px);
        `;
        
        modal.innerHTML = `
            <div style="background: var(--bg-surface); border-radius: 16px; 
                        max-width: 500px; width: 90%; max-height: 80vh; 
                        overflow-y: auto; padding: 24px;">
                <h3 style="margin-bottom: 16px; color: var(--primary);">Episode Details</h3>
                <div style="margin-bottom: 12px;"><strong>Title:</strong><br>${escapeHtml(episode.title)}</div>
                <div style="margin-bottom: 12px;"><strong>Show:</strong><br>${episode.show} ${episode.hour}</div>
                <div style="margin-bottom: 12px;"><strong>Date (CT):</strong><br>${formatCentralTime(episode.centralDate)}</div>
                <div style="margin-bottom: 12px;"><strong>Description:</strong><br>${escapeHtml(episode.description)}</div>
                <button onclick="this.closest('div').parentElement.remove()" class="btn btn-primary">Close</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    };
    
    function closeAllFlyouts() {
        document.querySelectorAll('.flyout-menu').forEach(menu => menu.classList.remove('active'));
    }
    
    // Load episodes from RSS
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
                    dateKey: centralDate.toISOString().split('T')[0],
                    show: show,
                    hour: hour,
                    videoUrl: transformVideoUrl(item.link)
                };
            });
            
            allEpisodes.sort((a, b) => b.centralDate - a.centralDate);
            currentPlaylist = [...allEpisodes];
            
            const uniqueDates = new Set(currentPlaylist.map(e => e.dateKey));
            playlistStats.innerHTML = `${currentPlaylist.length.toLocaleString()} episodes • ${uniqueDates.size} days • CT Timezone`;
            
            renderVirtualPlaylist();
            
            if (currentPlaylist.length > 0) {
                playEpisode(0);
            }
            
            showToast(`Loaded ${allEpisodes.length.toLocaleString()} episodes`);
            
        } catch (error) {
            console.error('Error:', error);
            playlistStats.innerHTML = '❌ Failed to load episodes';
            showToast('Failed to load episodes', 4000);
        }
    }
    
    // Event listeners for playlist container (delegation)
    playlistContainer.addEventListener('click', (e) => {
        const playlistItem = e.target.closest('.playlist-item');
        if (playlistItem && !e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu')) {
            const index = parseInt(playlistItem.dataset.index);
            if (!isNaN(index)) playEpisode(index);
        }
    });
    
    // Close flyouts when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu')) {
            closeAllFlyouts();
        }
    });
    
    // Scroll handler for virtual list
    playlistContainer.addEventListener('scroll', () => {
        requestAnimationFrame(renderVirtualPlaylist);
    });
    
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
    
    // Main button handlers
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (currentEpisodeData) window.downloadEpisode(currentIndex);
        });
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            if (currentEpisodeData) window.shareEpisode(currentIndex);
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentIndex + 1 < currentPlaylist.length) {
                playEpisode(currentIndex + 1);
                showToast('Playing next episode...');
            } else {
                showToast('End of playlist');
            }
        });
    }
    
    // Initialize
    initDarkMode();
    initVideoControls();
    loadEpisodes();
    
    console.log("Application initialized successfully!");
});