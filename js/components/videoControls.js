// ============ VIDEO CONTROLS COMPONENT ==========
window.VideoControls = class VideoControls {
    constructor(options = {}) {
        this.video = null;
        this.progressBar = null;
        this.playPauseBtn = null;
        this.currentTimeDisplay = null;
        this.durationDisplay = null;
        this.onEndCallback = null;
        this.isSeeking = false;
        this.init(options);
    }
    
    init(options) {
        this.video = document.getElementById(options.videoId || 'mainVideo');
        this.progressBar = document.getElementById(options.progressId || 'progressBar');
        this.playPauseBtn = document.getElementById(options.playPauseId || 'playPauseBtn');
        this.currentTimeDisplay = document.getElementById(options.currentTimeId || 'currentTime');
        this.durationDisplay = document.getElementById(options.durationId || 'duration');
        if (!this.video) return false;
        this.bindEvents();
        return true;
    }
    
    bindEvents() {
        if (!this.video) return;
        this.video.addEventListener('timeupdate', () => {
            if (!this.isSeeking && this.video.duration) {
                this.updateProgress();
                this.updateCurrentTime();
            }
        });
        this.video.addEventListener('loadedmetadata', () => this.updateDuration());
        if (this.progressBar) {
            this.progressBar.addEventListener('input', (e) => {
                this.isSeeking = true;
                const seekTime = (e.target.value / 100) * this.video.duration;
                if (this.currentTimeDisplay) {
                    this.currentTimeDisplay.textContent = this.formatTime(seekTime);
                }
            });
            this.progressBar.addEventListener('change', (e) => {
                const seekTime = (e.target.value / 100) * this.video.duration;
                if (this.video) this.video.currentTime = seekTime;
                this.isSeeking = false;
            });
        }
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        }
        this.video.addEventListener('play', () => this.updatePlayButton(true));
        this.video.addEventListener('pause', () => this.updatePlayButton(false));
        this.video.addEventListener('ended', () => {
            if (this.onEndCallback) this.onEndCallback();
        });
    }
    
    updateProgress() {
        if (this.progressBar && this.video.duration) {
            this.progressBar.value = (this.video.currentTime / this.video.duration) * 100;
        }
    }
    
    updateCurrentTime() {
        if (this.currentTimeDisplay) {
            this.currentTimeDisplay.textContent = this.formatTime(this.video.currentTime);
        }
    }
    
    updateDuration() {
        if (this.durationDisplay) {
            this.durationDisplay.textContent = this.formatTime(this.video.duration);
        }
        if (this.progressBar) this.progressBar.max = 100;
    }
    
    updatePlayButton(isPlaying) {
        if (this.playPauseBtn) {
            this.playPauseBtn.innerHTML = isPlaying ? '⏸ Pause' : '⏯ Play';
        }
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    togglePlay() {
        if (!this.video) return;
        if (this.video.paused) {
            this.video.play().catch(e => console.log('Play prevented:', e));
        } else {
            this.video.pause();
        }
    }
    
    skip(seconds) {
        if (!this.video) return;
        this.video.currentTime = Math.min(Math.max(this.video.currentTime + seconds, 0), this.video.duration);
    }
    
    loadEpisode(videoUrl, autoPlay = false) {
        if (!this.video) return;
        this.video.src = videoUrl;
        this.video.load();
        if (autoPlay) {
            this.video.play().catch(e => console.log('Autoplay prevented:', e));
        }
    }
    
    setOnEnd(callback) {
        this.onEndCallback = callback;
    }
    
    destroy() {
        if (this.video) {
            this.video.pause();
            this.video.src = '';
            this.video.load();
        }
    }
};