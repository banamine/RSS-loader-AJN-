// ============ VIRTUAL PLAYLIST COMPONENT ==========
import { formatCentralTime, formatShortDate, formatTime, escapeHtml, getPlaybackPosition, trapFocus } from '../utils/helpers.js';

export class VirtualPlaylist {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.spacer = document.getElementById('scrollSpacer');
        this.virtualList = document.getElementById('virtualList');
        
        this.items = [];
        this.currentIndex = -1;
        this.rowHeight = options.rowHeight || 80;
        this.buffer = options.buffer || 5;
        this.viewMode = options.viewMode || 'list';
        this.onItemClick = null;
        this.onDownload = null;
        this.onShare = null;
        this.onAddToQueue = null;
        this.onClearResume = null;
        
        this.activeFlyoutCleanup = null;
        this.scrollTimeout = null;
        
        this.init();
    }
    
    init() {
        if (!this.container || !this.spacer || !this.virtualList) {
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
    
    setItems(items) {
        this.items = items;
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
    
    setCallbacks(callbacks) {
        this.onItemClick = callbacks.onItemClick;
        this.onDownload = callbacks.onDownload;
        this.onShare = callbacks.onShare;
        this.onAddToQueue = callbacks.onAddToQueue;
        this.onClearResume = callbacks.onClearResume;
    }
    
    render() {
        if (!this.items.length) {
            this.virtualList.innerHTML = '<div class="empty-state">📭 No episodes found</div>';
            if (this.viewMode !== 'grid') {
                this.spacer.style.height = '0px';
            }
            return;
        }
        
        const isGrid = this.viewMode === 'grid';
        
        if (isGrid) {
            this.virtualList.style.position = 'relative';
            this.virtualList.style.transform = 'none';
            this.spacer.style.display = 'none';
            
            this.virtualList.innerHTML = this.items.map((ep, idx) => {
                const isActive = idx === this.currentIndex;
                return this.renderGridItem(ep, idx, isActive);
            }).join('');
        } else {
            this.virtualList.style.position = 'absolute';
            this.spacer.style.display = 'block';
            
            const scrollTop = this.container.scrollTop;
            const viewportHeight = this.container.clientHeight;
            const totalHeight = this.items.length * this.rowHeight;
            this.spacer.style.height = `${totalHeight}px`;
            
            const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.buffer);
            const endIndex = Math.min(this.items.length - 1, Math.floor((scrollTop + viewportHeight) / this.rowHeight) + this.buffer);
            const offsetY = startIndex * this.rowHeight;
            this.virtualList.style.transform = `translateY(${offsetY}px)`;
            const visibleItems = this.items.slice(startIndex, endIndex + 1);
            
            this.virtualList.innerHTML = visibleItems.map((ep, idx) => {
                const actualIndex = startIndex + idx;
                const isActive = actualIndex === this.currentIndex;
                return this.renderListItem(ep, actualIndex, isActive);
            }).join('');
        }
    }
    
    renderListItem(episode, index, isActive) {
        const escapedTitle = escapeHtml(episode.title);
        const escapedDate = escapeHtml(formatCentralTime(episode.centralDate));
        const escapedShow = escapeHtml(episode.show);
        const escapedHour = escapeHtml(episode.hour);
        const flyoutId = `flyout-${index}`;
        const savedPosition = getPlaybackPosition(episode.id);
        const hasResume = savedPosition > 0;
        const resumeTime = savedPosition ? formatTime(savedPosition) : '';
        
        return `
            <div class="playlist-item list-item ${isActive ? 'active' : ''} ${hasResume ? 'has-resume' : ''}" 
                 data-index="${index}"
                 data-episode-id="${episode.id}">
                <div class="menu-trigger" data-flyout="${flyoutId}" 
                     onclick="event.stopPropagation(); window.toggleFlyout(event, ${index}, this)"
                     role="button" tabindex="0"
                     aria-label="More options for ${escapedTitle}"
                     aria-haspopup="true" aria-expanded="false">⋮</div>
                <div class="flyout-menu" id="${flyoutId}" role="menu">
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); if(window.onDownload) window.onDownload(${index})">⬇️ Download</div>
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); if(window.onShare) window.onShare(${index})">📤 Share</div>
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); if(window.onAddToQueue) window.onAddToQueue(${index})">📋 Add to Queue</div>
                    ${hasResume ? `<div class="flyout-menu-item" onclick="event.stopPropagation(); if(window.onClearResume) window.onClearResume(${episode.id})">🗑️ Clear Resume Point</div>` : ''}
                    <div class="flyout-menu-divider"></div>
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); window.onViewDetails(${index})">📄 Details</div>
                </div>
                <div class="playlist-thumbnail">🎬</div>
                <div class="playlist-info" onclick="if(window.onItemClick) window.onItemClick(${index})">
                    <div class="playlist-title">${escapedTitle}${hasResume ? `<span class="resume-indicator">▶ Resume ${resumeTime}</span>` : ''}</div>
                    <div class="playlist-date">📅 ${escapedDate}</div>
                    <div class="playlist-duration">🎬 ${escapedShow} ${escapedHour}</div>
                </div>
                <button class="add-to-queue-btn" onclick="event.stopPropagation(); if(window.onAddToQueue) window.onAddToQueue(${index})">📋 Add</button>
            </div>
        `;
    }
    
    renderGridItem(episode, index, isActive) {
        const escapedTitle = escapeHtml(episode.title);
        const escapedShortDate = escapeHtml(formatShortDate(episode.centralDate));
        const escapedShow = escapeHtml(episode.show);
        const escapedHour = escapeHtml(episode.hour);
        const flyoutId = `flyout-${index}`;
        const savedPosition = getPlaybackPosition(episode.id);
        const hasResume = savedPosition > 0;
        const resumeTime = savedPosition ? formatTime(savedPosition) : '';
        
        return `
            <div class="playlist-item grid-item ${isActive ? 'active' : ''}" data-index="${index}" data-episode-id="${episode.id}">
                <div class="menu-trigger" data-flyout="${flyoutId}" 
                     onclick="event.stopPropagation(); window.toggleFlyout(event, ${index}, this)"
                     role="button" tabindex="0"
                     aria-label="More options for ${escapedTitle}"
                     aria-haspopup="true" aria-expanded="false">⋮</div>
                <div class="flyout-menu" id="${flyoutId}" role="menu">
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); if(window.onDownload) window.onDownload(${index})">⬇️ Download</div>
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); if(window.onShare) window.onShare(${index})">📤 Share</div>
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); if(window.onAddToQueue) window.onAddToQueue(${index})">📋 Add to Queue</div>
                    <div class="flyout-menu-divider"></div>
                    <div class="flyout-menu-item" onclick="event.stopPropagation(); window.onViewDetails(${index})">📄 Details</div>
                </div>
                <div class="grid-thumbnail" onclick="if(window.onItemClick) window.onItemClick(${index})">🎬</div>
                <div class="grid-title" onclick="if(window.onItemClick) window.onItemClick(${index})">${escapedTitle}</div>
                <div class="grid-date" onclick="if(window.onItemClick) window.onItemClick(${index})">📅 ${escapedShortDate}</div>
                <div class="grid-duration" onclick="if(window.onItemClick) window.onItemClick(${index})">🎬 ${escapedShow} ${escapedHour}</div>
                ${hasResume ? `<span class="resume-indicator">▶ Resume ${resumeTime}</span>` : ''}
                <button class="add-to-queue-btn" onclick="event.stopPropagation(); if(window.onAddToQueue) window.onAddToQueue(${index})">📋 Add</button>
            </div>
        `;
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
    
    closeAllFlyouts() {
        document.querySelectorAll('.flyout-menu').forEach(menu => {
            menu.classList.remove('active');
            const trigger = document.querySelector(`.menu-trigger[data-flyout="${menu.id}"]`);
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
        if (this.activeFlyoutCleanup) {
            this.activeFlyoutCleanup();
            this.activeFlyoutCleanup = null;
        }
    }
    
    toggleFlyout(event, index, triggerElement) {
        event.stopPropagation();
        const flyoutId = `flyout-${index}`;
        const menu = document.getElementById(flyoutId);
        const trigger = triggerElement || document.querySelector(`.menu-trigger[data-flyout="${flyoutId}"]`);
        
        if (!menu) return;
        
        document.querySelectorAll('.flyout-menu').forEach(f => {
            if (f.id !== flyoutId && f.classList.contains('active')) {
                f.classList.remove('active');
                const oldTrigger = document.querySelector(`.menu-trigger[data-flyout="${f.id}"]`);
                if (oldTrigger) oldTrigger.setAttribute('aria-expanded', 'false');
            }
        });
        
        menu.classList.toggle('active');
        if (trigger) trigger.setAttribute('aria-expanded', menu.classList.contains('active'));
        
        if (menu.classList.contains('active')) {
            const menuItems = menu.querySelectorAll('.flyout-menu-item');
            if (menuItems.length > 0) {
                menuItems[0].focus();
                if (this.activeFlyoutCleanup) this.activeFlyoutCleanup();
                this.activeFlyoutCleanup = trapFocus(menu);
            }
        } else {
            if (this.activeFlyoutCleanup) {
                this.activeFlyoutCleanup();
                this.activeFlyoutCleanup = null;
            }
            if (trigger && trigger.focus) trigger.focus();
        }
    }
}