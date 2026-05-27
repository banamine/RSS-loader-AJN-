// ============ VIDEO CONTROLS MODULE ==========
// Place this file at the root level (same as index.html)

import { formatTime, showToast } from './helpers.js';

export class VideoControls {
    constructor(videoElement, progressBar, playPauseBtn, currentTimeDisplay, durationDisplay) {
        this.video = videoElement;
        this.progressBar = progressBar;
        this.playPauseBtn = playPauseBtn;
        this.currentTimeDisplay = currentTimeDisplay;
        this.durationDisplay = durationDisplay;
        this.isSeeking = false;
        this.onEndCallback = null;
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        if (!this.video) return;
        
        this.video.addEventListener('timeupdate', () => {
            if (!this.isSeeking && this.video.duration) {
                this.updateProgress();
                this.updateCurrentTime();
            }
        });
        
        this.video.addEventListener('loadedmetadata', () => {
            this.updateDuration();
        });
        
        if (this.progressBar) {
            this.progressBar.addEventListener('input', (e) => {
                this.isSeeking = true;
                const seekTime = (e.target.value / 100) * this.video.duration;
                if (this.currentTimeDisplay) {
                    this.currentTimeDisplay.textContent = formatTime(seekTime);
                }
            });
            
            this.progressBar.addEventListener('change', (e) => {
                const seekTime = (e.target.value / 100) * this.video.duration;
                this.video.currentTime = seekTime;
                this.isSeeking = false;
            });
        }
        
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => {
                this.togglePlayPause();
            });
        }
        
        this.video.addEventListener('play', () => {
            this.updatePlayPauseButton(true);
        });
        
        this.video.addEventListener('pause', () => {
            this.updatePlayPauseButton(false);
        });
        
        this.video.addEventListener('ended', () => {
            if (this.onEndCallback) {
                this.onEndCallback();
            }
        });
    }
    
    updateProgress() {
        if (this.video.duration && this.progressBar) {
            const percent = (this.video.currentTime / this.video.duration) * 100;
            this.progressBar.value = percent;
        }
    }
    
    updateCurrentTime() {
        if (this.currentTimeDisplay) {
            this.currentTimeDisplay.textContent = formatTime(this.video.currentTime);
        }
    }
    
    updateDuration() {
        if (this.durationDisplay) {
            this.durationDisplay.textContent = formatTime(this.video.duration);
        }
        if (this.progressBar) {
            this.progressBar.max = 100;
        }
    }
    
    updatePlayPauseButton(isPlaying) {
        if (!this.playPauseBtn) return;
        
        if (isPlaying) {
            this.playPauseBtn.innerHTML = '⏸ Pause';
            this.playPauseBtn.setAttribute('aria-label', 'Pause video');
        } else {
            this.playPauseBtn.innerHTML = '⏯ Play';
            this.playPauseBtn.setAttribute('aria-label', 'Play video');
        }
    }
    
    togglePlayPause() {
        if (!this.video) return;
        
        if (this.video.paused) {
            this.video.play().catch(e => {
                console.log('Play prevented:', e);
                if (typeof showToast === 'function') {
                    showToast('Click play to start', 2000);
                }
            });
        } else {
            this.video.pause();
        }
    }
    
    skip(seconds) {
        if (!this.video) return;
        this.video.currentTime = Math.min(Math.max(this.video.currentTime + seconds, 0), this.video.duration);
        if (typeof showToast === 'function') {
            showToast(`${seconds > 0 ? 'Forward' : 'Back'} ${Math.abs(seconds)} seconds`);
        }
    }
    
    setOnEnd(callback) {
        this.onEndCallback = callback;
    }
    
    loadEpisode(videoUrl, autoPlay = false) {
        if (!this.video) return;
        
        this.video.src = videoUrl;
        this.video.load();
        if (autoPlay) {
            this.video.play().catch(e => console.log('Autoplay prevented:', e));
        }
    }
    
    setCurrentTime(position) {
        if (this.video && position > 0 && position < this.video.duration) {
            this.video.currentTime = position;
        }
    }
}