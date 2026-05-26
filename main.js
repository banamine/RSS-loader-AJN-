// ============ MAIN APPLICATION - MODULAR VERSION ============
import { transformVideoUrl, toCentralTime, formatCentralTime, parseEpisodeDetails, escapeHtml, showToast } from './utils/helpers.js';
import { VideoControls } from './utils/videoControls.js';
import { NowPlayingCard } from './components/NowPlayingCard.js';
import { VirtualPlaylist } from './components/VirtualPlaylist.js';

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
    showToast('Loading episodes...');
    
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
        
        // Update stats display
        updatePlaylistStats();
        
        // Initialize Virtual Playlist if not already done
        if (!virtualPlaylist) {
            virtualPlaylist = new VirtualPlaylist('playlistContainer', {
                rowHeight: 80,
                buffer: 5,
                onItemClick: (index) => playEpisode(index),
                onDownload: (index) => downloadEpisodeByIndex(index),
                onShare: (index) => shareEpisodeByIndex(index),
                onCopyLink: (index) => copyLink(index),
                onViewDetails: (index) => viewDetails(index)
            });
        }
        
        // Set items in virtual playlist
        virtualPlaylist.setItems(currentPlaylist);
        
        // Initialize Now Playing Card
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
        
        showToast(`Loaded ${allEpisodes.length.toLocaleString()} episodes`);
        
    } catch (error) {
        console.error('Error loading episodes:', error);
        const statsElement = document.getElementById('playlistStats');
        if (statsElement) {
            statsElement.innerHTML = '❌ Failed to load episodes';
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
    
    // Update document title
    document.title = `${episode.show} - AJN Hourly Archive`;
    
    // Save to localStorage
    localStorage.setItem('lastPlaylistIndex', currentIndex);
}

// Download episode by index
function downloadEpisodeByIndex(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    const link = document.createElement('a');
    link.href = episode.videoUrl;
    link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (virtualPlaylist) virtualPlaylist.closeAllFlyouts();
    showToast(`Downloading: ${episode.title.substring(0, 50)}...`);
}

// Share episode by index
function shareEpisodeByIndex(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    if (virtualPlaylist) virtualPlaylist.closeAllFlyouts();
    
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

// Copy link by index
function copyLink(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    navigator.clipboard.writeText(episode.videoUrl);
    if (virtualPlaylist) virtualPlaylist.closeAllFlyouts();
    showToast('Link copied to clipboard');
}

// View episode details
function viewDetails(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    if (virtualPlaylist) virtualPlaylist.closeAllFlyouts();
    
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
}

// Download current episode (main button)
function downloadCurrentEpisode() {
    downloadEpisodeByIndex(currentIndex);
}

// Share current episode (main button)
function shareCurrentEpisode() {
    shareEpisodeByIndex(currentIndex);
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
        const toggleBtn = document.getElementById('darkModeToggle');
        if (toggleBtn) toggleBtn.textContent = '☀️ Light';
    }
    
    const toggleBtn = document.getElementById('darkModeToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            const dark = document.body.classList.contains('dark');
            localStorage.setItem('darkMode', dark);
            toggleBtn.textContent = dark ? '☀️ Light' : '🌙 Dark';
        });
    }
}

// Event Listeners
document.getElementById('downloadBtn')?.addEventListener('click', downloadCurrentEpisode);
document.getElementById('shareBtn')?.addEventListener('click', shareCurrentEpisode);
document.getElementById('nextBtn')?.addEventListener('click', nextEpisode);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
        e.preventDefault();
        nextEpisode();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
        e.preventDefault();
        previousEpisode();
    } else if (e.key === 'Escape' && virtualPlaylist) {
        virtualPlaylist.closeAllFlyouts();
    }
});

// Initialize application
function init() {
    console.log('Initializing AJN Hourly Archive...');
    initDarkMode();
    loadEpisodes();
}

// Start the application
init();