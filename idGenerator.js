// ============ STABLE EPISODE ID GENERATOR ==========

/**
 * Creates a stable, deterministic ID from episode metadata
 * Uses SHA-256 inspired approach for uniqueness without external crypto
 */
export function generateStableEpisodeId(episode) {
    const { pubDate, title, link } = episode;
    
    // Create a normalized string from stable fields
    const normalizedString = [
        pubDate || '',
        (title || '').trim(),
        (link || '').split('?')[0] // Remove query params
    ].join('|').toLowerCase();
    
    // Simple but effective hash function (FNV-1a variant)
    let hash = 2166136261;
    for (let i = 0; i < normalizedString.length; i++) {
        hash ^= normalizedString.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
        hash >>>= 0; // Convert to 32-bit unsigned
    }
    
    // Convert to hex and take first 16 chars for readability
    return hash.toString(16).padStart(8, '0');
}

/**
 * Migrates old playback positions (index-based) to new ID-based storage
 */
export function migratePlaybackPositions(oldPositions, episodes) {
    if (!oldPositions || typeof oldPositions !== 'object') {
        return {};
    }
    
    const migrated = {};
    const episodeMap = new Map();
    
    // Build index-to-id mapping
    episodes.forEach((ep, idx) => {
        episodeMap.set(idx.toString(), ep.id);
        episodeMap.set(idx, ep.id);
    });
    
    for (const [key, value] of Object.entries(oldPositions)) {
        // Check if key is numeric index
        const numKey = parseInt(key, 10);
        if (!isNaN(numKey) && episodeMap.has(key)) {
            const newId = episodeMap.get(key);
            migrated[newId] = value;
        } else if (key.length === 8 && /^[0-9a-f]{8}$/i.test(key)) {
            // Already a valid hash ID
            migrated[key] = value;
        }
    }
    
    return migrated;
}

/**
 * Validates that an episode ID has the correct format
 */
export function isValidEpisodeId(id) {
    return typeof id === 'string' && /^[0-9a-f]{8}$/i.test(id);
}