/**
 * Window Manager Transitions Plugin
 * Provides smooth animations and transitions for window state changes
 */
class WindowManagerTransitionsPlugin {
    constructor(options = {}) {
        this.options = {
            duration: 1000, // Default transition duration in ms
            easing: 'easeInOut', // logical easing name (handled in JS)
            slideDirection: 'bottom', // Default slide direction for non-tiled windows
            overshootPx: 24, // fallback extra slide distance when no shadow is detected
            boxShadowFudgePx: 5, // extra pixels added to computed shadow extents for cross-browser safety
            ...options
        };
        
        this.windowManager = null;
        this.isAnimating = false;
        this.animationQueue = [];
        this.animationTimeout = null;
        
        // Track active RAF animations per window
        this.activeAnimations = { 1: null, 2: null };
        
        // Store logical positions for floating windows (independent of current DOM position)
        this.savedFloatingPositions = { 1: null, 2: null };
    }

    // Plugin initialization method called by WindowManager
    init(windowManager, container) {
        this.windowManager = windowManager;
        this.container = container;
        
        // Override the window manager's state update handler
        windowManager.setStateUpdateHandler((oldState, newState) => {
            this.handleStateUpdate(oldState, newState);
        });
        
        // Ensure container hides overflow to prevent scrollbars from off-screen windows
        container.style.overflow = 'hidden';

        // Add methods to window manager for controlling transitions
        this.extendWindowManager();
        
        // Initialize props
        this.updateTransitionProperties();
    }

    // NOTE: CSS transitions removed; JS animations only
    addTransitionStyles() { /* no-op: CSS-based transitions removed */ }

    extendWindowManager() {
        // Add transition control methods to the window manager
        this.windowManager.setTransitionDuration = (duration) => {
            this.options.duration = duration;
            this.updateTransitionProperties();
        };
        
        this.windowManager.setSlideDirection = (direction) => {
            this.options.slideDirection = direction;
        };
        
        this.windowManager.getTransitionDuration = () => {
            return this.options.duration;
        };
        
        this.windowManager.getSlideDirection = () => {
            return this.options.slideDirection;
        };

        // Hook into position setting methods to keep saved positions updated
        const originalSetWindowPosition = this.windowManager.setWindowPosition;
        this.windowManager.setWindowPosition = (windowNumber, left, top, width, height) => {
            const result = originalSetWindowPosition.call(this.windowManager, windowNumber, left, top, width, height);
            // Update saved position when a floating window position is manually set
            const element = windowNumber === 1 ? this.windowManager.window1 : this.windowManager.window2;
            if (element && element._customPosition) {
                const floatingState = windowNumber === 1 ? this.windowManager.window1Floating : this.windowManager.window2Floating;
                if (floatingState) {
                    this.saveFloatingPosition(windowNumber);
                }
            }
            return result;
        };

        const originalResetWindowPosition = this.windowManager.resetWindowPosition;
        this.windowManager.resetWindowPosition = (windowNumber) => {
            const result = originalResetWindowPosition.call(this.windowManager, windowNumber);
            // Clear saved position when window position is reset
            this.clearSavedPosition(windowNumber);
            return result;
        };
    }

    updateTransitionProperties() {
        // Keep CSS var set for possible external use; not used for JS animations
        if (this.container) {
            this.container.style.setProperty('--wm-duration', `${this.options.duration}ms`);
        }
    }

    handleStateUpdate(oldState, newState) {
        // Save floating positions before transitioning out
        this.saveFloatingPositionsBeforeTransition(oldState, newState);

        // If already animating, interrupt current animation and start new one
        if (this.isAnimating) {
            this.interruptCurrentAnimation();
        }

        this.animateStateTransition(oldState, newState);
    }

    saveFloatingPositionsBeforeTransition(oldState, newState) {
        // Save positions for windows that are currently visible and floating with custom positions,
        // but will become hidden (transitioning out)
        [1, 2].forEach(n => {
            const oldVis = oldState[`window${n}`].visible;
            const newVis = newState[`window${n}`].visible;
            const oldFloating = oldState[`window${n}`].floating;
            const element = n === 1 ? this.windowManager.window1 : this.windowManager.window2;
            
            // If window is transitioning from visible+floating to hidden, save its position
            if (oldVis && !newVis && oldFloating && element && element._customPosition) {
                // Only save if we don't already have a saved position, or if we're sure the current position is good
                if (!this.savedFloatingPositions[n] || (!this.isAnimating && !this.activeAnimations[n])) {
                    this.saveFloatingPosition(n);
                }
            }
        });
    }

    // Check if both windows are transitioning visibility simultaneously
    areBothWindowsTransitioning(oldState, newState) {
        const w1OldVis = oldState.window1.visible;
        const w1NewVis = newState.window1.visible;
        const w2OldVis = oldState.window2.visible;
        const w2NewVis = newState.window2.visible;
        
        // Both becoming visible (showBoth)
        const bothBecomingVisible = !w1OldVis && w1NewVis && !w2OldVis && w2NewVis;
        
        // Both becoming hidden (hideBoth)
        const bothBecomingHidden = w1OldVis && !w1NewVis && w2OldVis && !w2NewVis;
        
        return bothBecomingVisible || bothBecomingHidden;
    }

    interruptCurrentAnimation() {
        // Clear any pending animation timeout
        if (this.animationTimeout) {
            clearTimeout(this.animationTimeout);
            this.animationTimeout = null;
        }
        
        // Cancel RAFs
        [1, 2].forEach((n) => {
            const anim = this.activeAnimations[n];
            if (anim && anim.rafId) cancelAnimationFrame(anim.rafId);
            this.activeAnimations[n] = null;
        });
        
        // Clear the animation queue since we're starting fresh
        this.animationQueue = [];
        
        // Reset animation state
        this.isAnimating = false;
    }

    // ---------- Core animation orchestrator (JS-driven) ----------
    animateStateTransition(oldState, newState) {
        this.isAnimating = true;
        
        const wm = this.windowManager;
        const duration = Math.max(0, this.options.duration);

        // Check if both windows are transitioning simultaneously (showBoth/hideBoth scenario)
        const bothTransitioning = this.areBothWindowsTransitioning(oldState, newState);

        // Compute target layout rects for visible windows (percent-based)
        const targets = this.computeFinalLayoutTargets(newState);
        // targets: { w1:{rect,zIndex,visible}, w2:{rect,zIndex,visible} }

        // Build from/to rects per window
        const work = [1, 2].map((n) => {
            const element = n === 1 ? wm.window1 : wm.window2;
            const oldVis = oldState[`window${n}`].visible;
            const newVis = newState[`window${n}`].visible;
            const oldFloating = !!oldState[`window${n}`].floating;
            const newFloating = !!newState[`window${n}`].floating;
            const finalTarget = targets[`w${n}`];

            // Determine current rect (percent-based)
            const currentRect = this.getCurrentRectPercent(n);

            let fromRect;
            let toRect;
            let needsAnimation = true;

            // Determine off-screen rect for slide transitions when needed
            // If sliding OUT and has shadow, add overshoot so shadow clears edge
            // If sliding IN and has shadow, start a bit further out for nicer entry
            const hasShadow = this.windowHasDropShadow(element);
            const slidingOut = oldVis && !newVis;
            const slidingIn = !oldVis && newVis;
            const overshootNeeded = hasShadow && (slidingOut || slidingIn);
            // Compute overshoot based on actual box-shadow extents when available; fallback to configured overshootPx
            const overshoot = overshootNeeded
                ? this.computeDirectionalOvershoot(n, newState, element)
                : { x: 0, y: 0 };
            // For hiding windows, use current rect as base; for showing windows, use target rect
            const baseRectForOffscreen = (oldVis && !newVis) ? currentRect : finalTarget.rect;
            const offscreenRect = this.computeOffscreenRect(
                n,
                baseRectForOffscreen,
                newState,
                { x: overshoot.x || 0, y: overshoot.y || 0, slidingIn, slidingOut, bothTransitioning }
            );

            if (!oldVis && newVis) {
                // Becoming visible: start off-screen → animate to target
                fromRect = offscreenRect;
                toRect = finalTarget.rect;
                // Ensure element is visible for animation
                element.style.visibility = 'visible';
            } else if (oldVis && !newVis) {
                // Becoming hidden: animate from current → off-screen
                fromRect = currentRect;
                toRect = offscreenRect;
            } else if (newVis) {
                // Visible → visible: animate from current → target
                fromRect = currentRect;
                toRect = finalTarget.rect;
            } else {
                // Hidden → hidden: ensure off-screen and hidden; no need to animate
                fromRect = currentRect;
                toRect = offscreenRect;
                needsAnimation = false;
                this.applyRectPercent(element, toRect);
                element.style.visibility = 'hidden';
            }

            // Decide when to set z-index based on floating transition
            // - non-floating -> floating: set new z at start
            // - floating -> non-floating: keep old z until the end
            // - floating and sliding OUT: keep old z until the end to avoid being hidden under background
            const finalZ = finalTarget.zIndex;
            const keepZUntilEnd = (oldFloating && !newFloating) || (slidingOut && oldFloating);
            const setZAtStart = !keepZUntilEnd;
            if (setZAtStart) {
                element.style.zIndex = finalZ;
            }

            return { n, element, fromRect, toRect, needsAnimation, willBeVisible: newVis, finalZ, setZAtStart };
        });

        // Run animations in parallel for windows that need them
        const animating = work.filter(w => w.needsAnimation);
        if (animating.length === 0 || duration === 0) {
            // Apply final states immediately
            work.forEach(({ element, toRect, willBeVisible, finalZ }) => {
                this.applyRectPercent(element, toRect);
                element.style.visibility = willBeVisible ? 'visible' : 'hidden';
                // Immediate: end state z-index
                if (finalZ != null) element.style.zIndex = finalZ;
            });
            this.finishAnimation();
            return;
        }

        let completed = 0;
        const onOneComplete = () => {
            completed += 1;
            if (completed === animating.length) {
                this.finishAnimation();
            }
        };

        animating.forEach(({ n, element, fromRect, toRect, willBeVisible, finalZ, setZAtStart }) => {
            // Ensure visibility when animating in
            if (willBeVisible) element.style.visibility = 'visible';
            
            this.animateWindowRect(n, element, fromRect, toRect, duration, this.getEasingFn(), () => {
                // End state
                this.applyRectPercent(element, toRect);
                element.style.visibility = willBeVisible ? 'visible' : 'hidden';
                // If we deferred z-index change (floating -> non-floating), set at the end
                if (!setZAtStart && finalZ != null) element.style.zIndex = finalZ;
                
                // If this is a floating window that just finished animating to a visible position,
                // save its final position as the logical position
                if (willBeVisible && newState[`window${n}`].floating && element._customPosition) {
                    this.savedFloatingPositions[n] = { ...toRect };
                }
                
                onOneComplete();
            });
        });
    }

    // ---------- Geometry helpers (percent-based) ----------
    getCurrentRectPercent(windowNumber) {
        const pos = this.windowManager.getWindowPosition(windowNumber);
        // Fallback if null
        if (!pos) return { top: 0, left: 0, width: 50, height: 100 };
        return {
            top: pos.top,
            left: pos.left,
            width: pos.width,
            height: pos.height
        };
    }

    // Save the current position of a floating window as its logical position
    saveFloatingPosition(windowNumber) {
        const element = windowNumber === 1 ? this.windowManager.window1 : this.windowManager.window2;
        if (element && element._customPosition) {
            // Don't save position during animation - it could be an intermediate position
            if (this.isAnimating || this.activeAnimations[windowNumber]) {
                // Skip saving during animation to avoid corrupting the saved position
                return;
            }
            this.savedFloatingPositions[windowNumber] = this.getCurrentRectPercent(windowNumber);
        }
    }

    // Get the logical position for a floating window (saved position or current position)
    getLogicalFloatingPosition(windowNumber) {
        const element = windowNumber === 1 ? this.windowManager.window1 : this.windowManager.window2;
        if (element && element._customPosition && this.savedFloatingPositions[windowNumber]) {
            return this.savedFloatingPositions[windowNumber];
        }
        return this.getCurrentRectPercent(windowNumber);
    }

    // Clear saved position (when window is no longer floating or custom position is reset)
    clearSavedPosition(windowNumber) {
        this.savedFloatingPositions[windowNumber] = null;
    }

    applyRectPercent(element, rect) {
        element.style.top = rect.top + '%';
        element.style.left = rect.left + '%';
        element.style.width = rect.width + '%';
        element.style.height = rect.height + '%';
    }

    // Compute final target rects for visible layout (no off-screen here)
    computeFinalLayoutTargets(newState) {
        const wm = this.windowManager;
        const targets = { w1: { rect: null, zIndex: '1', visible: newState.window1.visible }, w2: { rect: null, zIndex: '1', visible: newState.window2.visible } };

        const paddingX = wm.paddingX;
        const paddingY = wm.paddingY;

        const makeRect = (top, left, width, height) => ({ top, left, width, height });

        const floatingRect = (el, isCustom) => {
            if (isCustom) {
                const windowNumber = el === wm.window1 ? 1 : 2;
                const pos = this.getLogicalFloatingPosition(windowNumber);
                return makeRect(pos.top, pos.left, pos.width, pos.height);
            }
            return makeRect(15, 15, 70, 70);
        };

        const singleRect = () => makeRect(
            (paddingY / (this.getContainerRect().height)) * 100, // but easier to compute directly in px? We keep percent by formula below
            (paddingX / (this.getContainerRect().width)) * 100,
            ((this.getContainerRect().width - paddingX * 2) / this.getContainerRect().width) * 100,
            ((this.getContainerRect().height - paddingY * 2) / this.getContainerRect().height) * 100
        );

        // Helper: convert px calc with percent-friendly values
        const rectSingle = () => ({
            top: this.pxYToPercent(paddingY),
            left: this.pxXToPercent(paddingX),
            width: this.pxXToPercent(this.getContainerRect().width - paddingX * 2),
            height: this.pxYToPercent(this.getContainerRect().height - paddingY * 2),
        });

        const rectHalfWidth = () => this.pxXToPercent((this.getContainerRect().width - paddingX * 3) / 2);

        // Both hidden: still compute reasonable rects (unused)
        if (!newState.window1.visible && !newState.window2.visible) {
            targets.w1.rect = rectSingle();
            targets.w2.rect = rectSingle();
            return targets;
        }

        // Only one visible
        if (newState.window1.visible && !newState.window2.visible) {
            if (newState.window1.floating) {
                targets.w1.rect = floatingRect(wm.window1, wm.window1._customPosition);
                targets.w1.zIndex = '2';
            } else {
                targets.w1.rect = rectSingle();
                targets.w1.zIndex = '1';
            }
            // Ensure hidden window has a base rect for offscreen calculation
            targets.w2.rect = this.computeHiddenBaseRect(2, newState, rectSingle());
            return targets;
        }

        if (!newState.window1.visible && newState.window2.visible) {
            if (newState.window2.floating) {
                targets.w2.rect = floatingRect(wm.window2, wm.window2._customPosition);
                targets.w2.zIndex = '2';
            } else {
                targets.w2.rect = rectSingle();
                targets.w2.zIndex = '1';
            }
            // Ensure hidden window has a base rect for offscreen calculation
            targets.w1.rect = this.computeHiddenBaseRect(1, newState, rectSingle());
            return targets;
        }

        // Both visible
        if (newState.window1.floating && newState.window2.floating) {
            // stacked defaults unless custom
            targets.w1.rect = wm.window1._customPosition ? floatingRect(wm.window1, true) : { top: 10, left: 10, width: 60, height: 60 };
            targets.w1.zIndex = '2';
            targets.w2.rect = wm.window2._customPosition ? floatingRect(wm.window2, true) : { top: 20, left: 20, width: 60, height: 60 };
            targets.w2.zIndex = '1';
            return targets;
        }

        if (newState.window1.floating && !newState.window2.floating) {
            targets.w2.rect = rectSingle();
            targets.w2.zIndex = '1';
            targets.w1.rect = floatingRect(wm.window1, wm.window1._customPosition);
            targets.w1.zIndex = '2';
            return targets;
        }

        if (!newState.window1.floating && newState.window2.floating) {
            targets.w1.rect = rectSingle();
            targets.w1.zIndex = '1';
            targets.w2.rect = floatingRect(wm.window2, wm.window2._customPosition);
            targets.w2.zIndex = '2';
            return targets;
        }

        // Tiled side by side
        const half = rectHalfWidth();
        targets.w1.rect = {
            top: this.pxYToPercent(paddingY),
            left: this.pxXToPercent(paddingX),
            width: half,
            height: this.pxYToPercent(this.getContainerRect().height - paddingY * 2)
        };
        targets.w1.zIndex = '1';

        targets.w2.rect = {
            top: this.pxYToPercent(paddingY),
            left: this.pxXToPercent(paddingX) + half + this.pxXToPercent(paddingX),
            width: half,
            height: this.pxYToPercent(this.getContainerRect().height - paddingY * 2)
        };
        targets.w2.zIndex = '1';

        return targets;
    }

    // Compute a reasonable on-screen base rect for a window that will be hidden in newState
    // fallbackRect is typically the single-window rect for convenience
    computeHiddenBaseRect(windowNumber, newState, fallbackRect) {
        const wm = this.windowManager;
        const isFloating = newState[`window${windowNumber}`].floating;
        const otherNumber = windowNumber === 1 ? 2 : 1;
        const singleWindow = !newState[`window${otherNumber}`].visible;
        const backgroundToFloating = newState[`window${otherNumber}`].visible && newState[`window${otherNumber}`].floating;

        // If in floating/single/background-to-floating context
        if (isFloating || singleWindow || backgroundToFloating) {
            // Use custom if present
            const element = windowNumber === 1 ? wm.window1 : wm.window2;
            if (isFloating && element && element._customPosition) {
                const pos = this.getLogicalFloatingPosition(windowNumber);
                return { top: pos.top, left: pos.left, width: pos.width, height: pos.height };
            }
            // If floating: default floating rect; else fallback to single rect
            if (isFloating) return { top: 15, left: 15, width: 70, height: 70 };
            return fallbackRect;
        }

        // Tiled context: return the on-screen tiled rect for that window
        const paddingX = wm.paddingX;
        const paddingY = wm.paddingY;
        const half = this.pxXToPercent((this.getContainerRect().width - paddingX * 3) / 2);
        const top = this.pxYToPercent(paddingY);
        const height = this.pxYToPercent(this.getContainerRect().height - paddingY * 2);
        if (windowNumber === 1) {
            return { top, left: this.pxXToPercent(paddingX), width: half, height };
        } else {
            return { top, left: this.pxXToPercent(paddingX) + half + this.pxXToPercent(paddingX), width: half, height };
        }
    }

    computeOffscreenRect(windowNumber, baseRect, newState, opts = { x: 0, y: 0, slidingIn: false, slidingOut: false, bothTransitioning: false }) {
        const dir = this.options.slideDirection;
        const isFloating = newState[`window${windowNumber}`].floating;
        
        // Match original logic exactly: singleWindow means the OTHER window is also not visible
        const otherNumber = windowNumber === 1 ? 2 : 1;
        const singleWindow = !newState[`window${otherNumber}`].visible; // "will slide alone"
        
        const backgroundToFloating = this.isBackgroundToFloatingContext(windowNumber, newState);

        // Enhanced logic: Use configurable direction for floating, single-window, background-to-floating, 
        // OR when both windows are transitioning together (showBoth/hideBoth)
        const useConfigurableDirection = isFloating || singleWindow || backgroundToFloating || opts.bothTransitioning;

        if (useConfigurableDirection) {
            // Use configured slide direction
            const off = { ...baseRect };
            const extraX = opts.x || 0;
            const extraY = opts.y || 0;
            
            // Special case: when both windows are transitioning and we're in tiled context,
            // preserve the current layout dimensions and only move in the slide direction
            if (opts.bothTransitioning && !isFloating && !singleWindow) {
                // For both-window transitions in tiled mode, maintain current width/position
                // and only slide in the specified direction
                if (dir === 'left') {
                    off.left = -baseRect.width - extraX;
                } else if (dir === 'right') {
                    off.left = 100 + extraX;
                } else if (dir === 'top') {
                    // For top/bottom, keep the current left position and width, only change top
                    off.top = -baseRect.height - extraY;
                    // Don't modify left or width - keep them as they are in baseRect
                } else if (dir === 'bottom') {
                    off.top = 100 + extraY;
                    // Don't modify left or width - keep them as they are in baseRect
                }
            } else {
                // Original behavior for non-both-transitioning cases
                if (dir === 'left') off.left = -baseRect.width - extraX;
                else if (dir === 'right') off.left = 100 + extraX;
                else if (dir === 'top') off.top = -baseRect.height - extraY;
                else if (dir === 'bottom') off.top = 100 + extraY;
            }
            return off;
        } else {
            // Fixed tiled behavior: window 1 slides left, window 2 slides right
            // This applies to regular tiled context (both visible, both non-floating)
            if (windowNumber === 1) {
                const extra = opts.x || 0;
                return { top: baseRect.top, left: -baseRect.width - this.pxXToPercent(this.windowManager.paddingX) - extra, width: baseRect.width, height: baseRect.height };
            } else {
                const extra = opts.x || 0;
                return { top: baseRect.top, left: 100 + extra, width: baseRect.width, height: baseRect.height };
            }
        }
    }

    windowHasDropShadow(element) {
        if (!element) return false;
        const inline = element.style && element.style.boxShadow;
        if (inline && inline !== 'none') return true;
        const cs = typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
        return !!(cs && cs.boxShadow && cs.boxShadow !== 'none');
    }

    // Parse box-shadow to compute horizontal/vertical extents (max spread + |offset| + blur)
    // Returns overshoot in percent for x and y axes
    computeDirectionalOvershoot(windowNumber, newState, element) {
        const cs = typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
        const shadowStr = (element.style && element.style.boxShadow) || (cs && cs.boxShadow) || '';
        if (!shadowStr || shadowStr === 'none') {
            // fallback to configured overshootPx
            return {
                x: this.pxXToPercent(this.options.overshootPx),
                y: this.pxYToPercent(this.options.overshootPx)
            };
        }

        // box-shadow may contain multiple shadows, comma-separated. We take the maximum extents.
        const parts = shadowStr.split(',');
        let maxX = 0;
        let maxY = 0;
        for (let part of parts) {
            const vals = part.trim().split(/\s+/);
            // Expect: [offset-x, offset-y, blur-radius?, spread-radius?, color...]
            // Values can be like '10px', '0', 'rgba(...)', 'inset'
            const nums = [];
            for (let v of vals) {
                if (v === 'inset') continue;
                const m = v.match(/^(-?\d+)(px)?$/);
                if (m) nums.push(parseFloat(m[1]));
            }
            if (nums.length >= 2) {
                const ox = Math.abs(nums[0] || 0);
                const oy = Math.abs(nums[1] || 0);
                const blur = Math.abs(nums[2] || 0);
                const spread = Math.abs(nums[3] || 0);
                // Extent is offset + blur + spread
                maxX = Math.max(maxX, ox + blur + spread);
                maxY = Math.max(maxY, oy + blur + spread);
            }
        }
        // Add fudge
        maxX += this.options.boxShadowFudgePx;
        maxY += this.options.boxShadowFudgePx;
        return {
            x: this.pxXToPercent(maxX),
            y: this.pxYToPercent(maxY)
        };
    }

    isTiledContext(newState) {
        // true when both not floating OR when the other window fills background
        const w1 = newState.window1;
        const w2 = newState.window2;
        if (!w1.visible && !w2.visible) return true;
        if (w1.visible && w2.visible && !w1.floating && !w2.floating) return true;
        // background case: one floating over a tiled background
        if (w1.floating && w2.visible && !w2.floating) return true;
        if (w2.floating && w1.visible && !w1.floating) return true;
        return false;
    }

    isBackgroundToFloatingContext(windowNumber, newState) {
        // Check if this window is acting as background to a floating window
        // This matches the original logic for when to use configurable slide direction
        const otherNumber = windowNumber === 1 ? 2 : 1;
        const thisWindow = newState[`window${windowNumber}`];
        const otherWindow = newState[`window${otherNumber}`];
        
        return otherWindow.visible && otherWindow.floating && !thisWindow.floating;
    }

    // ---------- Animation helpers ----------
    animateWindowRect(n, element, fromRect, toRect, duration, easingFn, onComplete) {
        // Cancel existing RAF for this window if any
        const existing = this.activeAnimations[n];
        if (existing && existing.rafId) cancelAnimationFrame(existing.rafId);

        const start = performance.now();
        const state = { rafId: 0 };
        this.activeAnimations[n] = state;

        const step = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const k = easingFn(t);
            const cur = {
                top: this.lerp(fromRect.top, toRect.top, k),
                left: this.lerp(fromRect.left, toRect.left, k),
                width: this.lerp(fromRect.width, toRect.width, k),
                height: this.lerp(fromRect.height, toRect.height, k)
            };
            this.applyRectPercent(element, cur);

            if (t < 1) {
                state.rafId = requestAnimationFrame(step);
            } else {
                this.activeAnimations[n] = null;
                onComplete && onComplete();
            }
        };

        state.rafId = requestAnimationFrame(step);
    }

    lerp(a, b, t) { return a + (b - a) * t; }

    getEasingFn() {
        // Basic easeInOut (similar to CSS ease)
        return (t) => {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };
    }

    // ---------- Unit helpers ----------
    getContainerRect() { return this.container.getBoundingClientRect(); }
    pxXToPercent(px) { const w = this.getContainerRect().width || 1; return (px / w) * 100; }
    pxYToPercent(px) { const h = this.getContainerRect().height || 1; return (px / h) * 100; }

    // ---------- Cleanup ----------
    finishAnimation() {
        this.isAnimating = false;
        this.animationTimeout = null;

        // No queue processing; interruptions clear queue, and we always process latest
        if (this.animationQueue.length > 0) {
            const next = this.animationQueue.shift();
            // Small delay isn’t necessary with RAF; but keep a microtask to avoid re-entrancy
            setTimeout(() => {
                this.animateStateTransition(next.oldState, next.newState);
            }, 16);
        }
    }

    // Utility method to disable transitions temporarily (kept for API parity)
    disableTransitions() { /* no-op in JS animations */ }
    enableTransitions() { /* no-op in JS animations */ }
}

// Create a factory function for the plugin
function createWindowManagerTransitionsPlugin(options = {}) {
    return new WindowManagerTransitionsPlugin(options);
}

// Export for use in modules or make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WindowManagerTransitionsPlugin, createWindowManagerTransitionsPlugin };
} else {
    window.WindowManagerTransitionsPlugin = WindowManagerTransitionsPlugin;
    window.createWindowManagerTransitionsPlugin = createWindowManagerTransitionsPlugin;
}
