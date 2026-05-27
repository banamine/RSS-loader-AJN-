// ============ SKELETON LOADER COMPONENT ==========

class SkeletonLoader {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.rowCount = options.rowCount || 10;
        this.rowHeight = options.rowHeight || 80;
        this.isVisible = false;
    }
    
    show() { if (!this.container) return; this.isVisible = true; this.render(); }
    hide() { if (!this.container) return; this.isVisible = false; this.container.innerHTML = ''; }
    
    render() {
        if (!this.container || !this.isVisible) return;
        const fragment = document.createDocumentFragment();
        const container = document.createElement('div');
        container.className = 'skeleton-container';
        for (let i = 0; i < this.rowCount; i++) {
            const row = document.createElement('div');
            row.className = 'skeleton-row';
            row.style.height = `${this.rowHeight}px`;
            container.appendChild(row);
        }
        fragment.appendChild(container);
        this.container.innerHTML = '';
        this.container.appendChild(fragment);
    }
}