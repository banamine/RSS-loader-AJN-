// ============ VIRTUAL LIST COMPONENT - WITH CONFIG ==========
import { CONFIG, ROW_HEIGHT, BUFFER } from '../config.js';

export class VirtualList {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.rowHeight = options.rowHeight || ROW_HEIGHT;
        this.buffer = options.buffer || BUFFER;
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
        this.maxRetries = CONFIG.PERFORMANCE.MAX_RETRIES;
        this.focusedIndex = -1;
        
        this.init();
    }
    
    init() {
        this.container = document.getElementById(this.containerId);
        
        if (!this.container) {
            this.retryCount++;
            if (this.retryCount <= this.maxRetries) {
                setTimeout(() => this.init(), CONFIG.PERFORMANCE.RETRY_DELAY);
            } else {
                console.error(`Container "${this.containerId}" not found after ${this.maxRetries} attempts`);
            }
            return;
        }
        
        console.log(`Container "${this.containerId}" found, initializing VirtualList...`);
        
        this.spacer = document.createElement('div');
        this.spacer.style.position = 'relative';
        this.spacer.style.width = '100%';
        
        this.visibleContainer = document.createElement('div');
        this.visibleContainer.style.position = 'absolute';
        this.visibleContainer.style.top = '0';
        this.visibleContainer.style.left = '0';
        this.visibleContainer.style.width = '100%';
        
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        this.container.style.flex = '1';
        this.container.style.minHeight = '0';
        
        this.container.appendChild(this.spacer);
        this.container.appendChild(this.visibleContainer);
        
        this.scrollHandler = this.handleScroll.bind(this);
        this.container.addEventListener('scroll', this.scrollHandler);
        
        this.resizeObserver = new ResizeObserver(() => {
            if (this.isInitialized) this.updateVisibleRange();
        });
        this.resizeObserver.observe(this.container);
        
        this.isInitialized = true;
        console.log('VirtualList initialized successfully');
        
        if (this.items && this.items.length > 0) {
            this.setItems(this.items);
        }
    }
    
    setItems(items) {
        this.items = items || [];
        this.focusedIndex = -1;
        
        if (!this.isInitialized) {
            console.log(`VirtualList not ready yet, storing ${this.items.length} items`);
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
        if (!this.renderItem || !this.visibleContainer) return;
        
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
                
                if (actualIndex === this.focusedIndex) {
                    row.style.outline = '2px solid var(--primary)';
                    row.style.outlineOffset = '2px';
                    row.setAttribute('aria-selected', 'true');
                } else {
                    row.style.outline = '';
                    row.style.outlineOffset = '';
                    row.setAttribute('aria-selected', 'false');
                }
                
                if (this.onItemClick) {
                    row.addEventListener('click', (e) => {
                        if (!e.target.closest('.menu-trigger') && !e.target.closest('.flyout-menu')) {
                            this.setFocusedIndex(actualIndex);
                            this.onItemClick(actualIndex);
                        }
                    });
                }
                
                fragment.appendChild(row);
            }
        });
        
        this.visibleContainer.innerHTML = '';
        this.visibleContainer.appendChild(fragment);
    }
    
    // Keyboard navigation methods
    setFocusedIndex(index) {
        if (index < 0 || index >= this.items.length) return;
        this.focusedIndex = index;
        this.renderVisibleItems();
        this.scrollToIndex(index);
    }
    
    moveFocus(delta) {
        const newIndex = this.focusedIndex + delta;
        if (newIndex >= 0 && newIndex < this.items.length) {
            this.setFocusedIndex(newIndex);
            return true;
        }
        return false;
    }
    
    moveFocusToStart() {
        if (this.items.length > 0) {
            this.setFocusedIndex(0);
        }
    }
    
    moveFocusToEnd() {
        if (this.items.length > 0) {
            this.setFocusedIndex(this.items.length - 1);
        }
    }
    
    playActive() {
        if (this.focusedIndex !== -1 && this.onItemClick) {
            this.onItemClick(this.focusedIndex);
        }
    }
    
    getFocusedIndex() {
        return this.focusedIndex;
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