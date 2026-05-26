// ============ VIRTUALIZED PLAYLIST COMPONENT WITH FLYOUT ============

class VirtualPlaylist {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.spacer = document.getElementById('scrollSpacer');
        this.virtualList = document.getElementById('virtualList');
        
        // Configuration
        this.rowHeight = options.rowHeight || 80;
        this.buffer = options.buffer || 5;
        this.items = [];
        this.currentIndex = -1;
        this.onItemClick = null;
        this.onScrollEnd = null;
        this.onDownload = null;
        this.onShare = null;
        this.onAddToPlaylist = null;
        this.onRemoveFromPlaylist = null;
        
        // Performance tracking
        this.scrollTimeout = null;
        this.lastScrollTop = 0;
        this.renderCount = 0;
        this.activeFlyout = null;
        
        // Bind methods
        this.handleScroll = this.handleScroll.bind(this);
        this.handleKeyNavigation = this.handleKeyNavigation.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        
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
        document.addEventListener('click', this.handleClickOutside);
        
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
    
    setOnDownload(callback) {
        this.onDownload = callback;
    }
    
    setOnShare(callback) {
        this.onShare = callback;
    }
    
    setOnAddToPlaylist(callback) {
        this.onAddToPlaylist = callback;
    }
    
    setOnRemoveFromPlaylist(callback) {
        this.onRemoveFromPlaylist = callback;
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
        
        // Close any open flyout on scroll
        if (this.activeFlyout) {
            this.closeFlyout(this.activeFlyout);
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
        
        // Generate unique IDs for flyout menu
        const flyoutId = `flyout-${index}`;
        
        // Build menu HTML with all options
        const menuHtml = `
            <div class="menu-trigger" 
                 data-flyout="${flyoutId}"
                 data-index="${index}"
                 onclick="event.stopPropagation(); window.toggleFlyout(event, ${index})"
                 onkeypress="if(event.key==='Enter' || event.key===' ') window.toggleFlyout(event, ${index})"
                 role="button"
                 tabindex="0"
                 aria-label="More options for ${escapedTitle}"
                 aria-expanded="false"
                 aria-haspopup="true">
                ⋮
            </div>
            <div class="flyout-menu" 
                 id="${flyoutId}"
                 role="menu"
                 aria-label="Episode actions"
                 data-index="${index}">
                <div class="flyout-menu-item" 
                     role="menuitem"
                     tabindex="0"
                     onclick="event.stopPropagation(); window.downloadEpisodeByIndex(${index})"
                     onkeypress="if(event.key==='Enter') window.downloadEpisodeByIndex(${index})">
                    ⬇️ Download
                </div>
                <div class="flyout-menu-item" 
                     role="menuitem"
                     tabindex="0"
                     onclick="event.stopPropagation(); window.shareEpisodeByIndex(${index})"
                     onkeypress="if(event.key==='Enter') window.shareEpisodeByIndex(${index})">
                    📤 Share
                </div>
                <div class="flyout-menu-divider" role="separator"></div>
                <div class="flyout-menu-item" 
                     role="menuitem"
                     tabindex="0"
                     onclick="event.stopPropagation(); window.copyLink(${index})"
                     onkeypress="if(event.key==='Enter') window.copyLink(${index})">
                    🔗 Copy Link
                </div>
                <div class="flyout-menu-item" 
                     role="menuitem"
                     tabindex="0"
                     onclick="event.stopPropagation(); window.viewDetails(${index})"
                     onkeypress="if(event.key==='Enter') window.viewDetails(${index})">
                    📄 Details
                </div>
            </div>
        `;
        
        return `
            <div class="playlist-item ${isActive ? 'active' : ''}" 
                 data-index="${index}"
                 data-episode-id="${item.id}"
                 style="height: ${this.rowHeight}px"
                 tabindex="0"
                 role="button"
                 aria-label="Play episode: ${escapedTitle}"
                 aria-current="${isActive ? 'true' : 'false'}">
                ${menuHtml}
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
    
    toggleFlyout(event, index) {
        event.stopPropagation();
        
        const flyoutId = `flyout-${index}`;
        const menu = document.getElementById(flyoutId);
        
        if (!menu) return;
        
        // Close other open menus first
        const allFlyouts = document.querySelectorAll('.flyout-menu');
        allFlyouts.forEach(f => {
            if (f.id !== flyoutId && f.classList.contains('active')) {
                f.classList.remove('active');
                // Update aria-expanded on corresponding trigger
                const trigger = document.querySelector(`.menu-trigger[data-flyout="${f.id}"]`);
                if (trigger) {
                    trigger.setAttribute('aria-expanded', 'false');
                }
            }
        });
        
        // Toggle current menu
        const isActive = menu.classList.contains('active');
        menu.classList.toggle('active');
        
        // Update aria-expanded on trigger
        const trigger = document.querySelector(`.menu-trigger[data-flyout="${flyoutId}"]`);
        if (trigger) {
            trigger.setAttribute('aria-expanded', !isActive);
        }
        
        // Store active flyout
        this.activeFlyout = isActive ? null : flyoutId;
        
        // If menu was activated, add focus to first item
        if (!isActive) {
            const firstItem = menu.querySelector('.flyout-menu-item');
            if (firstItem) {
                setTimeout(() => firstItem.focus(), 0);
            }
        }
    }
    
    closeFlyout(flyoutId) {
        const menu = document.getElementById(flyoutId);
        if (menu && menu.classList.contains('active')) {
            menu.classList.remove('active');
            const trigger = document.querySelector(`.menu-trigger[data-flyout="${flyoutId}"]`);
            if (trigger) {
                trigger.setAttribute('aria-expanded', 'false');
            }
        }
        if (this.activeFlyout === flyoutId) {
            this.activeFlyout = null;
        }
    }
    
    closeAllFlyouts() {
        const allFlyouts = document.querySelectorAll('.flyout-menu');
        allFlyouts.forEach(f => {
            f.classList.remove('active');
            const trigger = document.querySelector(`.menu-trigger[data-flyout="${f.id}"]`);
            if (trigger) {
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
        this.activeFlyout = null;
    }
    
    handleClickOutside(event) {
        // Check if click is outside any flyout menu
        const isClickInsideFlyout = event.target.closest('.flyout-menu');
        const isClickOnTrigger = event.target.closest('.menu-trigger');
        
        if (!isClickInsideFlyout && !isClickOnTrigger) {
            this.closeAllFlyouts();
        }
    }
    
    handleKeyNavigation(event) {
        // Arrow navigation for playlist
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const newIndex = Math.min(this.currentIndex + 1, this.items.length - 1);
            if (newIndex !== this.currentIndex && this.onItemClick) {
                this.onItemClick(newIndex);
                this.scrollToIndex(newIndex);
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const newIndex = Math.max(this.currentIndex - 1, 0);
            if (newIndex !== this.currentIndex && this.onItemClick) {
                this.onItemClick(newIndex);
                this.scrollToIndex(newIndex);
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
                this.scrollToIndex(0);
            }
        } else if (event.key === 'End') {
            event.preventDefault();
            if (this.onItemClick && this.items.length > 0) {
                this.onItemClick(this.items.length - 1);
                this.scrollToIndex(this.items.length - 1);
            }
        } else if (event.key === 'Escape') {
            // Close flyout on escape
            this.closeAllFlyouts();
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
        document.removeEventListener('click', this.handleClickOutside);
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
    }
}

// Make flyout functions globally available
window.toggleFlyout = (event, index) => {
    if (window.virtualPlaylist) {
        window.virtualPlaylist.toggleFlyout(event, index);
    }
};

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualPlaylist;
}