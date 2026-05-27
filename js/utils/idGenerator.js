// ============ STABLE ID GENERATOR ==========

function generateStableEpisodeId(episode) {
    const videoUrl = episode.videoUrl || episode.link || episode.enclosure?.url || '';
    
    if (videoUrl) {
        try {
            const urlHash = btoa(encodeURIComponent(videoUrl).substring(0, 100));
            return `ep_${urlHash.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 32)}`;
        } catch (e) {
            console.warn('Failed to create base64 ID, using fallback');
        }
    }
    
    const fallbackString = `${episode.title || ''}|${episode.pubDate || ''}`;
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < fallbackString.length; i++) {
        hash = Math.imul(hash ^ fallbackString.charCodeAt(i), 16777619) >>> 0;
    }
    return `ep_${hash.toString(36)}`;
}

function isValidEpisodeId(id) {
    return typeof id === 'string' && id.startsWith('ep_') && id.length > 3;
}

function migrateEpisodeId(oldId, episode) {
    if (oldId && oldId.startsWith('ep_') && oldId.length > 10) {
        const hasTimestamp = oldId.includes(Date.now().toString().substring(0, 8));
        if (!hasTimestamp) return oldId;
    }
    return generateStableEpisodeId(episode);
}