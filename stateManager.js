// ============ STATE MANAGER - SINGLE SOURCE OF TRUTH ==========
// Implements deduplication pipeline for stable episode IDs

class StateManager {
    constructor(initialState = {}) {
        this.state = {
            episodes: [],
            filteredEpisodes: [],
            currentIndex: 0,
            currentPlayingId: null,
            playbackPositions: {},
            searchTerm: '',
            selectedDate: null,
            viewMode: 'list',
            darkMode: false,
            queue: [],
            loading: true,
            error: null,
            ...initialState
        };
        
        this.listeners = [];
        this.episodeMap = new Map(); // For O(1) lookup by ID
    }
    
    // Get current state
    getState() {
        return { ...this.state };
    }
    
    // Subscribe to state changes
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    
    // Notify all listeners of state change
    notify() {
        this.listeners.forEach(listener => listener(this.getState()));
    }
    
    // Update state with deduplication for episodes
    setState(updates) {
        const newState = { ...this.state, ...updates };
        
        // Handle episode updates with deduplication
        if (updates.episodes) {
            const uniqueEpisodes = [];
            const seenIds = new Set();
            
            for (const episode of updates.episodes) {
                if (!seenIds.has(episode.id)) {
                    seenIds.add(episode.id);
                    uniqueEpisodes.push(episode);
                    this.episodeMap.set(episode.id, episode);
                }
            }
            
            // Preserve existing episodes that aren't in the new set
            const existingEpisodes = this.state.episodes.filter(ep => !seenIds.has(ep.id));
            newState.episodes = [...existingEpisodes, ...uniqueEpisodes];
            
            // Sort by date (newest first)
            newState.episodes.sort((a, b) => b.centralDate - a.centralDate);
        }
        
        // Update filtered episodes based on search and date filters
        if (updates.episodes !== undefined || 
            updates.searchTerm !== undefined || 
            updates.selectedDate !== undefined) {
            
            let filtered = [...newState.episodes];
            
            if (newState.searchTerm) {
                const term = newState.searchTerm.toLowerCase();
                filtered = filtered.filter(ep => 
                    ep.title.toLowerCase().includes(term) || 
                    ep.description.toLowerCase().includes(term)
                );
            }
            
            if (newState.selectedDate) {
                filtered = filtered.filter(ep => ep.dateKey === newState.selectedDate);
            }
            
            newState.filteredEpisodes = filtered;
        }
        
        this.state = newState;
        this.notify();
        
        return this.state;
    }
    
    // Add episodes with automatic deduplication (for chunked loading)
    addEpisodes(newEpisodes) {
        const currentIds = new Set(this.state.episodes.map(ep => ep.id));
        const uniqueNewEpisodes = newEpisodes.filter(ep => !currentIds.has(ep.id));
        
        if (uniqueNewEpisodes.length > 0) {
            const allEpisodes = [...this.state.episodes, ...uniqueNewEpisodes];
            allEpisodes.sort((a, b) => b.centralDate - a.centralDate);
            
            this.setState({ episodes: allEpisodes, loading: false });
        }
        
        return uniqueNewEpisodes.length;
    }
    
    // Get episode by stable ID
    getEpisodeById(id) {
        return this.episodeMap.get(id) || this.state.episodes.find(ep => ep.id === id);
    }
    
    // Update playback position for an episode
    updatePlaybackPosition(episodeId, position, duration) {
        const positions = { ...this.state.playbackPositions };
        
        if (duration && position >= duration - 2) {
            delete positions[episodeId];
        } else {
            positions[episodeId] = {
                position: Math.floor(position),
                timestamp: Date.now(),
                duration: duration || 0
            };
        }
        
        this.setState({ playbackPositions: positions });
    }
    
    // Get playback position for an episode
    getPlaybackPosition(episodeId) {
        const saved = this.state.playbackPositions[episodeId];
        return saved && saved.position ? saved.position : 0;
    }
    
    // Queue management
    addToQueue(episode) {
        const queue = [...this.state.queue];
        const exists = queue.some(item => item.id === episode.id);
        
        if (!exists) {
            queue.push(episode);
            this.setState({ queue });
        }
        
        return !exists;
    }
    
    removeFromQueue(index) {
        const queue = [...this.state.queue];
        queue.splice(index, 1);
        this.setState({ queue });
    }
    
    clearQueue() {
        this.setState({ queue: [] });
    }
    
    // Current episode management
    setCurrentEpisode(index) {
        const episode = this.state.filteredEpisodes[index];
        if (episode) {
            this.setState({ 
                currentIndex: index, 
                currentPlayingId: episode.id 
            });
        }
    }
    
    // Filter management
    setSearchTerm(term) {
        this.setState({ searchTerm: term, currentIndex: 0 });
    }
    
    setSelectedDate(date) {
        this.setState({ selectedDate: date, currentIndex: 0 });
    }
    
    clearFilters() {
        this.setState({ searchTerm: '', selectedDate: null, currentIndex: 0 });
    }
    
    // View mode
    setViewMode(mode) {
        this.setState({ viewMode: mode });
    }
    
    // Dark mode
    setDarkMode(enabled) {
        this.setState({ darkMode: enabled });
    }
    
    // Loading/Error states
    setLoading(loading) {
        this.setState({ loading });
    }
    
    setError(error) {
        this.setState({ error, loading: false });
    }
}

// Singleton instance
let stateManagerInstance = null;

export function getStateManager() {
    if (!stateManagerInstance) {
        stateManagerInstance = new StateManager();
    }
    return stateManagerInstance;
}