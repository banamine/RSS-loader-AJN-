import { formatTime } from './helpers.js';

// ============ VIDEO CONTROLS MODULE ============

export class VideoControls {
    constructor(videoElement, progressBar, playPauseBtn, currentTimeDisplay, durationDisplay) {
        this.video = videoElement;
        this.progressBar = progressBar;
        this.playPauseBtn = playPauseBtn;
        this.currentTimeDisplay = currentTimeDisplay;
        this.durationDisplay = durationDisplay;
        this.isSeeking = false;
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        this.video.addEventListener('timeupdate', () => {
            if (!this.isSeeking) {
                this.updateProgress();
                this.updateCurrentTime();
            }
        });
        
        this.video.addEventListener('loadedmetadata', () => {
            this.updateDuration();
        });
        
        this.progressBar.addEventListener('input', (e) => {
            this.isSeeking = true;
            const seekTime = (e.target.value / 100) * this.video.duration;
            this.currentTimeDisplay.textContent = formatTime(seekTime);
        });
        
        this.progressBar.addEventListener('change', (e) => {
            const seekTime = (e.target.value / 100) * this.video.duration;
            this.video.currentTime = seekTime;
            this.isSeeking = false;
        });
        
        this.playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        this.video.addEventListener('ended', () => {
            this.updatePlayPauseButton(false);
        });
        
        this.video.addEventListener('play', () => {
            this.updatePlayPauseButton(true);
        });
        
        this.video.addEventListener('pause', () => {
            this.updatePlayPauseButton(false);
        });
    }
    
    updateProgress() {
        if (this.video.duration) {
            const percent = (this.video.currentTime / this.video.duration) * 100;
            this.progressBar.value = percent;
        }
    }
    
    updateCurrentTime() {
        this.currentTimeDisplay.textContent = formatTime(this.video.currentTime);
    }
    
    updateDuration() {
        this.durationDisplay.textContent = formatTime(this.video.duration);
        this.progressBar.max = 100;
    }
    
    updatePlayPauseButton(isPlaying) {
        if (isPlaying) {
            this.playPauseBtn.innerHTML = '⏸ Pause';
            this.playPauseBtn.setAttribute('aria-label', 'Pause video');
        } else {
            this.playPauseBtn.innerHTML = '⏯ Play';
            this.playPauseBtn.setAttribute('aria-label', 'Play video');
        }
    }
    
    togglePlayPause() {
        if (this.video.paused) {
            this.video.play().catch(e => console.log('Play prevented:', e));
        } else {
            this.video.pause();
        }
    }
    
    skip(seconds) {
        this.video.currentTime = Math.min(
            Math.max(this.video.currentTime + seconds, 0),
            this.video.duration
        );
    }
    
    enterFullscreen(element) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }
}