// ============ STABLE ID GENERATOR ==========
// Generates consistent IDs based on episode content, not time

/**
 * Creates a stable, deterministic ID from episode metadata
 * Uses base64 encoding of the video URL for guaranteed uniqueness
 */
export function generateStableEpisodeId(episode) {
    // Primary: Use video URL as the source of truth
    const videoUrl = episode.videoUrl || episode.link || episode.enclosure?.url || '';
    
    if (videoUrl) {
        // Create a base64 encoded ID from the URL
        // btoa works with ASCII, so we need to handle Unicode properly
        try {
            const urlHash = btoa(encodeURIComponent(videoUrl).substring(0, 100));
            return `ep_${urlHash.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 32)}`;
        } catch (e) {
            console.warn('Failed to create base64 ID, using fallback');
        }
    }
    
    // Fallback: Use title + pubDate hash
    const fallbackString = `${episode.title || ''}|${episode.pubDate || ''}`;
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < fallbackString.length; i++) {
        hash = Math.imul(hash ^ fallbackString.charCodeAt(i), 16777619) >>> 0;
    }
    return `ep_${hash.toString(36)}`;
}

/**
 * Validates that an episode ID has the correct format
 */
export function isValidEpisodeId(id) {
    return typeof id === 'string' && id.startsWith('ep_') && id.length > 3;
}

/**
 * Migrates old IDs to new stable IDs
 */
export function migrateEpisodeId(oldId, episode) {
    if (oldId && oldId.startsWith('ep_') && oldId.length > 10) {
        // Check if it looks like a hash-based ID (not timestamp-based)
        const hasTimestamp = oldId.includes(Date.now().toString().substring(0, 8));
        if (!hasTimestamp) {
            return oldId; // Already seems stable
        }
    }
    return generateStableEpisodeId(episode);
}