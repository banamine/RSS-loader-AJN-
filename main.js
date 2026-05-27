document.addEventListener("DOMContentLoaded", () => {
    const mainVideo = document.getElementById("mainVideo");
    const playPauseBtn = document.getElementById("playPauseBtn");

    console.log("App Initialized");

    // Initialize UI Component
    if (window.VideoControls) {
        const controls = new window.VideoControls(mainVideo);
        controls.init();
    } else {
        console.error("VideoControls is not defined. Ensure it is loaded in index.html");
    }

    playPauseBtn.addEventListener("click", () => {
        if (mainVideo.paused) {
            mainVideo.play();
            playPauseBtn.textContent = "⏸ Pause";
        } else {
            mainVideo.pause();
            playPauseBtn.textContent = "⏯ Play";
        }
    });
});