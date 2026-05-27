// ============ STATE MANAGER - WITH PERSISTENCE ==========
// Now persists searchTerm, filterDate, and viewMode

let instance = null;
let scheduledRender = false;

class StateManager {
    constructor() {
        if (instance) return instance;
        
        // Load all persisted state from localStorage
        this.state = {
            loading: true,
            error: null,
            episodes: [],
            filteredEpisodes: [],
            nowPlayingId: null,
            searchTerm: localStorage.getItem('searchTerm') || '',
            filterDate: localStorage.getItem('filterDate') || null,
            viewMode: localStorage.getItem('viewMode') || 'list',
            darkMode: localStorage.getItem('darkMode') === 'true',
            queue: [],
            calendarVisible: false,
            currentCalendarDate: new Date(),
            processedCount: 0
        };
        
        this.listeners = [];
        this.renderCallback = null;
        instance = this;
    }
    
    getState() {
        return { ...this.state };
    }
    
    setRenderCallback(callback) {
        this.renderCallback = callback;
    }
    
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    
    notify() {
        this.listeners.forEach(listener => listener(this.getState()));
    }
    
    setState(patch) {
        const newState = { ...this.state, ...patch };
        
        // Handle filtered episodes
        if (patch.episodes !== undefined || 
            patch.searchTerm !== undefined || 
            patch.filterDate !== undefined) {
            
            let filtered = [...newState.episodes];
            
            if (newState.searchTerm) {
                const term = newState.searchTerm.toLowerCase();
                filtered = filtered.filter(ep => 
                    (ep.title || '').toLowerCase().includes(term) || 
                    (ep.description || '').toLowerCase().includes(term)
                );
            }
            
            if (newState.filterDate) {
                filtered = filtered.filter(ep => ep.dateKey === newState.filterDate);
            }
            
            newState.filteredEpisodes = filtered;
        }
        
        this.state = newState;
        
        // Persist specific state to localStorage
        this.persistState();
        
        // Schedule render
        if (!scheduledRender && this.renderCallback) {
            scheduledRender = true;
            requestAnimationFrame(() => {
                scheduledRender = false;
                this.renderCallback(this.getState());
                this.notify();
            });
        }
    }
    
    persistState() {
        // Save user preferences to localStorage
        localStorage.setItem('searchTerm', this.state.searchTerm);
        localStorage.setItem('filterDate', this.state.filterDate || '');
        localStorage.setItem('viewMode', this.state.viewMode);
        localStorage.setItem('darkMode', this.state.darkMode);
        // Note: queue is saved separately via saveQueueToStorage
    }
    
    // Search and filter methods
    setSearchTerm(term) {
        this.setState({ searchTerm: term });
    }
    
    setFilterDate(date) {
        this.setState({ filterDate: date });
        if (date) {
            localStorage.setItem('filterDate', date);
        } else {
            localStorage.removeItem('filterDate');
        }
    }
    
    clearFilters() {
        this.setState({ searchTerm: '', filterDate: null });
        localStorage.removeItem('searchTerm');
        localStorage.removeItem('filterDate');
    }
    
    // Queue management
    addToQueue(episode) {
        if (!episode || this.state.queue.some(q => q.id === episode.id)) {
            return false;
        }
        const queue = [...this.state.queue, episode];
        this.setState({ queue });
        this.saveQueueToStorage();
        return true;
    }
    
    removeFromQueue(index) {
        const queue = [...this.state.queue];
        queue.splice(index, 1);
        this.setState({ queue });
        this.saveQueueToStorage();
    }
    
    clearQueue() {
        this.setState({ queue: [] });
        this.saveQueueToStorage();
    }
    
    saveQueueToStorage() {
        try {
            localStorage.setItem('userQueue', JSON.stringify(this.state.queue));
        } catch (e) {
            console.error('Failed to save queue:', e);
        }
    }
    
    loadQueueFromStorage() {
        try {
            const saved = localStorage.getItem('userQueue');
            if (saved) {
                const queue = JSON.parse(saved);
                this.setState({ queue });
            }
        } catch (e) {
            console.error('Failed to load queue:', e);
        }
    }
    
    // View mode
    setViewMode(mode) {
        if (mode === 'list' || mode === 'grid') {
            this.setState({ viewMode: mode });
        }
    }
    
    // Dark mode
    toggleDarkMode() {
        this.setState({ darkMode: !this.state.darkMode });
        document.body.classList.toggle('dark', this.state.darkMode);
    }
    
    // Now playing
    setNowPlaying(episodeId) {
        this.setState({ nowPlayingId: episodeId });
    }
    
    // Loading state
    setLoading(loading) {
        this.setState({ loading });
    }
    
    setError(error) {
        this.setState({ error, loading: false });
    }
    
    setEpisodes(episodes) {
        this.setState({ episodes, loading: false });
    }
}

export const stateManager = new StateManager();