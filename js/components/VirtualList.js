// ============ VIRTUAL LIST COMPONENT - WITH LIFECYCLE GUARD ==========
// This component will retry finding the container until it exists

export class VirtualList {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.rowHeight = options.rowHeight || 80;
        this.buffer = options.buffer || 5;
        this.items = [];
        this.renderItem = options.renderItem || null;
        this.onItemClick = options.onItemClick || null;
        
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.totalHeight = 0;
        this.isInitialized = false;
        this.container = null;
        this.spacer = null;
        this.visibleContainer = null;
        this.scrollHandler = null;
        this.resizeObserver = null;
        this.retryCount = 0;
        this.maxRetries = 20; // 20 * 50ms = 1 second max retry
        
        // Start initialization with guard
        this.init();
    }
    
    init() {
        // GUARD: Try to find the container
        this.container = document.getElementById(this.containerId);
        
        // If container doesn't exist yet, retry after delay
        if (!this.container) {
            this.retryCount++;
            if (this.retryCount <= this.maxRetries) {
                console.warn(`Container "${this.containerId}" not found (attempt ${this.retryCount}/${this.maxRetries}). Retrying in 50ms...`);
                setTimeout(() => this.init(), 50);
            } else {
                console.error(`Container "${this.containerId}" not found after ${this.maxRetries} attempts. Check your HTML for a div with id="${this.containerId}".`);
            }
            return;
        }
        
        console.log(`Container "${this.containerId}" found, initializing VirtualList...`);
        
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
        
        // Bind scroll handler with guard
        this.scrollHandler = this.handleScroll.bind(this);
        this.container.addEventListener('scroll', this.scrollHandler);
        
        // Observe container resize
        this.resizeObserver = new ResizeObserver(() => {
            if (this.isInitialized) {
                this.updateVisibleRange();
            }
        });
        this.resizeObserver.observe(this.container);
        
        this.isInitialized = true;
        console.log('VirtualList initialized successfully');
        
        // If items were set before initialization, render them now
        if (this.items && this.items.length > 0) {
            this.setItems(this.items);
        }
    }
    
    setItems(items) {
        this.items = items || [];
        
        if (!this.isInitialized) {
            console.log(`VirtualList not ready yet, storing ${this.items.length} items for later`);
            return;
        }
        
        this.totalHeight = this.items.length * this.rowHeight;
        if (this.spacer) {
            this.spacer.style.height = `${this.totalHeight}px`;
        }
        this.updateVisibleRange();
        console.log(`VirtualList: ${this.items.length} items rendered`);
    }
    
    handleScroll() {
        if (!this.isInitialized || !this.container) return;
        requestAnimationFrame(() => this.updateVisibleRange());
    }
    
    updateVisibleRange() {
        if (!this.items.length || !this.isInitialized || !this.container) return;
        
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
        if (!this.renderItem || !this.visibleContainer) {
            console.warn('No renderItem function provided or container missing');
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
                    // Remove any existing click listeners to prevent duplicates
                    const newRow = row.cloneNode(true);
                    row.parentNode?.replaceChild(newRow, row);
                    newRow.addEventListener('click', (e) => {
                        if (!e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu')) {
                            this.onItemClick(actualIndex);
                        }
                    });
                    this.visibleContainer.appendChild(newRow);
                    return;
                }
                
                this.visibleContainer.appendChild(row);
            }
        });
        
        // Clear old content and add new fragment
        this.visibleContainer.innerHTML = '';
        this.visibleContainer.appendChild(fragment);
    }
    
    scrollToIndex(index) {
        if (!this.items.length || index < 0 || index >= this.items.length) return;
        if (!this.isInitialized || !this.container) return;
        
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
        if (this.isInitialized) {
            this.updateVisibleRange();
        }
    }
    
    getCurrentItems() {
        return this.items;
    }
    
    isReady() {
        return this.isInitialized && this.container !== null;
    }
    
    destroy() {
        if (this.container && this.scrollHandler) {
            this.container.removeEventListener('scroll', this.scrollHandler);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.isInitialized = false;
        this.container = null;
    }
}