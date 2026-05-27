// ============ SAFE EVALUATION - NO eval() ==========

const ACTION_HANDLERS = {
    play: (controls) => controls?.play?.(),
    pause: (controls) => controls?.pause?.(),
    togglePlay: (controls) => controls?.togglePlay?.(),
    skipForward: (controls) => controls?.skip?.(10),
    skipBack: (controls) => controls?.skip?.(-10),
    next: (controls, nextCallback) => nextCallback?.(),
    addToQueue: (episode, queueManager) => queueManager?.addToQueue?.(episode),
    removeFromQueue: (index, queueManager) => queueManager?.removeFromQueue?.(index),
    clearQueue: (queueManager) => queueManager?.clearQueue?.(),
    setListView: (virtualList) => virtualList?.setViewMode?.('list'),
    setGridView: (virtualList) => virtualList?.setViewMode?.('grid'),
    toggleDarkMode: (toggleCallback) => toggleCallback?.(),
    download: (episode) => {
        if (episode?.videoUrl) {
            const link = document.createElement('a');
            link.href = episode.videoUrl;
            link.download = `${episode.title?.replace(/[^a-z0-9]/gi, '_') || 'episode'}.m4v`;
            link.click();
        }
    },
    share: async (episode) => {
        if (episode?.videoUrl && navigator.share) {
            try {
                await navigator.share({ title: episode.title, url: episode.videoUrl });
            } catch (e) {}
        }
    }
};

function executeAction(actionName, ...args) {
    const handler = ACTION_HANDLERS[actionName];
    if (handler) return handler(...args);
    console.warn(`Unknown action: ${actionName}`);
    return null;
}

function getNestedProperty(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
}

function setNestedProperty(obj, path, value) {
    if (!obj || !path) return false;
    const parts = path.split('.');
    const lastKey = parts.pop();
    let current = obj;
    for (const part of parts) {
        if (current[part] === undefined) current[part] = {};
        current = current[part];
    }
    if (lastKey) { current[lastKey] = value; return true; }
    return false;
}

function safeSetAttribute(element, attr, value) {
    if (!element) return;
    const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'];
    if (dangerousAttrs.includes(attr.toLowerCase())) {
        console.warn(`Blocked setting dangerous attribute: ${attr}`);
        return;
    }
    element.setAttribute(attr, value);
}

function safeSetStyle(element, property, value) {
    if (!element) return;
    const dangerousValues = ['javascript:', 'expression(', 'url(', 'behavior:'];
    const valueStr = String(value).toLowerCase();
    if (dangerousValues.some(dangerous => valueStr.includes(dangerous))) {
        console.warn(`Blocked dangerous CSS value: ${property}=${value}`);
        return;
    }
    element.style[property] = value;
}