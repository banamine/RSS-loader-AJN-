// Inside VirtualPlaylist class - renderItem method
renderItem(item, index, isActive) {
    const escapedTitle = this.escapeHtml(item.title);
    const escapedDate = this.escapeHtml(formatCentralTime(item.centralDate));
    const escapedShow = this.escapeHtml(item.show);
    const escapedHour = this.escapeHtml(item.hour);
    const flyoutId = `flyout-${index}`;
    
    const menuHtml = `
        <div class="menu-trigger" 
             data-flyout="${flyoutId}"
             data-index="${index}"
             onclick="event.stopPropagation(); window.toggleFlyout(event, ${index})"
             onkeypress="if(event.key==='Enter' || event.key===' ') { event.stopPropagation(); window.toggleFlyout(event, ${index}); }"
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
                 onkeypress="if(event.key==='Enter') { event.stopPropagation(); window.downloadEpisodeByIndex(${index}); }">
                ⬇️ Download
            </div>
            <div class="flyout-menu-item" 
                 role="menuitem"
                 tabindex="0"
                 onclick="event.stopPropagation(); window.shareEpisodeByIndex(${index})"
                 onkeypress="if(event.key==='Enter') { event.stopPropagation(); window.shareEpisodeByIndex(${index}); }">
                📤 Share
            </div>
            <div class="flyout-menu-divider" role="separator"></div>
            <div class="flyout-menu-item" 
                 role="menuitem"
                 tabindex="0"
                 onclick="event.stopPropagation(); window.copyLink(${index})"
                 onkeypress="if(event.key==='Enter') { event.stopPropagation(); window.copyLink(${index}); }">
                🔗 Copy Link
            </div>
            <div class="flyout-menu-item" 
                 role="menuitem"
                 tabindex="0"
                 onclick="event.stopPropagation(); window.viewDetails(${index})"
                 onkeypress="if(event.key==='Enter') { event.stopPropagation(); window.viewDetails(${index}); }">
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
            <div class="playlist-thumbnail" aria-hidden="true">🎬</div>
            <div class="playlist-info">
                <div class="playlist-title">${escapedTitle}</div>
                <div class="playlist-date">📅 ${escapedDate}</div>
                <div class="playlist-duration">🎬 ${escapedShow} ${escapedHour}</div>
            </div>
        </div>
    `;
}

// toggleFlyout method with event.stopPropagation()
toggleFlyout(event, index) {
    event.stopPropagation();  // CRITICAL: Prevents bubbling to playlist-item
    
    const flyoutId = `flyout-${index}`;
    const menu = document.getElementById(flyoutId);
    
    if (!menu) return;
    
    // Close other open menus
    document.querySelectorAll('.flyout-menu').forEach(f => {
        if (f.id !== flyoutId && f.classList.contains('active')) {
            f.classList.remove('active');
            const trigger = document.querySelector(`.menu-trigger[data-flyout="${f.id}"]`);
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }
    });
    
    // Toggle current menu
    const isActive = menu.classList.contains('active');
    menu.classList.toggle('active');
    
    // Update aria-expanded
    const trigger = document.querySelector(`.menu-trigger[data-flyout="${flyoutId}"]`);
    if (trigger) trigger.setAttribute('aria-expanded', !isActive);
    
    // Focus first item when opening
    if (!isActive) {
        const firstItem = menu.querySelector('.flyout-menu-item');
        if (firstItem) setTimeout(() => firstItem.focus(), 0);
    }
}