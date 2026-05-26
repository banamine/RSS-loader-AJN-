import { formatCentralTime, escapeHtml } from '../utils/helpers.js';

// ============ VIRTUALIZED PLAYLIST COMPONENT ============

export class VirtualPlaylist {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.spacer = document.getElementById('scrollSpacer');
        this.virtualList = document.getElementById('virtualList');
        
        this.rowHeight = options.rowHeight || 80;
        this.buffer = options.buffer || 5;
        this.items = [];
        this.currentIndex = -1;
        this.activeFlyout = null;
        
        this.onItemClick = options.onItemClick || null;
        this.onDownload = options.onDownload || null;
        this.onShare = options.onShare || null;
        this.onCopyLink = options.onCopyLink || null;
        this.onViewDetails = options.onViewDetails || null;
        
        this.scrollTimeout = null;
        this.renderCount = 0;
        
        this.handleScroll = this.handleScroll.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        
        this.init();
    }
    
    init() {
        if (!this.container || !this.spacer || !this.virtualList) {
            console.error('Virtual list DOM elements not found');
            return;
        }
        
        this.container.addEventListener('scroll', this.handleScroll, { passive: true });
        document.addEventListener('click', this.handleClickOutside);
        this.updateView();
    }
    
    setItems(items) {
        this.items = items;
        this.renderCount = 0;
        this.updateTotalHeight();
        this.updateView();
    }
    
    setCurrentIndex(index) {
        if (this.currentIndex !== index) {
            this.currentIndex = index;
            this.updateView();
            this.scrollToIndex(index);
        }
    }
    
    updateTotalHeight() {
        const totalHeight = this.items.length * this.rowHeight;
        this.spacer.style.height = `${totalHeight}px`;
    }
    
    handleScroll() {
        if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            requestAnimationFrame(() => this.updateView());
        }, 16);
    }
    
    updateView() {
        if (!this.items.length) {
            this.virtualList.innerHTML = this.getEmptyState();
            return;
        }
        
        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;
        
        const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.buffer);
        const endIndex = Math.min(
            this.items.length - 1,
            Math.floor((scrollTop + viewportHeight) / this.rowHeight) + this.buffer
        );
        
        this.renderCount++;
        const offsetY = startIndex * this.rowHeight;
        this.virtualList.style.transform = `translateY(${offsetY}px)`;
        
        const visibleItems = this.items.slice(startIndex, endIndex + 1);
        this.virtualList.innerHTML = visibleItems.map((item, idx) => {
            const actualIndex = startIndex + idx;
            const isActive = actualIndex === this.currentIndex;
            return this.renderItem(item, actualIndex, isActive);
        }).join('');
    }
    
    renderItem(item, index, isActive) {
        const escapedTitle = escapeHtml(item.title);
        const escapedDate = escapeHtml(formatCentralTime(item.centralDate));
        const escapedShow = escapeHtml(item.show);
        const escapedHour = escapeHtml(item.hour);
        const flyoutId = `flyout-${index}`;
        
        return `
            <div class="playlist-item ${isActive ? 'active' : ''}" 
                 data-index="${index}"
                 style="height: ${this.rowHeight}px"
                 tabindex="0"
                 role="button"
                 aria-label="Play episode: ${escapedTitle}"
                 onclick="window.dispatchEvent(new CustomEvent('playEpisode', { detail: { index: ${index} } }))">
                
                <div class="menu-trigger" 
                     data-flyout="${flyoutId}"
                     onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('toggleFlyout', { detail: { index: ${index}, flyoutId: '${flyoutId}' } }))">
                    ⋮
                </div>
                
                <div class="flyout-menu" id="${flyoutId}" role="menu">
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('downloadEpisode', { detail: { index: ${index} } }))">⬇️ Download</div>
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('shareEpisode', { detail: { index: ${index} } }))">📤 Share</div>
                    <div class="flyout-menu-divider"></div>
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('copyLink', { detail: { index: ${index} } }))">🔗 Copy Link</div>
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('viewDetails', { detail: { index: ${index} } }))">📄 Details</div>
                </div>
                
                <div class="playlist-thumbnail" aria-hidden="true">🎬</div>
                <div class="playlist-info">
                    <div class="playlist-title">${escapedTitle}</div>
                    <div class="playlist-date">📅 ${escapedDate}</div>
                    <div class="playlist-duration">🎬 ${escapedShow} ${escapedHour}</div>
                </div>
            </div>
        `;
    }
    
    getEmptyState() {
        return `<div class="empty-state" style="padding: 40px; text-align: center;">📭 No episodes found</div>`;
    }
    
    toggleFlyout(index, flyoutId) {
        const menu = document.getElementById(flyoutId);
        if (!menu) return;
        
        document.querySelectorAll('.flyout-menu').forEach(f => {
            if (f.id !== flyoutId) f.classList.remove('active');
        });
        
        menu.classList.toggle('active');
    }
    
    closeAllFlyouts() {
        document.querySelectorAll('.flyout-menu').forEach(f => f.classList.remove('active'));
        this.activeFlyout = null;
    }
    
    handleClickOutside(event) {
        if (!event.target.closest('.menu-trigger') && !event.target.closest('.flyout-menu')) {
            this.closeAllFlyouts();
        }
    }
    
    scrollToIndex(index) {
        if (index < 0 || index >= this.items.length) return;
        const targetScrollTop = index * this.rowHeight;
        const viewportHeight = this.container.clientHeight;
        const currentScrollTop = this.container.scrollTop;
        
        if (targetScrollTop < currentScrollTop || targetScrollTop > currentScrollTop + viewportHeight - this.rowHeight) {
            this.container.scrollTo({
                top: Math.max(0, targetScrollTop - viewportHeight / 2 + this.rowHeight / 2),
                behavior: 'smooth'
            });
        }
    }
}

// Set up custom event listeners
window.addEventListener('playEpisode', (e) => {
    if (window.appCallbacks?.onPlayEpisode) window.appCallbacks.onPlayEpisode(e.detail.index);
});
window.addEventListener('toggleFlyout', (e) => {
    if (window.virtualPlaylistInstance) window.virtualPlaylistInstance.toggleFlyout(e.detail.index, e.detail.flyoutId);
});
window.addEventListener('downloadEpisode', (e) => {
    if (window.appCallbacks?.onDownload) window.appCallbacks.onDownload(e.detail.index);
});
window.addEventListener('shareEpisode', (e) => {
    if (window.appCallbacks?.onShare) window.appCallbacks.onShare(e.detail.index);
});
window.addEventListener('copyLink', (e) => {
    if (window.appCallbacks?.onCopyLink) window.appCallbacks.onCopyLink(e.detail.index);
});
window.addEventListener('viewDetails', (e) => {
    if (window.appCallbacks?.onViewDetails) window.appCallbacks.onViewDetails(e.detail.index);
});