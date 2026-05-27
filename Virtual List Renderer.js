// ============ VIRTUAL LIST RENDERER WITH DOCUMENT FRAGMENT ==========
// Performance-optimized renderer that uses DocumentFragment for batch DOM updates

import { escapeHtml, formatCentralTime, formatShortDate, formatTime } from './utils/helpers.js';

class VirtualListRenderer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.scrollSpacer = document.getElementById('scrollSpacer');
        this.virtualList = document.getElementById('virtualList');
        
        this.rowHeight = options.rowHeight || 80;
        this.buffer = options.buffer || 5;
        this.viewMode = options.viewMode || 'list';
        this.onItemClick = options.onItemClick || null;
        this.onDownload = options.onDownload || null;
        this.onShare = options.onShare || null;
        this.onAddToQueue = options.onAddToQueue || null;
        this.onClearResume = options.onClearResume || null;
        
        this.items = [];
        this.currentIndex = -1;
        this.playbackPositions = {};
        this.scrollTimeout = null;
        this.activeFlyoutCleanup = null;
        
        this.init();
    }
    
    init() {
        if (!this.container || !this.scrollSpacer || !this.virtualList) {
            console.error('Virtual list DOM elements not found');
            return;
        }
        
        this.container.addEventListener('scroll', () => {
            if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                if (this.viewMode !== 'grid') {
                    requestAnimationFrame(() => this.render());
                }
            }, 16);
        });
        
        this.render();
    }
    
    setItems(items, playbackPositions = {}) {
        this.items = items;
        this.playbackPositions = playbackPositions;
        this.render();
    }
    
    setCurrentIndex(index) {
        this.currentIndex = index;
        this.render();
    }
    
    setViewMode(mode) {
        this.viewMode = mode;
        this.container.classList.toggle('grid-view', mode === 'grid');
        this.rowHeight = mode === 'grid' ? 220 : 80;
        this.render();
    }
    
    getPlaybackPosition(episodeId) {
        const saved = this.playbackPositions[episodeId];
        return saved && saved.position ? saved.position : 0;
    }
    
    // Performance-optimized render using DocumentFragment
    render() {
        if (!this.items.length) {
            this.virtualList.innerHTML = '<div class="empty-state">📭 No episodes found</div>';
            if (this.viewMode !== 'grid') {
                this.scrollSpacer.style.height = '0px';
            }
            return;
        }
        
        const isGrid = this.viewMode === 'grid';
        
        if (isGrid) {
            this.virtualList.style.position = 'relative';
            this.virtualList.style.transform = 'none';
            this.scrollSpacer.style.display = 'none';
            
            // Use DocumentFragment for batch DOM operations
            const fragment = document.createDocumentFragment();
            
            this.items.forEach((ep, idx) => {
                const isActive = idx === this.currentIndex;
                const row = this.createGridItem(ep, idx, isActive);
                fragment.appendChild(row);
            });
            
            // Clear and append in one operation
            this.virtualList.innerHTML = '';
            this.virtualList.appendChild(fragment);
            
        } else {
            this.virtualList.style.position = 'absolute';
            this.scrollSpacer.style.display = 'block';
            
            const scrollTop = this.container.scrollTop;
            const viewportHeight = this.container.clientHeight;
            const totalHeight = this.items.length * this.rowHeight;
            this.scrollSpacer.style.height = `${totalHeight}px`;
            
            const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.buffer);
            const endIndex = Math.min(this.items.length - 1, Math.floor((scrollTop + viewportHeight) / this.rowHeight) + this.buffer);
            const offsetY = startIndex * this.rowHeight;
            this.virtualList.style.transform = `translateY(${offsetY}px)`;
            const visibleItems = this.items.slice(startIndex, endIndex + 1);
            
            // Use DocumentFragment for batch DOM operations
            const fragment = document.createDocumentFragment();
            
            visibleItems.forEach((ep, idx) => {
                const actualIndex = startIndex + idx;
                const isActive = actualIndex === this.currentIndex;
                const row = this.createListItem(ep, actualIndex, isActive);
                fragment.appendChild(row);
            });
            
            // Clear and append in one operation
            this.virtualList.innerHTML = '';
            this.virtualList.appendChild(fragment);
        }
    }
    
    createListItem(episode, index, isActive) {
        const escapedTitle = escapeHtml(episode.title);
        const escapedDate = escapeHtml(formatCentralTime(episode.centralDate));
        const escapedShow = escapeHtml(episode.show);
        const escapedHour = escapeHtml(episode.hour);
        const flyoutId = `flyout-${index}`;
        const savedPosition = this.getPlaybackPosition(episode.id);
        const hasResume = savedPosition > 0;
        const resumeTime = savedPosition ? formatTime(savedPosition) : '';
        
        const div = document.createElement('div');
        div.className = `playlist-item list-item ${isActive ? 'active' : ''} ${hasResume ? 'has-resume' : ''}`;
        div.setAttribute('data-index', index);
        div.setAttribute('data-episode-id', episode.id);
        
        // Build inner HTML safely
        div.innerHTML = `
            <div class="menu-trigger" data-flyout="${flyoutId}" 
                 role="button" tabindex="0"
                 aria-label="More options for ${escapedTitle}"
                 aria-haspopup="true" aria-expanded="false">⋮</div>
            <div class="flyout-menu" id="${flyoutId}" role="menu">
                <div class="flyout-menu-item" data-action="download" data-index="${index}">⬇️ Download</div>
                <div class="flyout-menu-item" data-action="share" data-index="${index}">📤 Share</div>
                <div class="flyout-menu-item" data-action="addToQueue" data-index="${index}">📋 Add to Queue</div>
                ${hasResume ? `<div class="flyout-menu-item" data-action="clearResume" data-episode-id="${episode.id}">🗑️ Clear Resume Point</div>` : ''}
                <div class="flyout-menu-divider"></div>
                <div class="flyout-menu-item" data-action="viewDetails" data-index="${index}">📄 Details</div>
            </div>
            <div class="playlist-thumbnail">🎬</div>
            <div class="playlist-info">
                <div class="playlist-title">${escapedTitle}${hasResume ? `<span class="resume-indicator">▶ Resume ${resumeTime}</span>` : ''}</div>
                <div class="playlist-date">📅 ${escapedDate}</div>
                <div class="playlist-duration">🎬 ${escapedShow} ${escapedHour}</div>
            </div>
            <button class="add-to-queue-btn" data-action="addToQueue" data-index="${index}">📋 Add</button>
        `;
        
        // Add click handler for the item
        div.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-trigger') && 
                !e.target.closest('.flyout-menu') && 
                !e.target.closest('.add-to-queue-btn')) {
                if (this.onItemClick) this.onItemClick(index);
            }
        });
        
        // Add menu trigger handler
        const menuTrigger = div.querySelector('.menu-trigger');
        if (menuTrigger) {
            menuTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFlyout(flyoutId, menuTrigger);
            });
        }
        
        // Add action button handlers
        const actionBtns = div.querySelectorAll('[data-action]');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                const btnIndex = parseInt(btn.getAttribute('data-index'), 10);
                const episodeId = btn.getAttribute('data-episode-id');
                
                switch(action) {
                    case 'download':
                        if (this.onDownload) this.onDownload(btnIndex);
                        break;
                    case 'share':
                        if (this.onShare) this.onShare(btnIndex);
                        break;
                    case 'addToQueue':
                        if (this.onAddToQueue) this.onAddToQueue(btnIndex);
                        break;
                    case 'clearResume':
                        if (this.onClearResume && episodeId) this.onClearResume(episodeId);
                        break;
                    case 'viewDetails':
                        if (this.onViewDetails) this.onViewDetails(btnIndex);
                        break;
                }
                this.closeAllFlyouts();
            });
        });
        
        return div;
    }
    
    createGridItem(episode, index, isActive) {
        const escapedTitle = escapeHtml(episode.title);
        const escapedShortDate = escapeHtml(formatShortDate(episode.centralDate));
        const escapedShow = escapeHtml(episode.show);
        const escapedHour = escapeHtml(episode.hour);
        const flyoutId = `flyout-${index}`;
        const savedPosition = this.getPlaybackPosition(episode.id);
        const hasResume = savedPosition > 0;
        const resumeTime = savedPosition ? formatTime(savedPosition) : '';
        
        const div = document.createElement('div');
        div.className = `playlist-item grid-item ${isActive ? 'active' : ''}`;
        div.setAttribute('data-index', index);
        div.setAttribute('data-episode-id', episode.id);
        
        div.innerHTML = `
            <div class="menu-trigger" data-flyout="${flyoutId}" 
                 role="button" tabindex="0"
                 aria-label="More options for ${escapedTitle}"
                 aria-haspopup="true" aria-expanded="false">⋮</div>
            <div class="flyout-menu" id="${flyoutId}" role="menu">
                <div class="flyout-menu-item" data-action="download" data-index="${index}">⬇️ Download</div>
                <div class="flyout-menu-item" data-action="share" data-index="${index}">📤 Share</div>
                <div class="flyout-menu-item" data-action="addToQueue" data-index="${index}">📋 Add to Queue</div>
                <div class="flyout-menu-divider"></div>
                <div class="flyout-menu-item" data-action="viewDetails" data-index="${index}">📄 Details</div>
            </div>
            <div class="grid-thumbnail">🎬</div>
            <div class="grid-title">${escapedTitle}</div>
            <div class="grid-date">📅 ${escapedShortDate}</div>
            <div class="grid-duration">🎬 ${escapedShow} ${escapedHour}</div>
            ${hasResume ? `<span class="resume-indicator">▶ Resume ${resumeTime}</span>` : ''}
            <button class="add-to-queue-btn" data-action="addToQueue" data-index="${index}">📋 Add</button>
        `;
        
        // Add click handler for the item
        div.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-trigger') && 
                !e.target.closest('.flyout-menu') && 
                !e.target.closest('.add-to-queue-btn')) {
                if (this.onItemClick) this.onItemClick(index);
            }
        });
        
        // Add menu trigger handler
        const menuTrigger = div.querySelector('.menu-trigger');
        if (menuTrigger) {
            menuTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFlyout(flyoutId, menuTrigger);
            });
        }
        
        // Add action button handlers
        const actionBtns = div.querySelectorAll('[data-action]');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                const btnIndex = parseInt(btn.getAttribute('data-index'), 10);
                
                switch(action) {
                    case 'download':
                        if (this.onDownload) this.onDownload(btnIndex);
                        break;
                    case 'share':
                        if (this.onShare) this.onShare(btnIndex);
                        break;
                    case 'addToQueue':
                        if (this.onAddToQueue) this.onAddToQueue(btnIndex);
                        break;
                    case 'viewDetails':
                        if (this.onViewDetails) this.onViewDetails(btnIndex);
                        break;
                }
                this.closeAllFlyouts();
            });
        });
        
        return div;
    }
    
    toggleFlyout(flyoutId, trigger) {
        const menu = document.getElementById(flyoutId);
        if (!menu) return;
        
        document.querySelectorAll('.flyout-menu').forEach(f => {
            if (f.id !== flyoutId && f.classList.contains('active')) {
                f.classList.remove('active');
                const oldTrigger = document.querySelector(`.menu-trigger[data-flyout="${f.id}"]`);
                if (oldTrigger) oldTrigger.setAttribute('aria-expanded', 'false');
            }
        });
        
        menu.classList.toggle('active');
        trigger.setAttribute('aria-expanded', menu.classList.contains('active'));
        
        if (menu.classList.contains('active')) {
            const menuItems = menu.querySelectorAll('.flyout-menu-item');
            if (menuItems.length > 0) {
                menuItems[0].focus();
            }
        }
    }
    
    closeAllFlyouts() {
        document.querySelectorAll('.flyout-menu').forEach(menu => {
            menu.classList.remove('active');
            const trigger = document.querySelector(`.menu-trigger[data-flyout="${menu.id}"]`);
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
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
    
    setCallbacks(callbacks) {
        this.onItemClick = callbacks.onItemClick;
        this.onDownload = callbacks.onDownload;
        this.onShare = callbacks.onShare;
        this.onAddToQueue = callbacks.onAddToQueue;
        this.onClearResume = callbacks.onClearResume;
        this.onViewDetails = callbacks.onViewDetails;
    }
}

export default VirtualListRenderer;