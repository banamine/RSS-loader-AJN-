// ============ NOW PLAYING CARD COMPONENT ============

class NowPlayingCard {
    constructor() {
        this.video = document.getElementById('videoPlayer');
        this.progressBar = document.getElementById('progressBar');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.durationDisplay = document.getElementById('duration');
        this.skipBackBtn = document.getElementById('skipBackBtn');
        this.skipForwardBtn = document.getElementById('skipForwardBtn');
        this.autoplayToggle = document.getElementById('autoplayToggle');
        this.immersiveBtn = document.getElementById('immersiveViewBtn');
        this.videoContainer = document.getElementById('videoThumbnailContainer');
        this.currentTitle = document.getElementById('currentTitle');
        
        this.videoControls = null;
        this.currentEpisode = null;
        this.onEpisodeEndCallback = null;
        
        this.init();
    }
    
    init() {
        // Initialize video controls
        this.videoControls = new VideoControls(
            this.video,
            this.progressBar,
            this.playPauseBtn,
            this.currentTimeDisplay,
            this.durationDisplay
        );
        
        // Setup skip buttons
        this.skipBackBtn.addEventListener('click', () => {
            this.videoControls.skip(-10);
        });
        
        this.skipForwardBtn.addEventListener('click', () => {
            this.videoControls.skip(10);
        });
        
        // Setup immersive/fullscreen view
        this.immersiveBtn.addEventListener('click', () => {
            this.videoControls.enterFullscreen(this.videoContainer);
        });
        
        // Handle video end for continuous playback
        this.video.addEventListener('ended', () => {
            if (this.autoplayToggle.checked && this.onEpisodeEndCallback) {
                this.onEpisodeEndCallback();
            }
        });
        
        // Save autoplay preference
        this.autoplayToggle.addEventListener('change', () => {
            localStorage.setItem('autoplayEnabled', this.autoplayToggle.checked);
        });
        
        // Load saved autoplay preference
        const savedAutoplay = localStorage.getItem('autoplayEnabled');
        if (savedAutoplay !== null) {
            this.autoplayToggle.checked = savedAutoplay === 'true';
        }
    }
    
    setOnEpisodeEnd(callback) {
        this.onEpisodeEndCallback = callback;
    }
    
    updateEpisode(episode) {
        this.currentEpisode = episode;
        
        // Update title
        this.currentTitle.textContent = episode.title;
        
        // Update video source
        this.video.src = episode.videoUrl;
        this.video.load();
        
        // Update ARIA labels for accessibility
        this.video.setAttribute('aria-label', `Playing: ${episode.title}`);
        
        // Auto-play if enabled
        if (this.autoplayToggle.checked) {
            this.video.play().catch(e => {
                console.log('Autoplay prevented:', e);
                // Update button state to show it's paused
                if (this.videoControls) {
                    this.videoControls.updatePlayPauseButton(false);
                }
            });
        } else {
            // Ensure button shows correct state
            if (this.videoControls) {
                this.videoControls.updatePlayPauseButton(false);
            }
        }
        
        // Update metadata for Media Session API
        this.updateMediaSession(episode);
    }
    
    updateMediaSession(episode) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: episode.title,
                artist: episode.show,
                album: 'AJN Hourly Archive',
                artwork: [
                    { src: 'https://via.placeholder.com/96x96?text=AJN', sizes: '96x96', type: 'image/png' },
                    { src: 'https://via.placeholder.com/128x128?text=AJN', sizes: '128x128', type: 'image/png' }
                ]
            });
            
            // Set action handlers
            navigator.mediaSession.setActionHandler('play', () => {
                this.video.play();
                this.videoControls.updatePlayPauseButton(true);
            });
            
            navigator.mediaSession.setActionHandler('pause', () => {
                this.video.pause();
                this.videoControls.updatePlayPauseButton(false);
            });
            
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                if (this.onEpisodeEndCallback) {
                    this.onEpisodeEndCallback(true); // true = previous
                }
            });
            
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                if (this.onEpisodeEndCallback) {
                    this.onEpisodeEndCallback();
                }
            });
        }
    }
    
    getCurrentEpisode() {
        return this.currentEpisode;
    }
    
    isAutoplayEnabled() {
        return this.autoplayToggle.checked;
    }
}