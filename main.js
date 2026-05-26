// ============ MAIN APPLICATION ============

// Global state
let allEpisodes = [];
let currentPlaylist = [];
let currentIndex = 0;
let nowPlayingCard = null;

// RSS Feed URL
const RSS_URL = 'https://rss.alexjones.media/AJNHourlyVideo.xml';
const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;

// Load episodes from RSS
async function loadEpisodes() {
    const container = document.getElementById('playlistContainer');
    
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
        renderPlaylist();
        
        // Initialize Now Playing Card component
        nowPlayingCard = new NowPlayingCard();
        nowPlayingCard.setOnEpisodeEnd(() => {
            if (nowPlayingCard.isAutoplayEnabled() && currentIndex + 1 < currentPlaylist.length) {
                playEpisode(currentIndex + 1);
                showToast('▶ Auto-playing next episode');
            }
        });
        
        // Auto-select first episode
        if (currentPlaylist.length > 0) {
            playEpisode(0);
        }
        
        showToast(`Loaded ${allEpisodes.length} episodes`);
        
    } catch (error) {
        console.error('Error loading episodes:', error);
        container.innerHTML = `
            <div class="error-state">
                <div>❌ Failed to load episodes</div>
                <div class="mt-1">Please check your connection and refresh</div>
            </div>
        `;
        showToast('Failed to load episodes', 4000);
    }
}

// Update playlist statistics
function updatePlaylistStats() {
    const uniqueDates = new Set(currentPlaylist.map(e => e.dateKey));
    const statsElement = document.getElementById('playlistStats');
    if (statsElement) {
        statsElement.innerHTML = `${currentPlaylist.length} episodes • ${uniqueDates.size} days • CT Timezone`;
    }
}

// Render playlist items
function renderPlaylist() {
    const container = document.getElementById('playlistContainer');
    
    if (!currentPlaylist.length) {
        container.innerHTML = '<div class="loading-state">No episodes found</div>';
        return;
    }
    
    container.innerHTML = currentPlaylist.map((ep, idx) => `
        <div class="playlist-item ${idx === currentIndex ? 'active' : ''}" 
             onclick="playEpisode(${idx})"
             onkeypress="if(event.key==='Enter') playEpisode(${idx})"
             tabindex="0"
             role="button"
             aria-label="Play episode: ${escapeHtml(ep.title)}">
            <div class="playlist-thumbnail" aria-hidden="true">
                🎬
            </div>
            <div class="playlist-info">
                <div class="playlist-title">${escapeHtml(ep.title)}</div>
                <div class="playlist-date">📅 ${formatCentralTime(ep.centralDate)}</div>
                <div class="playlist-duration">🎬 ${ep.show} ${ep.hour}</div>
            </div>
        </div>
    `).join('');
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
    
    // Update active state in playlist
    renderPlaylist();
    
    // Save to localStorage for persistence
    savePlaybackState();
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

// Next episode (called from main controls)
function nextEpisode() {
    if (currentIndex + 1 < currentPlaylist.length) {
        playEpisode(currentIndex + 1);
        showToast('Playing next episode...');
    } else {
        showToast('End of playlist reached');
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

// Event Listeners
document.getElementById('downloadBtn').addEventListener('click', downloadEpisode);
document.getElementById('shareBtn').addEventListener('click', shareEpisode);
document.getElementById('nextBtn').addEventListener('click', nextEpisode);

// Make playEpisode globally available for onclick
window.playEpisode = playEpisode;

// Initialize application
initDarkMode();
loadEpisodes();