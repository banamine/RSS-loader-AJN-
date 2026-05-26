// In renderItem() - menu trigger click handler
<div class="menu-trigger" 
     onclick="event.stopPropagation(); window.toggleFlyout(event, ${index})"
     onkeypress="if(event.key==='Enter' || event.key===' ') event.stopPropagation(); window.toggleFlyout(event, ${index})">

// In flyout menu items
<div class="flyout-menu-item" 
     onclick="event.stopPropagation(); window.downloadEpisodeByIndex(${index})"
     onkeypress="if(event.key==='Enter') { event.stopPropagation(); window.downloadEpisodeByIndex(${index}); }">

// In toggleFlyout function
function toggleFlyout(event, index) {
    event.stopPropagation();  // Prevents bubbling to playlist-item
    // ... rest of function
}