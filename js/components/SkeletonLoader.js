// ============ SKELETON LOADER COMPONENT ==========
// Shows placeholder rows while content loads

export class SkeletonLoader {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.rowCount = options.rowCount || 10;
        this.rowHeight = options.rowHeight || 80;
        this.isVisible = false;
    }
    
    show() {
        if (!this.container) return;
        this.isVisible = true;
        this.render();
    }
    
    hide() {
        if (!this.container) return;
        this.isVisible = false;
        this.container.innerHTML = '';
    }
    
    render() {
        if (!this.container || !this.isVisible) return;
        
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < this.rowCount; i++) {
            const skeletonRow = document.createElement('div');
            skeletonRow.className = 'skeleton-row';
            skeletonRow.style.height = `${this.rowHeight}px`;
            skeletonRow.style.marginBottom = '8px';
            skeletonRow.style.background = 'linear-gradient(90deg, var(--border) 25%, var(--bg-surface-hover) 50%, var(--border) 75%)';
            skeletonRow.style.backgroundSize = '200% 100%';
            skeletonRow.style.borderRadius = '8px';
            skeletonRow.style.animation = 'shimmer 1.5s infinite';
            fragment.appendChild(skeletonRow);
        }
        
        this.container.innerHTML = '';
        this.container.appendChild(fragment);
    }
}

// Add this CSS to your main.css if not already present
export const skeletonStyles = `
    @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
    .skeleton-row {
        animation: shimmer 1.5s infinite;
    }
`;