// ============ MAIN APPLICATION WITH FLYOUT ACTIONS ============

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
                rowHeight: 80,
                buffer: 5
            });
            
            virtualPlaylist.setOnItemClick((index) => {
                playEpisode(index);
            });
            
            virtualPlaylist.setOnScrollEnd(() => {
                console.log('Scroll end reached - ready for lazy loading');
            });
            
            virtualPlaylist.setOnDownload((index) => {
                downloadEpisodeByIndex(index);
            });
            
            virtualPlaylist.setOnShare((index) => {
                shareEpisodeByIndex(index);
            });
            
            // Make virtualPlaylist globally accessible for flyout functions
            window.virtualPlaylist = virtualPlaylist;
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
        
        showToast(`Loaded ${allEpisodes.length.toLocaleString()} episodes (virtualized for smooth scrolling)`);
        
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

// Download episode by index (for flyout)
function downloadEpisodeByIndex(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    const link = document.createElement('a');
    link.href = episode.videoUrl;
    link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Close flyout after action
    if (virtualPlaylist) {
        virtualPlaylist.closeAllFlyouts();
    }
    
    showToast(`Downloading: ${episode.title.substring(0, 50)}...`);
}

// Share episode by index (for flyout)
function shareEpisodeByIndex(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    // Close flyout after action
    if (virtualPlaylist) {
        virtualPlaylist.closeAllFlyouts();
    }
    
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

// Copy link by index (for flyout)
function copyLink(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    navigator.clipboard.writeText(episode.videoUrl);
    
    if (virtualPlaylist) {
        virtualPlaylist.closeAllFlyouts();
    }
    
    showToast('Link copied to clipboard');
}

// View episode details (for flyout)
function viewDetails(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    if (virtualPlaylist) {
        virtualPlaylist.closeAllFlyouts();
    }
    
    // Create modal with episode details
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        backdrop-filter: blur(4px);
    `;
    
    modal.innerHTML = `
        <div style="background: var(--bg-surface); border-radius: 16px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; padding: 24px;">
            <h3 style="margin-bottom: 16px; color: var(--primary);">Episode Details</h3>
            <div style="margin-bottom: 12px;"><strong>Title:</strong><br>${escapeHtml(episode.title)}</div>
            <div style="margin-bottom: 12px;"><strong>Show:</strong><br>${episode.show} ${episode.hour}</div>
            <div style="margin-bottom: 12px;"><strong>Date (CT):</strong><br>${formatCentralTime(episode.centralDate)}</div>
            <div style="margin-bottom: 12px;"><strong>Description:</strong><br>${escapeHtml(episode.description)}</div>
            <div style="margin-bottom: 12px;"><strong>Video URL:</strong><br><a href="${episode.videoUrl}" target="_blank" style="color: var(--primary); word-break: break-all;">${episode.videoUrl}</a></div>
            <button onclick="this.closest('div').parentElement.remove()" class="btn btn-primary" style="margin-top: 16px;">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
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
        virtualPlaylist.closeAllFlyouts();
    }
    
    if (currentPlaylist.length > 0) {
        playEpisode(0);
    }
    
    showToast(`Found ${currentPlaylist.length.toLocaleString()} episodes`);
}

// Clear filters
function clearFilters() {
    const searchInput = document.getElementById('searchInput');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (searchInput) searchInput.value = '';
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';
    
    applyFilters();
}

// Make functions globally available for flyout
window.downloadEpisodeByIndex = downloadEpisodeByIndex;
window.shareEpisodeByIndex = shareEpisodeByIndex;
window.copyLink = copyLink;
window.viewDetails = viewDetails;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.playEpisode = playEpisode;

// Event Listeners
document.getElementById('downloadBtn')?.addEventListener('click', downloadCurrentEpisode);
document.getElementById('shareBtn')?.addEventListener('click', shareCurrentEpisode);
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
    } else if (e.key === ' ' && document.activeElement?.tagName !== 'BUTTON' && !document.activeElement?.classList?.contains('menu-trigger')) {
        e.preventDefault();
        const video = document.getElementById('videoPlayer');
        if (video) {
            if (video.paused) video.play();
            else video.pause();
        }
    } else if (e.key === 'Escape') {
        // Close any open flyout
        if (virtualPlaylist) {
            virtualPlaylist.closeAllFlyouts();
        }
    }
});

// Close flyout when clicking outside (handled by VirtualPlaylist)
document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu')) {
        if (virtualPlaylist) {
            virtualPlaylist.closeAllFlyouts();
        }
    }
});

// Initialize application
initDarkMode();
loadEpisodes();

console.log('P1-4: Episode hover overlay & three-dot flyout initialized');