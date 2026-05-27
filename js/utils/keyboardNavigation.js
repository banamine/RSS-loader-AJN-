// ============ KEYBOARD NAVIGATION UTILITY ==========
// Provides keyboard-only navigation for the playlist

export class KeyboardNavigation {
    constructor(virtualList, options = {}) {
        this.virtualList = virtualList;
        this.onSelect = options.onSelect || null;
        this.currentFocusIndex = -1;
        this.isEnabled = false;
    }
    
    enable() {
        if (this.isEnabled) return;
        this.isEnabled = true;
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        console.log('Keyboard navigation enabled');
    }
    
    disable() {
        if (!this.isEnabled) return;
        this.isEnabled = false;
        document.removeEventListener('keydown', this.handleKeydown.bind(this));
        this.clearFocus();
    }
    
    handleKeydown(event) {
        // Only handle if no input/textarea is focused
        const activeElement = document.activeElement;
        if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
            return;
        }
        
        const items = this.virtualList?.getCurrentItems() || [];
        if (items.length === 0) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.moveFocus(1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.moveFocus(-1);
                break;
            case 'Enter':
            case ' ':
                if (this.currentFocusIndex !== -1) {
                    event.preventDefault();
                    this.selectCurrent();
                }
                break;
            case 'Home':
                event.preventDefault();
                this.moveFocusToStart();
                break;
            case 'End':
                event.preventDefault();
                this.moveFocusToEnd();
                break;
            case 'Escape':
                event.preventDefault();
                this.clearFocus();
                break;
        }
    }
    
    moveFocus(delta) {
        const items = this.virtualList?.getCurrentItems() || [];
        if (items.length === 0) return;
        
        const newIndex = this.currentFocusIndex + delta;
        if (newIndex >= 0 && newIndex < items.length) {
            this.setFocus(newIndex);
            this.virtualList?.scrollToIndex(newIndex);
        }
    }
    
    moveFocusToStart() {
        this.setFocus(0);
        this.virtualList?.scrollToIndex(0);
    }
    
    moveFocusToEnd() {
        const items = this.virtualList?.getCurrentItems() || [];
        if (items.length > 0) {
            this.setFocus(items.length - 1);
            this.virtualList?.scrollToIndex(items.length - 1);
        }
    }
    
    setFocus(index) {
        this.clearFocus();
        this.currentFocusIndex = index;
        this.highlightFocusedItem();
    }
    
    highlightFocusedItem() {
        // Find and highlight the focused item
        const items = document.querySelectorAll('.playlist-item');
        if (items[this.currentFocusIndex]) {
            items[this.currentFocusIndex].style.outline = '2px solid var(--primary)';
            items[this.currentFocusIndex].style.outlineOffset = '2px';
        }
    }
    
    clearFocus() {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach(item => {
            item.style.outline = '';
            item.style.outlineOffset = '';
        });
        this.currentFocusIndex = -1;
    }
    
    selectCurrent() {
        if (this.currentFocusIndex !== -1 && this.onSelect) {
            this.onSelect(this.currentFocusIndex);
        }
    }
    
    updateItems() {
        // Reset focus when items change
        this.clearFocus();
        this.currentFocusIndex = -1;
    }
}