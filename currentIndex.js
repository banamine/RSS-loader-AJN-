// In VirtualPlaylist.js - renderItem() passes the actual index
function downloadEpisodeByIndex(index) {
    const episode = currentPlaylist[index];  // Uses parameter, not currentIndex
    if (!episode) return;
    
    const link = document.createElement('a');
    link.href = episode.videoUrl;
    link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (virtualPlaylist) {
        virtualPlaylist.closeAllFlyouts();
    }
    
    showToast(`Downloading: ${episode.title.substring(0, 50)}...`);
}

function shareEpisodeByIndex(index) {
    const episode = currentPlaylist[index];  // Uses parameter, not currentIndex
    if (!episode) return;
    
    if (virtualPlaylist) {
        virtualPlaylist.closeAllFlyouts();
    }
    
    if (navigator.share) {
        navigator.share({
            title: episode.title,
            text: episode.description.substring(0, 100),
            url: episode.videoUrl
        }).catch(e => console.log('Share cancelled'));
    } else {
        navigator.clipboard.writeText(episode.videoUrl);
        showToast('Episode link copied to clipboard');
    }
}