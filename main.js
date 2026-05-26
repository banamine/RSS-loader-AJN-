// ============ MAIN APPLICATION WITH VIRTUAL PLAYLIST ============

// Global state
let allEpisodes = [];
let currentPlaylist = [];
let currentIndex = 0;
let nowPlayingCard = null;
let virtualPlaylist = null;

// RSS Feed URL
const RSS_URL = 'https://rss.alexjones.media/AJNHourlyVideo.xml';
const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;

// Load episodes from RSS
async function loadEpisodes() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        if (data.status !== 'ok') {
            throw new Error('Failed to load RSS feed');
        }
        
        // Process episodes
        allEpisodes = data.items.map((item, idx) => {
            const utcDate = new Date(item.pubDate);
            const centralDate = toCentralTime(utcDate);
            const { show, hour } = parseEpisodeDetails(item.title);
            
            return {
                id: idx,
                title: item.title,
                description: item.description ? item.description.replace(/<[^>]*>/g, '') : 'No description',
                pubDateUTC: utcDate,
                centralDate: centralDate,
                dateKey: centralDate.toISOString().split('T')[0],
                show: show,
                hour: hour,
                videoUrl: transformVideoUrl(item.link),
                originalLink: item.link
            };
        });
        
        // Sort by date (newest first)
        allEpisodes.sort((a, b) => b.centralDate - a.centralDate);
        currentPlaylist = [...allEpisodes];
        
        // Update UI
        updatePlaylistStats();
        
        // Initialize Virtual Playlist
        if (!virtualPlaylist) {
            virtualPlaylist = new VirtualPlaylist('playlistContainer', {
                rowHeight: 80, // Must match CSS height
                buffer: 5
            });
            
            virtualPlaylist.setOnItemClick((index) => {
                playEpisode(index);
            });
            
            virtualPlaylist.setOnScrollEnd(() => {
                // For future lazy loading implementation
                console.log('Scroll end reached - ready for lazy loading');
            });
        }
        
        // Set items in virtual playlist
        virtualPlaylist.setItems(currentPlaylist);
        
        // Initialize Now Playing Card component
        if (!nowPlayingCard) {
            nowPlayingCard = new NowPlayingCard();
            nowPlayingCard.setOnEpisodeEnd(() => {
                if (nowPlayingCard.isAutoplayEnabled() && currentIndex + 1 < currentPlaylist.length) {
                    playEpisode(currentIndex + 1);
                    showToast('▶ Auto-playing next episode');
                }
            });
        }
        
        // Auto-select first episode
        if (currentPlaylist.length > 0) {
            playEpisode(0);
        }
        
        // Log performance metrics
        if (virtualPlaylist) {
            console.log('Virtual Playlist Metrics:', virtualPlaylist.getPerformanceMetrics());
        }
        
        showToast(`Loaded ${allEpisodes.length} episodes (virtualized for smooth scrolling)`);
        
    } catch (error) {
        console.error('Error loading episodes:', error);
        const container = document.getElementById('playlistContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div>❌ Failed to load episodes</div>
                    <div class="mt-1">Please check your connection and refresh</div>
                </div>
            `;
        }
        showToast('Failed to load episodes', 4000);
    }
}

// Update playlist statistics
function updatePlaylistStats() {
    const uniqueDates = new Set(currentPlaylist.map(e => e.dateKey));
    const statsElement = document.getElementById('playlistStats');
    if (statsElement) {
        statsElement.innerHTML = `${currentPlaylist.length.toLocaleString()} episodes • ${uniqueDates.size} days • CT Timezone`;
    }
}

// Play episode
function playEpisode(index) {
    if (index < 0 || index >= currentPlaylist.length) return;
    
    currentIndex = index;
    const episode = currentPlaylist[currentIndex];
    
    // Update Now Playing Card
    if (nowPlayingCard) {
        nowPlayingCard.updateEpisode(episode);
    }
    
    // Update virtual playlist active state
    if (virtualPlaylist) {
        virtualPlaylist.setCurrentIndex(currentIndex);
    }
    
    // Save to localStorage for persistence
    savePlaybackState();
    
    // Update document title
    document.title = `${episode.show} - AJN Hourly Archive`;
}

// Save playback state
function savePlaybackState() {
    localStorage.setItem('lastPlaylistIndex', currentIndex);
    localStorage.setItem('lastPlaylistLength', currentPlaylist.length);
    localStorage.setItem('lastEpisodeIds', JSON.stringify(currentPlaylist.map(e => e.id)));
}

// Restore playback state
function restorePlaybackState() {
    const savedIndex = localStorage.getItem('lastPlaylistIndex');
    const savedLength = localStorage.getItem('lastPlaylistLength');
    
    if (savedIndex && savedLength && parseInt(savedLength) === currentPlaylist.length) {
        const index = parseInt(savedIndex);
        if (index < currentPlaylist.length) {
            playEpisode(index);
            if (virtualPlaylist) {
                virtualPlaylist.scrollToIndex(index);
            }
        }
    }
}

// Download current episode
function downloadEpisode() {
    const episode = currentPlaylist[currentIndex];
    if (!episode) return;
    
    const link = document.createElement('a');
    link.href = episode.videoUrl;
    link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Download started');
}

// Share current episode
function shareEpisode() {
    const episode = currentPlaylist[currentIndex];
    if (!episode) return;
    
    if (navigator.share) {
        navigator.share({
            title: episode.title,
            text: episode.description.substring(0, 100),
            url: episode.videoUrl
        }).catch(e => console.log('Share cancelled'));
    } else {
        navigator.clipboard.writeText(episode.videoUrl);
        showToast('Episode link copied to clipboard');
    }
}

// Next episode
function nextEpisode() {
    if (currentIndex + 1 < currentPlaylist.length) {
        playEpisode(currentIndex + 1);
        showToast('Playing next episode...');
    } else {
        showToast('End of playlist reached');
    }
}

// Previous episode
function previousEpisode() {
    if (currentIndex - 1 >= 0) {
        playEpisode(currentIndex - 1);
        showToast('Playing previous episode...');
    } else {
        showToast('Beginning of playlist');
    }
}

// Dark mode toggle
function initDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark');
        document.getElementById('darkModeToggle').textContent = '☀️ Light';
    }
    
    document.getElementById('darkModeToggle').addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const dark = document.body.classList.contains('dark');
        localStorage.setItem('darkMode', dark);
        document.getElementById('darkModeToggle').textContent = dark ? '☀️ Light' : '🌙 Dark';
    });
}

// Search and filter (optimized for virtual list)
function applyFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const startDate = document.getElementById('startDate')?.value || '';
    const endDate = document.getElementById('endDate')?.value || '';
    
    currentPlaylist = allEpisodes.filter(ep => {
        if (searchTerm && !ep.title.toLowerCase().includes(searchTerm) && 
            !ep.description.toLowerCase().includes(searchTerm)) return false;
        if (startDate && ep.dateKey < startDate) return false;
        if (endDate && ep.dateKey > endDate) return false;
        return true;
    });
    
    currentIndex = 0;
    updatePlaylistStats();
    
    // Update virtual playlist with filtered items
    if (virtualPlaylist) {
        virtualPlaylist.setItems(currentPlaylist);
        virtualPlaylist.setCurrentIndex(0);
    }
    
    if (currentPlaylist.length > 0) {
        playEpisode(0);
    }
    
    showToast(`Found ${currentPlaylist.length.toLocaleString()} episodes`);
}

// Event Listeners
document.getElementById('downloadBtn')?.addEventListener('click', downloadEpisode);
document.getElementById('shareBtn')?.addEventListener('click', shareEpisode);
document.getElementById('nextBtn')?.addEventListener('click', nextEpisode);

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Arrow keys for navigation
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
        e.preventDefault();
        nextEpisode();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
        e.preventDefault();
        previousEpisode();
    } else if (e.key === ' ' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        const video = document.getElementById('videoPlayer');
        if (video) {
            if (video.paused) video.play();
            else video.pause();
        }
    }
});

// Make playEpisode globally available
window.playEpisode = playEpisode;
window.applyFilters = applyFilters;

// Initialize application
initDarkMode();
loadEpisodes();

// Log virtual list initialization
console.log('P1-3 Virtualized Playlist initialized - Optimized for 1000+ episodes');