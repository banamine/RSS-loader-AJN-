// ============ PLAYBACK PERSISTENCE - P1-7 ============

// Storage keys
const STORAGE_KEYS = {
    PLAYBACK_POSITIONS: 'ajn_playback_positions',
    LAST_EPISODE_ID: 'ajn_last_episode_id',
    LAST_POSITION: 'ajn_last_position',
    AUTOPLAY_STATE: 'autoplayEnabled'
};

// Playback position tracking
let playbackPositions = {};
let lastSaveTime = 0;
let saveTimeout = null;

// Load saved playback positions from localStorage
function loadPlaybackPositions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.PLAYBACK_POSITIONS);
        if (saved) {
            playbackPositions = JSON.parse(saved);
            console.log(`Loaded ${Object.keys(playbackPositions).length} saved playback positions`);
        }
    } catch (error) {
        console.error('Failed to load playback positions:', error);
        playbackPositions = {};
    }
}

// Save playback position for current episode
function savePlaybackPosition(episodeId, position, duration) {
    if (!episodeId || isNaN(position) || position < 0) return;
    
    // Don't save if at the very end (within 2 seconds of end)
    if (duration && position >= duration - 2) {
        // Episode is almost finished, remove saved position
        delete playbackPositions[episodeId];
    } else {
        // Save position with timestamp
        playbackPositions[episodeId] = {
            position: Math.floor(position),
            timestamp: Date.now(),
            duration: duration || 0,
            lastUpdated: new Date().toISOString()
        };
    }
    
    // Debounce save to avoid excessive writes
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            localStorage.setItem(STORAGE_KEYS.PLAYBACK_POSITIONS, JSON.stringify(playbackPositions));
            console.log(`Saved playback position for episode ${episodeId}: ${Math.floor(position)}s`);
        } catch (error) {
            console.error('Failed to save playback position:', error);
        }
    }, 500);
}

// Get saved playback position for an episode
function getPlaybackPosition(episodeId) {
    const saved = playbackPositions[episodeId];
    if (saved && saved.position) {
        console.log(`Found saved position for episode ${episodeId}: ${saved.position}s from ${new Date(saved.timestamp).toLocaleString()}`);
        return saved.position;
    }
    return 0;
}

// Clear playback position for an episode (when completed)
function clearPlaybackPosition(episodeId) {
    if (episodeId && playbackPositions[episodeId]) {
        delete playbackPositions[episodeId];
        localStorage.setItem(STORAGE_KEYS.PLAYBACK_POSITIONS, JSON.stringify(playbackPositions));
        console.log(`Cleared playback position for episode ${episodeId}`);
    }
}

// Save last played episode
function saveLastPlayedEpisode(episodeId, position) {
    if (!episodeId) return;
    
    try {
        const lastPlayed = {
            episodeId: episodeId,
            position: Math.floor(position),
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.LAST_EPISODE_ID, episodeId);
        localStorage.setItem(STORAGE_KEYS.LAST_POSITION, JSON.stringify(lastPlayed));
    } catch (error) {
        console.error('Failed to save last episode:', error);
    }
}

// Get last played episode
function getLastPlayedEpisode() {
    try {
        const episodeId = localStorage.getItem(STORAGE_KEYS.LAST_EPISODE_ID);
        const lastPlayed = localStorage.getItem(STORAGE_KEYS.LAST_POSITION);
        
        if (episodeId && lastPlayed) {
            return {
                episodeId: episodeId,
                data: JSON.parse(lastPlayed)
            };
        }
    } catch (error) {
        console.error('Failed to get last episode:', error);
    }
    return null;
}

// Resume playback from saved position
function resumePlayback(episodeId, expectedDuration = null) {
    const savedPosition = getPlaybackPosition(episodeId);
    
    if (savedPosition > 0 && videoPlayer) {
        console.log(`Resuming episode ${episodeId} from position ${savedPosition}s`);
        
        // Set the position once metadata is loaded
        const setPosition = () => {
            // Verify position is within valid range
            if (savedPosition < videoPlayer.duration && savedPosition > 0) {
                videoPlayer.currentTime = savedPosition;
                
                // Show resume notification
                const resumeTime = formatTime(savedPosition);
                showToast(`▶ Resuming from ${resumeTime}`, 3000);
                
                // Track that we resumed
                if (window.analytics) {
                    window.analytics.track('playback_resumed', {
                        episodeId: episodeId,
                        position: savedPosition,
                        duration: videoPlayer.duration
                    });
                }
            } else if (savedPosition >= videoPlayer.duration - 2) {
                // Episode was nearly finished, start from beginning
                clearPlaybackPosition(episodeId);
                console.log('Episode was nearly finished, starting from beginning');
            }
            
            videoPlayer.removeEventListener('loadedmetadata', setPosition);
        };
        
        videoPlayer.addEventListener('loadedmetadata', setPosition);
        
        // Fallback timeout in case metadata doesn't load
        setTimeout(() => {
            if (videoPlayer.readyState === 0) {
                videoPlayer.removeEventListener('loadedmetadata', setPosition);
                console.log('Metadata load timeout, skipping resume');
            }
        }, 3000);
    }
    
    return savedPosition;
}

// Save position periodically during playback
let saveInterval = null;

function startPositionTracking() {
    if (saveInterval) clearInterval(saveInterval);
    
    saveInterval = setInterval(() => {
        if (videoPlayer && videoPlayer.currentTime && currentPlaylist[currentIndex]) {
            const episode = currentPlaylist[currentIndex];
            if (episode && videoPlayer.currentTime > 0) {
                savePlaybackPosition(episode.id, videoPlayer.currentTime, videoPlayer.duration);
                saveLastPlayedEpisode(episode.id, videoPlayer.currentTime);
            }
        }
    }, 5000); // Save every 5 seconds as per acceptance criteria
}

function stopPositionTracking() {
    if (saveInterval) {
        clearInterval(saveInterval);
        saveInterval = null;
    }
    
    // Final save when stopping
    if (videoPlayer && videoPlayer.currentTime && currentPlaylist[currentIndex]) {
        const episode = currentPlaylist[currentIndex];
        if (episode) {
            savePlaybackPosition(episode.id, videoPlayer.currentTime, videoPlayer.duration);
        }
    }
}

// Override playEpisode to include resume functionality
const originalPlayEpisode = window.playEpisode || function() {};

function enhancedPlayEpisode(index) {
    if (index < 0 || index >= currentPlaylist.length) return;
    
    currentIndex = index;
    const episode = currentPlaylist[currentIndex];
    currentEpisodeData = episode;
    
    // Update UI
    if (currentTitle) currentTitle.textContent = episode.title;
    
    // Update video source
    videoPlayer.src = episode.videoUrl;
    videoPlayer.load();
    
    // Resume from saved position
    const resumePosition = getPlaybackPosition(episode.id);
    if (resumePosition > 0) {
        videoPlayer.addEventListener('loadedmetadata', function onMetadata() {
            if (resumePosition < videoPlayer.duration) {
                videoPlayer.currentTime = resumePosition;
                const resumeTime = formatTime(resumePosition);
                showToast(`▶ Resuming from ${resumeTime}`, 3000);
            }
            videoPlayer.removeEventListener('loadedmetadata', onMetadata);
        }, { once: true });
    }
    
    // Auto-play if enabled
    if (autoplayToggle && autoplayToggle.checked) {
        videoPlayer.play().catch(e => console.log('Autoplay prevented:', e));
    }
    
    // Update active state in playlist
    if (virtualPlaylist) {
        virtualPlaylist.setCurrentIndex(currentIndex);
    } else {
        renderVirtualPlaylist();
    }
    
    // Update document title
    document.title = `${episode.show} - AJN Hourly Archive`;
    
    // Save last played
    saveLastPlayedEpisode(episode.id, resumePosition || 0);
}

// Save position on pause
function setupPersistenceEventListeners() {
    if (!videoPlayer) return;
    
    // Save position on pause
    videoPlayer.addEventListener('pause', () => {
        if (currentPlaylist[currentIndex]) {
            savePlaybackPosition(
                currentPlaylist[currentIndex].id,
                videoPlayer.currentTime,
                videoPlayer.duration
            );
        }
    });
    
    // Save position on seek
    videoPlayer.addEventListener('seeked', () => {
        if (currentPlaylist[currentIndex]) {
            savePlaybackPosition(
                currentPlaylist[currentIndex].id,
                videoPlayer.currentTime,
                videoPlayer.duration
            );
        }
    });
    
    // Clear position when episode ends (within 2 seconds)
    videoPlayer.addEventListener('ended', () => {
        if (currentPlaylist[currentIndex]) {
            clearPlaybackPosition(currentPlaylist[currentIndex].id);
        }
    });
    
    // Save before page unload
    window.addEventListener('beforeunload', () => {
        if (currentPlaylist[currentIndex] && videoPlayer.currentTime) {
            savePlaybackPosition(
                currentPlaylist[currentIndex].id,
                videoPlayer.currentTime,
                videoPlayer.duration
            );
        }
    });
}

// Resume from last played episode on page load
function resumeLastPlayedEpisode() {
    const lastPlayed = getLastPlayedEpisode();
    if (lastPlayed && lastPlayed.episodeId && allEpisodes.length > 0) {
        const episodeIndex = allEpisodes.findIndex(ep => ep.id == lastPlayed.episodeId);
        if (episodeIndex !== -1) {
            console.log(`Resuming last played episode: ${allEpisodes[episodeIndex].title}`);
            
            // Small delay to ensure video player is ready
            setTimeout(() => {
                playEpisode(episodeIndex);
                
                // Additional delay for position seek
                setTimeout(() => {
                    if (videoPlayer && lastPlayed.data.position > 0) {
                        videoPlayer.currentTime = lastPlayed.data.position;
                        showToast(`▶ Resumed from ${formatTime(lastPlayed.data.position)}`, 3000);
                    }
                }, 500);
            }, 100);
            return true;
        }
    }
    return false;
}

// Clean up old playback positions (older than 30 days)
function cleanupOldPlaybackPositions() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let changed = false;
    
    Object.keys(playbackPositions).forEach(episodeId => {
        if (playbackPositions[episodeId].timestamp < thirtyDaysAgo) {
            delete playbackPositions[episodeId];
            changed = true;
        }
    });
    
    if (changed) {
        localStorage.setItem(STORAGE_KEYS.PLAYBACK_POSITIONS, JSON.stringify(playbackPositions));
        console.log('Cleaned up old playback positions');
    }
}

// Display saved positions in UI (debug/stats)
function displayPlaybackStats() {
    const savedCount = Object.keys(playbackPositions).length;
    if (savedCount > 0) {
        console.log(`📊 Playback persistence: ${savedCount} episodes have saved positions`);
        
        // Add to stats display if desired
        const statsElement = document.getElementById('playlistStats');
        if (statsElement && savedCount > 0) {
            const existingText = statsElement.innerHTML;
            if (!existingText.includes('saved positions')) {
                statsElement.innerHTML = `${existingText} • 💾 ${savedCount} saved positions`;
            }
        }
    }
}

// Initialize playback persistence
function initPlaybackPersistence() {
    loadPlaybackPositions();
    cleanupOldPlaybackPositions();
    setupPersistenceEventListeners();
    startPositionTracking();
    displayPlaybackStats();
    
    console.log('Playback persistence initialized');
}

// Export for use in main
window.initPlaybackPersistence = initPlaybackPersistence;
window.savePlaybackPosition = savePlaybackPosition;
window.getPlaybackPosition = getPlaybackPosition;
window.clearPlaybackPosition = clearPlaybackPosition;
window.resumeLastPlayedEpisode = resumeLastPlayedEpisode;
// js/main.js

// 1. Ensure global variables are set (as per your VirtualPlaylist.js export)
window.virtualPlaylist = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded. Initializing components...");

    // 2. Instantiate the VirtualPlaylist
    // Pass the container ID defined in index.html ('playlistContainer')
    if (typeof VirtualPlaylist !== 'undefined') {
        window.virtualPlaylist = new VirtualPlaylist('playlistContainer', {
            rowHeight: 80,
            buffer: 10
        });
        
        // 3. Inject data (Assuming 'allEpisodes' is the array of your archive)
        // If 'allEpisodes' isn't defined yet, this won't show anything.
        if (typeof allEpisodes !== 'undefined') {
            window.virtualPlaylist.items = allEpisodes;
            window.virtualPlaylist.init(); // This actually renders the rows
        } else {
            console.warn("allEpisodes data array is not defined yet.");
        }
    } else {
        console.error("VirtualPlaylist class is not loaded.");
    }
});
