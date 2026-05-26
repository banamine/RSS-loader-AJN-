import { VideoControls } from '../utils/videoControls.js';
import { showToast } from '../utils/helpers.js';

// ============ NOW PLAYING CARD COMPONENT ============

export class NowPlayingCard {
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
        this.videoControls = new VideoControls(
            this.video,
            this.progressBar,
            this.playPauseBtn,
            this.currentTimeDisplay,
            this.durationDisplay
        );
        
        this.skipBackBtn.addEventListener('click', () => {
            this.videoControls.skip(-10);
            showToast('Back 10 seconds');
        });
        
        this.skipForwardBtn.addEventListener('click', () => {
            this.videoControls.skip(10);
            showToast('Forward 10 seconds');
        });
        
        this.immersiveBtn.addEventListener('click', () => {
            this.videoControls.enterFullscreen(this.videoContainer);
        });
        
        this.video.addEventListener('ended', () => {
            if (this.autoplayToggle.checked && this.onEpisodeEndCallback) {
                this.onEpisodeEndCallback();
            }
        });
        
        const savedAutoplay = localStorage.getItem('autoplayEnabled');
        if (savedAutoplay !== null) {
            this.autoplayToggle.checked = savedAutoplay === 'true';
        }
        
        this.autoplayToggle.addEventListener('change', () => {
            localStorage.setItem('autoplayEnabled', this.autoplayToggle.checked);
        });
    }
    
    setOnEpisodeEnd(callback) {
        this.onEpisodeEndCallback = callback;
    }
    
    updateEpisode(episode) {
        this.currentEpisode = episode;
        this.currentTitle.textContent = episode.title;
        this.video.src = episode.videoUrl;
        this.video.load();
        
        if (this.autoplayToggle.checked) {
            this.video.play().catch(e => console.log('Autoplay prevented:', e));
        }
        
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: episode.title,
                artist: episode.show,
                album: 'AJN Hourly Archive'
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