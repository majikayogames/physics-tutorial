(function () {
    'use strict';

    function safeSetInnerHTML(element, html) {
        try {
            element.innerHTML = html;
        } catch (e) {
            // Fallback for CSP/TrustedTypes restrictions
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        }
    }

    /* Polygon Displacement Shader Integration */
    function generateShaderId() {
        return 'shader-' + Math.random().toString(36).slice(2);
    }

    function pointInPolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    class PolygonShader {
        constructor({ width = 200, height = 120, fragment, polygon = [], dpi = 0.5 }) {
            this.width = width;
            this.height = height;
            this.fragment = fragment || ((uv) => ({ x: uv.x, y: uv.y }));
            this.polygon = polygon; // Array of {x, y} points in 0-1 space
            this.id = generateShaderId();

            // Allow caller to trade fidelity for speed via dpi (< 1 produces a smaller off-screen canvas)
            this.canvasDPI = dpi;

            // Internals reused every frame
            this.imageData = null;    // ImageData cache
            this.mask = null;         // Uint8 mask of points inside the polygon
            this._frameCounter = 0;   // Used to throttle expensive href updates
            // Stores external constraint-based displacement influences updated each frame
            this.constraintData = [];

            this.mouse = { x: 0, y: 0 };

            this.createElement();
            this.buildMask();
            this.updateShader();
        }

        createElement() {
            // Create SVG filter
            this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this.svg.setAttribute('width', '0');
            this.svg.setAttribute('height', '0');
            this.svg.style.cssText = 'position: fixed; top: 0; left: 0; pointer-events: none;';

            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

            // Create mask for the polygon
            const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
            mask.id = `${this.id}_mask`;
            mask.setAttribute('maskUnits', 'userSpaceOnUse');
            mask.setAttribute('x', '0');
            mask.setAttribute('y', '0');
            mask.setAttribute('width', this.width);
            mask.setAttribute('height', this.height);

            // Create polygon path for the mask (white = visible, black = hidden)
            this.maskPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            this.maskPath.setAttribute('fill', 'white');
            this.maskPath.setAttribute('stroke', 'none');

            mask.appendChild(this.maskPath);
            defs.appendChild(mask);

            const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
            filter.id = `${this.id}_filter`;
            filter.setAttribute('filterUnits', 'userSpaceOnUse');
            filter.setAttribute('colorInterpolationFilters', 'sRGB');
            filter.setAttribute('x', '0');
            filter.setAttribute('y', '0');
            filter.setAttribute('width', this.width);
            filter.setAttribute('height', this.height);

            this.feImage = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
            this.feImage.setAttribute('id', `${this.id}_map`);
            this.feImage.setAttribute('width', this.width);
            this.feImage.setAttribute('height', this.height);
            this.feImage.setAttribute('preserveAspectRatio', 'none');

            this.feDisplacementMap = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
            this.feDisplacementMap.setAttribute('in', 'SourceGraphic');
            this.feDisplacementMap.setAttribute('in2', `${this.id}_map`);
            this.feDisplacementMap.setAttribute('xChannelSelector', 'R');
            this.feDisplacementMap.setAttribute('yChannelSelector', 'G');

            filter.appendChild(this.feImage);
            filter.appendChild(this.feDisplacementMap);
            defs.appendChild(filter);
            this.svg.appendChild(defs);

            // Create overlay container with mask applied
            this.container = document.createElement('div');
            // Use absolute positioning in iframes, fixed in top-level windows
            const positionType = (window.parent !== window) ? 'absolute' : 'fixed';
            this.container.style.cssText = `
                position: ${positionType};
                width: ${this.width}px;
                height: ${this.height}px;
                overflow: hidden;
                backdrop-filter: url(#${this.id}_filter);
                -webkit-backdrop-filter: url(#${this.id}_filter);
                mask: url(#${this.id}_mask);
                -webkit-mask: url(#${this.id}_mask);
                pointer-events: none;
                z-index: 9999;
            `;

            // Off-screen canvas for the displacement map
            this.canvas = document.createElement('canvas');
            this.canvas.width = Math.round(this.width * this.canvasDPI);
            this.canvas.height = Math.round(this.height * this.canvasDPI);
            this.canvas.style.display = 'none';
            this.context = this.canvas.getContext('2d');

            // Allocate ImageData buffer once; reused every frame
            this.imageData = this.context.createImageData(this.canvas.width, this.canvas.height);

            // Update the mask path initially
            this.updateMaskPath();
        }

        // Pre-compute which canvas pixels fall inside the polygon so we don't
        // call the expensive pointInPolygon test every frame.
        buildMask() {
            const w = this.canvas.width;
            const h = this.canvas.height;
            this.mask = new Uint8Array(w * h);

            let idx = 0;
            for (let y = 0; y < h; y++) {
                const uvY = y / h;
                for (let x = 0; x < w; x++, idx++) {
                    const uvX = x / w;
                    this.mask[idx] = pointInPolygon(uvX, uvY, this.polygon) ? 1 : 0;
                }
            }
        }

        // Update the SVG mask path to match the current polygon with smooth curves
        updateMaskPath() {
            if (!this.maskPath || !this.polygon || this.polygon.length < 3) {
                return;
            }

            // Convert normalized polygon coordinates to actual pixel coordinates
            const scaledPolygon = this.polygon.map(point => ({
                x: point.x * this.width,
                y: point.y * this.height
            }));

            // Create smooth path data using the same algorithm as the slime body
            const pathData = this.createSmoothPathData(scaledPolygon);
            this.maskPath.setAttribute('d', pathData);
        }

        // Create smooth path data using cubic Bézier curves (same as SlimeRenderer.createSmoothPath)
        createSmoothPathData(verts) {
            if (verts.length < 3) {
                return '';
            }

            // Create ultra-smooth path using cubic Bézier curves
            let pathData = `M ${verts[0].x} ${verts[0].y}`;

            for (let i = 0; i < verts.length; i++) {
                const current = verts[i];
                const next = verts[(i + 1) % verts.length];
                const prev = verts[(i - 1 + verts.length) % verts.length];
                const nextNext = verts[(i + 2) % verts.length];

                // Calculate control points for smooth cubic Bézier curve
                const tension = 0.3; // Controls how "tight" the curves are

                // Vector from previous to next point
                const prevToNext = {
                    x: next.x - prev.x,
                    y: next.y - prev.y
                };

                // Vector from current to next-next point
                const currentToNextNext = {
                    x: nextNext.x - current.x,
                    y: nextNext.y - current.y
                };

                // Control point 1: extends from current point
                const cp1 = {
                    x: current.x + prevToNext.x * tension,
                    y: current.y + prevToNext.y * tension
                };

                // Control point 2: extends backwards from next point
                const cp2 = {
                    x: next.x - currentToNextNext.x * tension,
                    y: next.y - currentToNextNext.y * tension
                };

                pathData += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${next.x} ${next.y}`;
            }

            pathData += ' Z';
            return pathData;
        }

        updateShader() {
            const w = this.canvas.width;
            const h = this.canvas.height;
            const data = this.imageData.data; // Uint8ClampedArray, already allocated

            let maxScale = 0;

            // Allocate scratch buffers once (Float32 precise displacements)
            if (!this._dispX || this._dispX.length !== w * h) {
                this._dispX = new Float32Array(w * h);
                this._dispY = new Float32Array(w * h);
            }

            let idxPix = 0;
            for (let i = 0; i < data.length; i += 4, idxPix++) {
                if (!this.mask[idxPix]) {
                    // Neutral displacement outside polygon
                    this._dispX[idxPix] = 0;
                    this._dispY[idxPix] = 0;
                    continue;
                }

                const x = idxPix % w;
                const y = (idxPix / w) | 0;
                const uvX = x / w;
                const uvY = y / h;

                const pos = this.fragment({ x: uvX, y: uvY }, this.constraintData);
                const dx = pos.x * w - x;
                const dy = pos.y * h - y;

                this._dispX[idxPix] = dx;
                this._dispY[idxPix] = dy;

                maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
            }

            // Tame intensity – raise factor for stronger visible distortion
            maxScale *= 0.6;

            // Prevent division by zero in totally neutral frames
            if (maxScale === 0) {
                maxScale = 1;
            }

            // Second pass – encode displacement into RG
            idxPix = 0;
            for (let i = 0; i < data.length; i += 4, idxPix++) {
                if (!this.mask[idxPix]) {
                    // No displacement for pixels outside polygon - neutral displacement
                    data[i] = 128;     // R channel: 0.5 * 255 = neutral X displacement
                    data[i + 1] = 128; // G channel: 0.5 * 255 = neutral Y displacement
                    data[i + 2] = 0;   // B channel: unused
                    data[i + 3] = 255; // A channel: fully opaque
                    continue;
                }

                const dx = this._dispX[idxPix];
                const dy = this._dispY[idxPix];

                data[i] = ((dx / maxScale) + 0.5) * 255;
                data[i + 1] = ((dy / maxScale) + 0.5) * 255;
                data[i + 2] = 0;
                data[i + 3] = 255;
            }

            this.context.putImageData(this.imageData, 0, 0);

            // Update feImage every frame for tighter sync with physics data
            this.feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.canvas.toDataURL());

            this.feDisplacementMap.setAttribute('scale', (maxScale / this.canvasDPI).toString());
        }

        updatePolygon(newPolygon) {
            this.polygon = newPolygon;

            // Rebuild mask because polygon topology changed
            this.buildMask();

            // Update the SVG mask path
            this.updateMaskPath();

            // No need to update clip-path since we're using a rectangle
            this.updateShader(); // Already update after constraint solve
        }

        // Allow external callers (e.g., physics controller) to provide per-constraint
        // displacement influence information for the shader. Each element should be
        // of the form { ax, ay, bx, by, weight } in 0-1 normalized shader space.
        setConstraintData(data = []) {
            this.constraintData = Array.isArray(data) ? data : [];
        }

        setPosition(x, y) {
            let finalX = x;
            let finalY = y;

            // In iframe contexts, use absolute positioning and account for page scroll.
            // In a top-level window, use fixed positioning.
            if (window.parent !== window) {
                this.container.style.position = 'absolute';
                finalX += window.scrollX;
                finalY += window.scrollY;
            } else {
                this.container.style.position = 'fixed';
            }

            this.container.style.left = finalX + 'px';
            this.container.style.top = finalY + 'px';
        }

        appendTo(parent) {
            parent.appendChild(this.svg);
            parent.appendChild(this.container);
        }

        destroy() {
            if (this.svg.parentNode) this.svg.parentNode.removeChild(this.svg);
            if (this.container.parentNode) this.container.parentNode.removeChild(this.container);
            if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
        }

        resize(newWidth, newHeight) {
            // Do nothing if dimensions are the same
            if (this.width === newWidth && this.height === newHeight) {
                return;
            }

            this.width = newWidth;
            this.height = newHeight;

            // Update container div style
            this.container.style.width = this.width + 'px';
            this.container.style.height = this.height + 'px';

            // Update SVG mask attributes
            const mask = this.svg.querySelector(`#${this.id}_mask`);
            if (mask) {
                mask.setAttribute('width', this.width);
                mask.setAttribute('height', this.height);
            }

            // Update SVG filter attributes
            const filter = this.svg.querySelector(`#${this.id}_filter`);
            if (filter) {
                filter.setAttribute('width', this.width);
                filter.setAttribute('height', this.height);
            }

            // Update feImage attributes
            if (this.feImage) {
                this.feImage.setAttribute('width', this.width);
                this.feImage.setAttribute('height', this.height);
            }

            // Recreate canvas and context
            const newCanvasWidth = Math.round(this.width * this.canvasDPI);
            const newCanvasHeight = Math.round(this.height * this.canvasDPI);

            if (this.canvas.width !== newCanvasWidth || this.canvas.height !== newCanvasHeight) {
                this.canvas.width = newCanvasWidth;
                this.canvas.height = newCanvasHeight;
                this.context = this.canvas.getContext('2d');

                // Reallocate ImageData buffer
                this.imageData = this.context.createImageData(this.canvas.width, this.canvas.height);

                // Force a rebuild of displacement buffers in updateShader
                this._dispX = null;
                this._dispY = null;
            }

            // Rebuild pixel mask and update SVG path
            this.buildMask();
            this.updateMaskPath();
        }
    }

    class MixedSlimeRenderer {
        constructor(camera = null) {
            this.slimeCounter = 0;
            this.mainSVG = null;
            this.constraintsLayer = null; // Layer for constraints with opacity mask
            this.selectionLayer = null; // Separate layer for selection marker (always on top)
            this.camera = camera; // Optional ezdraw camera
            this.setupFullWindowSVG();

            this.mouseScreenPos = { x: 0, y: 0 };
            this.mouseWorldPos = { x: -1000, y: -1000 };
            this.selectedNode = null;
            this.closestNode = null;
            this.bodies = [];
            this.bindEvents();
        }

        setCamera(camera) {
            this.camera = camera;
        }

        worldToScreen(pt) {
            if (this.camera && typeof this.camera.worldToScreen === 'function') {
                const s = this.camera.worldToScreen(vec3(pt.x, pt.y, 0));
                return { x: s.x, y: s.y };
            }
            return { x: pt.x, y: pt.y };
        }

        getPixelsPerUnit() {
            if (this.camera && typeof this.camera.worldToScreen === 'function') {
                const a = this.camera.worldToScreen(vec3(0, 0, 0));
                const b = this.camera.worldToScreen(vec3(1, 0, 0));
                return Math.abs(b.x - a.x);
            }
            return 120;
        }

        screenToWorld(screenPos) {
            if (this.camera && typeof this.camera.screenToWorld === 'function') {
                const w = this.camera.screenToWorld(vec2(screenPos.x, screenPos.y));
                return { x: w.x, y: w.y };
            }
            return { x: screenPos.x, y: screenPos.y };
        }

        bindEvents() {
            window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            window.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            window.addEventListener('mouseup', () => this.handleMouseUp());
        }

        handleMouseMove(e) {
            this.mouseScreenPos = { x: e.clientX, y: e.clientY };
            this.mouseWorldPos = this.screenToWorld(this.mouseScreenPos);
        }

        handleMouseDown(e) {
            if (e.button !== 0) return;
            this.updateClosestNode();
            this.selectedNode = this.closestNode;
            if (this.selectedNode) {
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                if (typeof e.preventDefault === 'function') e.preventDefault();
            }
        }

        handleMouseUp() {
            this.selectedNode = null;
        }

        updateClosestNode(bodies = this.bodies) {
            this.bodies = bodies;
            if (!this.mouseWorldPos || !bodies) { this.closestNode = null; return; }
            let closest = null;
            let closestDistSq = Infinity;
            const pickRadiusSq = 0.3 * 0.3;
            for (const b of bodies) {
                const dx = b.position.x - this.mouseWorldPos.x;
                const dy = b.position.y - this.mouseWorldPos.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < pickRadiusSq && distSq < closestDistSq) {
                    closest = b;
                    closestDistSq = distSq;
                }
            }
            this.closestNode = closest;
        }

        setupFullWindowSVG() {
            // Create a single full-window SVG that will contain all slimes
            if (document.getElementById('slime-main-svg')) {
                this.mainSVG = document.getElementById('slime-main-svg');
                return;
            }

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'slime-main-svg';
            svg.style.position = 'fixed';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100vw';
            svg.style.height = '100vh';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '10002';
            svg.style.shapeRendering = 'geometricPrecision';

            // Set viewBox to match window size
            svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);

            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.id = 'slime-defs';

            // Create radial gradient for slime body
            const bodyGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
            bodyGradient.id = 'slime-body-gradient';
            bodyGradient.setAttribute('cx', '30%');
            bodyGradient.setAttribute('cy', '30%');
            bodyGradient.setAttribute('r', '70%');

            const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop1.setAttribute('offset', '0%');
            stop1.setAttribute('stop-color', '#C8E6FF');
            stop1.setAttribute('stop-opacity', '0.15');

            const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop2.setAttribute('offset', '40%');
            stop2.setAttribute('stop-color', '#4A90E2');
            stop2.setAttribute('stop-opacity', '0.25');

            const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop3.setAttribute('offset', '100%');
            stop3.setAttribute('stop-color', '#2E5BBA');
            stop3.setAttribute('stop-opacity', '0.35');

            bodyGradient.appendChild(stop1);
            bodyGradient.appendChild(stop2);
            bodyGradient.appendChild(stop3);

            // Create highlight gradient
            const highlightGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
            highlightGradient.id = 'slime-highlight-gradient';
            highlightGradient.setAttribute('cx', '25%');
            highlightGradient.setAttribute('cy', '25%');
            highlightGradient.setAttribute('r', '50%');

            const hStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            hStop1.setAttribute('offset', '0%');
            hStop1.setAttribute('stop-color', '#E6F3FF');
            hStop1.setAttribute('stop-opacity', '0.3');

            const hStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            hStop2.setAttribute('offset', '70%');
            hStop2.setAttribute('stop-color', '#B3D9FF');
            hStop2.setAttribute('stop-opacity', '0.1');

            const hStop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            hStop3.setAttribute('offset', '100%');
            hStop3.setAttribute('stop-color', '#E6F3FF');
            hStop3.setAttribute('stop-opacity', '0');

            highlightGradient.appendChild(hStop1);
            highlightGradient.appendChild(hStop2);
            highlightGradient.appendChild(hStop3);

            // Create blur filter for glow effect
            const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
            filter.id = 'slime-glow';
            filter.setAttribute('x', '-50%');
            filter.setAttribute('y', '-50%');
            filter.setAttribute('width', '200%');
            filter.setAttribute('height', '200%');

            const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
            feGaussianBlur.setAttribute('stdDeviation', '3');
            feGaussianBlur.setAttribute('result', 'coloredBlur');

            const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
            const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
            feMergeNode1.setAttribute('in', 'coloredBlur');
            const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
            feMergeNode2.setAttribute('in', 'SourceGraphic');

            feMerge.appendChild(feMergeNode1);
            feMerge.appendChild(feMergeNode2);
            filter.appendChild(feGaussianBlur);
            filter.appendChild(feMerge);

            // Create anime eye gradient (dark at top, lighter at bottom)
            const eyeGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            eyeGradient.id = 'anime-eye-gradient';
            eyeGradient.setAttribute('x1', '0%');
            eyeGradient.setAttribute('y1', '0%');
            eyeGradient.setAttribute('x2', '0%');
            eyeGradient.setAttribute('y2', '100%');

            const eyeStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            eyeStop1.setAttribute('offset', '0%');
            eyeStop1.setAttribute('stop-color', '#1a1a1a'); // dark at top

            const eyeStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            eyeStop2.setAttribute('offset', '70%');
            eyeStop2.setAttribute('stop-color', '#333333'); // mid tone

            const eyeStop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            eyeStop3.setAttribute('offset', '100%');
            eyeStop3.setAttribute('stop-color', '#4a4a4a'); // lighter at bottom

            eyeGradient.appendChild(eyeStop1);
            eyeGradient.appendChild(eyeStop2);
            eyeGradient.appendChild(eyeStop3);

            // Create drop shadow filter
            const dropShadowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
            dropShadowFilter.id = 'slime-drop-shadow';
            dropShadowFilter.setAttribute('x', '-50%');
            dropShadowFilter.setAttribute('y', '-50%');
            dropShadowFilter.setAttribute('width', '200%');
            dropShadowFilter.setAttribute('height', '200%');

            // Create the shadow
            const feDropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
            feDropShadow.setAttribute('dx', '3');
            feDropShadow.setAttribute('dy', '6');
            feDropShadow.setAttribute('stdDeviation', '4');
            feDropShadow.setAttribute('flood-color', '#000000');
            feDropShadow.setAttribute('flood-opacity', '0.15');

            dropShadowFilter.appendChild(feDropShadow);

            defs.appendChild(bodyGradient);
            defs.appendChild(highlightGradient);
            defs.appendChild(filter);
            defs.appendChild(eyeGradient);
            defs.appendChild(dropShadowFilter);

            svg.appendChild(defs);
            // Don't append to body here. Let the controller do it.

            this.mainSVG = svg;

            // Handle window resize
            window.addEventListener('resize', () => {
                if (this.mainSVG) {
                    this.mainSVG.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
                }
            });
        }

        // NEW: utility to update gradients based on a single base color
        updateGradientColors(baseColor = '#4A90E2') {
            if (!this.mainSVG) return;

            const bodyGradient = this.mainSVG.querySelector('#slime-body-gradient');
            const highlightGradient = this.mainSVG.querySelector('#slime-highlight-gradient');
            if (!bodyGradient || !highlightGradient) return;

            const bodyStops = bodyGradient.querySelectorAll('stop');
            const highlightStops = highlightGradient.querySelectorAll('stop');
            if (bodyStops.length < 3 || highlightStops.length < 3) return;

            const toRgb = (hex) => {
                let h = hex.replace('#', '');
                if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
                const num = parseInt(h, 16);
                return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
            };
            const fromRgb = ({ r, g, b }) => {
                const toHex = (c) => ('0' + Math.round(Math.min(255, Math.max(0, c))).toString(16)).slice(-2);
                return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
            };
            const lighten = (hex, amt) => {
                const rgb = toRgb(hex);
                return fromRgb({
                    r: rgb.r + (255 - rgb.r) * amt,
                    g: rgb.g + (255 - rgb.g) * amt,
                    b: rgb.b + (255 - rgb.b) * amt
                });
            };
            const darken = (hex, amt) => {
                const rgb = toRgb(hex);
                return fromRgb({
                    r: rgb.r * (1 - amt),
                    g: rgb.g * (1 - amt),
                    b: rgb.b * (1 - amt)
                });
            };

            const defaultBlue = '#4A90E2';
            const base = baseColor.toLowerCase();

            let bodyColors, highlightColors;
            if (base === defaultBlue.toLowerCase()) {
                // Keep existing exact colors for the default blue so visuals don't change at all
                bodyColors = ['#C8E6FF', '#4A90E2', '#2E5BBA'];
                highlightColors = ['#E6F3FF', '#B3D9FF', '#E6F3FF'];
            } else {
                // Derive lighter/darker variants from the provided base colour
                bodyColors = [lighten(base, 0.65), baseColor, darken(base, 0.45)];
                highlightColors = [lighten(base, 0.85), lighten(base, 0.55), lighten(base, 0.85)];
            }

            // Apply updated colours while preserving original opacities
            bodyStops[0].setAttribute('stop-color', bodyColors[0]);
            bodyStops[1].setAttribute('stop-color', bodyColors[1]);
            bodyStops[2].setAttribute('stop-color', bodyColors[2]);

            highlightStops[0].setAttribute('stop-color', highlightColors[0]);
            highlightStops[1].setAttribute('stop-color', highlightColors[1]);
            highlightStops[2].setAttribute('stop-color', highlightColors[2]);
        }

        // Convert slime vertices to normalized polygon for shader
        vertsToNormalizedPolygon(verts, bbox) {
            // First normalize the vertices
            const normalized = verts.map(v => ({
                x: (v.x - bbox.x) / bbox.width,
                y: (v.y - bbox.y) / bbox.height
            }));

            // Then shrink the polygon slightly inward to prevent edge bleeding
            const shrinkFactor = 0.95; // Shrink by 5%
            const center = { x: 0.5, y: 0.5 }; // Center of normalized space

            return normalized.map(v => ({
                x: center.x + (v.x - center.x) * shrinkFactor,
                y: center.y + (v.y - center.y) * shrinkFactor
            }));
        }

        createSlime(worldVerts, pixelsPerUnit = null, baseColor = '#4A90E2') {
            // Update gradients and cached colour before any SVG elements are created
            this.updateGradientColors(baseColor);

            if (!worldVerts || worldVerts.length < 3) {
                throw new Error('Slime needs at least 3 vertices');
            }

            const verts = worldVerts.map(v => this.worldToScreen(v));
            pixelsPerUnit = pixelsPerUnit ?? this.getPixelsPerUnit();

            const slimeId = `slime-${this.slimeCounter++}`;

            // Create a group to contain both paths
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.id = slimeId;
            group.style.pointerEvents = 'none'; // Pass through mouse events

            // Create slime body path
            const bodyPath = this.createSmoothPath(verts);
            bodyPath.setAttribute('fill', 'url(#slime-body-gradient)');
            bodyPath.setAttribute('stroke', baseColor);
            bodyPath.setAttribute('stroke-width', '1');
            bodyPath.setAttribute('stroke-opacity', '0.2');
            bodyPath.setAttribute('filter', 'url(#slime-glow) url(#slime-drop-shadow)');

            // Create highlight path (slightly smaller)
            const highlightPath = this.createSmoothPath(verts, 0.8);
            highlightPath.setAttribute('fill', 'url(#slime-highlight-gradient)');
            highlightPath.setAttribute('filter', 'url(#slime-distortion)');

            group.appendChild(bodyPath);
            group.appendChild(highlightPath);
            // -----------------------
            // Cute anime eyes - now sized based on PIXELS_PER_UNIT
            // -----------------------
            const centroid = this.calculateCentroid(verts);
            const eyeBBox = this.calculateBBox(verts);

            // Calculate eye sizes based on slime size
            const baseSizeWorld = Math.max(eyeBBox.width, eyeBBox.height) / pixelsPerUnit;
            const eyeWorldSize = baseSizeWorld * 0.0667;
            const eyeWidth = eyeWorldSize * pixelsPerUnit;
            const eyeHeight = eyeWidth * 1.4; // egg shape - taller than wide
            const shineWidth = eyeWidth * 0.25;
            const shineHeight = eyeWidth * 0.42;

            // Eye offset proportional to slime bounds
            const eyeOffsetX = eyeBBox.width * 0.125;
            const eyeOffsetY = eyeBBox.height * 0.0416667;

            // Eye centers
            const leftEyeCX = centroid.x - eyeOffsetX;
            const leftEyeCY = centroid.y - eyeOffsetY;
            const rightEyeCX = centroid.x + eyeOffsetX;
            const rightEyeCY = centroid.y - eyeOffsetY;

            // Shine positions (offset from eye centers)
            const leftShineCX = leftEyeCX - eyeWidth * 0.4;
            const leftShineCY = leftEyeCY - eyeHeight * 0.3;
            const rightShineCX = rightEyeCX - eyeWidth * 0.4;
            const rightShineCY = rightEyeCY - eyeHeight * 0.3;

            // Left eye (ellipse with anime gradient)
            const eyeLeftMain = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            eyeLeftMain.setAttribute('cx', leftEyeCX);
            eyeLeftMain.setAttribute('cy', leftEyeCY);
            eyeLeftMain.setAttribute('rx', eyeWidth);
            eyeLeftMain.setAttribute('ry', eyeHeight);
            eyeLeftMain.setAttribute('fill', 'url(#anime-eye-gradient)');
            eyeLeftMain.style.pointerEvents = 'none';

            // Left eye shine (small white circle in top-left)
            const eyeLeftShineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            eyeLeftShineGroup.setAttribute('transform', `translate(${leftShineCX}, ${leftShineCY}) rotate(16)`);

            const eyeLeftShine = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            eyeLeftShine.setAttribute('cx', 0);
            eyeLeftShine.setAttribute('cy', 0);
            eyeLeftShine.setAttribute('rx', shineWidth);
            eyeLeftShine.setAttribute('ry', shineHeight);
            eyeLeftShine.setAttribute('fill', '#FFFFFF');
            eyeLeftShine.setAttribute('fill-opacity', '0.9');
            eyeLeftShine.style.pointerEvents = 'none';

            eyeLeftShineGroup.appendChild(eyeLeftShine);

            // Right eye (ellipse with anime gradient)
            const eyeRightMain = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            eyeRightMain.setAttribute('cx', rightEyeCX);
            eyeRightMain.setAttribute('cy', rightEyeCY);
            eyeRightMain.setAttribute('rx', eyeWidth);
            eyeRightMain.setAttribute('ry', eyeHeight);
            eyeRightMain.setAttribute('fill', 'url(#anime-eye-gradient)');
            eyeRightMain.style.pointerEvents = 'none';

            // Right eye shine (small white circle in top-left)
            const eyeRightShineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            eyeRightShineGroup.setAttribute('transform', `translate(${rightShineCX}, ${rightShineCY}) rotate(16)`);

            const eyeRightShine = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            eyeRightShine.setAttribute('cx', 0);
            eyeRightShine.setAttribute('cy', 0);
            eyeRightShine.setAttribute('rx', shineWidth);
            eyeRightShine.setAttribute('ry', shineHeight);
            eyeRightShine.setAttribute('fill', '#FFFFFF');
            eyeRightShine.setAttribute('fill-opacity', '0.9');
            eyeRightShine.style.pointerEvents = 'none';

            eyeRightShineGroup.appendChild(eyeRightShine);

            // Add eyes to group after highlight so they render above body but below future additions
            group.appendChild(eyeLeftMain);
            group.appendChild(eyeRightMain);
            group.appendChild(eyeLeftShineGroup);
            group.appendChild(eyeRightShineGroup);

            this.mainSVG.appendChild(group);

            // Create displacement shader for background distortion
            const bbox = this.calculateBBox(verts);

            // Add padding to ensure full coverage, especially in smaller viewports
            const padding = Math.max(50, Math.min(bbox.width, bbox.height) * 0.2);
            const shaderWidth = bbox.width + padding * 2;
            const shaderHeight = bbox.height + padding * 2;
            const shaderX = bbox.x - padding;
            const shaderY = bbox.y - padding;

            // Create expanded bbox that includes padding for normalization
            const expandedBBox = {
                x: shaderX,
                y: shaderY,
                width: shaderWidth,
                height: shaderHeight
            };

            const normalizedPolygon = this.vertsToNormalizedPolygon(verts, expandedBBox);

            // --- Calculate an approximate radius for the droplet effect ---
            // This is used to make the shader effect conform to the slime's shape.
            const normalizedCenter = { x: 0.5, y: 0.5 };
            const radii = normalizedPolygon.map(p => Math.sqrt(Math.pow(p.x - normalizedCenter.x, 2) + Math.pow(p.y - normalizedCenter.y, 2)));
            // Using maxRadius ensures the effect covers the entire polygon.
            const maxRadius = Math.max(...radii, 0.01); // Avoid division by zero

            const shader = new PolygonShader({
                width: Math.max(shaderWidth, 100),
                height: Math.max(shaderHeight, 100),
                polygon: normalizedPolygon,
                fragment: (uv, constraints) => {
                    const centerX = 0.5;
                    const centerY = 0.5;

                    // --- 1. Constraint-based warping & stress calculation ---
                    let dx_c = 0, dy_c = 0;
                    let totalStress = 0;
                    const falloff = 10.0;
                    const baseAmp = 0.25;

                    for (const c of constraints) {
                        totalStress += Math.abs(c.weight);

                        const vx = c.bx - c.ax;
                        const vy = c.by - c.ay;
                        const wx = uv.x - c.ax;
                        const wy = uv.y - c.ay;

                        const segLenSq = vx * vx + vy * vy;
                        let t = 0;
                        if (segLenSq > 0) {
                            t = (wx * vx + wy * vy) / segLenSq;
                            t = Math.max(0, Math.min(1, t));
                        }

                        const projX = c.ax + t * vx;
                        const projY = c.ay + t * vy;

                        const dxSeg = uv.x - projX;
                        const dySeg = uv.y - projY;
                        const dist = Math.sqrt(dxSeg * dxSeg + dySeg * dySeg);

                        let nx = -vy;
                        let ny = vx;
                        const len = Math.sqrt(nx * nx + ny * ny) || 1;
                        nx /= len;
                        ny /= len;

                        const influence = c.weight * baseAmp * Math.exp(-dist * falloff);
                        dx_c += nx * influence;
                        dy_c += ny * influence;
                    }

                    const constrainedUvX = uv.x + dx_c;
                    const constrainedUvY = uv.y + dy_c;

                    // --- 2. 3D Water Droplet Refraction Effect ---
                    const vecX = constrainedUvX - centerX;
                    const vecY = constrainedUvY - centerY;
                    const r = Math.sqrt(vecX * vecX + vecY * vecY);

                    const norm_r = r / maxRadius;

                    let finalX = constrainedUvX;
                    let finalY = constrainedUvY;

                    if (norm_r < 1.0) {
                        // Modulate refraction power based on the slime's internal stress.
                        const stressFactor = Math.min(totalStress * 0.05, 1.0); // Clamp effect
                        const basePower = 1.8; // Slightly less base distortion
                        const extraPower = 1.2; // Additional power from stress
                        const power = basePower + extraPower * stressFactor;

                        const mapped_r = maxRadius * Math.pow(norm_r, power);
                        const ratio = (r > 1e-6) ? (mapped_r / r) : 0;

                        finalX = centerX + vecX * ratio;
                        finalY = centerY + vecY * ratio;

                        // --- 3. Add viscous "gooey" ripples ---
                        const rippleVecX = finalX - centerX;
                        const rippleVecY = finalY - centerY;

                        // Use a swirling pattern for a more liquid/gooey feel
                        const angle = Math.atan2(rippleVecY, rippleVecX);
                        const distFromCenter = Math.sqrt(rippleVecX * rippleVecX + rippleVecY * rippleVecY);

                        // Base swirl on the angle, make it slow and gloopy
                        const swirlStrength = 0.008 * (1.0 - norm_r); // Stronger at center
                        const swirl = Math.sin(angle * 6.0 + distFromCenter * 15.0);

                        // Apply displacement perpendicular to the vector from center (creates rotation)
                        finalX -= rippleVecY * swirl * swirlStrength;
                        finalY += rippleVecX * swirl * swirlStrength;

                        // Also add some radial push/pull for a boiling/simmering effect
                        const pulseFrequency = 10.0;
                        const pulseAmplitude = 0.004 * (1.0 - norm_r);
                        const pulse = Math.sin(distFromCenter * pulseFrequency) * pulseAmplitude;

                        finalX += rippleVecX * pulse;
                        finalY += rippleVecY * pulse;
                    }

                    // The final returned coordinate is where the background is sampled from.
                    return { x: finalX, y: finalY };
                }
            });

            // Position shader to match slime exactly (with padding offset)
            shader.setPosition(shaderX, shaderY);
            shader.appendTo(document.body);

            // Initialise with empty constraint data; will be updated each frame by controller
            shader.setConstraintData([]);

            // Start animation loop for this shader
            // const animate = () => {
            //     shader.updateShader(); // already update after constraint solve
            //     shader.animationFrame = requestAnimationFrame(animate);
            // };
            // shader.animationFrame = requestAnimationFrame(animate);

            return {
                id: slimeId,
                element: group,
                shader: shader,
                verts: [...verts],
                eyeLeftMain,
                eyeLeftShineGroup,
                eyeRightMain,
                eyeRightShineGroup,
                // Store initial eye dimensions to keep them constant
                initialEyeWidth: eyeWidth,
                initialEyeHeight: eyeHeight,
                initialShineWidth: shineWidth,
                initialShineHeight: shineHeight,
                // Store current eye positions for smooth interpolation
                currentLeftEyePos: { x: leftEyeCX, y: leftEyeCY },
                currentRightEyePos: { x: rightEyeCX, y: rightEyeCY },
                // Store the initial shape's "mass center" for stable reference
                initialMassCenter: this.calculateMassCenter(verts),
                initialBBoxSize: pixelsPerUnit, // Use the actual pixels per unit
                pixelsPerUnit: pixelsPerUnit, // Store for later use
                // Store expandedBBox for constraint mapping during rendering
                expandedBBox: expandedBBox,
                // Store current eye style
                eyeStyle: 'normal'
            };
        }

        // Create minimum thickness vertices when slime is flattened to 2 points
        createMinimumThicknessVerts(twoVerts, pixelsPerUnit) {
            if (twoVerts.length !== 2) return twoVerts;

            const [p1, p2] = twoVerts;
            
            // Calculate the vector between the two points
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            // If points are too close, create a small circle
            if (length < 0.1) {
                const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                const radius = 0.3; // Minimum radius in world units
                const numPoints = 6;
                const verts = [];
                
                for (let i = 0; i < numPoints; i++) {
                    const angle = (i / numPoints) * Math.PI * 2;
                    verts.push({
                        x: center.x + Math.cos(angle) * radius,
                        y: center.y + Math.sin(angle) * radius
                    });
                }
                return verts;
            }
            
            // Create perpendicular vector for thickness
            const perpX = -dy / length;
            const perpY = dx / length;
            
            // Minimum thickness in world units (adjust based on pixelsPerUnit for consistent visual size)
            const minThickness = 10; // px
            
            // Create 4 vertices forming a thin rectangle
            const halfThickness = minThickness / 2;
            
            return [
                { x: p1.x + perpX * halfThickness, y: p1.y + perpY * halfThickness },
                { x: p2.x + perpX * halfThickness, y: p2.y + perpY * halfThickness },
                { x: p2.x - perpX * halfThickness, y: p2.y - perpY * halfThickness },
                { x: p1.x - perpX * halfThickness, y: p1.y - perpY * halfThickness }
            ];
        }

        updateSlime(slime, worldVerts, pixelsPerUnit = null) {
            if (!slime || !slime.element || !worldVerts || worldVerts.length < 2) {
                return;
            }

            pixelsPerUnit = pixelsPerUnit ?? this.getPixelsPerUnit();
            let processedVerts = worldVerts.map(v => this.worldToScreen(v));
            if (processedVerts.length === 2) {
                processedVerts = this.createMinimumThicknessVerts(processedVerts, pixelsPerUnit);
            } else if (processedVerts.length < 3) {
                return; // Still can't handle less than 2 vertices
            }

            // Recompute geometry helpers for eyes and shader/bounding
            const bbox = this.calculateBBox(processedVerts);
            const centroid = this.calculateCentroid(processedVerts);

            // Update paths directly with new vertices
            const paths = slime.element.querySelectorAll('path');
            if (paths.length >= 2) {
                const bodyPath = this.createSmoothPath(processedVerts);
                const highlightPath = this.createSmoothPath(processedVerts, 0.8);

                paths[0].setAttribute('d', bodyPath.getAttribute('d'));
                paths[1].setAttribute('d', highlightPath.getAttribute('d'));
            }

            // Update shader polygon and position
            if (slime.shader) {
                // Use the same padding logic as in createSlime
                const padding = Math.max(50, Math.min(bbox.width, bbox.height) * 0.2);
                const shaderX = bbox.x - padding;
                const shaderY = bbox.y - padding;
                const shaderWidth = Math.max(100, bbox.width + padding * 2);
                const shaderHeight = Math.max(100, bbox.height + padding * 2);

                // Resize the shader to match the new bounding box
                slime.shader.resize(shaderWidth, shaderHeight);

                // Create expanded bbox that includes padding for normalization
                const expandedBBox = {
                    x: shaderX,
                    y: shaderY,
                    width: shaderWidth,
                    height: shaderHeight
                };

                const normalizedPolygon = this.vertsToNormalizedPolygon(processedVerts, expandedBBox);

                slime.shader.updatePolygon(normalizedPolygon);
                slime.shader.setPosition(shaderX, shaderY);

                // Update stored expanded bounding box for constraint mapping
                slime.expandedBBox = expandedBBox;
            }

            // Update eyes if present
            if (slime.eyeLeftMain) {
                const bboxWorldWidth = bbox.width / pixelsPerUnit;
                const bboxWorldHeight = bbox.height / pixelsPerUnit;
                const baseSizeWorld = Math.max(bboxWorldWidth, bboxWorldHeight);
                const eyeWorldSize = baseSizeWorld * 0.0667;
                const eyeWidth = eyeWorldSize * pixelsPerUnit;
                const eyeHeight = eyeWidth * 1.4;
                const shineWidth = eyeWidth * 0.25;
                const shineHeight = eyeWidth * 0.42;
                const eyeOffsetX = bboxWorldWidth * 0.125 * pixelsPerUnit;
                const eyeOffsetY = bboxWorldHeight * 0.0416667 * pixelsPerUnit;
                slime.initialEyeWidth = eyeWidth;
                slime.initialEyeHeight = eyeHeight;
                slime.initialShineWidth = shineWidth;
                slime.initialShineHeight = shineHeight;

                // Calculate stable eye positions with smooth interpolation
                const eyePositions = this.calculateStableEyePositions(slime, processedVerts, eyeOffsetX, eyeOffsetY, pixelsPerUnit);
                const leftEyeCX = eyePositions.leftEye.x;
                const leftEyeCY = eyePositions.leftEye.y;
                const rightEyeCX = eyePositions.rightEye.x;
                const rightEyeCY = eyePositions.rightEye.y;

                // Update eyes based on current style
                this.updateEyePositions(slime, leftEyeCX, leftEyeCY, rightEyeCX, rightEyeCY);
            }

            slime.verts = [...processedVerts];
        }

        createSmoothPath(verts, scale = 1) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

            if (verts.length < 3) {
                return path;
            }

            // If scaling, scale around the centroid
            let scaledVerts = verts;
            if (scale !== 1) {
                const centroid = this.calculateCentroid(verts);
                scaledVerts = verts.map(v => ({
                    x: centroid.x + (v.x - centroid.x) * scale,
                    y: centroid.y + (v.y - centroid.y) * scale
                }));
            }

            // Create ultra-smooth path using cubic Bézier curves
            let pathData = `M ${scaledVerts[0].x} ${scaledVerts[0].y}`;

            for (let i = 0; i < scaledVerts.length; i++) {
                const current = scaledVerts[i];
                const next = scaledVerts[(i + 1) % scaledVerts.length];
                const prev = scaledVerts[(i - 1 + scaledVerts.length) % scaledVerts.length];
                const nextNext = scaledVerts[(i + 2) % scaledVerts.length];

                // Calculate control points for smooth cubic Bézier curve
                const tension = 0.3; // Controls how "tight" the curves are

                // Vector from previous to next point
                const prevToNext = {
                    x: next.x - prev.x,
                    y: next.y - prev.y
                };

                // Vector from current to next-next point
                const currentToNextNext = {
                    x: nextNext.x - current.x,
                    y: nextNext.y - current.y
                };

                // Control point 1: extends from current point
                const cp1 = {
                    x: current.x + prevToNext.x * tension,
                    y: current.y + prevToNext.y * tension
                };

                // Control point 2: extends backwards from next point
                const cp2 = {
                    x: next.x - currentToNextNext.x * tension,
                    y: next.y - currentToNextNext.y * tension
                };

                pathData += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${next.x} ${next.y}`;
            }

            pathData += ' Z';
            path.setAttribute('d', pathData);

            return path;
        }

        calculateCentroid(verts) {
            const sum = verts.reduce((acc, v) => ({
                x: acc.x + v.x,
                y: acc.y + v.y
            }), { x: 0, y: 0 });

            return {
                x: sum.x / verts.length,
                y: sum.y / verts.length
            };
        }

        // More stable center calculation using area-weighted centroid
        calculateMassCenter(verts) {
            if (verts.length < 3) return this.calculateCentroid(verts);

            let area = 0;
            let cx = 0;
            let cy = 0;

            // Use shoelace formula for polygon area and centroid
            for (let i = 0; i < verts.length; i++) {
                const j = (i + 1) % verts.length;
                const cross = verts[i].x * verts[j].y - verts[j].x * verts[i].y;
                area += cross;
                cx += (verts[i].x + verts[j].x) * cross;
                cy += (verts[i].y + verts[j].y) * cross;
            }

            area *= 0.5;
            if (Math.abs(area) < 1e-10) {
                // Fallback to simple centroid for degenerate cases
                return this.calculateCentroid(verts);
            }

            cx /= (6 * area);
            cy /= (6 * area);

            return { x: cx, y: cy };
        }

        // Smooth interpolation function
        lerp(a, b, t) {
            return a + (b - a) * t;
        }

        // Calculate stable eye positions with smooth interpolation
        calculateStableEyePositions(slime, newVerts, eyeOffsetX, eyeOffsetY, pixelsPerUnit) {
            const massCenter = this.calculateMassCenter(newVerts);

            const targetLeftEyePos = {
                x: massCenter.x - eyeOffsetX,
                y: massCenter.y - eyeOffsetY
            };
            const targetRightEyePos = {
                x: massCenter.x + eyeOffsetX,
                y: massCenter.y - eyeOffsetY
            };

            const leftDistance = Math.hypot(
                targetLeftEyePos.x - slime.currentLeftEyePos.x,
                targetLeftEyePos.y - slime.currentLeftEyePos.y
            );
            const rightDistance = Math.hypot(
                targetRightEyePos.x - slime.currentRightEyePos.x,
                targetRightEyePos.y - slime.currentRightEyePos.y
            );

            const maxJumpDistance = pixelsPerUnit * 0.3;
            const leftLerpSpeed = leftDistance > maxJumpDistance ? 0.4 : 0.8;
            const rightLerpSpeed = rightDistance > maxJumpDistance ? 0.4 : 0.8;

            slime.currentLeftEyePos.x = this.lerp(slime.currentLeftEyePos.x, targetLeftEyePos.x, leftLerpSpeed);
            slime.currentLeftEyePos.y = this.lerp(slime.currentLeftEyePos.y, targetLeftEyePos.y, leftLerpSpeed);
            slime.currentRightEyePos.x = this.lerp(slime.currentRightEyePos.x, targetRightEyePos.x, rightLerpSpeed);
            slime.currentRightEyePos.y = this.lerp(slime.currentRightEyePos.y, targetRightEyePos.y, rightLerpSpeed);

            return {
                leftEye: { ...slime.currentLeftEyePos },
                rightEye: { ...slime.currentRightEyePos }
            };
        }

        calculateBBox(verts) {
            const xs = verts.map(v => v.x);
            const ys = verts.map(v => v.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        }

        removeSlime(slime) {
            if (slime && slime.element && slime.element.parentNode) {
                slime.element.parentNode.removeChild(slime.element);
            }

            // Clean up shader
            if (slime.shader) {
                if (slime.shader.animationFrame) {
                    cancelAnimationFrame(slime.shader.animationFrame);
                }
                slime.shader.destroy();
            }
        }

        // Method to switch eye styles
        setSlimeEyeStyle(slime, eyeStyle) {
            if (!slime || !slime.element) return;

            slime.eyeStyle = eyeStyle;

            // Get current eye positions
            const leftEyeCX = slime.currentLeftEyePos.x;
            const leftEyeCY = slime.currentLeftEyePos.y;
            const rightEyeCX = slime.currentRightEyePos.x;
            const rightEyeCY = slime.currentRightEyePos.y;

            // Remove existing eyes
            if (slime.eyeLeftMain && slime.eyeLeftMain.parentNode) {
                slime.eyeLeftMain.parentNode.removeChild(slime.eyeLeftMain);
            }
            if (slime.eyeLeftShineGroup && slime.eyeLeftShineGroup.parentNode) {
                slime.eyeLeftShineGroup.parentNode.removeChild(slime.eyeLeftShineGroup);
            }
            if (slime.eyeRightMain && slime.eyeRightMain.parentNode) {
                slime.eyeRightMain.parentNode.removeChild(slime.eyeRightMain);
            }
            if (slime.eyeRightShineGroup && slime.eyeRightShineGroup.parentNode) {
                slime.eyeRightShineGroup.parentNode.removeChild(slime.eyeRightShineGroup);
            }

            // Create new eyes based on style
            if (eyeStyle === 'sleepy') {
                this.createSleepyEyes(slime, leftEyeCX, leftEyeCY, rightEyeCX, rightEyeCY);
            } else {
                // Default to normal eyes
                this.createNormalEyes(slime, leftEyeCX, leftEyeCY, rightEyeCX, rightEyeCY);
            }
        }

        // Create normal anime-style eyes
        createNormalEyes(slime, leftEyeCX, leftEyeCY, rightEyeCX, rightEyeCY) {
            const eyeWidth = slime.initialEyeWidth;
            const eyeHeight = slime.initialEyeHeight;
            const shineWidth = slime.initialShineWidth;
            const shineHeight = slime.initialShineHeight;

            // Shine positions (offset from eye centers)
            const leftShineCX = leftEyeCX - eyeWidth * 0.4;
            const leftShineCY = leftEyeCY - eyeHeight * 0.3;
            const rightShineCX = rightEyeCX - eyeWidth * 0.4;
            const rightShineCY = rightEyeCY - eyeHeight * 0.3;

            // Left eye (ellipse with anime gradient)
            const eyeLeftMain = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            eyeLeftMain.setAttribute('cx', leftEyeCX);
            eyeLeftMain.setAttribute('cy', leftEyeCY);
            eyeLeftMain.setAttribute('rx', eyeWidth);
            eyeLeftMain.setAttribute('ry', eyeHeight);
            eyeLeftMain.setAttribute('fill', 'url(#anime-eye-gradient)');
            eyeLeftMain.style.pointerEvents = 'none';

            // Left eye shine
            const eyeLeftShineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            eyeLeftShineGroup.setAttribute('transform', `translate(${leftShineCX}, ${leftShineCY}) rotate(16)`);

            const eyeLeftShine = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            eyeLeftShine.setAttribute('cx', 0);
            eyeLeftShine.setAttribute('cy', 0);
            eyeLeftShine.setAttribute('rx', shineWidth);
            eyeLeftShine.setAttribute('ry', shineHeight);
            eyeLeftShine.setAttribute('fill', '#FFFFFF');
            eyeLeftShine.setAttribute('fill-opacity', '0.9');
            eyeLeftShine.style.pointerEvents = 'none';

            eyeLeftShineGroup.appendChild(eyeLeftShine);

            // Right eye (ellipse with anime gradient)
            const eyeRightMain = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            eyeRightMain.setAttribute('cx', rightEyeCX);
            eyeRightMain.setAttribute('cy', rightEyeCY);
            eyeRightMain.setAttribute('rx', eyeWidth);
            eyeRightMain.setAttribute('ry', eyeHeight);
            eyeRightMain.setAttribute('fill', 'url(#anime-eye-gradient)');
            eyeRightMain.style.pointerEvents = 'none';

            // Right eye shine
            const eyeRightShineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            eyeRightShineGroup.setAttribute('transform', `translate(${rightShineCX}, ${rightShineCY}) rotate(16)`);

            const eyeRightShine = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            eyeRightShine.setAttribute('cx', 0);
            eyeRightShine.setAttribute('cy', 0);
            eyeRightShine.setAttribute('rx', shineWidth);
            eyeRightShine.setAttribute('ry', shineHeight);
            eyeRightShine.setAttribute('fill', '#FFFFFF');
            eyeRightShine.setAttribute('fill-opacity', '0.9');
            eyeRightShine.style.pointerEvents = 'none';

            eyeRightShineGroup.appendChild(eyeRightShine);

            // Add eyes to the slime group
            slime.element.appendChild(eyeLeftMain);
            slime.element.appendChild(eyeRightMain);
            slime.element.appendChild(eyeLeftShineGroup);
            slime.element.appendChild(eyeRightShineGroup);

            // Update slime references
            slime.eyeLeftMain = eyeLeftMain;
            slime.eyeLeftShineGroup = eyeLeftShineGroup;
            slime.eyeRightMain = eyeRightMain;
            slime.eyeRightShineGroup = eyeRightShineGroup;
        }

        // Create sleepy eyes (curved lines slanted inward)
        createSleepyEyes(slime, leftEyeCX, leftEyeCY, rightEyeCX, rightEyeCY) {
            const eyeWidth = slime.initialEyeWidth;
            const eyeHeight = slime.initialEyeHeight;

            // Create sleepy eye paths (curved lines)
            // Left eye - curved line slanted inward (higher on the outside)
            const eyeLeftMain = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const leftStartX = leftEyeCX - eyeWidth * 0.8;
            const leftStartY = leftEyeCY - eyeHeight * 0.1; // Slightly higher on outside
            const leftEndX = leftEyeCX + eyeWidth * 0.8;
            const leftEndY = leftEyeCY + eyeHeight * 0.3; // Lower on inside
            const leftControlX = leftEyeCX;
            const leftControlY = leftEyeCY - eyeHeight * 0.2; // Control point for curve

            const leftPath = `M ${leftStartX} ${leftStartY} Q ${leftControlX} ${leftControlY} ${leftEndX} ${leftEndY}`;
            eyeLeftMain.setAttribute('d', leftPath);
            eyeLeftMain.setAttribute('fill', 'none');
            eyeLeftMain.setAttribute('stroke', '#2a2a2a');
            eyeLeftMain.setAttribute('stroke-width', '2');
            eyeLeftMain.setAttribute('stroke-linecap', 'round');
            eyeLeftMain.style.pointerEvents = 'none';

            // Right eye - curved line slanted inward (higher on the outside)
            const eyeRightMain = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const rightStartX = rightEyeCX - eyeWidth * 0.8;
            const rightStartY = rightEyeCY + eyeHeight * 0.3; // Lower on inside
            const rightEndX = rightEyeCX + eyeWidth * 0.8;
            const rightEndY = rightEyeCY - eyeHeight * 0.1; // Higher on outside
            const rightControlX = rightEyeCX;
            const rightControlY = rightEyeCY - eyeHeight * 0.2; // Control point for curve

            const rightPath = `M ${rightStartX} ${rightStartY} Q ${rightControlX} ${rightControlY} ${rightEndX} ${rightEndY}`;
            eyeRightMain.setAttribute('d', rightPath);
            eyeRightMain.setAttribute('fill', 'none');
            eyeRightMain.setAttribute('stroke', '#2a2a2a');
            eyeRightMain.setAttribute('stroke-width', '2');
            eyeRightMain.setAttribute('stroke-linecap', 'round');
            eyeRightMain.style.pointerEvents = 'none';

            // No shine for sleepy eyes - create empty groups to maintain compatibility
            const eyeLeftShineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const eyeRightShineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

            // Add eyes to the slime group
            slime.element.appendChild(eyeLeftMain);
            slime.element.appendChild(eyeRightMain);
            slime.element.appendChild(eyeLeftShineGroup);
            slime.element.appendChild(eyeRightShineGroup);

            // Update slime references
            slime.eyeLeftMain = eyeLeftMain;
            slime.eyeLeftShineGroup = eyeLeftShineGroup;
            slime.eyeRightMain = eyeRightMain;
            slime.eyeRightShineGroup = eyeRightShineGroup;
        }

        // Update eye positions based on current style
        updateEyePositions(slime, leftEyeCX, leftEyeCY, rightEyeCX, rightEyeCY) {
            if (slime.eyeStyle === 'sleepy') {
                this.updateSleepyEyePositions(slime, leftEyeCX, leftEyeCY, rightEyeCX, rightEyeCY);
            } else {
                this.updateNormalEyePositions(slime, leftEyeCX, leftEyeCY, rightEyeCX, rightEyeCY);
            }
        }

        // Update normal eye positions
        updateNormalEyePositions(slime, leftEyeCX, leftEyeCY, rightEyeCX, rightEyeCY) {
            const eyeWidth = slime.initialEyeWidth;
            const eyeHeight = slime.initialEyeHeight;
            const shineWidth = slime.initialShineWidth;
            const shineHeight = slime.initialShineHeight;

            // Shine positions (offset from eye centers)
            const leftShineCX = leftEyeCX - eyeWidth * 0.4;
            const leftShineCY = leftEyeCY - eyeHeight * 0.3;
            const rightShineCX = rightEyeCX - eyeWidth * 0.4;
            const rightShineCY = rightEyeCY - eyeHeight * 0.3;

            // Left eye
            slime.eyeLeftMain.setAttribute('cx', leftEyeCX);
            slime.eyeLeftMain.setAttribute('cy', leftEyeCY);
            slime.eyeLeftMain.setAttribute('rx', eyeWidth);
            slime.eyeLeftMain.setAttribute('ry', eyeHeight);

            // Left eye shine
            slime.eyeLeftShineGroup.setAttribute('transform', `translate(${leftShineCX}, ${leftShineCY}) rotate(16)`);
            const eyeLeftShine = slime.eyeLeftShineGroup.childNodes[0];
            if (eyeLeftShine) {
                eyeLeftShine.setAttribute('cx', 0);
                eyeLeftShine.setAttribute('cy', 0);
                eyeLeftShine.setAttribute('rx', shineWidth);
                eyeLeftShine.setAttribute('ry', shineHeight);
            }

            // Right eye
            slime.eyeRightMain.setAttribute('cx', rightEyeCX);
            slime.eyeRightMain.setAttribute('cy', rightEyeCY);
            slime.eyeRightMain.setAttribute('rx', eyeWidth);
            slime.eyeRightMain.setAttribute('ry', eyeHeight);

            // Right eye shine
            slime.eyeRightShineGroup.setAttribute('transform', `translate(${rightShineCX}, ${rightShineCY}) rotate(16)`);
            const eyeRightShine = slime.eyeRightShineGroup.childNodes[0];
            if (eyeRightShine) {
                eyeRightShine.setAttribute('cx', 0);
                eyeRightShine.setAttribute('cy', 0);
                eyeRightShine.setAttribute('rx', shineWidth);
                eyeRightShine.setAttribute('ry', shineHeight);
            }
        }

        // Update sleepy eye positions
        updateSleepyEyePositions(slime, leftEyeCX, leftEyeCY, rightEyeCX, rightEyeCY) {
            const eyeWidth = slime.initialEyeWidth;
            const eyeHeight = slime.initialEyeHeight;

            // Update left eye path
            const leftStartX = leftEyeCX - eyeWidth * 0.8;
            const leftStartY = leftEyeCY - eyeHeight * 0.1;
            const leftEndX = leftEyeCX + eyeWidth * 0.8;
            const leftEndY = leftEyeCY + eyeHeight * 0.3;
            const leftControlX = leftEyeCX;
            const leftControlY = leftEyeCY - eyeHeight * 0.2;

            const leftPath = `M ${leftStartX} ${leftStartY} Q ${leftControlX} ${leftControlY} ${leftEndX} ${leftEndY}`;
            slime.eyeLeftMain.setAttribute('d', leftPath);

            // Update right eye path
            const rightStartX = rightEyeCX - eyeWidth * 0.8;
            const rightStartY = rightEyeCY + eyeHeight * 0.3;
            const rightEndX = rightEyeCX + eyeWidth * 0.8;
            const rightEndY = rightEyeCY - eyeHeight * 0.1;
            const rightControlX = rightEyeCX;
            const rightControlY = rightEyeCY - eyeHeight * 0.2;

            const rightPath = `M ${rightStartX} ${rightStartY} Q ${rightControlX} ${rightControlY} ${rightEndX} ${rightEndY}`;
            slime.eyeRightMain.setAttribute('d', rightPath);
        }

        // New method to render physics constraints and points with radial opacity mask
        renderConstraints(points, constraints, mousePos = null, options = {}) {
            if (!this.mainSVG) return;

            // Ensure constraints layer exists
            this.ensureConstraintsLayer();

            // Clear existing constraints
            safeSetInnerHTML(this.constraintsLayer, '');

            const screenPoints = points ? points.map(p => this.worldToScreen(p)) : null;
            const screenConstraints = constraints ? constraints.map(c => ({ pointA: this.worldToScreen(c.pointA), pointB: this.worldToScreen(c.pointB), weight: c.weight })) : null;
            const screenMouse = mousePos ? this.worldToScreen(mousePos) : null;

            const {
                pointRadius = 1.5,
                pointColor = 'rgba(60, 60, 60, 1.0)', // Full opacity - mask will control visibility
                constraintColor = 'rgba(120, 120, 120, 1.0)', // Full opacity - mask will control visibility
                constraintWidth = 0.5,
                showPoints = true,
                showConstraints = true,
                baseOpacity = 0.25, // Base opacity when mouse is not hovering (more transparent)
                hoverRadius = 150, // Radius of the hover effect in pixels
                maxOpacity = 1.0 // Maximum opacity at mouse center
            } = options;

            // Scale strokes to match current camera zoom (120 px per unit baseline)
            const zoomScale = this.getPixelsPerUnit() / 120;

            // Update the radial opacity mask
            this.updateOpacityMask(screenMouse, baseOpacity, hoverRadius, maxOpacity);

            // Draw constraints first (so they appear behind points)
            if (showConstraints && screenConstraints) {
                for (const constraint of screenConstraints) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', constraint.pointA.x);
                    line.setAttribute('y1', constraint.pointA.y);
                    line.setAttribute('x2', constraint.pointB.x);
                    line.setAttribute('y2', constraint.pointB.y);
                    line.setAttribute('stroke', constraintColor);
                    line.setAttribute('stroke-width', constraintWidth * zoomScale);
                    line.setAttribute('stroke-linecap', 'round');
                    line.style.pointerEvents = 'none';
                    this.constraintsLayer.appendChild(line);
                }
            }

            // Draw points on top of constraints
            if (showPoints && screenPoints) {
                for (const point of screenPoints) {
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', point.x);
                    circle.setAttribute('cy', point.y);
                    circle.setAttribute('r', pointRadius * zoomScale);
                    circle.setAttribute('fill', pointColor);
                    circle.setAttribute('stroke', 'rgba(40, 40, 40, 1.0)'); // Full opacity
                    circle.setAttribute('stroke-width', 0.3 * zoomScale);
                    circle.style.pointerEvents = 'none';
                    this.constraintsLayer.appendChild(circle);
                }
            }
        }

        // Ensure constraints layer exists with proper layering
        ensureConstraintsLayer() {
            if (!this.constraintsLayer || !this.constraintsLayer.parentNode) {
                // Create or recreate constraints layer
                this.constraintsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                this.constraintsLayer.id = 'constraints-layer';
                this.constraintsLayer.style.pointerEvents = 'none';

                // Create the opacity mask if it doesn't exist
                this.createOpacityMask();

                // Apply the mask to the constraints layer
                this.constraintsLayer.setAttribute('mask', 'url(#constraints-opacity-mask)');
            }

            // Ensure proper layer ordering: constraints layer before selection layer
            if (this.constraintsLayer.parentNode !== this.mainSVG) {
                // Insert before selection layer if it exists, otherwise append
                if (this.selectionLayer && this.selectionLayer.parentNode === this.mainSVG) {
                    this.mainSVG.insertBefore(this.constraintsLayer, this.selectionLayer);
                } else {
                    this.mainSVG.appendChild(this.constraintsLayer);
                }
            }

            // Ensure selection layer exists and is on top
            this.ensureSelectionLayer();
        }

        // Ensure selection layer exists and is on top (no opacity mask)
        ensureSelectionLayer() {
            if (!this.selectionLayer || !this.selectionLayer.parentNode) {
                // Create or recreate selection layer
                this.selectionLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                this.selectionLayer.id = 'selection-layer';
                this.selectionLayer.style.pointerEvents = 'none';
            }

            // Always ensure it's the last child (on top)
            if (this.selectionLayer.parentNode !== this.mainSVG) {
                this.mainSVG.appendChild(this.selectionLayer);
            } else {
                // Move to end if it's not already there
                this.mainSVG.appendChild(this.selectionLayer);
            }
        }

        // Create the radial opacity mask
        createOpacityMask() {
            const defs = this.mainSVG.querySelector('#slime-defs');
            if (!defs) return;

            // Remove existing mask if it exists
            const existingMask = defs.querySelector('#constraints-opacity-mask');
            if (existingMask) {
                existingMask.remove();
            }

            // Create mask element
            const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
            mask.id = 'constraints-opacity-mask';
            mask.setAttribute('maskUnits', 'userSpaceOnUse');
            mask.setAttribute('x', '0');
            mask.setAttribute('y', '0');
            mask.setAttribute('width', '100%');
            mask.setAttribute('height', '100%');

            // Create base rectangle with base opacity
            const baseRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            baseRect.id = 'mask-base';
            baseRect.setAttribute('x', '0');
            baseRect.setAttribute('y', '0');
            baseRect.setAttribute('width', '100%');
            baseRect.setAttribute('height', '100%');
            baseRect.setAttribute('fill', 'rgba(255, 255, 255, 0.25)'); // Base opacity (more transparent)

            // Create radial gradient for hover effect
            const radialGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
            radialGradient.id = 'constraints-hover-gradient';
            radialGradient.setAttribute('cx', '50%');
            radialGradient.setAttribute('cy', '50%');
            radialGradient.setAttribute('r', '150'); // Default radius
            radialGradient.setAttribute('gradientUnits', 'userSpaceOnUse');

            // Gradient stops - more pronounced falloff for better visibility
            const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop1.setAttribute('offset', '0%');
            stop1.setAttribute('stop-color', 'white');
            stop1.setAttribute('stop-opacity', '1.0'); // Full opacity at center

            const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop2.setAttribute('offset', '50%');
            stop2.setAttribute('stop-color', 'white');
            stop2.setAttribute('stop-opacity', '0.8'); // Still quite visible at 50%

            const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop3.setAttribute('offset', '80%');
            stop3.setAttribute('stop-color', 'white');
            stop3.setAttribute('stop-opacity', '0.3'); // Fade more gradually

            const stop4 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop4.setAttribute('offset', '100%');
            stop4.setAttribute('stop-color', 'white');
            stop4.setAttribute('stop-opacity', '0.0'); // Fully transparent at edge

            radialGradient.appendChild(stop1);
            radialGradient.appendChild(stop2);
            radialGradient.appendChild(stop3);
            radialGradient.appendChild(stop4);

            // Create hover circle (initially hidden)
            const hoverCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            hoverCircle.id = 'mask-hover-circle';
            hoverCircle.setAttribute('cx', '-1000'); // Start off-screen
            hoverCircle.setAttribute('cy', '-1000');
            hoverCircle.setAttribute('r', '150');
            hoverCircle.setAttribute('fill', 'url(#constraints-hover-gradient)');
            hoverCircle.style.display = 'none'; // Initially hidden

            // Add elements to defs and mask
            defs.appendChild(radialGradient);
            mask.appendChild(baseRect);
            mask.appendChild(hoverCircle);
            defs.appendChild(mask);
        }

        // Update the opacity mask based on mouse position
        updateOpacityMask(mousePos, baseOpacity = 0.4, hoverRadius = 150, maxOpacity = 1.0) {
            const defs = this.mainSVG.querySelector('#slime-defs');
            if (!defs) return;

            const baseRect = defs.querySelector('#mask-base');
            const hoverCircle = defs.querySelector('#mask-hover-circle');
            const radialGradient = defs.querySelector('#constraints-hover-gradient');

            if (!baseRect || !hoverCircle || !radialGradient) return;

            // Update base opacity
            baseRect.setAttribute('fill', `rgba(255, 255, 255, ${baseOpacity})`);

            if (mousePos && mousePos.x !== -1000 && mousePos.y !== -1000) {
                // Show hover effect
                hoverCircle.style.display = 'block';
                hoverCircle.setAttribute('cx', mousePos.x);
                hoverCircle.setAttribute('cy', mousePos.y);
                hoverCircle.setAttribute('r', hoverRadius);

                // Update gradient center and radius
                radialGradient.setAttribute('cx', mousePos.x);
                radialGradient.setAttribute('cy', mousePos.y);
                radialGradient.setAttribute('r', hoverRadius);

                // Update gradient stops for max opacity
                const stops = radialGradient.querySelectorAll('stop');
                if (stops.length >= 1) {
                    stops[0].setAttribute('stop-opacity', maxOpacity.toString());
                }
            } else {
                // Hide hover effect when mouse is not present
                hoverCircle.style.display = 'none';
            }
        }

        // Clear constraints layer
        clearConstraints() {
            if (this.constraintsLayer) {
                safeSetInnerHTML(this.constraintsLayer, '');
            }
            // Also hide the hover effect when clearing
            this.updateOpacityMask(null);
        }

        // New method to render selection marker (on separate layer, always visible)
        renderSelectionMarker(point, options = {}) {
            // Ensure selection layer exists
            this.ensureSelectionLayer();

            // Remove existing selection marker
            const existingMarker = this.selectionLayer.querySelector('#selection-marker');
            if (existingMarker) {
                existingMarker.remove();
            }

            if (point) {
                point = this.worldToScreen(point);
            } else {
                return;
            }

            const {
                outerRadius = 8,
                innerRadius = 4,
                outerColor = 'black',
                innerColor = 'rgba(0, 0, 0, 0.8)',
                strokeWidth = 1
            } = options;

            // Create marker group
            const markerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            markerGroup.id = 'selection-marker';
            markerGroup.style.pointerEvents = 'none';

            // Helper function to create hexagon path
            const createHexagonPath = (centerX, centerY, radius) => {
                const points = [];
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI) / 3; // 60 degrees in radians
                    const x = centerX + radius * Math.cos(angle);
                    const y = centerY + radius * Math.sin(angle);
                    points.push(`${x},${y}`);
                }
                return `M ${points.join(' L ')} Z`;
            };

            // Hexagon outline only
            const hexagon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hexagon.setAttribute('d', createHexagonPath(point.x, point.y, outerRadius));
            hexagon.setAttribute('fill', 'none');
            hexagon.setAttribute('stroke', outerColor);
            hexagon.setAttribute('stroke-width', strokeWidth);
            hexagon.setAttribute('stroke-linejoin', 'round');

            markerGroup.appendChild(hexagon);
            this.selectionLayer.appendChild(markerGroup);
        }

        // Clear selection marker
        clearSelectionMarker() {
            if (!this.selectionLayer) return;

            const existingMarker = this.selectionLayer.querySelector('#selection-marker');
            if (existingMarker) {
                existingMarker.remove();
            }
        }
    }

    // Expose the renderer class for the controller to use
    window.MixedSlimeRenderer = MixedSlimeRenderer;

})();
