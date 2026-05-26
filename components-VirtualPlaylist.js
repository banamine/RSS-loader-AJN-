// ============ VIRTUALIZED PLAYLIST COMPONENT ============

class VirtualPlaylist {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.spacer = document.getElementById('scrollSpacer');
        this.virtualList = document.getElementById('virtualList');
        
        // Configuration
        this.rowHeight = options.rowHeight || 80;
        this.buffer = options.buffer || 5; // Extra rows above and below viewport
        this.items = [];
        this.currentIndex = -1;
        this.onItemClick = null;
        this.onScrollEnd = null;
        
        // Performance tracking
        this.scrollTimeout = null;
        this.lastScrollTop = 0;
        this.renderCount = 0;
        
        // Bind methods
        this.handleScroll = this.handleScroll.bind(this);
        this.handleKeyNavigation = this.handleKeyNavigation.bind(this);
        
        this.init();
    }
    
    init() {
        if (!this.container || !this.spacer || !this.virtualList) {
            console.error('Virtual list DOM elements not found');
            return;
        }
        
        // Setup scroll listener with passive option for performance
        this.container.addEventListener('scroll', this.handleScroll, { passive: true });
        this.container.addEventListener('keydown', this.handleKeyNavigation);
        
        // Initial render
        this.updateView();
    }
    
    setItems(items) {
        this.items = items;
        this.renderCount = 0;
        this.updateTotalHeight();
        this.updateView();
        this.scrollToIndex(this.currentIndex);
    }
    
    setCurrentIndex(index) {
        if (this.currentIndex !== index) {
            this.currentIndex = index;
            this.updateView();
            this.scrollToIndex(index);
        }
    }
    
    setOnItemClick(callback) {
        this.onItemClick = callback;
    }
    
    setOnScrollEnd(callback) {
        this.onScrollEnd = callback;
    }
    
    updateTotalHeight() {
        const totalHeight = this.items.length * this.rowHeight;
        this.spacer.style.height = `${totalHeight}px`;
    }
    
    handleScroll() {
        const scrollTop = this.container.scrollTop;
        
        // Detect scroll end for lazy loading
        const maxScroll = this.spacer.offsetHeight - this.container.clientHeight;
        if (scrollTop >= maxScroll - 100 && this.onScrollEnd) {
            this.onScrollEnd();
        }
        
        // Debounced scroll end detection
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        this.scrollTimeout = setTimeout(() => {
            if (this.onScrollEnd && scrollTop === this.lastScrollTop) {
                this.onScrollEnd();
            }
            this.lastScrollTop = scrollTop;
        }, 150);
        
        // Update view during scroll
        requestAnimationFrame(() => {
            this.updateView();
        });
    }
    
    updateView() {
        if (!this.items.length) {
            this.virtualList.innerHTML = this.getEmptyState();
            return;
        }
        
        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;
        
        // Calculate visible range
        const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.buffer);
        const endIndex = Math.min(
            this.items.length - 1,
            Math.floor((scrollTop + viewportHeight) / this.rowHeight) + this.buffer
        );
        
        // Performance tracking
        this.renderCount++;
        
        // Update transform for smooth scrolling
        const offsetY = startIndex * this.rowHeight;
        this.virtualList.style.transform = `translateY(${offsetY}px)`;
        
        // Get visible items
        const visibleItems = this.items.slice(startIndex, endIndex + 1);
        
        // Render only visible items
        this.virtualList.innerHTML = visibleItems.map((item, idx) => {
            const actualIndex = startIndex + idx;
            const isActive = actualIndex === this.currentIndex;
            return this.renderItem(item, actualIndex, isActive);
        }).join('');
        
        // Update ARIA attributes
        this.updateAriaAttributes();
    }
    
    renderItem(item, index, isActive) {
        const escapedTitle = this.escapeHtml(item.title);
        const escapedDate = this.escapeHtml(formatCentralTime(item.centralDate));
        const escapedShow = this.escapeHtml(item.show);
        const escapedHour = this.escapeHtml(item.hour);
        
        return `
            <div class="playlist-item ${isActive ? 'active' : ''}" 
                 data-index="${index}"
                 data-episode-id="${item.id}"
                 style="height: ${this.rowHeight}px"
                 tabindex="0"
                 role="button"
                 aria-label="Play episode: ${escapedTitle}"
                 aria-current="${isActive ? 'true' : 'false'}">
                <div class="playlist-thumbnail" aria-hidden="true">
                    🎬
                </div>
                <div class="playlist-info">
                    <div class="playlist-title">${escapedTitle}</div>
                    <div class="playlist-date">📅 ${escapedDate}</div>
                    <div class="playlist-duration">🎬 ${escapedShow} ${escapedHour}</div>
                </div>
            </div>
        `;
    }
    
    getEmptyState() {
        return `
            <div class="empty-state" style="padding: 40px; text-align: center;">
                <div>📭 No episodes found</div>
                <div style="font-size: 0.85rem; margin-top: 8px;">Try adjusting your filters</div>
            </div>
        `;
    }
    
    handleKeyNavigation(event) {
        // Keyboard navigation: Arrow Up/Down
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const newIndex = Math.min(this.currentIndex + 1, this.items.length - 1);
            if (newIndex !== this.currentIndex && this.onItemClick) {
                this.onItemClick(newIndex);
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const newIndex = Math.max(this.currentIndex - 1, 0);
            if (newIndex !== this.currentIndex && this.onItemClick) {
                this.onItemClick(newIndex);
            }
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (this.onItemClick && this.currentIndex !== -1) {
                this.onItemClick(this.currentIndex);
            }
        } else if (event.key === 'Home') {
            event.preventDefault();
            if (this.onItemClick && this.items.length > 0) {
                this.onItemClick(0);
            }
        } else if (event.key === 'End') {
            event.preventDefault();
            if (this.onItemClick && this.items.length > 0) {
                this.onItemClick(this.items.length - 1);
            }
        }
    }
    
    scrollToIndex(index, behavior = 'smooth') {
        if (index < 0 || index >= this.items.length) return;
        
        const targetScrollTop = index * this.rowHeight;
        const viewportHeight = this.container.clientHeight;
        
        // Ensure the item is visible
        const currentScrollTop = this.container.scrollTop;
        const itemTop = targetScrollTop;
        const itemBottom = targetScrollTop + this.rowHeight;
        
        if (itemTop < currentScrollTop || itemBottom > currentScrollTop + viewportHeight) {
            this.container.scrollTo({
                top: Math.max(0, targetScrollTop - viewportHeight / 2 + this.rowHeight / 2),
                behavior: behavior
            });
        }
    }
    
    updateAriaAttributes() {
        // Update aria-setsize and aria-posinset for accessibility
        const items = this.virtualList.querySelectorAll('.playlist-item');
        items.forEach((item, idx) => {
            const actualIndex = parseInt(item.getAttribute('data-index'));
            item.setAttribute('aria-setsize', this.items.length);
            item.setAttribute('aria-posinset', actualIndex + 1);
        });
    }
    
    refresh() {
        this.updateTotalHeight();
        this.updateView();
    }
    
    getVisibleRange() {
        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;
        const start = Math.floor(scrollTop / this.rowHeight);
        const end = Math.floor((scrollTop + viewportHeight) / this.rowHeight);
        return { start, end, count: end - start + 1 };
    }
    
    getPerformanceMetrics() {
        return {
            totalItems: this.items.length,
            renderCount: this.renderCount,
            visibleRange: this.getVisibleRange(),
            rowHeight: this.rowHeight,
            buffer: this.buffer
        };
    }
    
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    destroy() {
        this.container.removeEventListener('scroll', this.handleScroll);
        this.container.removeEventListener('keydown', this.handleKeyNavigation);
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualPlaylist;
}