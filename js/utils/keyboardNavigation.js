// ============ KEYBOARD NAVIGATION ==========

class KeyboardNavigation {
    constructor(virtualList, options = {}) {
        this.virtualList = virtualList;
        this.onSelect = options.onSelect || null;
        this.currentFocusIndex = -1;
        this.isEnabled = false;
        this.boundHandleKeydown = this.handleKeydown.bind(this);
    }
    
    enable() {
        if (this.isEnabled) return;
        this.isEnabled = true;
        document.addEventListener('keydown', this.boundHandleKeydown);
        console.log('Keyboard navigation enabled');
    }
    
    disable() {
        if (!this.isEnabled) return;
        this.isEnabled = false;
        document.removeEventListener('keydown', this.boundHandleKeydown);
        this.clearFocus();
    }
    
    handleKeydown(event) {
        const activeElement = document.activeElement;
        if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') return;
        if (!this.virtualList || !this.virtualList.isReady()) return;
        const items = this.virtualList.getCurrentItems();
        if (!items.length) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.virtualList.moveFocus(1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.virtualList.moveFocus(-1);
                break;
            case 'Home':
                event.preventDefault();
                this.virtualList.moveFocusToStart();
                break;
            case 'End':
                event.preventDefault();
                this.virtualList.moveFocusToEnd();
                break;
            case 'Enter':
                event.preventDefault();
                this.virtualList.playActive();
                if (this.onSelect) {
                    const focusedIndex = this.virtualList.getFocusedIndex();
                    if (focusedIndex !== -1) this.onSelect(focusedIndex);
                }
                break;
            case 'Escape':
                event.preventDefault();
                this.virtualList.setFocusedIndex(-1);
                break;
        }
    }
    
    clearFocus() {
        if (this.virtualList) this.virtualList.setFocusedIndex(-1);
    }
    
    updateItems() {
        this.clearFocus();
        this.currentFocusIndex = -1;
    }
}

function initKeyboardNavigation(virtualList, onSelect) {
    if (!virtualList) {
        console.warn('Cannot initialize keyboard navigation: virtualList not provided');
        return null;
    }
    const keyboardNav = new KeyboardNavigation(virtualList, { onSelect });
    keyboardNav.enable();
    return keyboardNav;
}