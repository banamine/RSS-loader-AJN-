window.stateManager = {
    state: {
        queue: [],
        currentEpisode: null,
        isPlaying: false
    },
    update(newState) {
        this.state = { ...this.state, ...newState };
        const event = new CustomEvent("stateChanged", { detail: this.state });
        window.dispatchEvent(event);
    }
};