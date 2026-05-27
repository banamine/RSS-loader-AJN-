// ============ STATE MANAGER ==========

const STORAGE_KEYS = {
    APP_STATE: 'ajn-app-state',
    QUEUE: 'ajn-user-queue',
    DARK_MODE: 'darkMode',
    VIEW_MODE: 'ajn_view_mode'
};

function saveState(state) {
    try {
        const stateToSave = {
            searchTerm: state.searchTerm,
            filterDate: state.filterDate,
            viewMode: state.viewMode,
            darkMode: state.darkMode,
            nowPlayingId: state.nowPlayingId,
            lastUpdated: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(stateToSave));
    } catch (e) { console.error('Failed to save state:', e); }
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.APP_STATE);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.lastUpdated && Date.now() - parsed.lastUpdated < 7 * 24 * 60 * 60 * 1000) return parsed;
        }
        return null;
    } catch (e) { return null; }
}

let stateManagerInstance = null;
let scheduledRender = false;

class StateManager {
    constructor() {
        if (stateManagerInstance) return stateManagerInstance;
        const persistedState = loadState();
        this.state = {
            loading: true, error: null, episodes: [], filteredEpisodes: [],
            nowPlayingId: persistedState?.nowPlayingId || null,
            searchTerm: persistedState?.searchTerm || '',
            filterDate: persistedState?.filterDate || null,
            viewMode: persistedState?.viewMode || 'list',
            darkMode: persistedState?.darkMode !== undefined ? persistedState.darkMode : localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true',
            queue: [],
            calendarVisible: false, currentCalendarDate: new Date(), processedCount: 0
        };
        this.listeners = [];
        this.renderCallback = null;
        stateManagerInstance = this;
        if (this.state.darkMode) document.body.classList.add('dark');
        console.log('StateManager initialized');
    }
    
    getState() { return { ...this.state }; }
    setRenderCallback(callback) { this.renderCallback = callback; }
    subscribe(listener) { this.listeners.push(listener); return () => { this.listeners = this.listeners.filter(l => l !== listener); }; }
    notify() { this.listeners.forEach(listener => listener(this.getState())); }
    
    setState(patch) {
        const newState = { ...this.state, ...patch };
        if (patch.episodes !== undefined || patch.searchTerm !== undefined || patch.filterDate !== undefined) {
            let filtered = [...newState.episodes];
            if (newState.searchTerm) {
                const term = newState.searchTerm.toLowerCase();
                filtered = filtered.filter(ep => (ep.title || '').toLowerCase().includes(term) || (ep.description || '').toLowerCase().includes(term));
            }
            if (newState.filterDate) filtered = filtered.filter(ep => ep.dateKey === newState.filterDate);
            newState.filteredEpisodes = filtered;
        }
        this.state = newState;
        saveState(this.state);
        if (patch.queue !== undefined) localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(this.state.queue));
        if (!scheduledRender && this.renderCallback) {
            scheduledRender = true;
            requestAnimationFrame(() => { scheduledRender = false; this.renderCallback(this.getState()); this.notify(); });
        }
    }
    
    setSearchTerm(term) { this.setState({ searchTerm: term }); }
    setFilterDate(date) { this.setState({ filterDate: date }); }
    clearFilters() { this.setState({ searchTerm: '', filterDate: null }); }
    
    addToQueue(episode) {
        if (!episode || this.state.queue.some(q => q.id === episode.id)) return false;
        const queue = [...this.state.queue, episode];
        this.setState({ queue });
        return true;
    }
    removeFromQueue(index) { const queue = [...this.state.queue]; queue.splice(index, 1); this.setState({ queue }); }
    clearQueue() { this.setState({ queue: [] }); }
    
    setViewMode(mode) { if (mode === 'list' || mode === 'grid') this.setState({ viewMode: mode }); }
    toggleDarkMode() { this.setState({ darkMode: !this.state.darkMode }); document.body.classList.toggle('dark', this.state.darkMode); localStorage.setItem(STORAGE_KEYS.DARK_MODE, this.state.darkMode); }
    setNowPlaying(episodeId) { this.setState({ nowPlayingId: episodeId }); }
    setLoading(loading) { this.setState({ loading }); }
    setError(error) { this.setState({ error, loading: false }); }
    setEpisodes(episodes) { this.setState({ episodes, loading: false }); }
    
    loadQueueFromStorage() {
        try { const saved = localStorage.getItem(STORAGE_KEYS.QUEUE); if (saved) this.setState({ queue: JSON.parse(saved) }); } catch (e) { console.error('Failed to load queue:', e); }
    }
}

const stateManager = new StateManager();