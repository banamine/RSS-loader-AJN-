// ============ FLYOUT ACTION HANDLERS ============
// All handlers accept an 'index' parameter, not relying on currentIndex

// Download episode by specific index
function downloadEpisodeByIndex(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    const link = document.createElement('a');
    link.href = episode.videoUrl;
    link.download = `${episode.title.replace(/[^a-z0-9]/gi, '_')}.m4v`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (virtualPlaylist) virtualPlaylist.closeAllFlyouts();
    showToast(`Downloading: ${episode.title.substring(0, 50)}...`);
}

// Share episode by specific index
function shareEpisodeByIndex(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    if (virtualPlaylist) virtualPlaylist.closeAllFlyouts();
    
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

// Copy link by specific index
function copyLink(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    navigator.clipboard.writeText(episode.videoUrl);
    if (virtualPlaylist) virtualPlaylist.closeAllFlyouts();
    showToast('Link copied to clipboard');
}

// View episode details by specific index
function viewDetails(index) {
    const episode = currentPlaylist[index];
    if (!episode) return;
    
    if (virtualPlaylist) virtualPlaylist.closeAllFlyouts();
    
    // Create modal with episode details
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.8); display: flex; align-items: center;
        justify-content: center; z-index: 2000; backdrop-filter: blur(4px);
    `;
    
    modal.innerHTML = `
        <div style="background: var(--bg-surface); border-radius: 16px; 
                    max-width: 500px; width: 90%; max-height: 80vh; 
                    overflow-y: auto; padding: 24px;">
            <h3 style="margin-bottom: 16px; color: var(--primary);">Episode Details</h3>
            <div style="margin-bottom: 12px;"><strong>Title:</strong><br>${escapeHtml(episode.title)}</div>
            <div style="margin-bottom: 12px;"><strong>Show:</strong><br>${episode.show} ${episode.hour}</div>
            <div style="margin-bottom: 12px;"><strong>Date (CT):</strong><br>${formatCentralTime(episode.centralDate)}</div>
            <div style="margin-bottom: 12px;"><strong>Description:</strong><br>${escapeHtml(episode.description)}</div>
            <button onclick="this.closest('div').parentElement.remove()" class="btn btn-primary">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// Make functions globally available
window.downloadEpisodeByIndex = downloadEpisodeByIndex;
window.shareEpisodeByIndex = shareEpisodeByIndex;
window.copyLink = copyLink;
window.viewDetails = viewDetails;
window.toggleFlyout = (event, index) => {
    if (window.virtualPlaylist) {
        window.virtualPlaylist.toggleFlyout(event, index);
    }
};