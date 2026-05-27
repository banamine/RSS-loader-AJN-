window.VideoControls = class VideoControls {
    constructor(videoElement) {
        this.video = videoElement;
    }

    init() {
        this.video.addEventListener("timeupdate", () => {
            const currentTimeDisplay = document.getElementById("currentTime");
            if (currentTimeDisplay) {
                currentTimeDisplay.textContent = this.formatTime(this.video.currentTime);
            }
        });
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, "0")}`;
    }
};