/**
 * Window Manager Resize Plugin
 * Adds resize handles and floating resize logic to windows managed by WindowManager
 */
class WindowManagerResizePlugin {
    constructor(options = {}) {
        this.options = {
            minSize: 5, // Minimum size in percent
            handleSize: 8, // Handle size in pixels
            cornerSize: 15, // Corner handle size in pixels
            ...options
        };
        
        this.windowManager = null;
        this.container = null;
        this.resizeOverlay = null;
    }

    // Plugin initialization method called by WindowManager
    init(windowManager, container) {
        this.windowManager = windowManager;
        this.container = container;
        
        this.injectResizeStyles();
        
        const window1 = windowManager.getWindowOneElement();
        const window2 = windowManager.getWindowTwoElement();

        // Initial setup
        this.updateHandles(window1, 1);
        this.updateHandles(window2, 2);

        // Hook into floating mode setters to update handles
        this.hookFloatingModeSetters();
    }

    addResizeHandles(windowElement) {
        if (windowElement.querySelector('.wm-resize-handle')) return;
        const directions = [
            'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'
        ];
        directions.forEach(direction => {
            const handle = document.createElement('div');
            handle.className = `wm-resize-handle wm-resize-${direction}`;
            handle.dataset.direction = direction;
            windowElement.appendChild(handle);
        });
    }

    removeResizeHandles(windowElement) {
        windowElement.querySelectorAll('.wm-resize-handle').forEach(h => h.remove());
    }

    getCursorForDirection(direction) {
        const cursors = {
            'n': 'n-resize',
            'ne': 'ne-resize',
            'e': 'e-resize',
            'se': 'se-resize',
            's': 's-resize',
            'sw': 'sw-resize',
            'w': 'w-resize',
            'nw': 'nw-resize'
        };
        return cursors[direction] || 'default';
    }

    createResizeOverlay() {
        if (this.resizeOverlay) return;
        const overlay = document.createElement('div');
        overlay.className = 'wm-resize-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '9998',
            background: 'transparent',
            cursor: document.body.style.cursor || 'default',
            pointerEvents: 'auto',
        });
        document.body.appendChild(overlay);
        this.resizeOverlay = overlay;

        // Disable pointer events for iframes beneath
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((f) => f.style.setProperty('pointer-events', 'none', 'important'));
    }

    removeResizeOverlay() {
        if (this.resizeOverlay && this.resizeOverlay.parentNode) {
            this.resizeOverlay.parentNode.removeChild(this.resizeOverlay);
        }
        this.resizeOverlay = null;
        // Re-enable pointer events for iframes
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((f) => f.style.removeProperty('pointer-events'));
    }

    enableResize(windowElement, windowNumber) {
        const handles = windowElement.querySelectorAll('.wm-resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                if (!this.windowManager[`window${windowNumber}Floating`]) return;
                e.preventDefault();
                e.stopPropagation();
                const direction = handle.dataset.direction;
                const pos = this.windowManager.getWindowPosition(windowNumber);
                const startMouseX = e.clientX;
                const startMouseY = e.clientY;
                const startLeft = pos.left;
                const startTop = pos.top;
                const startWidth = pos.width;
                const startHeight = pos.height;
                let isResizing = true;
                document.body.style.cursor = this.getCursorForDirection(direction);
                document.body.style.userSelect = 'none';
                
                // Create overlay to capture events over iframes
                this.createResizeOverlay();
                
                const onResize = (e) => {
                    if (!isResizing) return;
                    const containerRect = this.container.getBoundingClientRect();
                    const deltaX = ((e.clientX - startMouseX) / containerRect.width) * 100;
                    const deltaY = ((e.clientY - startMouseY) / containerRect.height) * 100;
                    let newLeft = startLeft;
                    let newTop = startTop;
                    let newWidth = startWidth;
                    let newHeight = startHeight;
                    
                    if (direction.includes('n')) {
                        newTop = Math.max(0, Math.min(startTop + deltaY, startTop + startHeight - this.options.minSize));
                        newHeight = startHeight - (newTop - startTop);
                    }
                    if (direction.includes('s')) {
                        newHeight = Math.max(this.options.minSize, Math.min(startHeight + deltaY, 100 - startTop));
                    }
                    if (direction.includes('w')) {
                        newLeft = Math.max(0, Math.min(startLeft + deltaX, startLeft + startWidth - this.options.minSize));
                        newWidth = startWidth - (newLeft - startLeft);
                    }
                    if (direction.includes('e')) {
                        newWidth = Math.max(this.options.minSize, Math.min(startWidth + deltaX, 100 - startLeft));
                    }
                    
                    this.windowManager.setWindowPosition(windowNumber, newLeft, newTop, newWidth, newHeight);
                };
                
                const stopResize = () => {
                    isResizing = false;
                    document.removeEventListener('mousemove', onResize);
                    document.removeEventListener('mouseup', stopResize);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    
                    // Remove overlay and restore iframe events
                    this.removeResizeOverlay();
                };
                
                document.addEventListener('mousemove', onResize);
                document.addEventListener('mouseup', stopResize);
            });
        });
    }

    injectResizeStyles() {
        if (document.getElementById('wm-resize-styles')) return;
        const styleEl = document.createElement('style');
        styleEl.id = 'wm-resize-styles';
        styleEl.type = 'text/css';
        const cornerSize = this.options.cornerSize;
        const handleSize = this.options.handleSize;
        styleEl.textContent = `
.wm-resize-handle { position: absolute; background: transparent; z-index: 9999; pointer-events: auto; }
.wm-resize-nw { top: -5px; left: -5px; width: ${cornerSize}px; height: ${cornerSize}px; cursor: nw-resize; }
.wm-resize-ne { top: -5px; right: -5px; width: ${cornerSize}px; height: ${cornerSize}px; cursor: ne-resize; }
.wm-resize-sw { bottom: -5px; left: -5px; width: ${cornerSize}px; height: ${cornerSize}px; cursor: sw-resize; }
.wm-resize-se { bottom: -5px; right: -5px; width: ${cornerSize}px; height: ${cornerSize}px; cursor: se-resize; }
.wm-resize-n { top: -3px; left: 10px; right: 10px; height: ${handleSize}px; cursor: n-resize; }
.wm-resize-s { bottom: -3px; left: 10px; right: 10px; height: ${handleSize}px; cursor: s-resize; }
.wm-resize-w { left: -3px; top: 10px; bottom: 10px; width: ${handleSize}px; cursor: w-resize; }
.wm-resize-e { right: -3px; top: 10px; bottom: 10px; width: ${handleSize}px; cursor: e-resize; }
#window-1:not(.wm-floating) .wm-resize-handle, #window-2:not(.wm-floating) .wm-resize-handle { display: none; }
`;
        document.head.appendChild(styleEl);
    }

    updateHandles(windowElement, windowNumber) {
        const isFloating = this.windowManager[`window${windowNumber}Floating`];
        if (isFloating) {
            this.addResizeHandles(windowElement);
            this.enableResize(windowElement, windowNumber);
        } else {
            this.removeResizeHandles(windowElement);
        }
    }

    hookFloatingModeSetters() {
        const window1 = this.windowManager.getWindowOneElement();
        const window2 = this.windowManager.getWindowTwoElement();

        // Hook into floating mode setters to update handles
        const origSetWindow1Floating = this.windowManager.setWindow1Floating.bind(this.windowManager);
        this.windowManager.setWindow1Floating = (floating) => {
            origSetWindow1Floating(floating);
            this.updateHandles(window1, 1);
        };
        
        const origSetWindow2Floating = this.windowManager.setWindow2Floating.bind(this.windowManager);
        this.windowManager.setWindow2Floating = (floating) => {
            origSetWindow2Floating(floating);
            this.updateHandles(window2, 2);
        };
    }

    destroy() {
        // Clean up any active resize overlay
        this.removeResizeOverlay();
    }
}

// Create a factory function for the plugin
function createWindowManagerResizePlugin(options = {}) {
    return new WindowManagerResizePlugin(options);
}

// Export for use in modules or make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WindowManagerResizePlugin, createWindowManagerResizePlugin };
} else {
    window.WindowManagerResizePlugin = WindowManagerResizePlugin;
    window.createWindowManagerResizePlugin = createWindowManagerResizePlugin;
    
    // Keep backwards compatibility
    window.setupWindowManagerResize = function(wm, container) {
        const plugin = new WindowManagerResizePlugin();
        plugin.init(wm, container);
    };
}
