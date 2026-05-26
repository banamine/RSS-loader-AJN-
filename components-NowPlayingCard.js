// ============ NOW PLAYING CARD COMPONENT ==========
import { VideoControls } from '../utils/videoControls.js';
import { formatCentralTime, showToast, escapeHtml } from '../utils/helpers.js';

export class NowPlayingCard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.video = null;
        this.videoControls = null;
        this.currentEpisode = null;
        this.autoplayEnabled = true;
        this.onNextCallback = null;
        
        this.render();
        this.init();
    }
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="now-playing-card">
                <div class="now-playing-label">▶ NOW PLAYING</div>
                <div class="now-playing-title" id="currentTitle" aria-live="polite">Select an episode to begin</div>
                
                <div class="video-container" id="videoThumbnailContainer">
                    <video id="videoPlayer" preload="metadata" aria-label="Video player">
                        <source src="" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                    <div class="immersive-overlay-btn" id="immersiveViewBtn" title="Open Immersive View" aria-label="Enter fullscreen mode">📺</div>
                </div>

                <div class="controls-ui">
                    <div class="progress-container">
                        <input type="range" id="progressBar" value="0" max="100" step="0.1" aria-label="Video progress">
                        <div class="time-display">
                            <span id="currentTime">0:00</span>
                            <span id="duration">0:00</span>
                        </div>
                    </div>
                    
                    <div class="video-controls-row">
                        <button id="playPauseBtn" class="btn-secondary">⏯ Play</button>
                        <button id="skipBackBtn" class="btn-secondary">⏪ 10s</button>
                        <button id="skipForwardBtn" class="btn-secondary">⏩ 10s</button>
                        <label class="btn-secondary">
                            <input type="checkbox" id="autoplayToggle" checked> Autoplay
                        </label>
                        <button id="downloadBtn" class="btn-secondary">⬇️</button>
                        <button id="shareBtn" class="btn-secondary">📤</button>
                        <button id="nextBtn" class="btn-primary">⏭️ Next</button>
                    </div>
                </div>
            </div>
        `;
        
        this.attachElements();
    }
    
    attachElements() {
        this.video = document.getElementById('videoPlayer');
        const progressBar = document.getElementById('progressBar');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const currentTimeDisplay = document.getElementById('currentTime');
        const durationDisplay = document.getElementById('duration');
        const skipBackBtn = document.getElementById('skipBackBtn');
        const skipForwardBtn = document.getElementById('skipForwardBtn');
        const autoplayToggle = document.getElementById('autoplayToggle');
        const immersiveBtn = document.getElementById('immersiveViewBtn');
        const videoContainer = document.getElementById('videoThumbnailContainer');
        const downloadBtn = document.getElementById('downloadBtn');
        const shareBtn = document.getElementById('shareBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        this.videoControls = new VideoControls(
            this.video, progressBar, playPauseBtn, currentTimeDisplay, durationDisplay
        );
        
        skipBackBtn.addEventListener('click', () => this.videoControls.skip(-10));
        skipForwardBtn.addEventListener('click', () => this.videoControls.skip(10));
        immersiveBtn.addEventListener('click', () => this.videoControls.enterFullscreen(videoContainer));
        
        autoplayToggle.addEventListener('change', (e) => {
            this.autoplayEnabled = e.target.checked;
            localStorage.setItem('autoplayEnabled', this.autoplayEnabled);
        });
        
        const savedAutoplay = localStorage.getItem('autoplayEnabled');
        if (savedAutoplay !== null) {
            this.autoplayEnabled = savedAutoplay === 'true';
            autoplayToggle.checked = this.autoplayEnabled;
        }
        
        downloadBtn.addEventListener('click', () => this.downloadCurrent());
        shareBtn.addEventListener('click', () => this.shareCurrent());
        nextBtn.addEventListener('click', () => {
            if (this.onNextCallback) this.onNextCallback();
        });
        
        this.videoControls.setOnEnd(() => {
            if (this.autoplayEnabled && this.onNextCallback) {
                this.onNextCallback();
            }
        });
    }
    
    updateEpisode(episode, savedPosition = 0) {
        this.currentEpisode = episode;
        const titleElement = document.getElementById('currentTitle');
        if (titleElement) {
            titleElement.textContent = episode.title;
        }
        
        this.videoControls.loadEpisode(episode.videoUrl, this.autoplayEnabled);
        
        if (savedPosition > 0 && savedPosition < this.video.duration - 2) {
            const setPosition = () => {
                this.videoControls.setCurrentTime(savedPosition);
                this.video.removeEventListener('loadedmetadata', setPosition);
            };
            this.video.addEventListener('loadedmetadata', setPosition);
        }
        
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: episode.title,
                artist: episode.show,
                album: 'AJN Hourly Archive'
            });
        }
        
        document.title = `${episode.show} - AJN Hourly Archive`;
    }
    
    downloadCurrent() {
        if (!this.currentEpisode) return;
        const link = document.createElement('a');
        link.href = this.currentEpisode.videoUrl;
        link.download = `${this.currentEpisode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
        link.click();
        showToast('Download started');
    }
    
    shareCurrent() {
        if (!this.currentEpisode) return;
        if (navigator.share) {
            navigator.share({
                title: this.currentEpisode.title,
                text: this.currentEpisode.description?.substring(0, 100),
                url: this.currentEpisode.videoUrl
            }).catch(e => console.log('Share cancelled'));
        } else {
            navigator.clipboard.writeText(this.currentEpisode.videoUrl);
            showToast('Link copied to clipboard');
        }
    }
    
    setOnNext(callback) {
        this.onNextCallback = callback;
    }
    
    isAutoplayEnabled() {
        return this.autoplayEnabled;
    }
}