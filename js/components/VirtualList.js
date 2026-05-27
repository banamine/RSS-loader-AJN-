// ============ VIRTUAL LIST COMPONENT - CORRECT EXPORT ==========
// This is the renamed VirtualPlaylist.js file

export class VirtualList {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with id "${containerId}" not found`);
            return;
        }
        
        this.rowHeight = options.rowHeight || 80;
        this.buffer = options.buffer || 5;
        this.items = [];
        this.renderItem = options.renderItem || null;
        this.onItemClick = options.onItemClick || null;
        
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.totalHeight = 0;
        this.isInitialized = false;
        
        this.init();
    }
    
    init() {
        // Create spacer for scrollbar
        this.spacer = document.createElement('div');
        this.spacer.style.position = 'relative';
        this.spacer.style.width = '100%';
        
        // Create container for visible items
        this.visibleContainer = document.createElement('div');
        this.visibleContainer.style.position = 'absolute';
        this.visibleContainer.style.top = '0';
        this.visibleContainer.style.left = '0';
        this.visibleContainer.style.width = '100%';
        
        // Clear container and add elements
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        this.container.style.flex = '1';
        this.container.style.minHeight = '0';
        
        this.container.appendChild(this.spacer);
        this.container.appendChild(this.visibleContainer);
        
        // Bind scroll handler
        this.scrollHandler = this.handleScroll.bind(this);
        this.container.addEventListener('scroll', this.scrollHandler);
        
        // Observe container resize
        this.resizeObserver = new ResizeObserver(() => {
            this.updateVisibleRange();
        });
        this.resizeObserver.observe(this.container);
        
        this.isInitialized = true;
        console.log('VirtualList initialized');
    }
    
    setItems(items) {
        if (!this.isInitialized) {
            console.warn('VirtualList not initialized, items will be set after init');
            this.items = items;
            return;
        }
        
        this.items = items || [];
        this.totalHeight = this.items.length * this.rowHeight;
        this.spacer.style.height = `${this.totalHeight}px`;
        this.updateVisibleRange();
        console.log(`VirtualList: ${this.items.length} items set`);
    }
    
    handleScroll() {
        if (!this.isInitialized) return;
        requestAnimationFrame(() => this.updateVisibleRange());
    }
    
    updateVisibleRange() {
        if (!this.items.length || !this.isInitialized) return;
        
        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;
        
        const start = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.buffer);
        const end = Math.min(this.items.length, Math.ceil((scrollTop + viewportHeight) / this.rowHeight) + this.buffer);
        
        if (start === this.visibleStart && end === this.visibleEnd) return;
        
        this.visibleStart = start;
        this.visibleEnd = end;
        this.renderVisibleItems();
    }
    
    renderVisibleItems() {
        if (!this.renderItem) {
            console.warn('No renderItem function provided');
            return;
        }
        
        const fragment = document.createDocumentFragment();
        const visibleItems = this.items.slice(this.visibleStart, this.visibleEnd);
        
        visibleItems.forEach((item, idx) => {
            const actualIndex = this.visibleStart + idx;
            const row = this.renderItem(item, actualIndex);
            
            if (row) {
                row.style.position = 'absolute';
                row.style.top = `${actualIndex * this.rowHeight}px`;
                row.style.left = '0';
                row.style.width = '100%';
                row.style.height = `${this.rowHeight}px`;
                
                if (this.onItemClick) {
                    const originalClick = row.onclick;
                    row.addEventListener('click', (e) => {
                        if (!e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu')) {
                            if (this.onItemClick) this.onItemClick(actualIndex);
                            if (originalClick) originalClick(e);
                        }
                    });
                }
                
                fragment.appendChild(row);
            }
        });
        
        this.visibleContainer.innerHTML = '';
        this.visibleContainer.appendChild(fragment);
    }
    
    scrollToIndex(index) {
        if (!this.items.length || index < 0 || index >= this.items.length) return;
        const targetScroll = index * this.rowHeight;
        const viewportHeight = this.container.clientHeight;
        const currentScroll = this.container.scrollTop;
        
        if (targetScroll < currentScroll || targetScroll > currentScroll + viewportHeight - this.rowHeight) {
            this.container.scrollTo({
                top: Math.max(0, targetScroll - viewportHeight / 2 + this.rowHeight / 2),
                behavior: 'smooth'
            });
        }
    }
    
    refresh() {
        this.updateVisibleRange();
    }
    
    getCurrentItems() {
        return this.items;
    }
    
    destroy() {
        if (this.container) {
            this.container.removeEventListener('scroll', this.scrollHandler);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.isInitialized = false;
    }
}