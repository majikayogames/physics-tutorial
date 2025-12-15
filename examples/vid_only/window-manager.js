/**
 * Window Manager JS Library
 * A simple library to manage 2 windows in various configurations
 */
class WindowManager {
    constructor(container = document.body, plugins = []) {
        this.container = container;
        this.plugins = plugins;
        
        // Create the two windows
        this.window1 = this.createWindow('window-1');
        this.window2 = this.createWindow('window-2');
        
        // Append to container
        this.container.appendChild(this.window1);
        this.container.appendChild(this.window2);
        
        // Window states
        this.window1Visible = true;
        this.window2Visible = true;
        this.window1Floating = false;
        this.window2Floating = false;
        
        // Layout settings
        this.padding = 0; // Padding in pixels (for backward compatibility)
        this.paddingX = 0; // Horizontal padding in pixels
        this.paddingY = 0; // Vertical padding in pixels
        this.borderRadius = 0; // Border radius in pixels (for backward compatibility)
        
        // Individual window styling
        this.window1BorderRadius = 0; // Border radius for window 1 in pixels
        this.window2BorderRadius = 0; // Border radius for window 2 in pixels
        this.window1DropShadow = ''; // Drop shadow for window 1 (CSS box-shadow value)
        this.window2DropShadow = ''; // Drop shadow for window 2 (CSS box-shadow value)
        
        // State tracking for transitions
        this.currentState = null;
        this.stateUpdateHandler = null;
        
        // Ensure container has relative positioning for absolute positioning to work
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        
        // Initialize plugins first (so they can override handlers)
        this.initializePlugins();
        
        // Initialize current state before first layout update
        this.currentState = this.getCurrentState();
        
        // Initialize layout
        this.updateLayout();
        this.applyWindowStyling();
    }

    initializePlugins() {
        this.plugins.forEach(plugin => {
            if (typeof plugin.init === 'function') {
                plugin.init(this, this.container);
            }
        });
    }

    // State management methods
    getCurrentState() {
        return {
            window1: {
                visible: this.window1Visible,
                floating: this.window1Floating,
                element: this.window1,
                position: {
                    top: this.window1.style.top,
                    left: this.window1.style.left,
                    width: this.window1.style.width,
                    height: this.window1.style.height,
                    zIndex: this.window1.style.zIndex,
                    display: this.window1.style.display
                }
            },
            window2: {
                visible: this.window2Visible,
                floating: this.window2Floating,
                element: this.window2,
                position: {
                    top: this.window2.style.top,
                    left: this.window2.style.left,
                    width: this.window2.style.width,
                    height: this.window2.style.height,
                    zIndex: this.window2.style.zIndex,
                    display: this.window2.style.display
                }
            },
            layout: {
                paddingX: this.paddingX,
                paddingY: this.paddingY
            }
        };
    }

    // Hook method that can be overridden by plugins
    handleWindowsStateUpdate(oldState, newState) {
        // Default behavior: directly apply styles
        this.applyWindowState(newState.window1, this.window1);
        this.applyWindowState(newState.window2, this.window2);
    }

    // Helper method to apply window state
    applyWindowState(windowState, windowElement) {
        if (!windowElement) return;
        
        const pos = windowState.position;
        windowElement.style.top = pos.top || '';
        windowElement.style.left = pos.left || '';
        windowElement.style.width = pos.width || '';
        windowElement.style.height = pos.height || '';
        windowElement.style.zIndex = pos.zIndex || '';
        windowElement.style.display = pos.display || '';
    }

    // Method to trigger state updates
    updateWindowsState(newState) {
        const oldState = this.currentState || this.getCurrentState();
        this.currentState = newState;
        
        // Use custom handler if available, otherwise use default
        if (this.stateUpdateHandler) {
            this.stateUpdateHandler(oldState, newState);
        } else {
            this.handleWindowsStateUpdate(oldState, newState);
        }
    }

    // Method for plugins to override the state update handler
    setStateUpdateHandler(handler) {
        this.stateUpdateHandler = handler;
    }
    
    createWindow(id) {
        const window = document.createElement('div');
        window.id = id;
        window.style.cssText = `
            position: absolute;
            background: transparent;
            box-sizing: border-box;
            top: 0;
            height: 100%;
        `;
        
        // Set initial positions
        if (id === 'window-1') {
            window.style.left = '0';
            window.style.width = '50%';
        } else {
            window.style.left = '50%';
            window.style.width = '50%';
        }
        
        return window;
    }

    setRect(el, { top, left, width, height }) { Object.assign(el.style, { top, left, width, height }); }

    getWindowOneElement() {
        return this.window1;
    }
    
    getWindowTwoElement() {
        return this.window2;
    }
    
    setWindow1Visible(visible) {
        this.window1Visible = visible;
        this.updateLayout();
    }
    
    setWindow2Visible(visible) {
        this.window2Visible = visible;
        this.updateLayout();
    }
    
    showBoth() {
        this.window1Visible = true;
        this.window2Visible = true;
        this.updateLayout();
    }
    
    hideBoth() {
        this.window1Visible = false;
        this.window2Visible = false;
        this.updateLayout();
    }
    
    setWindow1Floating(floating) {
        this.window1Floating = floating;
        if (floating) {
            this.window1.classList.add('wm-floating');
        } else {
            this.window1.classList.remove('wm-floating');
        }
        this.updateLayout();
    }
    
    setWindow2Floating(floating) {
        this.window2Floating = floating;
        if (floating) {
            this.window2.classList.add('wm-floating');
        } else {
            this.window2.classList.remove('wm-floating');
        }
        this.updateLayout();
    }
    
    setWindowPosition(windowNumber, left, top, width, height) {
        const window = windowNumber === 1 ? this.window1 : this.window2;
        if (!window) return;
        
        window.style.left = typeof left === 'number' ? left + '%' : left;
        window.style.top = typeof top === 'number' ? top + '%' : top;
        window.style.width = typeof width === 'number' ? width + '%' : width;
        window.style.height = typeof height === 'number' ? height + '%' : height;
        
        // Mark as having custom position
        window._customPosition = true;
    }
    
    getWindowPosition(windowNumber) {
        const window = windowNumber === 1 ? this.window1 : this.window2;
        if (!window) return null;
        
        const rect = window.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        return {
            left: ((rect.left - containerRect.left) / containerRect.width) * 100,
            top: ((rect.top - containerRect.top) / containerRect.height) * 100,
            width: (rect.width / containerRect.width) * 100,
            height: (rect.height / containerRect.height) * 100
        };
    }
    
    resetWindowPosition(windowNumber) {
        const window = windowNumber === 1 ? this.window1 : this.window2;
        if (!window) return;
        
        window._customPosition = false;
        this.updateLayout();
    }
    
    setPaddingX(paddingPx) {
        this.paddingX = Math.max(0, paddingPx);
        this.updateLayout();
    }
    
    getPaddingX() {
        return this.paddingX;
    }
    
    setPaddingY(paddingPx) {
        this.paddingY = Math.max(0, paddingPx);
        this.updateLayout();
    }
    
    getPaddingY() {
        return this.paddingY;
    }
    
    setBorderRadius(radiusPx) {
        this.borderRadius = Math.max(0, radiusPx);
        this.window1BorderRadius = this.borderRadius;
        this.window2BorderRadius = this.borderRadius;
        this.applyWindowStyling();
    }
    
    getBorderRadius() {
        return this.borderRadius || 0;
    }
    
    setWindow1BorderRadius(radiusPx) {
        this.window1BorderRadius = Math.max(0, radiusPx);
        this.applyWindowStyling();
    }
    
    getWindow1BorderRadius() {
        return this.window1BorderRadius;
    }
    
    setWindow2BorderRadius(radiusPx) {
        this.window2BorderRadius = Math.max(0, radiusPx);
        this.applyWindowStyling();
    }
    
    getWindow2BorderRadius() {
        return this.window2BorderRadius;
    }
    
    setWindow1DropShadow(shadowValue) {
        this.window1DropShadow = shadowValue || '';
        this.applyWindowStyling();
    }
    
    getWindow1DropShadow() {
        return this.window1DropShadow;
    }
    
    setWindow2DropShadow(shadowValue) {
        this.window2DropShadow = shadowValue || '';
        this.applyWindowStyling();
    }
    
    getWindow2DropShadow() {
        return this.window2DropShadow;
    }
    
    applyWindowStyling() {
        // Apply styling directly to window elements so it works in both floating and tiled modes
        if (this.window1) {
            // Only apply border radius if there's padding or window is floating
            const shouldApplyBorderRadius1 = (this.paddingX > 0 || this.paddingY > 0) || this.window1Floating;
            this.window1.style.borderRadius = shouldApplyBorderRadius1 ? `${this.window1BorderRadius}px` : '0px';
            this.window1.style.boxShadow = this.window1DropShadow;
        }
        
        if (this.window2) {
            // Only apply border radius if there's padding or window is floating
            const shouldApplyBorderRadius2 = (this.paddingX > 0 || this.paddingY > 0) || this.window2Floating;
            this.window2.style.borderRadius = shouldApplyBorderRadius2 ? `${this.window2BorderRadius}px` : '0px';
            this.window2.style.boxShadow = this.window2DropShadow;
        }
    }
    
    
    updateLayout() {
        // Calculate the new state based on current settings
        const newState = this.calculateNewState();
        
        // Update windows using the state management system
        this.updateWindowsState(newState);
        
        // Apply window styling (including conditional border radius)
        this.applyWindowStyling();
    }

    calculateNewState() {
        const newState = this.getCurrentState();
        
        // Handle window visibility using display property
        if (!this.window1Visible && !this.window2Visible) {
            // Both hidden
            newState.window1.position.display = 'none';
            newState.window2.position.display = 'none';
            return newState;
        }
        
        if (!this.window1Visible && this.window2Visible) {
            // Only window 2 visible
            newState.window1.position.display = 'none';
            newState.window2.position.display = 'block';
            if (this.window2Floating) {
                this.calculateFloatingWindowPosition(newState.window2);
            } else {
                this.calculateSingleWindowPosition(newState.window2);
            }
        } else if (this.window1Visible && !this.window2Visible) {
            // Only window 1 visible
            newState.window1.position.display = 'block';
            newState.window2.position.display = 'none';
            if (this.window1Floating) {
                this.calculateFloatingWindowPosition(newState.window1);
            } else {
                this.calculateSingleWindowPosition(newState.window1);
            }
        } else if (this.window1Visible && this.window2Visible) {
            // Both windows visible
            newState.window1.position.display = 'block';
            newState.window2.position.display = 'block';
            this.calculateBothWindowsPosition(newState);
        }
        
        return newState;
    }
    
    calculateSingleWindowPosition(windowState) {
        windowState.position.top = this.paddingY + 'px';
        windowState.position.left = this.paddingX + 'px';
        windowState.position.width = `calc(100% - ${this.paddingX * 2}px)`;
        windowState.position.height = `calc(100% - ${this.paddingY * 2}px)`;
        windowState.position.zIndex = '1';
    }
    
    calculateFloatingWindowPosition(windowState) {
        const windowElement = windowState.element;
        // Only set default floating position if not set and no custom position
        if (!windowElement._customPosition) {
            windowState.position.top = '15%';
            windowState.position.left = '15%';
            windowState.position.width = '70%';
            windowState.position.height = '70%';
        }
        // Always set z-index for floating windows
        windowState.position.zIndex = '2';
    }
    
    calculateBothWindowsPosition(newState) {
        if (this.window1Floating && this.window2Floating) {
            // Both floating - stack them (only set defaults if no custom position)
            if (!this.window1._customPosition) {
                newState.window1.position.top = '10%';
                newState.window1.position.left = '10%';
                newState.window1.position.width = '60%';
                newState.window1.position.height = '60%';
            }
            newState.window1.position.zIndex = '2';
            
            if (!this.window2._customPosition) {
                newState.window2.position.top = '20%';
                newState.window2.position.left = '20%';
                newState.window2.position.width = '60%';
                newState.window2.position.height = '60%';
            }
            newState.window2.position.zIndex = '1';
        } else if (this.window1Floating) {
            // Window 1 floating over window 2 (which fills background with padding)
            newState.window2.position.top = this.paddingY + 'px';
            newState.window2.position.left = this.paddingX + 'px';
            newState.window2.position.width = `calc(100% - ${this.paddingX * 2}px)`;
            newState.window2.position.height = `calc(100% - ${this.paddingY * 2}px)`;
            newState.window2.position.zIndex = '1';
            
            // Only set default position if window doesn't have custom position
            if (!this.window1._customPosition) {
                newState.window1.position.top = '15%';
                newState.window1.position.left = '15%';
                newState.window1.position.width = '70%';
                newState.window1.position.height = '70%';
            }
            newState.window1.position.zIndex = '2';
        } else if (this.window2Floating) {
            // Window 2 floating over window 1 (which fills background with padding)
            newState.window1.position.top = this.paddingY + 'px';
            newState.window1.position.left = this.paddingX + 'px';
            newState.window1.position.width = `calc(100% - ${this.paddingX * 2}px)`;
            newState.window1.position.height = `calc(100% - ${this.paddingY * 2}px)`;
            newState.window1.position.zIndex = '1';
            
            // Only set default position if window doesn't have custom position
            if (!this.window2._customPosition) {
                newState.window2.position.top = '15%';
                newState.window2.position.left = '15%';
                newState.window2.position.width = '70%';
                newState.window2.position.height = '70%';
            }
            newState.window2.position.zIndex = '2';
        } else {
            // Both tiled side by side - window 1 always on left, window 2 always on right
            // Layout: [paddingX][window1][paddingX][window2][paddingX]
            // Each window gets: (100% - 3*paddingX) / 2
            const half = `calc((100% - ${this.paddingX * 3}px) / 2)`;
            newState.window1.position.top = this.paddingY + 'px';
            newState.window1.position.left = this.paddingX + 'px';
            newState.window1.position.width = half;
            newState.window1.position.height = `calc(100% - ${this.paddingY * 2}px)`;
            newState.window1.position.zIndex = '1';
            
            newState.window2.position.top = this.paddingY + 'px';
            newState.window2.position.left = `calc(${this.paddingX}px + ${half} + ${this.paddingX}px)`;
            newState.window2.position.width = half;
            newState.window2.position.height = `calc(100% - ${this.paddingY * 2}px)`;
            newState.window2.position.zIndex = '1';
        }
    }
    
    destroy() {
        if (this.window1 && this.window1.parentNode) {
            this.window1.parentNode.removeChild(this.window1);
        }
        if (this.window2 && this.window2.parentNode) {
            this.window2.parentNode.removeChild(this.window2);
        }
        this.window1 = null;
        this.window2 = null;
        this.container = null;
    }
}

function createWindowManager(container = document.body, plugins = []) {
    return new WindowManager(container, plugins);
}

// Export for use in modules or make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WindowManager, createWindowManager };
} else {
    window.WindowManager = WindowManager;
    window.createWindowManager = createWindowManager;
}
