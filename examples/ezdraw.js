// License: CC0 public domain: https://creativecommons.org/publicdomain/zero/1.0/deed.en

// Cheat sheet:

/////////////////////////////////////////////////////////
// EZ LIBRARY CHEAT SHEET
/////////////////////////////////////////////////////////

/*
// Basic Setup and Canvas Operations
ez.setCanvas(canvas)                    // Set the canvas element
ez.clear(color)                         // Clear the canvas with optional background color
ez.blitCanvas(otherCanvas)              // Blit another canvas onto the current canvas
ez.createCanvasAndAddToPage(width, height) // Create a canvas and add it to the page

// Save and Restore Context
ez.save()                               // Save the current context state
ez.restore()                            // Restore the last saved context state

// Shapes and Drawing
ez.circle(pos, radius)                  // Create a circle
ez.rect(pos, size, rot, scale)          // Create a rectangle
ez.capsule(pos, rot, length, radius1, radius2) // Create a capsule
ez.image(url, pos, rot, scale)          // Create and draw an image
ez.grid(cellSize, numCells)             // Create a grid
ez.line(startPos, endPos, options)      // Create a line
ez.arrow(startPos, endPos, arrowSize)   // Create an arrow
ez.path(points, closed, smoothed, transform) // Create a path
ez.text(text, pos, options)             // Create and render text
ez.triangle(pos, points, colors)        // Create a triangle
ez.quad(pos, points, colors)            // Create a quad

// Input Handling
ez.keys                                 // Object to track key states
ez.mousePos                             // Current mouse position (vec2)
ez.lastMousePos                         // Last mouse position
ez.isMouseDown(button)                  // Check if a mouse button is down
ez.isMouseUp(button)                    // Check if a mouse button is up
ez.getMousePos()                        // Get current mouse position
ez.getMousePosWorld()                   // Get current mouse position in world coordinates

// Input Event Listeners
ez.onKeyPress(key, callback)            // Add key press event listener
ez.onKeyDown(key, callback)             // Add key down event listener
ez.onKeyUp(key, callback)               // Add key up event listener
ez.onMouseMove(callback)                // Add mouse move event listener
ez.onMouseDown(callback)                // Add mouse down event listener
ez.onMouseUp(callback)                  // Add mouse up event listener
ez.onMouseDrag(callback)                // Add mouse drag event listener
ez.onMouseDragEnd(callback)             // Add mouse drag end event listener
ez.onMouseLeave(callback)               // Add mouse leave event listener
ez.onMouseWheel(callback)               // Add mouse wheel event listener

// Math and Utility Functions
vec2(x, y)                              // Create a 2D vector
vec3(x, y, z)                           // Create a 3D vector
vec4(x, y, z, w)                        // Create a 4D vector
mat3(col1, col2, col3)                  // Create a 3x3 matrix
mat4(col1, col2, col3, col4)            // Create a 4x4 matrix
mat3x4(col1, col2, col3, col4)          // Create a 3x4 matrix

// Vector Methods (vec2, vec3, vec4)
.add(other)                             // Add another vector
.sub(other)                             // Subtract another vector
.dot(other)                             // Dot product with another vector
.divide(other)                          // Divide by another vector
.scale(other)                           // Scale by another vector
.length()                               // Magnitude of the vector
.clone()                                // Clone the vector
.normalized()                           // Normalize the vector
.rounded()                              // Round the vector
.floored()                              // Floor the vector
.ceiled()                               // Ceil the vector
.abs()                                  // Absolute value of the vector
.set(other)                             // Set the vector to another vector
.rotated(angle)                         // Rotate the vector by an angle
.angle()                                // Get the angle of the vector
.perpendicular()                        // Get a perpendicular vector

// Matrix Methods (mat3, mat4, mat3x4)
.multiply(otherMat)                     // Multiply with another matrix
.multiplyVec3(vec)                      // Multiply with a 3D vector
.multiplyVec4(vec)                      // Multiply with a 4D vector (mat4 only)
.transpose()                            // Transpose the matrix
.determinant()                          // Get the determinant of the matrix
.inverse()                              // Get the inverse of the matrix

// Shape Methods
fill(color, ctxOptions)                 // Fill the shape with a color
stroke(color, ctxOptions)               // Stroke the shape with a color
fillAndStroke(fillColor, strokeColor, ctxOptions) // Fill and stroke the shape

// World and Screen Transformations
ez.worldToScreen(point, objectTransform) // Transform world coordinates to screen coordinates
ez.screenToWorld(pos)                   // Transform screen coordinates to world coordinates

// Color Parsing
ez.parseColor(color)                    // Parse color to hex format
ez.parseColorAsRGBAObj(color)           // Parse color to RGBA object

// GUI Functions
ez.gui(data, callbacks, options)        // Create a GUI for the data object
ez.guiPalettes                          // Predefined color palettes for the GUI

// Advanced Utilities
ez.smoothVar(key, newValue, duration)   // Smoothly interpolate variable values over time
ez.bresenhamLineConnect(pointA, pointB) // Generate points for a line between two points using Bresenham's algorithm
ez.smoothPoints(points, options)        // Smooth a set of points
ez.makeVecBarycentric(p, a, b, c)       // Convert a point to barycentric coordinates
ez.drawTriangle(canvas, ctx, p0, p1, p2, color0, color1, color2) // Draw a triangle with color interpolation
ez.createProjectionMatrix(fov, aspect, near, far) // Create a projection matrix
ez._blitCanvasSizes                     // Predefined canvas sizes for optimized drawing
ez._blitCanvasCache                     // Cache for optimized canvas drawing

// Miscellaneous
ez.centerOrigin                         // Center the origin of the canvas
ez.useProjectionMatrix                  // Use a projection matrix for 3D transformations
ez.projectionMatrixOverride             // Override the default projection matrix

*/
/////////////////////////////////////////////////////////



if(!window.$) window.$ = (...args) => document.querySelector(...args)

const ez = {
    canvas: null,
    ctx: null,
    camera: null,
    useProjectionMatrix: false,
    projectionMatrixOverride: null,
    centerOrigin: false,
    centerOriginX: false,
    centerOriginY: false,
    fast2DModeWithNoCameraRotation: false,
}

///////////////////////
// SETUP BOILERPLATE //
///////////////////////

ez.setCanvas = function(canvas) {
    if (!canvas) return;
    canvas.dataset.ezPreserveCssSize = 'true';
    ez._patchCanvasForHiDPI(canvas, false);
    ez.canvas = canvas;
    ez.ctx = canvas.getContext("2d");
    ez._applyCanvasScale(canvas, ez.ctx);
}

ez.clear = function(color) {
    ez.ctx.clearRect(0, 0, ez.canvas.width, ez.canvas.height);
    if(color !== undefined) {
        ez.ctx.save();
        ez.ctx.fillStyle = ez.parseColor(color);
        ez.ctx.fillRect(0, 0, ez.canvas.width, ez.canvas.height);
        ez.ctx.restore();
    }
}

ez.blitCanvas = function(otherCanvas) {
    ez.ctx.drawImage(otherCanvas, 0, 0);
}

const _canvasWidthProperty = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
const _canvasHeightProperty = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');

let savedEzs = [];
ez.save = function() {
    savedEzs.push({...ez});
    ez.ctx.save();
}

ez.restore = function() {
    Object.assign(ez, savedEzs.pop());
    ez.ctx.restore();
}

ez._ensureViewportMeta = function() {
    if (typeof document === 'undefined') return;
    const existingMeta = document.querySelector('meta[name="viewport"]');
    if (!existingMeta) {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
        document.head.appendChild(meta);
    }
};

ez._devicePixelRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

ez._applyCanvasScale = function(canvas, ctx) {
    if (!canvas || !ctx || canvas._ezIsWebGL) return;
    const dpr = canvas._ezDevicePixelRatio || ez._devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

ez._patchCanvasForHiDPI = function(canvas, initAsWebGL = false) {
    if (!canvas || canvas._ezHiDPIPatched) return;
    canvas._ezHiDPIPatched = true;
    canvas._ezIsWebGL = initAsWebGL;

    if (initAsWebGL) {
        // Leave WebGL canvases with default width/height behavior; rely on caller to manage DPR if needed.
        return;
    }

    Object.defineProperty(canvas, 'width', {
        configurable: true,
        enumerable: true,
        get() {
            if (this._ezLogicalWidth !== undefined) {
                return this._ezLogicalWidth;
            }
            const dpr = this._ezDevicePixelRatio || ez._devicePixelRatio || 1;
            return _canvasWidthProperty.get.call(this) / dpr;
        },
        set(value) {
            const parsed = typeof value === 'number' ? value : parseFloat(value);
            const numericValue = Number.isFinite(parsed) ? parsed : 0;
            const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
            this._ezDevicePixelRatio = dpr;
            ez._devicePixelRatio = dpr;
            this._ezLogicalWidth = numericValue;
            const actualWidth = Math.max(Math.round(numericValue * dpr), 1);
            _canvasWidthProperty.set.call(this, actualWidth);
            if (this.dataset?.ezPreserveCssSize !== 'true') {
                this.style.width = `${numericValue}px`;
            }
            this._ezBackingWidth = actualWidth;

            if (!this._ezIsWebGL) {
                const ctx = this.getContext('2d');
                if (ctx) {
                    ez._applyCanvasScale(this, ctx);
                }
            } else {
                const gl = this.getContext('webgl') || this.getContext('experimental-webgl');
                if (gl) {
                    const heightActual = this._ezBackingHeight || _canvasHeightProperty.get.call(this);
                    gl.viewport(0, 0, actualWidth, heightActual);
                }
            }
        }
    });

    Object.defineProperty(canvas, 'height', {
        configurable: true,
        enumerable: true,
        get() {
            if (this._ezLogicalHeight !== undefined) {
                return this._ezLogicalHeight;
            }
            const dpr = this._ezDevicePixelRatio || ez._devicePixelRatio || 1;
            return _canvasHeightProperty.get.call(this) / dpr;
        },
        set(value) {
            const parsed = typeof value === 'number' ? value : parseFloat(value);
            const numericValue = Number.isFinite(parsed) ? parsed : 0;
            const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
            this._ezDevicePixelRatio = dpr;
            ez._devicePixelRatio = dpr;
            this._ezLogicalHeight = numericValue;
            const actualHeight = Math.max(Math.round(numericValue * dpr), 1);
            _canvasHeightProperty.set.call(this, actualHeight);
            if (this.dataset?.ezPreserveCssSize !== 'true') {
                this.style.height = `${numericValue}px`;
            }
            this._ezBackingHeight = actualHeight;

            if (!this._ezIsWebGL) {
                const ctx = this.getContext('2d');
                if (ctx) {
                    ez._applyCanvasScale(this, ctx);
                }
            } else {
                const gl = this.getContext('webgl') || this.getContext('experimental-webgl');
                if (gl) {
                    const widthActual = this._ezBackingWidth || _canvasWidthProperty.get.call(this);
                    gl.viewport(0, 0, widthActual, actualHeight);
                }
            }
        }
    });
};

ez.createCanvasAndAddToPage = function(width, height, initAsWebGL = false) {
    ez._ensureViewportMeta();
    ez.canvas = document.createElement("canvas");
    document.body.appendChild(ez.canvas);
    ez._patchCanvasForHiDPI(ez.canvas, initAsWebGL);

    if (width && height) {
        ez.canvas.width = width;
        ez.canvas.height = height;
    } else {
        const canvas = ez.canvas;

        // Style the canvas
        canvas.style.display = 'block'; // Remove extra space below canvas

        // Style the body to remove margins and overflow
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden'; // Hide scrollbars

        // Ensure canvas is always in the top-left corner
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.outline = 'none'; // Kept getting focus outline, so making this the default.

        // Set full-screen styles
        const resizeCanvas = () => {
            const widthCss = Math.max(window.innerWidth, 1);
            const heightCss = Math.max(window.innerHeight, 1);
            const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
            const needsDprUpdate = canvas._ezDevicePixelRatio !== dpr;

            if (needsDprUpdate || canvas.width !== widthCss) canvas.width = widthCss;
            if (needsDprUpdate || canvas.height !== heightCss) canvas.height = heightCss;
        };

        // Apply styles initially and on resize
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Set the canvas to be focusable
        canvas.setAttribute('tabindex', '0');
        // Allow using same mouseDrag etc on mobile.
        canvas.style.touchAction = "none";
    }
    ez.addInputEventListeners(ez.canvas);
    if(!initAsWebGL) {
        ez.ctx = ez.canvas.getContext("2d");
        ez._applyCanvasScale(ez.canvas, ez.ctx);
    }
    else {
        ez.ctx = ez.canvas.getContext("webgl");
    }

    ez._update();
    return ez.canvas;
};

// Called before every single function via hack at the bottom of this file.
ez._update = function() {
    if(!ez.canvas) {
        ez.canvas = document.querySelector("canvas");
        if(!ez.canvas) {
            ez.createCanvasAndAddToPage();
        }
    }
    ez.addInputEventListeners(ez.canvas);
    ez.ctx = ez.canvas.getContext("2d");
    ez._applyCanvasScale(ez.canvas, ez.ctx);
    ez.camera = ez.camera || mat3x4();
}

/////////////////
// INPUT STUFF //
/////////////////

ez.keys = {};
ez.mousePos = new vec2(0, 0);
ez.lastMousePos = new vec2(0, 0);

ez.keyPressCallbacks = {};
ez.keyDownCallbacks = {};
ez.keyUpCallbacks = {};
ez.mouseMoveCallbacks = [];
ez.mouseDownCallbacks = [];
ez.mouseUpCallbacks = [];
ez.mouseDragCallbacks = [];
ez.mouseDragEndCallbacks = [];
ez.mouseLeaveCallbacks = [];
ez.mouseWheelCallbacks = [];
ez.mouseDown = { left: false, middle: false, right: false };
ez.isDragging = false;
ez.curCanvasMouseOver = null;

ez.mousePosGlobal = new vec2(0, 0);
ez.lastMousePosGlobal = new vec2(0, 0);
document.addEventListener("pointerdown", (event) => {
    ez.mousePosGlobal = vec2(event.pageX, event.pageY);
});

document.addEventListener("pointermove", (event) => {
    ez.lastMousePosGlobal = ez.mousePosGlobal;
    ez.mousePosGlobal = vec2(event.pageX, event.pageY);
});

document.addEventListener('keydown', function(event) {
    ez.keys[event.key] = true;
});

document.addEventListener('keyup', function(event) {
    ez.keys[event.key] = false;
});

document.addEventListener('keypress', function(event) {
    if (ez.keyPressCallbacks[event.key]) {
        ez.keyPressCallbacks[event.key].forEach(cb => cb(event));
    }
});

document.addEventListener('keydown', function(event) {
    ez.keys[event.key] = true;
    if (ez.keyDownCallbacks[event.key]) {
        ez.keyDownCallbacks[event.key].forEach(cb => cb(event));
    }
});

document.addEventListener('keyup', function(event) {
    ez.keys[event.key] = false;
    if (ez.keyUpCallbacks[event.key]) {
        ez.keyUpCallbacks[event.key].forEach(cb => cb(event));
    }
});

ez.onKeyPress = function(key, callback) {
    if (!ez.keyPressCallbacks[key]) {
        ez.keyPressCallbacks[key] = [];
    }
    ez.keyPressCallbacks[key].push(callback);
};

ez.onKeyDown = function(key, callback) {
    if (!ez.keyDownCallbacks[key]) {
        ez.keyDownCallbacks[key] = [];
    }
    ez.keyDownCallbacks[key].push(callback);
};

ez.onKeyUp = function(key, callback) {
    if (!ez.keyUpCallbacks[key]) {
        ez.keyUpCallbacks[key] = [];
    }
    ez.keyUpCallbacks[key].push(callback);
};

ez.isMouseInCanvas = function(canvas) {
    if(!canvas) canvas = ez.canvas;
    return canvas = ez.curCanvasMouseOver;
};

ez.isMouseDown = function(button="left") {
    return ez.mouseDown[button];
};

ez.isMouseUp = function(button="left") {
    return !ez.isMouseDown(button);
};

ez.onMouseMove = function(callback) {
    ez.mouseMoveCallbacks.push(callback);
};

ez.onMouseDown = function(callback) {
    ez.mouseDownCallbacks.push(callback);
};

ez.onMouseUp = function(callback) {
    ez.mouseUpCallbacks.push(callback);
};

ez.onMouseDrag = function(callback) {
    ez.mouseDragCallbacks.push(callback);
};

ez.onMouseDragEnd = function(callback) {
    ez.mouseDragEndCallbacks.push(callback);
};

ez.onMouseWheel = function(callback) {
    ez.mouseWheelCallbacks.push(callback);
}

ez.onMouseLeave = function(callback) {
    ez.mouseLeaveCallbacks.push(callback);
};

ez.isKeyDown = function(key) {
    return ez.keys[key] || false;
};

ez.getMousePos = function() {
    return ez.mousePos;
};

ez.addInputEventListeners = function(canvas) {
    if (canvas.ezEventListenersAdded) return; // Prevent multiple bindings
    canvas.ezEventListenersAdded = true;

    canvas.addEventListener('pointerdown', function(event) {
        const activeEl = document.activeElement;
        if (activeEl && activeEl !== canvas) {
            const tagName = activeEl.tagName?.toUpperCase?.() ?? '';
            if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
                activeEl.blur();
            }
        }
        if (typeof canvas.focus === 'function') {
            canvas.focus({ preventScroll: true });
        }
        ez.curCanvasMouseOver = canvas;
        let rect = canvas.getBoundingClientRect();
        ez.mousePos = new vec2(event.clientX - rect.left, event.clientY - rect.top);
        if(event.button === 0) ez.mouseDown.left = true;
        if(event.button === 1) ez.mouseDown.middle = true;
        if(event.button === 2) ez.mouseDown.right = true;
        ez.mouseDownCallbacks.forEach(cb => cb(event));
        ez.lastMousePos = new vec2(event.clientX - rect.left, event.clientY - rect.top);
    });

    canvas.addEventListener('pointermove', function(event) {
        ez.curCanvasMouseOver = canvas;
        let rect = canvas.getBoundingClientRect();
        ez.mousePos = new vec2(event.clientX - rect.left, event.clientY - rect.top);
        ez.mouseMoveCallbacks.forEach(cb => cb(event));
        if(ez.isMouseDown("left") || ez.isMouseDown("middle") || ez.isMouseDown("right")) {
            ez.isDragging = true;
        }
        if (ez.isDragging) {
            let delta = ez.mousePos.sub(ez.lastMousePos);
            ez.mouseDragCallbacks.forEach(cb => cb(event, delta));
        }
        ez.lastMousePos = ez.mousePos;
    });

    canvas.addEventListener('pointerup', function(event) {
        ez.curCanvasMouseOver = canvas;
        let rect = canvas.getBoundingClientRect();
        ez.mousePos = new vec2(event.clientX - rect.left, event.clientY - rect.top);
        if(event.button === 0) ez.mouseDown.left = false;
        if(event.button === 1) ez.mouseDown.middle = false;
        if(event.button === 2) ez.mouseDown.right = false;

        ez.mouseUpCallbacks.forEach(cb => cb(event));
        if (ez.isDragging) {
            ez.isDragging = false;
            ez.mouseDragEndCallbacks.forEach(cb => cb(event));
        }
        ez.lastMousePos = new vec2(event.clientX - rect.left, event.clientY - rect.top);
    });

    canvas.addEventListener('pointerleave', function(event) {
        ez.isDragging = false;
        if(ez.isMouseDown("left") || ez.isMouseDown("middle") || ez.isMouseDown("right")) {
            ez.mouseDown.left = ez.mouseDown.middle = ez.mouseDown.right = false;
            ez.mouseUpCallbacks.forEach(cb => cb(event))
        }
        else ez.mouseDown.left = ez.mouseDown.middle = ez.mouseDown.right = false;
        ez.curCanvasMouseOver = null;
        if(ez.isDragging) ez.mouseDragEndCallbacks.forEach(cb => cb(event));
        ez.mouseLeaveCallbacks.forEach(cb => cb(event));
    });

    document.addEventListener('wheel', function(event) {
        ez.mouseWheelCallbacks.forEach(cb => cb(event));
    })
};

///////////////////
// SHAPE DRAWING //
///////////////////

// rect

ez.rect = function ezRect(pos, size, rot, scale) {
    if (!(this instanceof ezRect)) return new ezRect(pos, size, rot, scale);
    this.size = vec2(size);
    this.scale = scale || 1;
    this.transform = mat3x4From2DRotationAndPosition(rot || 0, pos);
};

ez.rect.prototype.drawPath = function() {
    let halfWidth = this.size.x / 2 * this.scale;
    let halfHeight = this.size.y / 2 * this.scale;
    let corners = [
        new vec3(-halfWidth, -halfHeight, 0),
        new vec3(halfWidth, -halfHeight, 0),
        new vec3(halfWidth, halfHeight, 0),
        new vec3(-halfWidth, halfHeight, 0)
    ];

    // Rotate, translate, then apply camera matrix to each corner
    corners = corners.map(corner => {
        let cornerPt = new vec3(
            corner.x,
            corner.y,
            corner.z
        );
        return ez.worldToScreen(cornerPt, this.transform);
    });

    ez.ctx.beginPath();
    ez.ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
        ez.ctx.lineTo(corners[i].x, corners[i].y);
    }
    ez.ctx.closePath();
};

// circle

ez.circle = function ezCircle(pos, radius) {
    if (!(this instanceof ezCircle)) return new ezCircle(pos, radius);
    this.radius = radius; // Circle's radius

    // Prepare the transform for the circle, including scale and position
    pos = vec2(pos);
    this.transform = mat3x4([1,0,0], [0,1,0], [0,0,1], [pos.x, pos.y, 0]);
};

ez.circle.prototype.drawPath = function() {
    // Apply the transformation to the circle's position
    const transformedCenter = ez.worldToScreen(new vec3(0,0,0), this.transform);
    const transformedRad = ez.worldToScreen(new vec3(0,this.radius,0), this.transform);

    // Start drawing the circle path
    ez.ctx.beginPath();
    ez.ctx.arc(transformedCenter.x, transformedCenter.y, transformedCenter.sub(transformedRad).length(), 0, 2 * Math.PI);
    ez.ctx.closePath();
};
// arc

ez.arc = function ezArc(pos, rot, spanAngle, radius, closeAsTriangle = true) {
    if (!(this instanceof ezArc)) return new ezArc(pos, rot, spanAngle, radius, closeAsTriangle);
    this.spanAngle = spanAngle ?? Math.PI; // Default to 180 degrees
    this.closeAsTriangle = closeAsTriangle;
    this.radius = radius; // Store the radius

    // Prepare the transform for the arc
    pos = vec2(pos);
    this.transform = mat3x4([Math.cos(rot), Math.sin(rot), 0], [Math.sin(rot), -Math.cos(rot), 0], [0,0,1], [pos[0], pos[1], 0]);
};

ez.arc.prototype.drawPath = function() {
    // Apply the transformation to get the center point
    const center = ez.worldToScreen(new vec3(0,0,0), this.transform);
    const radiusPoint = ez.worldToScreen(new vec3(this.radius,0,0), this.transform);
    const transformedRadius = center.sub(radiusPoint).length();
    const rot = this.transform.getRotation2D();
    
    // Calculate start and end angles based on rotation
    const startAngle = rot;
    const endAngle = rot + this.spanAngle;
    
    ez.ctx.beginPath();
    
    if (this.closeAsTriangle) {
        // Start at center for pie slice
        ez.ctx.moveTo(center.x, center.y);
        // Draw arc
        ez.ctx.arc(center.x, center.y, transformedRadius, startAngle, endAngle);
        // Close path back to center to create pie slice
        ez.ctx.closePath();
    } else {
        // Just draw the arc without closing
        ez.ctx.arc(center.x, center.y, transformedRadius, startAngle, endAngle);
    }
};

// capsule

ez.capsule = function ezCapsule(pos, rot, length, radius1, radius2) {
    if (!(this instanceof ezCapsule)) return new ezCapsule(pos, rot, length, radius1, radius2);
    this.length = length || 0;
    this.radius1 = radius1 || 1;
    this.radius2 = radius2 || 1;

    // Prepare the transformation matrix for the capsule
    this.transform = mat3x4From2DRotationAndPosition(rot || 0, pos);
};

ez.capsule.prototype.drawPath = function() {
    // If the distance between endpoints is too small compared to the radii difference,
    // the smaller circle is completely inside the larger. In that case, draw a regular circle.
    if (this.length <= Math.abs(this.radius2 - this.radius1)) {
        // Determine which end has the larger radius and adjust center accordingly
        let isR2Larger = this.radius2 > this.radius1;
        let rad = Math.max(this.radius1, this.radius2);
        let offset = isR2Larger ? this.length / 2 : -this.length / 2;
        let centerLocal = new vec3(offset, 0, 0);
        let centerScreen = ez.worldToScreen(centerLocal, this.transform);
        let pointOnPeriphery = ez.worldToScreen(new vec3(offset + rad, 0, 0), this.transform);
        let transformedRad = pointOnPeriphery.sub(centerScreen).length();
        ez.ctx.beginPath();
        ez.ctx.arc(centerScreen.x, centerScreen.y, transformedRad, 0, 2 * Math.PI);
        ez.ctx.closePath();
        return;
    }

    // Compute factor for envelope (common for both endpoints)
    let factor = Math.sqrt(1 - Math.pow((this.radius2 - this.radius1) / this.length, 2));

    // Compute screen-space centers and transformed radii for the endpoint circles
    let leftCenterLocal = new vec3(-this.length / 2, 0, 0);
    let rightCenterLocal = new vec3(this.length / 2, 0, 0);
    let leftCenterScreen = ez.worldToScreen(leftCenterLocal, this.transform);
    let rightCenterScreen = ez.worldToScreen(rightCenterLocal, this.transform);

    let leftRadiusPoint = ez.worldToScreen(new vec3(-this.length / 2, this.radius1, 0), this.transform);
    let transformedR1 = leftRadiusPoint.sub(leftCenterScreen).length();

    let rightRadiusPoint = ez.worldToScreen(new vec3(this.length / 2, this.radius2, 0), this.transform);
    let transformedR2 = rightRadiusPoint.sub(rightCenterScreen).length();

    // Compute tangency points where the envelope meets the endpoint circles
    let leftTangencyTopLocal = {
        x: -this.length / 2 - ((this.radius2 - this.radius1) * this.radius1) / this.length,
        y: this.radius1 * factor
    };
    let leftTangencyBottomLocal = {
        x: -this.length / 2 - ((this.radius2 - this.radius1) * this.radius1) / this.length,
        y: -this.radius1 * factor
    };
    let rightTangencyTopLocal = {
        x: this.length / 2 - ((this.radius2 - this.radius1) * this.radius2) / this.length,
        y: this.radius2 * factor
    };
    let rightTangencyBottomLocal = {
        x: this.length / 2 - ((this.radius2 - this.radius1) * this.radius2) / this.length,
        y: -this.radius2 * factor
    };

    let leftTangencyTop = ez.worldToScreen(new vec3(leftTangencyTopLocal.x, leftTangencyTopLocal.y, 0), this.transform);
    let leftTangencyBottom = ez.worldToScreen(new vec3(leftTangencyBottomLocal.x, leftTangencyBottomLocal.y, 0), this.transform);
    let rightTangencyTop = ez.worldToScreen(new vec3(rightTangencyTopLocal.x, rightTangencyTopLocal.y, 0), this.transform);
    let rightTangencyBottom = ez.worldToScreen(new vec3(rightTangencyBottomLocal.x, rightTangencyBottomLocal.y, 0), this.transform);

    // Draw the complete capsule shape
    ez.ctx.beginPath();

    // Start at the left endpoint's top tangency point
    ez.ctx.moveTo(leftTangencyTop.x, leftTangencyTop.y);

    // Draw the right endpoint's arc (clockwise)
    let angleTop = Math.atan2(rightTangencyTop.y - rightCenterScreen.y, rightTangencyTop.x - rightCenterScreen.x);
    let angleBottom = Math.atan2(rightTangencyBottom.y - rightCenterScreen.y, rightTangencyBottom.x - rightCenterScreen.x);
    ez.ctx.arc(rightCenterScreen.x, rightCenterScreen.y, transformedR2, angleTop, angleBottom, false);

    // Draw the left endpoint's arc (clockwise)
    angleBottom = Math.atan2(leftTangencyBottom.y - leftCenterScreen.y, leftTangencyBottom.x - leftCenterScreen.x);
    angleTop = Math.atan2(leftTangencyTop.y - leftCenterScreen.y, leftTangencyTop.x - leftCenterScreen.x);
    ez.ctx.arc(leftCenterScreen.x, leftCenterScreen.y, transformedR1, angleBottom, angleTop, false);

    ez.ctx.closePath();
};



// image
// Image Manager
ez.loadedImages = {};

ez.imageWorldScaled = function ezImageWorldScaled(url, pos, rot, scale) {
    let yScale = vec3(ez.camera.matrix.col2).length()
    return ez.image(url, pos, rot, scale * yScale);
}
ez.image = function ezImage(url, pos, rot, scale) {
	if (!(this instanceof ezImage)) return new ezImage(url, pos, rot, scale);
    if(url.trim().toLowerCase().startsWith("<svg")) {
        url = "data:image/svg+xml;base64," + btoa(url);
    }
	this.url = url;
	this.pos = vec2(pos);
	this.rot = rot || 0; // Rotation in radians
	this.scale = scale || 1;

	// Check if the image has already been loaded
	if (!ez.loadedImages[url]) {
		const img = new Image();
		img.src = url;
		img.onload = () => {
			ez.loadedImages[url] = img;
		};
		img.onerror = () => {
			console.error("Failed to load image at " + url);
		};
		this.img = img;
	} else {
		this.img = ez.loadedImages[url];
	}

	// Set up the transformation matrix
	this.transform = mat3x4();
    // since pos is set will double up if set
	//this.transform.setOrigin(this.pos);
};

ez.image.prototype.draw = function() {
	if (!this.img.complete) {
		return; // Don't try to draw the image if it's not loaded
	}

	// Calculate the position on the canvas
	let drawPos = ez.worldToScreen(this.pos, this.transform);

	// Calculate screen pixels per world unit using horizontal distance
	let worldPos1 = ez.worldToScreen(new vec3(this.pos.x, this.pos.y, 0), this.transform);
	let worldPos2 = ez.worldToScreen(new vec3(this.pos.x + 1, this.pos.y, 0), this.transform);
	let pixelsPerWorldUnit = worldPos2.x - worldPos1.x;

	// Set the transformation context for drawing
	ez.ctx.save();
	ez.ctx.translate(drawPos.x, drawPos.y);
	ez.ctx.rotate(this.rot);
	ez.ctx.scale(this.scale, this.scale);

	// Calculate the draw width and height based on the image's natural size
	// 100px = 1 world unit, so divide by 100 to convert pixels to world units, then convert to screen pixels
	let drawWidth = (this.img.naturalWidth / 100) * pixelsPerWorldUnit * this.scale;
	let drawHeight = (this.img.naturalHeight / 100) * pixelsPerWorldUnit * this.scale;

	// Draw the image centered on its transformed position
	ez.ctx.drawImage(this.img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
	ez.ctx.restore();
};


// grid

ez.grid = function ezGrid(cellSize, numCells, roundToNearestPixel = true) {
    if (!(this instanceof ezGrid)) return new ezGrid(cellSize, numCells);
    this.cellSize = vec2(cellSize || 10);
    this.numCells = vec2(numCells || 10);
    this.roundToNearestPixel = roundToNearestPixel;
};

ez.grid.prototype.stroke = function() {
    ez.ctx.beginPath();

    const halfNumCells = this.numCells.scaled(0.5).floored();
    const gridSize = this.cellSize.multiply(this.numCells);

    // Calculate screen bounds in world coordinates
    const screenCorners = [
        ez.screenToWorld(new vec3(0, 0, 0)),
        ez.screenToWorld(new vec3(ez.canvas.width, 0, 0)),
        ez.screenToWorld(new vec3(0, ez.canvas.height, 0)),
        ez.screenToWorld(new vec3(ez.canvas.width, ez.canvas.height, 0))
    ];

    // Find min/max X and Y from screen corners
    const minX = Math.min(...screenCorners.map(c => c.x));
    const maxX = Math.max(...screenCorners.map(c => c.x));
    const minY = Math.min(...screenCorners.map(c => c.y));
    const maxY = Math.max(...screenCorners.map(c => c.y));

    // Calculate visible grid line indices
    const startX = Math.max(Math.floor(-halfNumCells.x), Math.floor(minX / this.cellSize.x));
    const endX = Math.min(Math.ceil(halfNumCells.x), Math.ceil(maxX / this.cellSize.x));
    const startY = Math.max(Math.floor(-halfNumCells.y), Math.floor(minY / this.cellSize.y));
    const endY = Math.min(Math.ceil(halfNumCells.y), Math.ceil(maxY / this.cellSize.y));

    // Vertical lines
    for (let i = startX; i <= endX; i++) {
        const pos = i * this.cellSize.x;
        const startPoint = new vec3(pos, Math.max(-gridSize.y / 2, minY), 0);
        const endPoint = new vec3(pos, Math.min(gridSize.y / 2, maxY), 0);

        let transformedStartPoint = ez.worldToScreen(startPoint);
        let transformedEndPoint = ez.worldToScreen(endPoint);

        if(this.roundToNearestPixel) {
            transformedStartPoint = transformedStartPoint.rounded();
            transformedEndPoint = transformedEndPoint.rounded();
        }

        ez.ctx.moveTo(transformedStartPoint.x, transformedStartPoint.y);
        ez.ctx.lineTo(transformedEndPoint.x, transformedEndPoint.y);
    }

    // Horizontal lines
    for (let i = startY; i <= endY; i++) {
        const pos = i * this.cellSize.y;
        const startPoint = new vec3(Math.max(-gridSize.x / 2, minX), pos, 0);
        const endPoint = new vec3(Math.min(gridSize.x / 2, maxX), pos, 0);

        let transformedStartPoint = ez.worldToScreen(startPoint);
        let transformedEndPoint = ez.worldToScreen(endPoint);

        if(this.roundToNearestPixel) {
            transformedStartPoint = transformedStartPoint.rounded();
            transformedEndPoint = transformedEndPoint.rounded();
        }

        ez.ctx.moveTo(transformedStartPoint.x, transformedStartPoint.y);
        ez.ctx.lineTo(transformedEndPoint.x, transformedEndPoint.y);
    }

    ez.ctx.stroke();
};

// svg grid (fullscreen overlay behind canvas)
// Same parameters as ez.grid; calling this updates the SVG grid instead of painting the canvas
ez.gridSvg = function ezGridSvg(cellSize, numCells, options) {
    ez._update();
    options = options || {};
    const color = options.color || '#dcdcdc';
    const strokeWidth = options.strokeWidth || 1;
    const crispEdges = options.crispEdges !== undefined ? options.crispEdges : true;

    // Ensure overlay SVG exists and is behind the canvas
    if (!ez._svgGridOverlay) {
        const SVG_NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', window.innerWidth);
        svg.setAttribute('height', window.innerHeight);
        svg.style.position = 'absolute';
        svg.style.left = '0';
        svg.style.top = '0';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '-1';
        // Insert behind the canvas
        const parent = ez.canvas.parentNode || document.body;
        parent.insertBefore(svg, ez.canvas);

        const gWorld = document.createElementNS(SVG_NS, 'g');
        svg.appendChild(gWorld);

        const gGrid = document.createElementNS(SVG_NS, 'g');
        gGrid.setAttribute('stroke', color);
        gGrid.setAttribute('fill', 'none');
        gGrid.setAttribute('vector-effect', 'non-scaling-stroke');
        gGrid.setAttribute('stroke-width', String(strokeWidth));
        if (crispEdges) gGrid.setAttribute('shape-rendering', 'crispEdges');
        gWorld.appendChild(gGrid);

        ez._svgGridOverlay = { svg, gWorld, gGrid, SVG_NS };

        // Keep SVG sized to window
        window.addEventListener('resize', () => {
            svg.setAttribute('width', window.innerWidth);
            svg.setAttribute('height', window.innerHeight);
        });
    }

    const overlay = ez._svgGridOverlay;
    // Ensure size is up-to-date (in case caller resizes before event fires)
    overlay.svg.setAttribute('width', window.innerWidth);
    overlay.svg.setAttribute('height', window.innerHeight);
    // Update style from options on each call
    overlay.gGrid.setAttribute('stroke', color);
    overlay.gGrid.setAttribute('stroke-width', String(strokeWidth));
    if (crispEdges) overlay.gGrid.setAttribute('shape-rendering', 'crispEdges');
    else overlay.gGrid.removeAttribute('shape-rendering');

    // Build world->screen affine matrix for the group using current camera
    const O = ez.worldToScreen(vec3(0, 0, 0));
    const X = ez.worldToScreen(vec3(1, 0, 0));
    const Y = ez.worldToScreen(vec3(0, 1, 0));
    const a = X.x - O.x; // scale x
    const b = X.y - O.y; // shear y from x
    const c = Y.x - O.x; // shear x from y
    const d = Y.y - O.y; // scale y
    const e = O.x;       // translate x
    const f = O.y;       // translate y
    overlay.gWorld.setAttribute('transform', `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);

    // Clear existing lines
    while (overlay.gGrid.firstChild) overlay.gGrid.removeChild(overlay.gGrid.firstChild);

    // Determine visible world bounds
    const screenCorners = [
        ez.screenToWorld(new vec3(0, 0, 0)),
        ez.screenToWorld(new vec3(ez.canvas.width, 0, 0)),
        ez.screenToWorld(new vec3(0, ez.canvas.height, 0)),
        ez.screenToWorld(new vec3(ez.canvas.width, ez.canvas.height, 0))
    ];
    let minX = Math.floor(Math.min(...screenCorners.map(c => c.x))) - 1;
    let maxX = Math.ceil(Math.max(...screenCorners.map(c => c.x))) + 1;
    let minY = Math.floor(Math.min(...screenCorners.map(c => c.y))) - 1;
    let maxY = Math.ceil(Math.max(...screenCorners.map(c => c.y))) + 1;

    // Apply optional overall bounds from numCells if finite (match ez.grid semantics)
    const cs = vec2(cellSize || 10);
    const nc = vec2(numCells || 10);
    const halfNum = nc.scaled(0.5);

    // X bounds clamp
    if (Number.isFinite(halfNum.x)) {
        const leftBound = Math.floor(-halfNum.x);
        const rightBound = Math.ceil(halfNum.x);
        minX = Math.max(minX, Math.floor(leftBound * cs.x));
        maxX = Math.min(maxX, Math.ceil(rightBound * cs.x));
    }
    // Y bounds clamp
    if (Number.isFinite(halfNum.y)) {
        const botBound = Math.floor(-halfNum.y);
        const topBound = Math.ceil(halfNum.y);
        minY = Math.max(minY, Math.floor(botBound * cs.y));
        maxY = Math.min(maxY, Math.ceil(topBound * cs.y));
    }

    // Draw grid lines in world units; rely on group transform for placement
    const stepX = cs.x || 1;
    const stepY = cs.y || 1;
    const startX = Math.floor(minX / stepX) * stepX;
    const endX = Math.ceil(maxX / stepX) * stepX;
    const startY = Math.floor(minY / stepY) * stepY;
    const endY = Math.ceil(maxY / stepY) * stepY;

    for (let x = startX; x <= endX; x += stepX) {
        const line = document.createElementNS(overlay.SVG_NS, 'line');
        line.setAttribute('x1', String(x));
        line.setAttribute('y1', String(minY));
        line.setAttribute('x2', String(x));
        line.setAttribute('y2', String(maxY));
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        overlay.gGrid.appendChild(line);
    }
    for (let y = startY; y <= endY; y += stepY) {
        const line = document.createElementNS(overlay.SVG_NS, 'line');
        line.setAttribute('x1', String(minX));
        line.setAttribute('y1', String(y));
        line.setAttribute('x2', String(maxX));
        line.setAttribute('y2', String(y));
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        overlay.gGrid.appendChild(line);
    }
};

// line

ez.line = function ezLine(startPos, endPos, options) {
    if (!(this instanceof ezLine)) return new ezLine(startPos, endPos, options);
    this.startPos = vec2(startPos);
    this.endPos = vec2(endPos);
    this.options = options || {};

    // Default options
    this.lineDash = this.options.lineDash;
    this.roundToNearestPixel = this.options.roundToNearestPixel || false;
};

ez.line.prototype.stroke = function() {
    // Transform start and end points to screen coordinates
    let transformedStart = ez.worldToScreen(vec3(this.startPos));
    let transformedEnd = ez.worldToScreen(vec3(this.endPos));

    if(this.roundToNearestPixel) {
        transformedStart = transformedStart.rounded();
        transformedEnd = transformedEnd.rounded();
    }

    ez.save();

    ez.ctx.beginPath();
    ez.ctx.moveTo(transformedStart.x, transformedStart.y);
    ez.ctx.lineTo(transformedEnd.x, transformedEnd.y);

    // Apply line styles
    if(this.lineDash) ez.ctx.setLineDash(this.lineDash);

    ez.ctx.stroke();

    ez.restore();
};

// arrow

ez.arrow = function ezArrow(startPos, endPos, arrowSize) { 
    if (!(this instanceof ezArrow)) return new ezArrow(startPos, endPos, arrowSize);
    this.startPos = vec2(startPos);
    this.endPos = vec2(endPos);
    this.arrowSize = arrowSize || 10; // Size of the arrowhead
};

ez.arrow.prototype.drawPath = function() {
    // Transform start and end points using the camera matrix
    const transformedStart = ez.worldToScreen(vec3(this.startPos));
    const transformedEnd = ez.worldToScreen(vec3(this.endPos));
    
    // Calculate the direction vector of the arrow
    const direction = transformedEnd.sub(transformedStart).normalized();
    const perpendicular = new vec3(-direction.y, direction.x, 0); // Perpendicular vector for the width of the arrow shaft

    // Define the width of the arrow shaft and the arrowhead base
    const shaftWidth = this.arrowSize / 4; // Adjust the width as needed
    const arrowheadWidth = this.arrowSize; // Width of the base of the arrowhead

    // Calculate points for the shaft of the arrow
    const shaftStartLeft = transformedStart.add(perpendicular.scale(shaftWidth / 2));
    const shaftStartRight = transformedStart.sub(perpendicular.scale(shaftWidth / 2));
    const shaftEndLeft = transformedEnd.sub(direction.scale(this.arrowSize)).add(perpendicular.scale(shaftWidth / 2));
    const shaftEndRight = transformedEnd.sub(direction.scale(this.arrowSize)).sub(perpendicular.scale(shaftWidth / 2));

    // Points for the base of the arrowhead
    const arrowheadBaseCenter = transformedEnd.sub(direction.scale(this.arrowSize));
    const arrowheadLeft = arrowheadBaseCenter.add(perpendicular.scale(arrowheadWidth / 2));
    const arrowheadRight = arrowheadBaseCenter.sub(perpendicular.scale(arrowheadWidth / 2));

    ez.ctx.beginPath();
    // Draw the shaft from one side to the other
    ez.ctx.moveTo(shaftStartLeft.x, shaftStartLeft.y);
    ez.ctx.lineTo(shaftEndLeft.x, shaftEndLeft.y);
    // Draw the left side of the arrowhead
    ez.ctx.lineTo(arrowheadLeft.x, arrowheadLeft.y);
    // Draw to the tip of the arrowhead
    ez.ctx.lineTo(transformedEnd.x, transformedEnd.y);
    // Draw the right side of the arrowhead
    ez.ctx.lineTo(arrowheadRight.x, arrowheadRight.y);
    // Complete the path by drawing the right side of the shaft
    ez.ctx.lineTo(shaftEndRight.x, shaftEndRight.y);
    ez.ctx.lineTo(shaftStartRight.x, shaftStartRight.y);
    // Close the path to connect back to the start
    ez.ctx.closePath();
};

// path

ez.path = function ezPath(points = [], closed = false, smoothed = true, transform = mat3x4()) {
    if (!(this instanceof ezPath)) return new ezPath(points, closed, smoothed, transform);
    this.points = points.map(point => vec2(point)); // Ensure all points are vec2
    this.closed = closed
    this.smoothed = smoothed
    this.transform = transform;
};
ez.path.prototype.drawPath = function() {
    if (this.points.length < 2) return; // Need at least two points to draw a path

    ez.ctx.beginPath();

    // Move to first point
    let start = ez.worldToScreen(vec3(this.points[0].x, this.points[0].y, 0), this.transform);
    ez.ctx.moveTo(start.x, start.y);

    // Draw path through intermediate points
    for (let i = 1; i < this.points.length - 1; i++) {
        let current = this.points[i];
        let next = this.points[i + 1];
        
        if (this.smoothed) {
            // For smooth paths, use quadratic curves through midpoints
            let midPoint = current.add(next).scale(0.5);
            let transformedMid = ez.worldToScreen(vec3(midPoint.x, midPoint.y, 0), this.transform);
            let transformedCurrent = ez.worldToScreen(vec3(current.x, current.y, 0), this.transform);
            ez.ctx.quadraticCurveTo(transformedCurrent.x, transformedCurrent.y, transformedMid.x, transformedMid.y);
        } else {
            // For non-smooth paths, just draw straight lines
            let transformedCurrent = ez.worldToScreen(vec3(current.x, current.y, 0), this.transform);
            ez.ctx.lineTo(transformedCurrent.x, transformedCurrent.y);
        }
    }

    // Draw to final point
    let end = ez.worldToScreen(vec3(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y, 0), this.transform);
    ez.ctx.lineTo(end.x, end.y);

    if (this.closed) {
        ez.ctx.closePath();
    }
};

// text

// Wrapper to call ez.text with font size based on world y basis
ez.textWorldScaled = function ezTextWorldScaled(text, pos, options) {
    let yScale = vec3(ez.camera.matrix.col2).length()
    return ez.text(text, pos, {
        ...options,
        fontSize: options.fontSize / yScale * 0.1,
        lineHeight: options?.lineHeight !== undefined ? options.lineHeight / yScale * 0.1 : undefined
    })
}

ez.text = function ezText(text, pos, options) {
    if (!(this instanceof ezText)) return new ezText(text, pos, options);
    this.text = text;
    this.pos = vec2(pos); // Text position
    this.options = options || {};

    // Default options
    this.fontSize = this.options.fontSize || 16; // Default font size
    this.fontFamily = this.options.fontFamily || 'Arial'; // Default font family
    this.fontStyle = this.options.fontStyle || 'normal'; // Default font style
    this.textAlign = this.options.textAlign || ez.ctx.textAlign; // Default text align
    this.textBaseline = this.options.textBaseline || ez.ctx.textBaseline; // Default text baseline
    this.lineHeight = this.options.lineHeight || this.fontSize * 1.2; // Default line height
};

ez.text.prototype.renderText = function(method) {
    // Split the text into lines
    const lines = this.text.split(/\r?\n/);

    // Apply the text styles
    ez.save();
    ez.ctx.font = `${this.fontStyle} ${this.fontSize}px ${this.fontFamily}`;
    ez.ctx.textAlign = this.textAlign;
    ez.ctx.textBaseline = this.textBaseline; // Use the textBaseline from the options

    // Transform the position to screen coordinates
    const transformedPos = ez.worldToScreen(vec3(this.pos.x, this.pos.y, 0));

    // Calculate the total height of the text block
    const totalHeight = lines.length * this.lineHeight;

    // Calculate start position Y based on textBaseline
    let startY;
    if (this.textBaseline === 'middle') {
        startY = transformedPos.y - totalHeight / 2 + this.lineHeight / 2;
    } else if (this.textBaseline === 'top') {
        startY = transformedPos.y;
    } else if (this.textBaseline === 'bottom') {
        startY = transformedPos.y - totalHeight + this.lineHeight;
    } else { // Default to alphabetic
        startY = transformedPos.y - totalHeight / 2 + this.lineHeight / 2;
    }

    // Draw each line
    lines.forEach(line => {
        if (method === 'fill') {
            ez.ctx.fillText(line, transformedPos.x, startY);
        } else {
            ez.ctx.strokeText(line, transformedPos.x, startY);
        }
        startY += this.lineHeight;
    });

    ez.restore();
};

ez.text.prototype.fill = function() {
    this.renderText('fill');
};

ez.text.prototype.stroke = function() {
    this.renderText('stroke');
};

// buffered text - write to offscreen canvas first.
// allows subpixel positioning and smoothly moving text.
// normally fillText and strokeText force rounding to nearest pixel leading to jittery movement

// Wrapper to call ez.text with font size based on world y basis
ez.textWorldScaledBuffered = function ezTextWorldScaledBuffered(text, pos, options) {
    let yScale = vec3(ez.camera.matrix.col2).length()
    return ez.textBuffered(text, pos, {
        ...options,
        fontSize: options.fontSize / yScale * 0.1,
        lineHeight: options?.lineHeight !== undefined ? options.lineHeight / yScale * 0.1 : undefined
    })
}

// -----------------------------------------------------------------------------
//  ez.textBuffered – sub-pixel text identical to ez.text
//  Uses an off-screen canvas to avoid the whole-pixel snap of fillText/strokeText.
// -----------------------------------------------------------------------------

ez.textBuffered = function ezTextBuffered(text, pos, options) {
	// allow construction without `new`
	if (!(this instanceof ezTextBuffered)) return new ezTextBuffered(text, pos, options);

	// user-supplied ------------------------------------------------------------
	this.text			= text;
	this.pos			= vec2(pos);
	this.options		= options || {};

	this.fontSize		= this.options.fontSize		|| 16;
	this.fontFamily		= this.options.fontFamily	|| 'Arial';
	this.fontStyle		= this.options.fontStyle	|| 'normal';
	this.textAlign		= this.options.textAlign	|| ez.ctx.textAlign || 'left';
	this.textBaseline	= this.options.textBaseline	|| ez.ctx.textBaseline || 'alphabetic';
	this.lineHeight		= this.options.lineHeight	|| this.fontSize * 1.2;

	// off-screen canvas --------------------------------------------------------
	this._canvas		= document.createElement('canvas');
	this._ctx			= this._canvas.getContext('2d');
};

ez.textBuffered.prototype._prepareBuffer = function(method) {
	const ctx	= this._ctx;
	const lines	= this.text.split(/\r?\n/);

	// ---- metrics ------------------------------------------------------------
	ctx.font			= `${this.fontStyle} ${this.fontSize}px ${this.fontFamily}`;
	ctx.textAlign		= 'left';
	ctx.textBaseline	= 'alphabetic';

	let maxAsc = 0, maxDesc = 0, maxW = 0;
	for (const l of lines) {
		const m = ctx.measureText(l);
		maxAsc	= Math.max(maxAsc,	m.actualBoundingBoxAscent	|| this.fontSize * 0.8);
		maxDesc	= Math.max(maxDesc,	m.actualBoundingBoxDescent || this.fontSize * 0.2);
		maxW	= Math.max(maxW,	 m.width);
	}

	const w = Math.ceil(maxW);
	const h = Math.ceil(maxAsc + maxDesc + (lines.length - 1) * this.lineHeight);

	// ---- resize if needed ----------------------------------------------------
	if (this._canvas.width !== w || this._canvas.height !== h) {
		this._canvas.width	= Math.max(w, 1);
		this._canvas.height	= Math.max(h, 1);
	}

	// ---- clear & style -------------------------------------------------------
	ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
	ctx.font			= `${this.fontStyle} ${this.fontSize}px ${this.fontFamily}`;
	ctx.textBaseline	= 'alphabetic';		// always alphabetic inside buffer

	if (method === 'fill')	ctx.fillStyle	= ez.ctx.fillStyle;
	else					ctx.strokeStyle	= ez.ctx.strokeStyle;

	// ---- horizontal anchor ---------------------------------------------------
	let anchorX;
	switch (this.textAlign) {
		case 'center':	anchorX = w * 0.5;	ctx.textAlign = 'center';	break;
		case 'right':
		case 'end':		anchorX = w;		ctx.textAlign = 'right';	break;
		default:		anchorX = 0;		ctx.textAlign = 'left';		break;
	}
	this._anchorX = anchorX;

	// ---- draw all lines (baseline at maxAsc) ---------------------------------
	let baselineY = maxAsc;
	for (const line of lines) {
		if (method === 'fill')	ctx.fillText(line, anchorX, baselineY);
		else					ctx.strokeText(line, anchorX, baselineY);
		baselineY += this.lineHeight;
	}

	// store for blit -----------------------------------------------------------
	this._bufW		= w;
	this._bufH		= h;
	this._asc		= maxAsc;
	this._lines		= lines.length;
};

ez.textBuffered.prototype._blit = function() {
	const scr = ez.worldToScreen(vec3(this.pos.x, this.pos.y, 0));

	// horizontal offset so anchor sits at scr.x -------------------------------
	const offX = this._anchorX;

	// vertical offset to mimic ez.text -----------------------------------------
	let offY;
	switch (this.textBaseline) {
		case 'top':
			offY = 0;										// top of block
			break;
		case 'bottom':
			offY = (this._lines - 1) * this.lineHeight + this._asc;
			break;
		case 'middle':
		default: /* alphabetic handled same as middle in ez.text.renderText */
			offY = this._asc + (this._lines - 1) * this.lineHeight * 0.5;
			break;
	}

	ez.ctx.drawImage(this._canvas, scr.x - offX, scr.y - offY);
};

// public helpers --------------------------------------------------------------
ez.textBuffered.prototype.fill		= function() { this._prepareBuffer('fill');	this._blit(); };
ez.textBuffered.prototype.stroke	= function() { this._prepareBuffer('stroke');	this._blit(); };


// triangle

ez.triangle = function ezTriangle(pos, points, colors) {
    if (!(this instanceof ezTriangle)) return new ezTriangle(pos, points, colors);
    this.pos = vec3(pos); // Triangle's center position
    if(Array.isArray(points) && points.length === 6) points = [points.slice(0,2),points.slice(2,4),points.slice(4,6)]
    else if(Array.isArray(points) && points.length === 9) points = [points.slice(0,3),points.slice(3,6),points.slice(6,9)]
    this.points = points.map(p => vec3(p)); // Array of points (vec3) relative to center
    this.colors = colors; // Array of colors corresponding to each vertex
    this.isSubdiv = false;

    // Prepare the transform for the triangle, including scale and position
    this.transform = mat3x4();
    this.transform.setOrigin(this.pos);
};

ez.triangle.prototype.stroke = function(color) {
    ez.save();
    
    // Transform each point to screen space
    let transformedPoints = this.points.map(point => ez.worldToScreen(point, this.transform));
    const [p0, p1, p2] = transformedPoints.map(p => vec2(p));

    const drawLineAndInterpolateColors = function(startPoint, endPoint, startColor, endColor) {
        // Calculate the gradient between startColor and endColor
        var gradient = ez.ctx.createLinearGradient(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);
        
        // Set the stroke style to the gradient and draw the line
        ez.ctx.strokeStyle = gradient;
        ez.ctx.beginPath();
        ez.ctx.moveTo(startPoint.x, startPoint.y);
        ez.ctx.lineTo(endPoint.x, endPoint.y);
        ez.ctx.stroke();
    };
    
    // Draw lines between the points and interpolate colors
    drawLineAndInterpolateColors(p0, p1, color ?? this.colors[0], color ?? this.colors[1]);
    drawLineAndInterpolateColors(p1, p2, color ?? this.colors[1], color ?? this.colors[2]);
    drawLineAndInterpolateColors(p2, p0, color ?? this.colors[2], color ?? this.colors[0]);

    ez.restore();
};

ez.triangle.prototype.fill = function(color) {
    ez.save();
    
    // Transform and project each point to screen space
    let transformedPoints = this.points.map(point => {
        return ez.worldToScreen(point, this.transform);
    });

    // Loop through a bounding box around the triangle and fill in pixels
    const [p0, p1, p2] = transformedPoints.map(p => vec2(p));
    ez.drawTriangle(ez.canvas, ez.ctx, p0, p1, p2, color ?? this.colors[0], color ?? this.colors[1], color ?? this.colors[2]);

    ez.restore();
};

// quad

ez.quad = function ezQuad(pos, points, colors) {
    if (!(this instanceof ezQuad)) return new ezQuad(pos, points, colors);
    this.pos = vec3(pos); // Quad's center position
    if (Array.isArray(points) && points.length === 8) points = [points.slice(0, 2), points.slice(2, 4), points.slice(4, 6), points.slice(6, 8)];
    else if (Array.isArray(points) && points.length === 12) points = [points.slice(0, 3), points.slice(3, 6), points.slice(6, 9), points.slice(9, 12)];
    this.points = points.map(p => vec3(p)); // Array of points (vec3) relative to center
    this.colors = colors; // Array of colors corresponding to each vertex

    // Prepare the transform for the quad, including scale and position
    this.transform = mat3x4();
    this.transform.setOrigin(this.pos);
};

ez.quad.prototype.getTriangles = function() {
    // Colors for the triangles (assuming colors are ordered in the same way as points)
    const colorsTriangle1 = [this.colors[0], this.colors[1], this.colors[2]];
    const colorsTriangle2 = [this.colors[2], this.colors[3], this.colors[0]];

    // Create and render the first triangle
    let triangle1 = ez.triangle(this.pos, [this.points[0], this.points[1], this.points[2]], colorsTriangle1);
    triangle1.transform = this.transform;

    // Create and render the second triangle
    let triangle2 = ez.triangle(this.pos, [this.points[2], this.points[3], this.points[0]], colorsTriangle2);
    triangle2.transform = this.transform;

    return [triangle1, triangle2];
}

ez.quad.prototype.fill = function(color) {
    const tris = this.getTriangles();
    tris[0].fill(color);
    tris[1].fill(color);
};

ez.quad.prototype.stroke = function(color) {
    const tris = this.getTriangles();
    tris[0].stroke(color);
    tris[1].stroke(color);
};


////////////////
// MATH STUFF //
////////////////

function vec2(...args) {
    if (!(this instanceof vec2)) return new vec2(...args);
    if(args.length === 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
        this.x = args[0];
        this.y = args[1];
    }
    else {
        let [x, y] = tryVecToArray(args).flat(Infinity)
        if(x !== undefined && y === undefined) y = x
        this.x = x || 0;
        this.y = y || 0;
    }
    this[Symbol.iterator] = function* () {
        yield this.x;
        yield this.y;
    };
    // Access like array
	Object.defineProperty(this, 0, {
		get: () => this.x,
		set: (v) => { this.x = v; },
		enumerable: true,
		configurable: true
	});
	Object.defineProperty(this, 1, {
		get: () => this.y,
		set: (v) => { this.y = v; },
		enumerable: true,
		configurable: true
	});
}
vec2.prototype.equals = function(other) { return this?.x === other?.x && this?.y === other?.y; }
vec2.prototype.lerp = function(other, t) { return vec2(this.x + (other.x - this.x) * t, this.y + (other.y - this.y) * t); }
vec2.prototype.add = function(...args) {
    if(args?.[0] instanceof vec2) {
        return vec2(this.x + args[0].x, this.y + args[0].y) // Fast path
    }
    else {
        let other = vec2(args); return vec2(this.x + other.x, this.y + other.y);
    }
}
vec2.prototype.sub = vec2.prototype.subtract = function(...args) {
    if(args?.[0] instanceof vec2) {
        return vec2(this.x - args[0].x, this.y - args[0].y) // Fast path
    }
    else {
        let other = vec2(args); return vec2(this.x - other.x, this.y - other.y);
    }
}
vec2.prototype.dot = function(...args) { let other = vec2(args); return this.x * other.x + this.y * other.y; }
vec2.prototype.divide = vec2.prototype.divided = vec2.prototype.div = function(...args) {
    let n = vec2(args)
    return vec2(this.x / n.x, this.y / n.y);
}
vec2.prototype.scale = vec2.prototype.scaled = vec2.prototype.multiply = vec2.prototype.mul = function(...args) {
    let n = vec2(args);
    return vec2(this.x * n.x, this.y * n.y);
}
vec2.prototype.magnitude = vec2.prototype.mag = vec2.prototype.length = vec2.prototype.len = function() { return Math.sqrt(this.x * this.x + this.y * this.y); }
vec2.prototype.magnitudeSq = vec2.prototype.magSq = vec2.prototype.lengthSq = function() { return this.x * this.x + this.y * this.y; }
vec2.prototype.duplicate = vec2.prototype.clone = function() { return vec2(this.x, this.y); }
vec2.prototype.normalized = vec2.prototype.normalize = vec2.prototype.normal = function() { return vec2(this.x / this.length(), this.y / this.length()); };
vec2.prototype.rounded = vec2.prototype.round = function() { return vec2(Math.round(this.x), Math.round(this.y)); };
vec2.prototype.floor = vec2.prototype.floored = function() { return vec2(Math.floor(this.x), Math.floor(this.y)); };
vec2.prototype.ceil = vec2.prototype.ceiled = function() { return vec2(Math.ceil(this.x), Math.ceil(this.y)); };
vec2.prototype.abs = function() { return vec2(Math.abs(this.x), Math.abs(this.y)); };
vec2.prototype.min = function(other) { return vec2(Math.min(this.x, other.x), Math.min(this.y, other.y)); };
vec2.prototype.max = function(other) { return vec2(Math.max(this.x, other.x), Math.max(this.y, other.y)); };
vec2.prototype.set = vec2.prototype.set_equal_to = function(...other) { this.x = vec2(other).x; this.y = vec2(other).y };
vec2.prototype.dist = function(other) { return vec2(other).sub(this).length(); }
vec2.prototype.crossSv = function(scalar) { return vec2(-scalar * this.y, scalar * this.x); }
vec2.prototype.rotated = vec2.prototype.rotate = function(angle) {
    // get rotated x and y basis vectors and multiply this.x and this.y by them
    //let xb = vec2(Math.cos(angle), Math.sin(angle));
    //let yb = vec2(-Math.sin(angle), Math.cos(angle));
    //return xb.scale(this.x).add(yb.scale(this.y));
    // Equivalent to the typical formula (faster):
    return vec2(
        Math.cos(angle) * this.x - Math.sin(angle) * this.y,
        Math.sin(angle) * this.x + Math.cos(angle) * this.y
    );
}
vec2.prototype.angle = function() { return Math.atan2(...this.normalized().yx) }
vec2.prototype.perpendicular_dot = vec2.prototype.cross = function(...other) {
    other = vec2(other);
    return this.x * other.y + this.y * -other.x;
    return this.x * other.y - this.y * other.x; // Same as above. Also same as the z component of vec3 cross
}
vec2.prototype.perpendicular = function() {
    return vec2(this.y, -this.x);
}

function vec3(...args) {
    if (!(this instanceof vec3)) return new vec3(...args);
    if(args.length === 3 && typeof args[0] === 'number' && typeof args[1] === 'number' && typeof args[2] === 'number') {
        this.x = args[0];
        this.y = args[1];
        this.z = args[2];
    }
    else {
        let [x, y, z] = args.map(tryVecToArray).flat(Infinity)
        if(x !== undefined && y === undefined && z === undefined) z = y = x
        this.x = x || 0; this.y = y || 0; this.z = z || 0;
    }
    this[Symbol.iterator] = function* () {
        yield this.x;
        yield this.y;
        yield this.z;
    };
    // Access like array
	Object.defineProperty(this, 0, {
		get: () => this.x,
		set: (v) => { this.x = v; },
		enumerable: true,
		configurable: true
	});
	Object.defineProperty(this, 1, {
		get: () => this.y,
		set: (v) => { this.y = v; },
		enumerable: true,
		configurable: true
	});
	Object.defineProperty(this, 2, {
		get: () => this.z,
		set: (v) => { this.z = v; },
		enumerable: true,
		configurable: true
	});
}

vec3.prototype.equals = function(other) { return this?.x === other?.x && this?.y === other?.y && this?.z === other?.z; }
vec3.prototype.lerp = function(other, t) { return vec3(this.x + (other.x - this.x) * t, this.y + (other.y - this.y) * t, this.z + (other.z - this.z) * t); }
vec3.prototype.add = function(...other) { other = vec3(other); return vec3(this.x + other.x, this.y + other.y, this.z + other.z); }
vec3.prototype.sub = function(...other) { other = vec3(other); return vec3(this.x - other.x, this.y - other.y, this.z - other.z); }
vec3.prototype.dot = function(...other) { other = vec3(other); return this.x * other.x + this.y * other.y + this.z * other.z; }
vec3.prototype.divide = vec3.prototype.divided = vec3.prototype.div = function(...n) {
    n = vec3(n);
    return vec3(this.x / n.x, this.y / n.y, this.z / n.z);
}
vec3.prototype.scale = vec3.prototype.scaled = vec3.prototype.multiply = vec3.prototype.mul = function(...n) {
    n = vec3(n);
    return vec3(this.x * n.x, this.y * n.y, this.z * n.z);
}
vec3.prototype.magnitude = vec3.prototype.mag = vec3.prototype.length = vec3.prototype.len = function() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
vec3.prototype.duplicate = vec3.prototype.clone = function() { return vec3(this.x, this.y, this.z); }
vec3.prototype.normalized = vec3.prototype.normalize = vec3.prototype.normal = function() { return new vec3(this.x / this.length(), this.y / this.length(), this.z / this.length()); };
vec3.prototype.rounded = vec3.prototype.round = function() { return vec3(Math.round(this.x), Math.round(this.y), Math.round(this.z)); };
vec3.prototype.floored = vec3.prototype.floor = function() { return vec3(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)); };
vec3.prototype.ceiled = vec3.prototype.ceil = function() { return vec3(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z)); };
vec3.prototype.abs = function() { return vec3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z)); };
vec3.prototype.set = vec3.prototype.set_equal_to = function(...other) { this.x = vec3(other).x; this.y = vec3(other).y; this.z = vec3(other).z };
vec3.prototype.dist = function(other) { return vec3(other).sub(this).length(); }
vec3.prototype.cross = function(...other) {
    other = vec3(other);
    // Real cross product formula:
    return vec3(
        this.y * other.z - this.z * other.y,
        this.z * other.x - this.x * other.z,
        this.x * other.y - this.y * other.x
    );
    // I think this is equivalent? was trying to figure out why
    return vec3(
        this.z * other.y - this.y * other.z,
        this.x * other.z - this.z * other.x,
        this.y * other.x - this.x * other.y
    );
};

vec3.prototype.perpendicular = function() {
    if(this.cross(1,0,0).length() > 0.001)
        return this.cross(1,0,0).normalized()
    else
        return this.cross(0,1,0).normalized()
}

vec3.prototype.rotated = function(axis, angle) {
    const k = axis.normalized(); // Ensure axis is a unit vector
    const v = this; // The vector to rotate
    const cosTheta = Math.cos(angle);
    const sinTheta = Math.sin(angle);
    const kDotV = k.dot(v); // Dot product of axis and vector

    // Rodrigues' rotation formula:
    // v_rot = v * cos(theta) + (k x v) * sin(theta) + k * (k . v) * (1 - cos(theta))

    const term1 = v.scaled(cosTheta); // v * cos(theta)
    const term2 = k.cross(v).scaled(sinTheta); // (k x v) * sin(theta)
    const term3 = k.scaled(kDotV * (1 - cosTheta)); // k * (k . v) * (1 - cos(theta))

    // Return the sum of the terms
    return term1.add(term2).add(term3);
}

function vec4(...args) {
    if (!(this instanceof vec4)) return new vec4(...args);
    if(args.length === 4 && typeof args[0] === 'number' && typeof args[1] === 'number' && typeof args[2] === 'number' && typeof args[3] === 'number') {
        this.x = args[0];
        this.y = args[1];
        this.z = args[2];
        this.w = args[3];
    }
    else {
        let [x, y, z, w] = args.map(tryVecToArray).flat(Infinity)
        if(x !== undefined && y === undefined && z === undefined && w === undefined) w = z = y = x
        this.x = x || 0; this.y = y || 0; this.z = z || 0; this.w = w || 0;
    }
    this[Symbol.iterator] = function* () {
        yield this.x;
        yield this.y;
        yield this.z;
        yield this.w;
    };
    // Access like array
	Object.defineProperty(this, 0, {
		get: () => this.x,
		set: (v) => { this.x = v; },
		enumerable: true,
		configurable: true
	});
	Object.defineProperty(this, 1, {
		get: () => this.y,
		set: (v) => { this.y = v; },
		enumerable: true,
		configurable: true
	});
	Object.defineProperty(this, 2, {
		get: () => this.z,
		set: (v) => { this.z = v; },
		enumerable: true,
		configurable: true
	});
	Object.defineProperty(this, 3, {
		get: () => this.w,
		set: (v) => { this.w = v; },
		enumerable: true,
		configurable: true
	});
}
vec4.prototype.equals = function(other) { return this?.x === other?.x && this?.y === other?.y && this?.z === other?.z && this?.w === other?.w; }
vec4.prototype.lerp = function(other, t) { return vec4(this.x + (other.x - this.x) * t, this.y + (other.y - this.y) * t, this.z + (other.z - this.z) * t, this.w + (other.w - this.w) * t); }
vec4.prototype.set = vec4.prototype.set_equal_to = function(...other) { this.x = vec4(other).x; this.y = vec4(other).y; this.z = vec4(other).z; this.w = vec4(other).w };

vec3.prototype.duplicate = function() { return vec4(this.x, this.y, this.z, this.w); }

// mat3

function mat3(col1, col2, col3) {
    if (!(this instanceof mat3)) return new mat3(col1, col2, col3);
    this.col1 = vec3(col1 || [1,0,0]);
    this.col2 = vec3(col2 || [0,1,0]);
    this.col3 = vec3(col3 || [0,0,1]);
}

mat3.prototype.equals = function(other) {
    if (!(other instanceof mat3)) return false;
    return this.col1.equals(other.col1) && 
           this.col2.equals(other.col2) &&
           this.col3.equals(other.col3);
}

mat3.prototype.multiply = function(otherMat) {
    if (!(otherMat instanceof mat3)) {
        throw new Error("You can only multiply a mat3 with another mat3.");
    }

    const a = this;
    const b = otherMat;

    const result = new mat3(
        vec3(
            a.col1.x * b.col1.x + a.col2.x * b.col1.y + a.col3.x * b.col1.z,
            a.col1.y * b.col1.x + a.col2.y * b.col1.y + a.col3.y * b.col1.z,
            a.col1.z * b.col1.x + a.col2.z * b.col1.y + a.col3.z * b.col1.z
        ),
        vec3(
            a.col1.x * b.col2.x + a.col2.x * b.col2.y + a.col3.x * b.col2.z,
            a.col1.y * b.col2.x + a.col2.y * b.col2.y + a.col3.y * b.col2.z,
            a.col1.z * b.col2.x + a.col2.z * b.col2.y + a.col3.z * b.col2.z
        ),
        vec3(
            a.col1.x * b.col3.x + a.col2.x * b.col3.y + a.col3.x * b.col3.z,
            a.col1.y * b.col3.x + a.col2.y * b.col3.y + a.col3.y * b.col3.z,
            a.col1.z * b.col3.x + a.col2.z * b.col3.y + a.col3.z * b.col3.z
        )
    );

    return result;
};

mat3.prototype.multiplyVec3 = function(vec) {
    return vec3(
        this.col1.x * vec.x + this.col2.x * vec.y + this.col3.x * vec.z,
        this.col1.y * vec.x + this.col2.y * vec.y + this.col3.y * vec.z,
        this.col1.z * vec.x + this.col2.z * vec.y + this.col3.z * vec.z
    );
};

mat3.prototype.transpose = function() {
    return mat3(
        vec3(this.col1.x, this.col2.x, this.col3.x),
        vec3(this.col1.y, this.col2.y, this.col3.y),
        vec3(this.col1.z, this.col2.z, this.col3.z)
    );
};

mat3.prototype.determinant = function() {
    return this.col1.x * (this.col2.y * this.col3.z - this.col2.z * this.col3.y) -
           this.col2.x * (this.col1.y * this.col3.z - this.col1.z * this.col3.y) +
           this.col3.x * (this.col1.y * this.col2.z - this.col1.z * this.col2.y);
};

mat3.prototype.inverse = function() {
    let a = this.col1.x, b = this.col1.y, c = this.col1.z;
    let d = this.col2.x, e = this.col2.y, f = this.col2.z;
    let g = this.col3.x, h = this.col3.y, i = this.col3.z;

    let det = a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g);
    if (det === 0) return null; // Non-invertible matrix

    let adj = new mat3(
        vec3(
            +(e*i - f*h),
            -(d*i - f*g),
            +(d*h - e*g)
        ),
        vec3(
            -(b*i - c*h),
            +(a*i - c*g),
            -(a*h - b*g)
        ),
        vec3(
            +(b*f - c*e),
            -(a*f - c*d),
            +(a*e - b*d)
        )
    );

    // Divide adjugate matrix by determinant
    for (let col of [adj.col1, adj.col2, adj.col3]) {
        col.x /= det;
        col.y /= det;
        col.z /= det;
    }

    return adj;
};

// mat4

function mat4(col1, col2, col3, col4) {
    if (!(this instanceof mat4)) return new mat4(col1, col2, col3, col4);
    if(col1 instanceof vec4 && col2 instanceof vec4 && col3 instanceof vec4 && col4 instanceof vec4) {
        // Fast path
        this.col1 = vec4(col1.x, col1.y, col1.z, col1.w);
        this.col2 = vec4(col2.x, col2.y, col2.z, col2.w);
        this.col3 = vec4(col3.x, col3.y, col3.z, col3.w);
        this.col4 = vec4(col4.x, col4.y, col4.z, col4.w);
    } else {
        this.col1 = vec4(col1 || [1,0,0,0]);
        this.col2 = vec4(col2 || [0,1,0,0]);
        this.col3 = vec4(col3 || [0,0,1,0]);
        this.col4 = vec4(col4 || [0,0,0,1]);
    }
}

mat4.prototype.equals = function(other) {
    if (!(other instanceof mat4)) return false;
    return this.col1.equals(other.col1) && 
           this.col2.equals(other.col2) &&
           this.col3.equals(other.col3) &&
           this.col4.equals(other.col4);
}

mat4.prototype.multiply = function(otherMat) {
    if (!(otherMat instanceof mat4)) {
        throw new Error("You can only multiply a mat4 with another mat4.");
    }

    const a = this;
    const b = otherMat;

    const result = new mat4(
        vec4(
            a.col1.x * b.col1.x + a.col2.x * b.col1.y + a.col3.x * b.col1.z + a.col4.x * b.col1.w,
            a.col1.y * b.col1.x + a.col2.y * b.col1.y + a.col3.y * b.col1.z + a.col4.y * b.col1.w,
            a.col1.z * b.col1.x + a.col2.z * b.col1.y + a.col3.z * b.col1.z + a.col4.z * b.col1.w,
            a.col1.w * b.col1.x + a.col2.w * b.col1.y + a.col3.w * b.col1.z + a.col4.w * b.col1.w
        ),
        vec4(
            a.col1.x * b.col2.x + a.col2.x * b.col2.y + a.col3.x * b.col2.z + a.col4.x * b.col2.w,
            a.col1.y * b.col2.x + a.col2.y * b.col2.y + a.col3.y * b.col2.z + a.col4.y * b.col2.w,
            a.col1.z * b.col2.x + a.col2.z * b.col2.y + a.col3.z * b.col2.z + a.col4.z * b.col2.w,
            a.col1.w * b.col2.x + a.col2.w * b.col2.y + a.col3.w * b.col2.z + a.col4.w * b.col2.w
        ),
        vec4(
            a.col1.x * b.col3.x + a.col2.x * b.col3.y + a.col3.x * b.col3.z + a.col4.x * b.col3.w,
            a.col1.y * b.col3.x + a.col2.y * b.col3.y + a.col3.y * b.col3.z + a.col4.y * b.col3.w,
            a.col1.z * b.col3.x + a.col2.z * b.col3.y + a.col3.z * b.col3.z + a.col4.z * b.col3.w,
            a.col1.w * b.col3.x + a.col2.w * b.col3.y + a.col3.w * b.col3.z + a.col4.w * b.col3.w
        ),
        vec4(
            a.col1.x * b.col4.x + a.col2.x * b.col4.y + a.col3.x * b.col4.z + a.col4.x * b.col4.w,
            a.col1.y * b.col4.x + a.col2.y * b.col4.y + a.col3.y * b.col4.z + a.col4.y * b.col4.w,
            a.col1.z * b.col4.x + a.col2.z * b.col4.y + a.col3.z * b.col4.z + a.col4.z * b.col4.w,
            a.col1.w * b.col4.x + a.col2.w * b.col4.y + a.col3.w * b.col4.z + a.col4.w * b.col4.w
        )
    );

    return result;
};

mat4.prototype.multiplyVec3 = function(vec) {
    vec = vec4(vec.x, vec.y, vec.z)
    return vec3(
        this.col1.x * vec.x + this.col2.x * vec.y + this.col3.x * vec.z + this.col4.x * vec.w,
        this.col1.y * vec.x + this.col2.y * vec.y + this.col3.y * vec.z + this.col4.y * vec.w,
        this.col1.z * vec.x + this.col2.z * vec.y + this.col3.z * vec.z + this.col4.z * vec.w
    );
};

mat4.prototype.multiplyVec4 = function(vec) {
    return vec4(
        this.col1.x * vec.x + this.col2.x * vec.y + this.col3.x * vec.z + this.col4.x * vec.w,
        this.col1.y * vec.x + this.col2.y * vec.y + this.col3.y * vec.z + this.col4.y * vec.w,
        this.col1.z * vec.x + this.col2.z * vec.y + this.col3.z * vec.z + this.col4.z * vec.w,
        this.col1.w * vec.x + this.col2.w * vec.y + this.col3.w * vec.z + this.col4.w * vec.w
    );
};

mat4.prototype.transpose = function() {
    return mat4(
        vec4(this.col1.x, this.col2.x, this.col3.x, this.col4.x),
        vec4(this.col1.y, this.col2.y, this.col3.y, this.col4.y),
        vec4(this.col1.z, this.col2.z, this.col3.z, this.col4.z),
        vec4(this.col1.w, this.col2.w, this.col3.w, this.col4.w)
    );
};

mat4.prototype.determinant = function() {
    let a = this.col1.x, b = this.col1.y, c = this.col1.z, d = this.col1.w;
    let e = this.col2.x, f = this.col2.y, g = this.col2.z, h = this.col2.w;
    let i = this.col3.x, j = this.col3.y, k = this.col3.z, l = this.col3.w;
    let m = this.col4.x, n = this.col4.y, o = this.col4.z, p = this.col4.w;

    let det1 = k * p - o * l;
    let det2 = j * p - n * l;
    let det3 = j * o - n * k;
    let det4 = i * p - m * l;
    let det5 = i * o - m * k;
    let det6 = i * n - m * j;

    return a * (f * det1 - g * det2 + h * det3) -
           b * (e * det1 - g * det4 + h * det5) +
           c * (e * det2 - f * det4 + h * det6) -
           d * (e * det3 - f * det5 + g * det6);
};

mat4.prototype.inverse = function() {
    let a = this.col1.x, b = this.col1.y, c = this.col1.z, d = this.col1.w;
    let e = this.col2.x, f = this.col2.y, g = this.col2.z, h = this.col2.w;
    let i = this.col3.x, j = this.col3.y, k = this.col3.z, l = this.col3.w;
    let m = this.col4.x, n = this.col4.y, o = this.col4.z, p = this.col4.w;

    let det = this.determinant();
    if (det === 0) return null; // Non-invertible matrix

    // Adjugate and determinant
    let adj = new mat4(
        vec4(
            +(f * k * p - f * l * o - j * g * p + j * h * o + n * g * l - n * h * k),
            -(b * k * p - b * l * o - j * c * p + j * d * o + n * c * l - n * d * k),
            +(b * g * p - b * h * o - f * c * p + f * d * o + n * c * h - n * d * g),
            -(b * g * l - b * h * k - f * c * l + f * d * k + j * c * h - j * d * g)
        ),
        vec4(
            -(e * k * p - e * l * o - i * g * p + i * h * o + m * g * l - m * h * k),
            +(a * k * p - a * l * o - i * c * p + i * d * o + m * c * l - m * d * k),
            -(a * g * p - a * h * o - e * c * p + e * d * o + m * c * h - m * d * g),
            +(a * g * l - a * h * k - e * c * l + e * d * k + i * c * h - i * d * g)
        ),
        vec4(
            +(e * j * p - e * l * n - i * f * p + i * h * n + m * f * l - m * h * j),
            -(a * j * p - a * l * n - i * b * p + i * d * n + m * b * l - m * d * j),
            +(a * f * p - a * h * n - e * b * p + e * d * n + m * b * h - m * d * f),
            -(a * f * l - a * h * j - e * b * l + e * d * j + i * b * h - i * d * f)
        ),
        vec4(
            -(e * j * o - e * k * n - i * f * o + i * g * n + m * f * k - m * g * j),
            +(a * j * o - a * k * n - i * b * o + i * c * n + m * b * k - m * c * j),
            -(a * f * o - a * g * n - e * b * o + e * c * n + m * b * g - m * c * f),
            +(a * f * k - a * g * j - e * b * k + e * c * j + i * b * g - i * c * f)
        )
    );

    // Divide adjugate matrix by determinant
    for (let col of [adj.col1, adj.col2, adj.col3, adj.col4]) {
        col.x /= det;
        col.y /= det;
        col.z /= det;
        col.w /= det;
    }

    return adj;
};

// mat3x4. used as a transform so has a bunch of utility functions

function mat3x4(col1, col2, col3, col4) {
    if (!(this instanceof mat3x4)) return new mat3x4(col1, col2, col3, col4);
    if(col1 instanceof vec4 && col2 instanceof vec4 && col3 instanceof vec4 && col4 instanceof vec4) {
        // Fast path
        this.matrix = new mat4(col1, col2, col3, col4);
    }
    else {
        this.matrix = new mat4(vec4(col1 || [1,0,0], 0), vec4(col2 || [0,1,0], 0), vec4(col3 || [0,0,1], 0), vec4(col4 || [0,0,0], 1));
    }
}

mat3x4.prototype.equals = function(other) {
    if (!(other instanceof mat3x4)) return false;
    return this.matrix.equals(other.matrix);
}

mat3x4.prototype.getOrigin = function() {
    return vec3(this.matrix.col4.x, this.matrix.col4.y, this.matrix.col4.z);
};

mat3x4.prototype.setOrigin = function(vec) {
    vec = vec3(vec)
    this.matrix.col4 = vec4(vec.x, vec.y, vec.z, 1);
};

mat3x4.prototype.setBasis = function(basis) {
    this.matrix.col1 = vec4(basis.col1.x, basis.col1.y, basis.col1.z, 0);
    this.matrix.col2 = vec4(basis.col2.x, basis.col2.y, basis.col2.z, 0);
    this.matrix.col3 = vec4(basis.col3.x, basis.col3.y, basis.col3.z, 0);
};

mat3x4.prototype.getBasis = function() {
    return mat3(
        vec3(this.matrix.col1.x, this.matrix.col1.y, this.matrix.col1.z),
        vec3(this.matrix.col2.x, this.matrix.col2.y, this.matrix.col2.z),
        vec3(this.matrix.col3.x, this.matrix.col3.y, this.matrix.col3.z)
    );
};

mat3x4.prototype.inverse = function() {
    let inv_4x4 = this.matrix.inverse()
    return mat3x4(
        inv_4x4.col1.xyz,
        inv_4x4.col2.xyz,
        inv_4x4.col3.xyz,
        inv_4x4.col4.xyz
    );
};

mat3x4.prototype.multiplyVec3 = function(vec) {
    return this.getBasis().multiplyVec3(vec).add(this.matrix.col4.xyz);
};

mat3x4.prototype.multiply = function(otherMat) {
    if (!(otherMat instanceof mat3x4)) {
        throw new Error("You can only multiply a mat3x4 with another mat3x4.");
    }
    otherMat = otherMat.matrix
    this.matrix = this.matrix.multiply(mat4(otherMatrix.col1, otherMatrix.col2, otherMatrix.col3, otherMatrix.col1, otherMatrix.col4))
};

mat3x4.prototype.getRotation2D = function() {
    return Math.atan2(this.matrix.col2.x, this.matrix.col1.x);
}

mat3x4.prototype.rotated = function(axis, angle) {
    // Create a rotation matrix based on the Rodrigues' rotation formula
    let cosTheta = Math.cos(-angle); // Made these negative to match p2.js convention... I assume p2 had it right and mine was backwards originally.
    let sinTheta = Math.sin(-angle);
    let rotationMatrix = mat3(
        vec3(
            cosTheta + (1 - cosTheta) * axis.x * axis.x,
            (1 - cosTheta) * axis.x * axis.y - sinTheta * axis.z,
            (1 - cosTheta) * axis.x * axis.z + sinTheta * axis.y
        ),
        vec3(
            (1 - cosTheta) * axis.y * axis.x + sinTheta * axis.z,
            cosTheta + (1 - cosTheta) * axis.y * axis.y,
            (1 - cosTheta) * axis.y * axis.z - sinTheta * axis.x
        ),
        vec3(
            (1 - cosTheta) * axis.z * axis.x - sinTheta * axis.y,
            (1 - cosTheta) * axis.z * axis.y + sinTheta * axis.x,
            cosTheta + (1 - cosTheta) * axis.z * axis.z
        )
    );

    // Multiply the rotation matrix with the current basis
    let newBasis = this.getBasis().multiply(rotationMatrix);

    // Create a new mat3x4 with the updated basis and the same origin
    return new mat3x4(
        newBasis.col1,
        newBasis.col2,
        newBasis.col3,
        this.getOrigin()
    );
};

mat3x4.prototype.scaled = function(scale) {
    // If scale is a single value, create a vec3 with the same value for uniform scaling
    if (typeof scale === 'number') {
        scale = new vec3(scale, scale, scale);
    } else if (Array.isArray(scale)) {
        scale = new vec3(scale);
    }

    return mat3x4(
        vec3(this.matrix.col1).scaled(scale),
        vec3(this.matrix.col2).scaled(scale),
        vec3(this.matrix.col3).scaled(scale),
        this.matrix.col4 // Since using this as a transform, not scaling the translate
        //vec3(this.matrix.col4).scaled(scale)
    );
};

mat3x4.prototype.translated = function(translate) {
    if (Array.isArray(translate)) {
        translate = new vec3(translate);
    }

    return mat3x4(
        this.matrix.col1,
        this.matrix.col2,
        this.matrix.col3,
        vec3(this.matrix.col4).add(translate)
    );
};

// Used in most of the shape funcs
function mat3x4From2DRotationAndPosition(angle, pos) {
	const cos = Math.cos(angle || 0);
	const sin = Math.sin(angle || 0);
	const x = pos?.[0] || 0;
	const y = pos?.[1] || 0;

	return new mat3x4(
		[cos, sin, 0],
		[-sin, cos, 0],
		[0, 0, 1],
		[x || 0, y || 0, 0]
	);
}

let _lastCameraBasis = null;
let _lastInvCameraBasis = null;
ez.worldToScreen = function(point, objectTransform) {
    if(ez.fast2DModeWithNoCameraRotation) {
        // In this mode, only need to account for camera position, scale, and centerOrigin vars
        let worldX = (objectTransform?.matrix?.col1.x ?? 1) * (point.x ?? 0) + (objectTransform?.matrix?.col2.x ?? 0) * (point.y ?? 0) + (objectTransform?.matrix?.col4.x ?? 0);
        let worldY = (objectTransform?.matrix?.col1.y ?? 0) * (point.x ?? 0) + (objectTransform?.matrix?.col2.y ?? 1) * (point.y ?? 0) + (objectTransform?.matrix?.col4.y ?? 0);

        // Apply camera transform (position and scale only)
        let screenX = (worldX - ez.camera.matrix.col4.x) / ez.camera.matrix.col1.x;
        let screenY = (worldY - ez.camera.matrix.col4.y) / ez.camera.matrix.col2.y;

        // Apply center origin offset if enabled
        if (ez.centerOrigin || ez.centerOriginX) {
            screenX += ez.canvas.width / 2;
        }
        if (ez.centerOrigin || ez.centerOriginY) {
            screenY += ez.canvas.height / 2;
        }

        return new vec2(screenX, screenY);
    }

    let worldX = point.x ?? 0, worldY = point.y ?? 0, worldZ = point.z ?? 0;

    // Apply object/model transform to get world coordinates (inlined mat3x4.multiplyVec3)
    if (objectTransform) {
        worldX = (objectTransform.matrix.col1.x * (point.x ?? 0) + objectTransform.matrix.col2.x * (point.y ?? 0) + objectTransform.matrix.col3.x * (point.z ?? 0)) || 0
        worldY = (objectTransform.matrix.col1.y * (point.x ?? 0) + objectTransform.matrix.col2.y * (point.y ?? 0) + objectTransform.matrix.col3.y * (point.z ?? 0)) || 0
        worldZ = (objectTransform.matrix.col1.z * (point.x ?? 0) + objectTransform.matrix.col2.z * (point.y ?? 0) + objectTransform.matrix.col3.z * (point.z ?? 0)) || 0

        worldX += objectTransform.matrix.col4.x
        worldY += objectTransform.matrix.col4.y
        worldZ += objectTransform.matrix.col4.z
    }

    // Apply camera transform. First translate/move the world around according to the camera pos in the world
    let csx = worldX - ez.camera.matrix.col4.x;
    let csy = worldY - ez.camera.matrix.col4.y;
    let csz = worldZ - ez.camera.matrix.col4.z;

    // Then, scale and rotate that world with the camera as the origin point to get our rotated camera perspective.
    // Cache the inverse camera basis calculation.
    const c = ez.camera.matrix;
    if (!_lastCameraBasis ||
        c.col1.x !== _lastCameraBasis.col1.x || c.col1.y !== _lastCameraBasis.col1.y || c.col1.z !== _lastCameraBasis.col1.z ||
        c.col2.x !== _lastCameraBasis.col2.x || c.col2.y !== _lastCameraBasis.col2.y || c.col2.z !== _lastCameraBasis.col2.z ||
        c.col3.x !== _lastCameraBasis.col3.x || c.col3.y !== _lastCameraBasis.col3.y || c.col3.z !== _lastCameraBasis.col3.z) {
        const cb = ez.camera.getBasis();
        // Cache so we aren't inverting camera basis many times per frame
        _lastCameraBasis = cb
        _lastInvCameraBasis = cb.inverse()
    }

    // Apply inverse camera basis rotation (inlined mat3.multiplyVec3)
    const icb_m = _lastInvCameraBasis; // Assuming mat3 stores columns directly or in a 'matrix' property
    const icb_c1 = icb_m.col1, icb_c2 = icb_m.col2, icb_c3 = icb_m.col3;

    const final_csx = icb_c1.x * csx + icb_c2.x * csy + icb_c3.x * csz;
    const final_csy = icb_c1.y * csx + icb_c2.y * csy + icb_c3.y * csz;
    const final_csz = icb_c1.z * csx + icb_c2.z * csy + icb_c3.z * csz;

    let cameraSpacePos = new vec3(final_csx, final_csy, final_csz);

    let screenSpacePos = vec3(cameraSpacePos);
    if(ez.useProjectionMatrix) {
        // Construct the projection mat from fov, aspect ratio, near plane distance, and far plane distance
        let projectionMat = ez.projectionMatrixOverride || ez.createProjectionMatrix(deg_to_rad(90), ez.canvas.height / ez.canvas.width, 1, 1000);
        // After the projection matrix is applied, it's called 'view space.' We still need to divide by w (original z coordinate) to apply perspective/vanishing point
        let viewSpacePos = projectionMat.multiplyVec4(vec4(cameraSpacePos, 1.0));
        // Apply perspective divide
        let clipSpacePos = vec3(viewSpacePos.xyz).divide(viewSpacePos.w);
        // Clip space is normalized between -1 and 1 on all axes, so to get back to screen size, multiply by half width and half height
        let perspectiveScreenSpacePos = vec2(clipSpacePos.xy).multiply(vec2(ez.canvas.width/2, ez.canvas.height/2))

        // Coerece to interpolation value if bool, allows for effects like smoothly transitioning from a 2D view to a 3D view
        let interp = +ez.useProjectionMatrix || 0
        // Interpolate between no projection matrix applied and resulting application value
        screenSpacePos.x = lerpClamp(screenSpacePos.x, perspectiveScreenSpacePos.x, interp);
        screenSpacePos.y = lerpClamp(screenSpacePos.y, perspectiveScreenSpacePos.y, interp);
        screenSpacePos.z = lerpClamp(screenSpacePos.z, perspectiveScreenSpacePos.z, interp);
    }
    if(ez.centerOrigin || (ez.centerOriginX && ez.centerOriginY)) {
        screenSpacePos.x += ez.canvas.width/2
        screenSpacePos.y += ez.canvas.height/2
    }
    else if(ez.centerOriginX) {
        screenSpacePos.x += ez.canvas.width/2
    }
    else if(ez.centerOriginY) {
        screenSpacePos.y += ez.canvas.height/2
    }
    return screenSpacePos;
}
ez.screenToWorld = function(pos) {
    pos = vec3(vec2(pos).xy, 0);
    if(ez.centerOrigin || (ez.centerOriginX && ez.centerOriginY)) {
        pos = pos.add(vec3(-ez.canvas.width/2, -ez.canvas.height/2))
    }
    else if(ez.centerOriginX) {
        pos = pos.add(vec3(-ez.canvas.width/2, 0))
    }
    else if(ez.centerOriginY) {
        pos = pos.add(vec3(0, -ez.canvas.height/2))
    }
    pos = ez.camera.getBasis().multiplyVec3(pos);
    pos = vec2(pos.add(ez.camera.getOrigin()).xy)
    return pos
    // settings for camera, ndc, perspective divide, etc
}

// Shorthand for doing worldToScreen on 2 points
ez.lengthToScreen = function(length) {
    let p1 = vec2(0, 0);
    let p2 = vec2(length, 0);
    let p1Screen = ez.worldToScreen(p1);
    let p2Screen = ez.worldToScreen(p2);
    return p2Screen.sub(p1Screen).magnitude();
}

ez.createProjectionMatrix = function(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1 / (near - far);

    return new mat4(
        [f / aspect, 0, 0, 0],
        [0, f, 0, 0],
        [0, 0, (near + far) * rangeInv, -1],
        [0, 0, near * far * rangeInv * 2, 0]
    );
}

ez.getMousePosWorld = function() {
    let pos = vec3(ez.mousePos.x, ez.mousePos.y, 0);
    return ez.screenToWorld(pos);
}

// Zoom so the rectangle (centre = pos, size = letterboxSize)
// is 100 % visible on the current canvas, honouring
// centreOrigin / centreOriginX / centreOriginY flags.
ez.letterBoxCamera = function(pos, letterboxSize, flipY = false) {
	ez._update();								// make sure canvas/ctx exist

	pos				= vec2(pos);
	letterboxSize	= vec2(letterboxSize).abs();	// safety

	const cw = ez.canvas.width;
	const ch = ez.canvas.height;
	const rw = letterboxSize.x;
	const rh = letterboxSize.y;

	if(rw === 0 || rh === 0) {
		console.warn("ez.letterBoxCamera: zero-sized rectangle");
		return;
	}

	// Uniform screen-pixels per world-unit that keeps BOTH edges in-frame
	const pixelsPerWU = Math.min(cw / rw, ch / rh);
	const wuPerPixel  = 1 / pixelsPerWU;				// basis scale

	//------------------------------------------------------------------
	// Choose where the rectangle should appear, based on centre flags
	//------------------------------------------------------------------
	let originX, originY;

	if(ez.centerOrigin || ez.centerOriginX) {
		// Want rectangle centre at screen-centre
		originX = pos.x;
	} else {
		// Left-align: rectangle's left edge at screen x = 0
		originX = pos.x - rw * 0.5;
	}

	if(ez.centerOrigin || ez.centerOriginY) {
			originY = pos.y;
	} else {
		// Top-align (world-Y positive downward in this library)
		originY = pos.y + rh * 0.5;
	}

	//------------------------------------------------------------------
	// Build the camera transform
	//------------------------------------------------------------------
	const cam = new mat3x4();
	cam.setBasis(mat3(
		vec3(wuPerPixel, 0, 0),		// X axis  (world-units per pixel)
		vec3(0, wuPerPixel, 0),		// Y axis  (keep sign ⇒ Y-down on screen)
		vec3(0, 0, 1)				// Z axis (unused in 2-D)
	));
	cam.setOrigin(vec3(originX, originY, 0));

	ez.camera = cam.scaled(vec3(1, flipY ? -1 : 1, 1));
};


///////////////////////
// GLOBAL MATH UTILS //
///////////////////////

function lerp(a, b, t) {
    return a + (b - a) * t;
}
ez.lerp = lerp

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
ez.clamp = clamp
function lerpClamp(a, b, t) {
    return clamp(lerp(a, b, t), Math.min(a, b), Math.max(a, b));
}
ez.lerpClamp = lerpClamp
function step(edge, value) {
    return value < edge ? 0 : 1;
}
ez.step = step
function smoothstep(edge0, edge1, value) {
    let t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3 - 2 * t);
}
ez.smoothstep = smoothstep

////////////////////////////
// MISC UTILITY FUNCTIONS //
////////////////////////////

// Object to store the observed variables' states
const smoothedVariables = {};

// Smoothly interpolates between values over time
ez.smoothVar = function(key, newValue = undefined, duration = 1000) {
    const currentTime = Date.now();
    
    // Initialize or update the tracking object for the specified key
    if (newValue !== undefined) {
        // If it's a new or updated target value
        if (!smoothedVariables[key] || smoothedVariables[key].targetValue !== newValue) {
            smoothedVariables[key] = {
                startValue: smoothedVariables[key]?.currentValue || 0,
                currentValue: smoothedVariables[key]?.currentValue || 0,
                targetValue: newValue,
                startTime: currentTime,
                endTime: currentTime + duration
            };
        }
    }
    
    // If the key is not being tracked, return 0 as a default value
    if (!smoothedVariables[key]) {
        return 0;
    }

    // Calculate the current interpolation value if within the transition period
    if (currentTime < smoothedVariables[key].endTime) {
        const elapsedTime = currentTime - smoothedVariables[key].startTime;
        const totalDuration = smoothedVariables[key].endTime - smoothedVariables[key].startTime;
        const progress = elapsedTime / totalDuration;
        
        // Linear interpolation formula: startValue + progress * (endValue - startValue)
        smoothedVariables[key].currentValue = smoothedVariables[key].startValue + 
                                              progress * (smoothedVariables[key].targetValue - smoothedVariables[key].startValue);
    } else {
        // If the transition period has ended, ensure the current value matches the target value
        smoothedVariables[key].currentValue = smoothedVariables[key].targetValue;
    }
    
    return smoothedVariables[key].currentValue;
}

function tryVecToArray(arg) {
    // Optimized version of tryVecToArray
    if (arg === undefined) return [0, 0, 0];

    // Fast path for numbers (common case for scalar expansion)
    if (typeof arg === 'number') return [arg];

    // Fast path for vec2, vec3, vec4 instances
    if (arg instanceof vec2) return [arg.x, arg.y];
    if (arg instanceof vec3) return [arg.x, arg.y, arg.z];
    if (arg instanceof vec4) return [arg.x, arg.y, arg.z, arg.w];

    // Handle arrays and array-like objects (includes TypedArrays)
    // Use a loop for potentially better performance than map/spread/flat for simple cases
    if (Array.isArray(arg) || (typeof arg === 'object' && arg !== null && typeof arg.length === 'number')) {
        const result = [];
        for (let i = 0; i < arg.length; i++) {
            const element = arg[i];
            // Recursively flatten known vector types or arrays within the array
            if (element?.x !== undefined && element?.y !== undefined && element?.z !== undefined && element?.w !== undefined) {
                result.push(element.x, element.y, element.z, element.w);
            } else if (element?.x !== undefined && element?.y !== undefined && element?.z !== undefined) {
                result.push(element.x, element.y, element.z);
            } else if (element?.x !== undefined && element?.y !== undefined) {
                result.push(element.x, element.y);
            } else if (Array.isArray(element)) {
                 // Use recursion for nested arrays, assuming finite depth usually
                result.push(...tryVecToArray(element));
            } else {
                result.push(element); // Add other elements directly
            }
        }
        // Filter out undefined/null values that might result from object processing
        // Note: This might be slightly different than the original's behavior with .flat() if the array contains undefined explicitly
        return result.filter(e => e !== undefined && e !== null);
    }

    // Handle plain objects with x, y, z, w properties
    if (typeof arg === 'object' && arg !== null) {
        const arr = [];
        if (arg.x !== undefined) arr.push(arg.x);
        if (arg.y !== undefined) arr.push(arg.y);
        if (arg.z !== undefined) arr.push(arg.z);
        if (arg.w !== undefined) arr.push(arg.w);
        // Return the array if properties were found, otherwise empty array
        return arr;
    }

    // Fallback for unrecognized types (e.g., strings, booleans) - wrap in array
    return [arg];
}

function deg_to_rad(degrees) {
    return degrees * (Math.PI / 180);
}

function rad_to_deg(radians) {
    return radians * (180 / Math.PI);
}

ez.bresenhamLineConnect = function(pointA, pointB) {
    let points = [];

    let x0 = pointA.x, y0 = pointA.y;
    let x1 = pointB.x, y1 = pointB.y;

    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, e2; 

    while (true) {
        points.push(new vec2(x0, y0));
        if (x0 === x1 && y0 === y1) break;
        e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }

    return points;
};

ez.smoothPoints = function(points, options = {}) {
    const iterations = options.iterations || 5; // Number of smoothing iterations
    const smoothingFactor = options.smoothingFactor || 0.25; // Factor for corner cutting

    let smoothedPoints = points.slice(); // Copy the original points array

    for (let it = 0; it < iterations; it++) {
        let newPoints = [];
        for (let i = 0; i < smoothedPoints.length - 1; i++) {
            const p0 = smoothedPoints[i];
            const p1 = smoothedPoints[i + 1];

            // Calculate the first new point
            const q = new vec2(
                p0.x + smoothingFactor * (p1.x - p0.x),
                p0.y + smoothingFactor * (p1.y - p0.y)
            );

            // Calculate the second new point
            const r = new vec2(
                p1.x - smoothingFactor * (p1.x - p0.x),
                p1.y - smoothingFactor * (p1.y - p0.y)
            );

            newPoints.push(q);

            if (i === smoothedPoints.length - 2) { // If it's the last iteration, add the second new point
                newPoints.push(r);
            }
        }

        // If it's not the first iteration, add the very first point of the previous smoothedPoints
        // because the algorithm "eats away" the start and end of the line over iterations
        if (it !== 0) {
            newPoints.unshift(smoothedPoints[0]);
        }
        
        // Similarly, add the very last point of the previous smoothedPoints to the end
        newPoints.push(smoothedPoints[smoothedPoints.length - 1]);

        smoothedPoints = newPoints;
    }

    return smoothedPoints;
}

ez.makeVecBarycentric = function(p, a, b, c) {
    const v0x = b.x - a.x, v0y = b.y - a.y;
    const v1x = c.x - a.x, v1y = c.y - a.y;
    const v2x = p.x - a.x, v2y = p.y - a.y;

    const d00 = v0x * v0x + v0y * v0y;
    const d01 = v0x * v1x + v0y * v1y;
    const d11 = v1x * v1x + v1y * v1y;
    const d20 = v2x * v0x + v2y * v0y;
    const d21 = v2x * v1x + v2y * v1y;

    const denom = d00 * d11 - d01 * d01;
    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1.0 - v - w;

    return {u, v, w};
};

// Was getting bottlenecked by ctx.getImageData on large canvas so came up with this to draw triangles faster
ez._blitCanvasSizes = [10, 20, 30, 40, 50, 100, 150, 200, 250, 500];
ez._blitCanvasCache = new Map();

// Function to select or create the appropriate canvas based on requested size
ez._getMiniCanvasForBlit = function(width, height) {
    // Find the smallest canvas size that fits the requested dimensions
    const sizeNeeded = Math.max(width, height);
    const selectedSize = ez._blitCanvasSizes.find(size => size >= sizeNeeded);
    if (!selectedSize) {
        throw new Error("Requested size exceeds maximum predefined canvas size.");
    }

    // Check if the canvas of the selected size is already created, if not, create it
    if (!ez._blitCanvasCache.has(selectedSize)) {
        const canvas = document.createElement("canvas");
        canvas.width = selectedSize;
        canvas.height = selectedSize;
        const ctx = canvas.getContext("2d", {willReadFrequently: true});
        // Initialize canvas with a clear state
        ctx.clearRect(0, 0, selectedSize, selectedSize);
        ez._blitCanvasCache.set(selectedSize, { canvas, ctx });
    }

    const { canvas, ctx } = ez._blitCanvasCache.get(selectedSize);
    // Clear the canvas to ensure it's ready for new drawing operations
    ctx.clearRect(0, 0, selectedSize, selectedSize);
    const canvasImageData = ctx.getImageData(0, 0, selectedSize, selectedSize);
    return [canvas, ctx, canvasImageData];
};


ez.drawTriangle = function(canvas, ctx, p0, p1, p2, color0="#000", color1="#000", color2="#000") {
    color0 = ez.parseColorAsRGBAObj(color0);
    color1 = ez.parseColorAsRGBAObj(color1);
    color2 = ez.parseColorAsRGBAObj(color2);

    var pointsAndColors = [{point: p0, color: color0}, {point: p1, color: color1}, {point: p2, color: color2}];

    // Sort points (and their colors) by y-coordinate
    pointsAndColors.sort((a, b) => a.point.y - b.point.y);

    // Unpack sorted points and colors
    [p0, p1, p2] = pointsAndColors.map(pc => vec2(pc.point).floor());
    [color0, color1, color2] = pointsAndColors.map(pc => pc.color);

    let blitCanvas, blitCtx, imgData
    let minX = Math.min(p0.x, p1.x, p2.x);
    let minY = Math.min(p0.y, p1.y, p2.y);
    let maxX = Math.max(p0.x, p1.x, p2.x);
    let maxY = Math.max(p0.y, p1.y, p2.y);
    if(Math.max(maxX + 1 - minX, maxY + 1 - minY) <= ez._blitCanvasSizes[ez._blitCanvasSizes.length - 1]) {
        [blitCanvas, blitCtx, imgData] = ez._getMiniCanvasForBlit(maxX + 1 - minX, maxY + 1 - minY);
        p0 = p0.sub([minX, minY]);
        p1 = p1.sub([minX, minY]);
        p2 = p2.sub([minX, minY]);
    }
    else {
        blitCanvas = canvas
        blitCtx = ctx
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    var pixels = imgData.data;

    const interpolate = function(p1, p2, y) {
        if (p1.y === p2.y) return p1.x;
        return ((y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y) + p1.x;
    };

    // Pre-calculate vector components for barycentric coordinates outside the loop
    const v0x = p1.x - p0.x, v0y = p1.y - p0.y;
    const v1x = p2.x - p0.x, v1y = p2.y - p0.y;
    const d00 = v0x * v0x + v0y * v0y;
    const d01 = v0x * v1x + v0y * v1y;
    const d11 = v1x * v1x + v1y * v1y;
    const denom = d00 * d11 - d01 * d01; // This stays constant for all pixels

    // Draw from top to bottom using scanline algorithm
    for (let y = p0.y; y <= p2.y; y++) {
        var x0 = interpolate(p0, p2, y);
        var x1 = (y < p1.y) ? interpolate(p0, p1, y) : interpolate(p1, p2, y);

        if (x0 > x1) [x0, x1] = [x1, x0]; // Swap if x0 is to the right of x1

        for (let x = Math.ceil(x0); x <= x1; x++) {
            const v2x = x - p0.x, v2y = y - p0.y;
            const d20 = v2x * v0x + v2y * v0y;
            const d21 = v2x * v1x + v2y * v1y;
            const v = (d11 * d20 - d01 * d21) / denom;
            const w = (d00 * d21 - d01 * d20) / denom;
            const u = 1.0 - v - w;

            const r = u * color0.r + v * color1.r + w * color2.r;
            const g = u * color0.g + v * color1.g + w * color2.g;
            const b = u * color0.b + v * color1.b + w * color2.b;

            const index = (x + y * imgData.width) * 4;
            pixels[index] = r;
            pixels[index + 1] = g;
            pixels[index + 2] = b;
            pixels[index + 3] = 255;
        }
    }

    if(canvas === blitCanvas) {
        ctx.putImageData(imgData, 0, 0);
    }
    else {
        blitCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(blitCanvas, minX, minY);
    }
};

// Create a canvas element dynamically
ez._parseColorCanvas = document.createElement('canvas');
ez._parseColorCanvas.width = 1;
ez._parseColorCanvas.height = 1;
ez._parseColorCanvasCtx = ez._parseColorCanvas.getContext('2d', {willReadFrequently: true});
const _colorCache = new Map();

ez.parseColor = function(color) {
    // Check if the input is a valid hexadecimal number
    if (!isNaN(color) && color >= 0 && color <= 0xFFFFFF) {
        return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
    }

    if(_colorCache.has(color)) return _colorCache.get(color);

    // Try setting the color and filling a rectangle to sample the color
    try {
        ez._parseColorCanvasCtx.clearRect(0,0,1,1);
        ez._parseColorCanvasCtx.fillStyle = color;
        ez._parseColorCanvasCtx.fillRect(0, 0, 1, 1);
        var imageData = ez._parseColorCanvasCtx.getImageData(0, 0, 1, 1).data;

        // Convert the RGBA color from the canvas to a hex string
        var hexColor = "#" + ((1 << 24) + (imageData[0] << 16) + (imageData[1] << 8) + imageData[2]).toString(16).slice(1).toUpperCase();
		// Check for alpha value and append if not 255 (fully opaque)
		if (imageData[3] !== 255) {
			var alphaHex = Math.round(imageData[3] / 255 * 255).toString(16).padStart(2, '0').toUpperCase();
			hexColor += alphaHex;
		}
        _colorCache.set(color, hexColor);
        return hexColor;
    } catch (e) {
        // If there's an error (invalid color), return black
        console.error("Error parsing color:", e);
        return "#000000";
    }
};

ez.parseColorAsRGBAObj = function(color) {
    let hexStr = ez.parseColor(color); // Assuming it returns a hex string like "#rrggbbaa" or "#rrggbb"

    // Remove the '#' character if present
    if (hexStr.startsWith('#')) {
        hexStr = hexStr.substring(1);
    }

    // Parse the r, g, b values from the hex string
    let r = parseInt(hexStr.substring(0, 2), 16);
    let g = parseInt(hexStr.substring(2, 4), 16);
    let b = parseInt(hexStr.substring(4, 6), 16);
    let a = hexStr.length === 8 ? parseInt(hexStr.substring(6, 8), 16) / 255 : 1;

    // Return the RGB object
    return { r, g, b, a };
}


/////////
// GUI //
/////////

ez._guiUpdateInputWithValue =function(path, value) {
    const inputElement = document.querySelector(`[data-path='${path}']`);
    if (inputElement) {
        if (inputElement.type === "checkbox") {
            inputElement.checked = value;
        } else if (inputElement.tagName.toLowerCase() === "select") {
            inputElement.value = value;
        } else {
            inputElement.value = value;
        }
    }
}

ez._guiTransformDataProperties = function(data, path, callbacks = {}, allDataPaths_out = []) {
    Object.keys(data).forEach((key) => {
        let internalValue = data[key];
        const currentPath = [...path, key].join(".");

        allDataPaths_out.push(currentPath);

        if (Array.isArray(internalValue)) {
            data[key] = internalValue[0]; // Set the data object to the first value of the array by default
        }

        if (typeof internalValue !== "object" || internalValue instanceof Function || Array.isArray(internalValue)) {
            Object.defineProperty(data, key, {
                get() {
                    return internalValue;
                },
                set(newValue) {
                    internalValue = newValue;
                    ez._guiUpdateInputWithValue(currentPath, newValue);
                    const catchallCallback = callbacks["*"];
                    const specificCallback = callbacks[currentPath];
                    if (specificCallback) {
                        specificCallback(newValue, currentPath);
                    }
                    if (catchallCallback) {
                        catchallCallback(newValue, currentPath);
                    }
                },
                enumerable: true,
                configurable: true,
            });
        } else if (typeof internalValue === "object" && !Array.isArray(internalValue) && internalValue !== null) {
            ez._guiTransformDataProperties(internalValue, [...path, key], callbacks, allDataPaths_out); // Recursive call for nested objects
        }
    });
}
ez._addMouseScrubListenersToNumberInput = function(numberInput, newValCallback) {
    let startX;
    let startValue;

    const onMouseDown = (e) => {
        // Ensure interaction starts only with the left mouse button
        if (e.button !== 0) return;
        
        // Clear any existing text selection before starting drag
        if (window.getSelection().toString()) {
            window.getSelection().removeAllRanges();
        }
        
        startX = e.pageX;
        startValue = parseFloat(numberInput.value);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
        const dx = e.pageX - startX;
        const baseSensitivity = 0.01;
        let step = parseFloat(numberInput.getAttribute('scrollStep') || numberInput.getAttribute('step') || `${baseSensitivity}`);
        let min = parseFloat(numberInput.getAttribute('min') || '-Infinity');
        let max = parseFloat(numberInput.getAttribute('max') || 'Infinity');
        
        // Scale sensitivity relative to step size to handle large steps
        const sensitivity = baseSensitivity * Math.max(1, step);
        
        // Calculate value change based on physical mouse movement
        let deltaValue = dx * sensitivity;
        
        // Preserve fractional changes until they accumulate to at least one step
        let effectiveValue = startValue + deltaValue;
        
        // Apply step increments while maintaining smooth dragging
        if (step > 0) {
            effectiveValue = Math.round(effectiveValue / step) * step;
        }
        
        // Clamp between min and max
        let newValue = Math.min(max, Math.max(min, effectiveValue));
        
        // Round to 10 decimal places to prevent floating point precision issues
        newValue = Math.round(newValue * 1e10) / 1e10;
        
        numberInput.value = newValue;
        newValCallback(newValue);
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    const onWheel = (e) => {
        // Prevent default scroll behavior
        e.preventDefault();
        
        let step = parseFloat(numberInput.getAttribute('scrollStep') || numberInput.getAttribute('step') || '1');
        let min = parseFloat(numberInput.getAttribute('min') || '-Infinity');
        let max = parseFloat(numberInput.getAttribute('max') || 'Infinity');
        
        // Get current value
        let currentValue = parseFloat(numberInput.value) || 0;
        
        // Determine direction (negative deltaY means scroll up, positive means scroll down)
        let direction = e.deltaY < 0 ? 1 : -1;
        
        // Calculate new value
        let newValue = currentValue + (direction * step);

        // Round to 10 decimal places to prevent floating point precision issues
        newValue = Math.round(newValue * 1e10) / 1e10;
        
        // Clamp between min and max
        newValue = Math.min(max, Math.max(min, newValue));
        
        // Update input and call callback
        numberInput.value = newValue;
        newValCallback(newValue);
    };

    numberInput.addEventListener('mousedown', onMouseDown);
    numberInput.addEventListener('wheel', onWheel, { passive: false });
}

ez._guiGenerateForm = function(dataObject, path) {
    const formContainer = document.createElement("div");

    const setPathValue = (path, value) => {
        let tempData = dataObject;
        for (let i = 0; i < path.length - 1; i++) {
            tempData = tempData[path[i]];
        }
        tempData[path[path.length - 1]] = value;
    }

    let nestedObjForRecur = dataObject;
    for(let i = 0; i < path.length; i++) {
        nestedObjForRecur = nestedObjForRecur[path[i]];
    }

    Object.entries(nestedObjForRecur).forEach(([key, value]) => {
        // Skip properties that start with underscore
        if (key == '_hints') return;

        const currentPath = [...path, key];

        if (typeof value === "function") {
            // Make functions buttons
            const button = document.createElement("button");
            button.classList.add("control");
            button.textContent = key;
            button.onclick = value;
            button.setAttribute("data-path", currentPath);
            formContainer.appendChild(button);

            if(dataObject._hints && dataObject._hints[key] && dataObject._hints[key].hidden && dataObject._hints[key].hidden === true) {
                button.style.display = "none";
            }
        } else if (Array.isArray(value)) {
            // Make arrays dropdowns
            const label = document.createElement("label");
            const labelText = document.createElement("span");
            labelText.innerText = key;
            labelText.title = key;
            labelText.classList.add("text")
            label.appendChild(labelText);

            const select = document.createElement("select");
            select.setAttribute("data-path", currentPath);
            value.forEach((option) => {
                const optionElement = document.createElement("option");
                optionElement.value = option;
                optionElement.textContent = option;
                select.appendChild(optionElement);
            });
            select.value = value[0]; // Default to first array element
            select.addEventListener("change", (e) => {
                setPathValue(currentPath, select.options[select.selectedIndex].value);
            });

            const control = document.createElement("span");
            control.classList.add("control");
            control.appendChild(select);
            label.appendChild(control);
            formContainer.appendChild(label);

            if(dataObject._hints && dataObject._hints[key] && dataObject._hints[key].hidden && dataObject._hints[key].hidden === true) {
                label.style.display = "none";
            }
        } else if (typeof value === "object" && !Array.isArray(value) && value !== null) {
            // Make nested objects collapsible sections
            const button = document.createElement("button");
            button.className = "collapsible";
            button.innerText = key;

            const contentDiv = document.createElement("div");
            contentDiv.className = "collapsible-content";
            contentDiv.appendChild(ez._guiGenerateForm(dataObject, currentPath)); // Recursive call for nested objects
            contentDiv.style.display = "none";

            button.addEventListener("click", function () {
                contentDiv.style.display = contentDiv.style.display === "none" ? "block" : "none";
                if (contentDiv.style.display === "none") {
                    button.classList.remove("expanded");
                } else {
                    button.classList.add("expanded");
                }
            });

            formContainer.appendChild(button);
            formContainer.appendChild(contentDiv);

            if(dataObject._hints && dataObject._hints[key] && dataObject._hints[key].hidden && dataObject._hints[key].hidden === true) {
                contentDiv.style.display = "none";
            }
        } else {
            // Make text, boolean, or numbers as text, checkbox, or number inputs
            const label = document.createElement("label");
            const labelText = document.createElement("span");
            labelText.innerText = key;
            labelText.title = key;
            labelText.classList.add("text")
            label.appendChild(labelText);

            let inputType = "text";
            if (typeof value === "boolean") {
                inputType = "checkbox";
            } else if (typeof value === "number") {
                inputType = "number";
            }

            const input = document.createElement("input");
            input.type = inputType;
            input.setAttribute("data-path", currentPath.join("."));
            input.name = currentPath.join(".");
            input.value = inputType === "checkbox" ? "" : value;
            input.checked = inputType === "checkbox" ? value : false;

            // Apply input attributes if they exist in the hints
            if (dataObject._hints && dataObject._hints[key]) {
                Object.entries(dataObject._hints[key]).forEach(([attr, val]) => {
                    if(attr === "hidden") {
                        if(val === true) {
                            label.style.display = "none";
                        }
                    } else {
                        input.setAttribute(attr, val);
                    }
                });
            }

            if(input.type === "number") {
                ez._addMouseScrubListenersToNumberInput(input, (newValue) => setPathValue(currentPath, Number(newValue)));
            }

            input.addEventListener("change", (e) => {
                const newValue = inputType === "checkbox" ? input.checked : input.value;
                setPathValue(currentPath, inputType === "number" ? Number(newValue) : newValue);
            });

            const control = document.createElement("span");
            control.classList.add("control");
            control.appendChild(input);
            label.appendChild(control);
            formContainer.appendChild(label);
        }
    });

    return formContainer;
}

ez._updateVisibilityClasses = function(formContainer) {
    // Remove existing classes
    const labels = formContainer.querySelectorAll('label');
    labels.forEach(label => {
        label.classList.remove('ezgui-first-visible', 'ezgui-last-visible');
    });

    // Find visible labels
    const visibleLabels = Array.from(labels).filter(label => 
        label.style.display !== 'none' && 
        getComputedStyle(label).display !== 'none'
    );

    // Add classes to first and last visible labels
    if (visibleLabels.length > 0) {
        visibleLabels[0].classList.add('ezgui-first-visible');
        visibleLabels[visibleLabels.length - 1].classList.add('ezgui-last-visible');
    }
};

ez._guiInjectStyles = function(palette, theme = 'default', darkMode = false) {
    const isMinimalist = theme === 'minimalist';
    const fontFamily = isMinimalist ? 
        "'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" :
        "'Lucida Grande', sans-serif";
    
    const styles = isMinimalist ? `
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600&display=swap');

        .ezgui-floating-window {
            position: absolute;
            bottom: 20px;
            right: 20px;
            width: min(320px, 90vw);
            max-width: 100%;
            background-color: ${palette.tertiaryBackground};
            color: ${palette.primaryText};
            font-family: ${fontFamily};
            font-size: 13px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border: 1px solid ${palette.borderColor};
            overflow: visible;
            display: flex;
            flex-direction: column;
        }

        .ezgui-floating-window form {
            order: 1;
            border-radius: 12px;
            overflow: hidden;
        }

        button.ezgui-close-controls {
            order: 2;
            background-color: transparent;
            color: ${palette.highlightText};
            font: 600 14px ${fontFamily};
            border: none;
            padding: 12px 16px;
            cursor: pointer;
            position: relative;
            text-align: left;
            transition: background-color 0.2s ease;
            border-top: 1px solid ${palette.borderColor};
            border-bottom-left-radius: 12px;
            border-bottom-right-radius: 12px;
        }

        button.collapsible {
            width: 100%;
            background-color: transparent;
            color: ${palette.highlightText};
            font: 600 14px ${fontFamily};
            border: none;
            padding: 12px 16px;
            cursor: pointer;
            position: relative;
            text-align: left;
            transition: background-color 0.2s ease;
            border-bottom: 1px solid ${palette.borderColor};
        }

        button.collapsible:first-child {
            border-top-left-radius: 12px;
            border-top-right-radius: 12px;
        }

        .ezgui-floating-window label {
            display: flex;
            align-items: center;
            padding: 10px 16px;
            cursor: pointer;
            color: ${palette.highlightText};
            transition: background-color 0.2s ease;
            position: relative;
            user-select: none;
            -webkit-user-select: none;
            -ms-user-select: none;
        }

        .ezgui-floating-window label.ezgui-first-visible {
            border-top-left-radius: 12px;
            border-top-right-radius: 12px;
        }

        .ezgui-floating-window label.ezgui-last-visible {
            border-bottom-left-radius: 12px;
            border-bottom-right-radius: 12px;
        }

        .ezgui-floating-window label:hover {
            background-color: ${palette.secondaryBackground};
        }

        .ezgui-floating-window label > .text {
            flex: 1;
            font-weight: 600;
            margin-right: 12px;
            user-select: none;
            -webkit-user-select: none;
            -ms-user-select: none;
        }

        .ezgui-floating-window label > .control {
            flex: 1.2;
            display: flex;
            justify-content: center;
            align-items: center;
            user-select: none;
            -webkit-user-select: none;
            -ms-user-select: none;
        }

        .ezgui-floating-window input[type="text"],
        .ezgui-floating-window input[type="number"] {
            width: 100%;
            background-color: ${palette.primaryBackground};
            color: ${palette.primaryText};
            border: 1px solid ${palette.borderColor};
            padding: 8px 12px;
            border-radius: 8px;
            font-family: ${fontFamily};
            font-size: 13px;
            transition: border-color 0.2s ease;
            user-select: none;
            -webkit-user-select: none;
            -ms-user-select: none;
        }

        .ezgui-floating-window input[type="text"]:focus,
        .ezgui-floating-window input[type="number"]:focus {
            outline: none;
            border-color: ${palette.accentBackground};
        }

        .ezgui-floating-window input[type="checkbox"] {
            appearance: none;
            width: 40px;
            height: 20px;
            border-radius: 10px;
            position: relative;
            cursor: pointer;
            transition: background-color 0.2s ease;
            background-color: ${theme === 'minimalist' && !darkMode ? palette.primaryBackground : palette.secondaryBackground};
            border: 1px solid ${palette.borderColor};
        }

        .ezgui-floating-window input[type="checkbox"]:checked {
            background-color: ${palette.accentBackground};
        }

        .ezgui-floating-window input[type="checkbox"]:before {
            content: '';
            position: absolute;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            top: 1px;
            left: 1px;
            background-color: ${theme === 'minimalist' && !darkMode ? palette.tertiaryBackground : palette.highlightText};
            transition: transform 0.2s ease;
            box-shadow: ${theme === 'minimalist' && !darkMode ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'};
        }

        .ezgui-floating-window input[type="checkbox"]:checked:before {
            transform: translateX(20px);
        }

        .ezgui-floating-window button.control {
            width: 100%;
            background-color: ${palette.secondaryBackground};
            color: ${palette.highlightText};
            border: 1px solid ${palette.borderColor};
            padding: 8px 16px;
            border-radius: 12px;
            font-family: ${fontFamily};
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
        }

        .ezgui-floating-window button.control:hover {
            background-color: ${palette.secondaryBackground};
            border-color: ${palette.accentBackground};
            color: ${palette.highlightText};
        }

        .collapsible-content {
            border-left: 5px solid ${palette.accentBackground};
        }

        button.collapsible::before {
            content: '';
            display: inline-block;
            width: 7px;
            height: 7px;
            background-image: url(${'data:image/svg+xml;base64,'+btoa("<svg xmlns='http://www.w3.org/2000/svg' width='5' height='5' viewBox='0 0 5 5'><polygon points='2,0 5,2.5 2,5' fill='"+palette.highlightText+"'/></svg>")});
            background-size: contain;
            background-repeat: no-repeat;
            margin-right: 8px;
            vertical-align: middle;
        }
        
        button.collapsible.expanded::before {
            background-image: url(${'data:image/svg+xml;base64,'+btoa("<svg xmlns='http://www.w3.org/2000/svg' width='5' height='5' viewBox='0 0 5 5'><polygon points='0,2 5,2 2.5,5' fill='"+palette.highlightText+"'/></svg>")});
        }

        .ezgui-floating-window select {
            width: 100%;
            background-color: ${palette.primaryBackground};
            color: ${palette.primaryText};
            border: 1px solid ${palette.borderColor};
            padding: 8px 12px;
            border-radius: 8px;
            font-family: ${fontFamily};
            font-size: 13px;
            transition: border-color 0.2s ease;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background-image: url(${'data:image/svg+xml;base64,'+btoa("<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='"+palette.primaryText+"' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>")});
            background-repeat: no-repeat;
            background-position: right 12px center;
            background-size: 10px;
            padding-right: 32px;
        }

        .ezgui-floating-window select:focus {
            outline: none;
            border-color: ${palette.accentBackground};
        }

        .ezgui-floating-window select:hover {
            background-color: ${palette.secondaryBackground};
        }

        .ezgui-floating-window select option {
            background-color: ${palette.primaryBackground};
            color: ${palette.primaryText};
            padding: 8px;
        }

        @media (max-width: 680px) {
            .ezgui-floating-window {
                width: min(92vw, 360px);
                font-size: 15px;
            }

            button.ezgui-close-controls,
            button.collapsible,
            .ezgui-floating-window button.control,
            .ezgui-floating-window input[type="text"],
            .ezgui-floating-window input[type="number"],
            .ezgui-floating-window select,
            .ezgui-floating-window label > .text {
                font-size: 15px;
            }

            .ezgui-floating-window label {
                padding: 12px 20px;
            }

            .ezgui-floating-window input[type="checkbox"] {
                width: 44px;
                height: 22px;
            }

            .ezgui-floating-window input[type="checkbox"]:before {
                width: 18px;
                height: 18px;
            }
        }
    ` : `
        .ezgui-floating-window {
            position: absolute;
            top: 10px;
            right: 10px;
            width: min(420px, 92vw);
            max-width: 100%;
            background-color: ${palette.tertiaryBackground};
            color: ${palette.primaryText};
            font-family: 'Lucida Grande', sans-serif;
            font-size: 12px;
            display: flex;
            flex-direction: column;
        }

        .ezgui-floating-window form {
            order: 1;
        }

        button.ezgui-close-controls {
            order: 2;
            width: 100%;
            background-color: ${palette.accentBackground};
            color: ${palette.highlightText};
            font-size: 11px;
            border: none;
            padding: 7px;
            cursor: pointer;
            position: relative;
            border-radius: 0;
            border-top: 1px solid ${palette.secondaryBackground};
        }

        button.collapsible {
            width: 100%;
            background-color: ${palette.accentBackground};
            color: ${palette.highlightText};
            font-size: 11px;
            border: none;
            padding: 7px;
            cursor: pointer;
            position: relative;
            border-radius: 0;
            text-align: left;
            border-bottom: 1px solid ${palette.secondaryBackground};
            user-select: none;
            -webkit-user-select: none;
            -ms-user-select: none;
        }

        button.ezgui-close-controls:hover, button.collapsible:hover {
            background-color: ${palette.secondaryBackground};
        }

        button.collapsible::before {
            content: '';
            display: inline-block;
            width: 7px;
            height: 7px;
            background-image: url(${'data:image/svg+xml;base64,'+btoa("<svg xmlns='http://www.w3.org/2000/svg' width='5' height='5' viewBox='0 0 5 5'><polygon points='2,0 5,2.5 2,5' fill='"+palette.highlightText+"'/></svg>")});
            background-size: contain;
            background-repeat: no-repeat;
            margin-right: 8px;
            vertical-align: middle;
        }
        
        button.collapsible.expanded::before {
            background-image: url(${'data:image/svg+xml;base64,'+btoa("<svg xmlns='http://www.w3.org/2000/svg' width='5' height='5' viewBox='0 0 5 5'><polygon points='0,2 5,2 2.5,5' fill='"+palette.highlightText+"'/></svg>")});
        }
        
        .ezgui-floating-window label {
            display: block;
            padding: 4px;
            cursor: pointer;
            border-bottom: 1px solid ${palette.secondaryBackground};
            color: ${palette.highlightText};
            overflow: hidden;
            white-space: nowrap;
        }

        .ezgui-floating-window label > .text, .ezgui-floating-window label > .control {
            display: inline-block;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .ezgui-floating-window label > .text {
            width: 40%;
            border-radius: 0px;
            border: 0px;
            padding: 0 4px 0 5px;
            user-select: none;
            -webkit-user-select: none;
            -ms-user-select: none;
        }

        .ezgui-floating-window label > .control {
            text-align: left;
            width: 60%;
        }

        .ezgui-floating-window button.control {
            padding: 4px 4px 4px 9px;
            text-align: left;
            background-color: transparent;
            color: ${palette.highlightText};
            border: 0px;
            width: 100%;
        }
        .ezgui-floating-window button.control:hover {
            background-color: ${palette.secondaryBackground};
            cursor: pointer;
            color: ${palette.highlightText};
            border: 0px;
            width: 100%;
        }

        .ezgui-floating-window input {
            background-color: ${palette.primaryBackground};
            color: ${palette.primaryText};
            border: 1px solid ${palette.secondaryBackground};
            padding: 2px 4px;
            border-radius: 2px;
        }
        .ezgui-floating-window input[type="text"], .ezgui-floating-window input[type="number"] {
            outline: none;
        }
        .ezgui-floating-window select {
            outline: none;
        }

        @media (max-width: 680px) {
            .ezgui-floating-window {
                width: min(94vw, 360px);
                font-size: 15px;
            }

            button.ezgui-close-controls,
            button.collapsible,
            .ezgui-floating-window button.control,
            .ezgui-floating-window input,
            .ezgui-floating-window select,
            .ezgui-floating-window label > .text,
            .ezgui-floating-window label > .control {
                font-size: 15px;
            }

            button.ezgui-close-controls,
            button.collapsible {
                padding: 10px;
            }

            .ezgui-floating-window label {
                padding: 8px 12px;
            }
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
}

ez.guiPalettes = {
    default: {
        primaryText: "#2FA1CC",
        highlightText: "#FFF",
        primaryBackground: "#303030",
        secondaryBackground: "#3C3C3C",
        tertiaryBackground: "#1A1A1A",
        accentBackground: "#000",
    },
    minimalist: {
        light: {
            primaryText: "#4a4036",
            highlightText: "#2d2420",
            primaryBackground: "#faf6f1",
            secondaryBackground: "#fff8eb",
            tertiaryBackground: "#ffffff",
            accentBackground: "#c17817",
            borderColor: "#e6dfd7"
        },
        dark: {
            primaryText: "#e1d4c9",
            highlightText: "#c8b8aa",
            primaryBackground: "#1a1a1a",
            secondaryBackground: "#2a2a2a",
            tertiaryBackground: "#242424",
            accentBackground: "#333333",
            borderColor: "#333333"
        }
    }
};

ez.gui = function(data, callbacks = {}, options = {}) {
    const theme = options.theme || 'default';
    const palette = theme === 'minimalist' ? 
        (options.darkMode ? ez.guiPalettes.minimalist.dark : ez.guiPalettes.minimalist.light) :
        ez.guiPalettes.default;

    let allDataPaths = []
    ez._guiTransformDataProperties(data, [], callbacks, allDataPaths);
    const form = ez._guiGenerateForm(data, [], callbacks);
    
    // Update visibility classes for proper border radius handling
    if (theme === 'minimalist') {
        ez._updateVisibilityClasses(form);
    }
    
    const floatingWindow = document.createElement("div");

    if (!options.hideControlsButton) {
        const closeControlsButton = document.createElement("button");
        closeControlsButton.innerText = theme === 'minimalist' ? 'Controls' : 'Close Controls';
        closeControlsButton.title = "Alt-Click to hide entire window, Alt+H to bring it back.";
        closeControlsButton.classList.add("ezgui-close-controls");

        closeControlsButton.onclick = (e) => {
            if(e.altKey) {
                floatingWindow.style.display = "none";
            }
            else {
                form.style.display = form.style.display === "none" ? "" : "none";
                closeControlsButton.innerText = form.style.display === "none" ? 
                    (theme === 'minimalist' ? 'Controls' : 'Open Controls') : 
                    (theme === 'minimalist' ? 'Controls' : 'Close Controls');
            }
        }
        floatingWindow.appendChild(closeControlsButton);
    }

    // Toggle hide floating window with alt + h
    document.addEventListener("keydown", (e) => {
        if((e.key === "h" || e.key === "H") && e.altKey && floatingWindow.checkVisibility()) {
            floatingWindow.style.display = "none";
        }
        else if ((e.key === "h" || e.key === "H") && e.altKey && !floatingWindow.checkVisibility()) {
            floatingWindow.style.display = "";
        }
    })

    floatingWindow.appendChild(form);
    floatingWindow.classList.add("ezgui-floating-window");

    let container = window?.ez?.canvas || options?.container || document.body;
    container.appendChild(floatingWindow);

    if (!options?.noStyling) {
        ez._guiInjectStyles(palette, theme, options.darkMode);
    }

    const endsInKeyRegex = /.*\[(.)\]$/;
    const endsInSpaceRegex = /.*\[(space|spacebar)\]$/i;
    let dataPathsEndingInKey = allDataPaths.filter(path => !path.startsWith("_hints")).filter(path => endsInKeyRegex.test(path))
    let keyPathMap = {}
    dataPathsEndingInKey.forEach(path => {keyPathMap[path.slice(-2)[0].toLowerCase()] = path})
    document.addEventListener("keypress", (e) => {
        const textInputTypes = ["text", "password", "email", "url", "search", "tel", "date", "time", "datetime-local", "month", "week"]
        if ((document.activeElement.tagName === "INPUT" &&  textInputTypes.indexOf(document.activeElement.type.toLowerCase()) !== -1) || document.activeElement.tagName === "TEXTAREA") {
            return;
        }

        if (document.activeElement.tagName === "INPUT" && document.activeElement.type === "number" &&
            ((e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === ',')) {
            return;
        }

        if (e.key === ' ') {
            const spacebarPath = allDataPaths.find(path => endsInSpaceRegex.test(path));
            if (spacebarPath) {
                const inputElement = document.querySelector(`[data-path='${spacebarPath}']`);
                if (inputElement) {
                    inputElement.click();
                    if(document.activeElement.tagName === "INPUT" && document.activeElement !== inputElement) {
                        document.activeElement.blur();
                    }
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        }

        let keyToPath = keyPathMap[e.key.toLowerCase()];
        if (keyToPath) {
            const inputElement = document.querySelector(`[data-path='${keyToPath}']`);
            if (inputElement) {
                // If it's a dropdown (select), cycle to next option and wrap around
                if (inputElement.tagName && inputElement.tagName.toLowerCase() === 'select') {
                    const total = inputElement.options.length;
                    if (total > 0) {
                        if (e.shiftKey) {
                            inputElement.selectedIndex = (inputElement.selectedIndex - 1 + total) % total;
                        } else {
                            inputElement.selectedIndex = (inputElement.selectedIndex + 1) % total;
                        }
                        // Trigger change so data object updates via ez._guiGenerateForm's listener
                        const changeEvent = new Event('change', { bubbles: true });
                        inputElement.dispatchEvent(changeEvent);
                    }
                } else {
                    // Fallback to click behavior (e.g., checkbox toggles)
                    inputElement.click();
                }
            }
        }
    });

    return floatingWindow;
}

/////////////////////////////////////////////
// CALL THESE LAST - SETUP SHORTHAND STUFF //
/////////////////////////////////////////////

// Shorthand hacks for each draw type. fillAndStroke and allow passing in color for each.
Object.entries(ez).forEach(([key,value]) => {
    if(typeof value === "function" && value.prototype) {
        if(value.prototype.drawPath && !value.prototype.fill && !value.prototype.stroke && !value.prototype.fillAndStroke) {
            value.prototype.fill = function(color) {
                this.drawPath();
                ez.ctx.fill();
            }
            value.prototype.stroke = function(color) {
                this.drawPath();
                ez.ctx.stroke();
            }
            value.prototype.fillAndStroke = function(fillColor, strokeColor) {
                this.drawPath();
                ez.ctx.fill();
                ez.ctx.stroke();
            }
        }

        if(value.prototype.fill) {
            let prevFill = value.prototype.fill
            value.prototype.fill = function(color = undefined, ctxOptions = {}) {
                ez.ctx.save()
                ez.ctx.fillStyle = color !== undefined ? ez.parseColor(color) : ez.ctx.fillStyle
                Object.entries(ctxOptions).forEach(([opt, val]) => ez.ctx[opt] = val)
                prevFill.bind(this)(color)
                ez.ctx.restore()
            }
        }

        if(value.prototype.stroke) {
            let prevStroke = value.prototype.stroke
            value.prototype.stroke = function(color = undefined, ctxOptions = {}) {
                ez.ctx.save()
                ez.ctx.strokeStyle = color !== undefined ? ez.parseColor(color) : ez.ctx.strokeStyle
                Object.entries(ctxOptions).forEach(([opt, val]) => ez.ctx[opt] = val)
                prevStroke.bind(this)(color)
                ez.ctx.restore()
            }
        }

        if(value.prototype.fillAndStroke) {
            let prevFillAndStroke = value.prototype.fillAndStroke
            value.prototype.fillAndStroke = function(fillColor = undefined, strokeColor = undefined, ctxOptions = {}) {
                ez.ctx.save()
                ez.ctx.fillStyle = fillColor !== undefined ? ez.parseColor(fillColor) : ez.ctx.fillStyle
                ez.ctx.strokeStyle = strokeColor !== undefined ? ez.parseColor(strokeColor) : ez.ctx.strokeStyle
                Object.entries(ctxOptions).forEach(([opt, val]) => ez.ctx[opt] = val)
                prevFillAndStroke.bind(this)(fillColor, strokeColor)
                ez.ctx.restore()
            }
        }

        if(value.prototype.fill && value.prototype.stroke && !value.prototype.fillAndStroke) {
            value.prototype.fillAndStroke = function(fillColor, strokeColor, ctxOptions) {
                this.fill(fillColor, ctxOptions)
                this.stroke(strokeColor, ctxOptions)
            }
        }
    }
})

// Swizzles for vectors so we can use them like vec4.xyz and vec3.zyx, or setters like vec3.xzy = [1,2,3] like how you can in shaders
ez.defineSwizzles = function(obj, ...propertyList) {
    function* generateCombinations(arr, length) {
        if (length === 1) {
            for (const item of arr) {
                yield [item];
            }
        } else {
            for (let i = 0; i < arr.length; i++) {
                const first = arr[i];
                const remainingCombinations = generateCombinations(arr, length - 1);
                for (const combination of remainingCombinations) {
                    yield [first, ...combination];
                }
            }
        }
    }

    for (let len = 2; len <= propertyList.length; len++) {
        for (const combination of generateCombinations(propertyList, len)) {
            const propName = combination.join('');
            Object.defineProperty(obj, propName, {
                get: function() {
                    return combination.map(prop => this[prop]);
                },
                set: function(value) {
                    combination.forEach((e, i) => this[e] = vec4(value).xyzw[i]);
                }
            });
        }
    }
}

ez.defineSwizzles(vec2.prototype, 'x', 'y', 'z', 'w')
ez.defineSwizzles(vec3.prototype, 'x', 'y', 'z', 'w')
ez.defineSwizzles(vec4.prototype, 'x', 'y', 'z', 'w')

// Hack so I don't have to call _update before every draw call etc. Any function you call automatically sets up ez
const _ezFunctionBlacklist = [
    "_update",
    "createCanvasAndAddToPage",
    "addInputEventListeners",
    "_ensureViewportMeta",
    "_applyCanvasScale",
    "_patchCanvasForHiDPI",
];

Object.entries(ez).forEach(([key,value]) => {
    if(typeof value === "function" && !_ezFunctionBlacklist.includes(key)) {
        ez[key] = (...args) => {
            ez._update();
            return value(...args);
        }
    }
})

// Animation System
ez._animationState = {
    isRunning: false,
    animationFrameId: null,
    animationCallback: null,
    lastFrameTime: 0,
    observer: null
};

ez.hideMouse = function() {
    document.body.style.cursor = "none";
}
ez.showMouse = function() {
    document.body.style.cursor = "auto";
}

// Make pause break key toggle a debug pause var
ez.debugPause = false;
document.addEventListener("keydown", function(e) {
    if (e.key === "Pause" || e.code === "Pause" || e.keyCode === 19) {
        ez.debugPause = !ez.debugPause;
    }
});

ez.callAnimate = function(callback, pauseOnHidden = true) {
    // Stop any existing animation
    if (ez._animationState.animationFrameId) {
        cancelAnimationFrame(ez._animationState.animationFrameId);
    }

    // Setup new animation state
    ez._animationState.animationCallback = callback;
    ez._animationState.isRunning = true;
    ez._animationState.lastFrameTime = performance.now();

    // Animation frame function
    function animate(currentTime) {
        if (!ez._animationState.isRunning) return;

        const deltaTime = (currentTime - ez._animationState.lastFrameTime) / 1000; // Convert to seconds
        ez._animationState.lastFrameTime = currentTime;

        // Call the user's animation function with deltaTime
        callback(ez.debugPause ? 0 : deltaTime);

        // Request next frame if still running
        if (ez._animationState.isRunning) {
            ez._animationState.animationFrameId = requestAnimationFrame(animate);
        }
    }

    // Start animation
    ez._animationState.animationFrameId = requestAnimationFrame(animate);

    // Setup intersection observer for visibility detection if requested
    if (pauseOnHidden) {
        // Remove any existing observer
        if (ez._animationState.observer) {
            ez._animationState.observer.disconnect();
        }

        // Create new observer
        ez._animationState.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    ez.resumeAnimation();
                } else {
                    ez.pauseAnimation();
                }
            });
        }, {
            root: null,
            threshold: 0.1  // Start running when at least 10% visible
        });

        // Start observing the canvas
        ez._animationState.observer.observe(ez.canvas);
    }

    return {
        pause: ez.pauseAnimation,
        resume: ez.resumeAnimation,
        stop: ez.stopAnimation
    };
};

ez.pauseAnimation = function() {
    ez._animationState.isRunning = false;
    if (ez._animationState.animationFrameId) {
        cancelAnimationFrame(ez._animationState.animationFrameId);
        ez._animationState.animationFrameId = null;
    }
};

ez.resumeAnimation = function() {
    if (!ez._animationState.isRunning && ez._animationState.animationCallback) {
        ez._animationState.isRunning = true;
        ez._animationState.lastFrameTime = performance.now();
        ez._animationState.animationFrameId = requestAnimationFrame(function animate(currentTime) {
            if (!ez._animationState.isRunning) return;

            const deltaTime = (currentTime - ez._animationState.lastFrameTime) / 1000;
            ez._animationState.lastFrameTime = currentTime;

            ez._animationState.animationCallback(deltaTime);

            if (ez._animationState.isRunning) {
                ez._animationState.animationFrameId = requestAnimationFrame(animate);
            }
        });
    }
};

ez.toggleAnimation = function() {
    if (ez._animationState.isRunning) {
        ez.pauseAnimation();
    } else {
        ez.resumeAnimation();
    }
}

ez.stopAnimation = function() {
    ez.pauseAnimation();
    ez._animationState.animationCallback = null;
    if (ez._animationState.observer) {
        ez._animationState.observer.disconnect();
        ez._animationState.observer = null;
    }
};
