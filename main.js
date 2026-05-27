// ============ MAIN.JS - DEFENSIVE INITIALIZATION ==========

// ... all your imports ...

// Global references
let videoControls = null;
let virtualList = null;
let calendarView = null;
let allEpisodes = [];

// ... helper functions ...

// Initialize virtual list with guard (don't wait for data to create it)
function initVirtualList() {
    // Create the component even if container isn't ready yet
    // The component's internal guard will handle retry
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
    console.log('VirtualList component created (will retry if container not ready)');
}

// Load episodes and update virtual list
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
            
            // Update virtual list with data (component will render when ready)
            if (virtualList) {
                virtualList.setItems(allEpisodes);
            }
            
            // Update calendar
            if (calendarView) {
                calendarView.setEpisodes(allEpisodes);
            }
            
            // Set first episode as now playing
            if (allEpisodes.length > 0) {
                updateNowPlayingDisplay(allEpisodes[0]);
                if (videoControls) {
                    videoControls.loadEpisode(allEpisodes[0].videoUrl, false);
                }
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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AJN Hourly Archive...');
    
    // Setup basic UI first
    setupDarkMode();
    setupVideoControls();
    setupSearch();
    setupViewMode();
    setupCalendar();
    setupPlaylistActions();
    setupQueueActions();
    
    // Load queue from storage
    stateManager.loadQueueFromStorage();
    renderQueue();
    
    // Create virtual list component (handles container not ready)
    initVirtualList();
    
    // Load episodes
    loadAndInitialize();
    
    console.log('Application ready');
});