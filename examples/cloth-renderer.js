/**
 * Cloth Renderer Mini Library
 * Self-contained WebGL curtain renderer with per-vertex colors, opacity, and interactive wireframe
 * 
 * Usage:
 * const curtains = new CurtainRenderer(canvas);
 * const vertexGrid = createVertexGrid(); // Make a2D array of {x, y, color, opacity}
 * curtains.createCurtain('main', vertexGrid, {
 *     wireframeColor: [1.0, 1.0, 1.0],
 *     outlineColor: [0.3, 0.05, 0.08, 1.0]
 * });
 * curtains.render();
 */

class CurtainRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = this.initWebGL(canvas);
        this.curtainProgram = this.createCurtainShaderProgram();
        this.wireframeProgram = this.createWireframeShaderProgram();
        this.outlineProgram = this.createOutlineShaderProgram();
        this.hexagonProgram = this.createHexagonShaderProgram();
        this.curtains = new Map();
        this.hexagonBuffer = this.createHexagonBuffer();
    }
    
    // Initialize WebGL context
    initWebGL(canvas) {
        const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) || 
                   canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
        if (!gl) throw new Error('WebGL not supported');
        

        
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        return gl;
    }
    
    // Create curtain shader program
    createCurtainShaderProgram() {
        const vertexShader = this.compileShader(`
            precision mediump float;
            attribute vec2 a_position;
            attribute vec3 a_color;
            varying vec3 v_color;
            
            void main() {
                // Convert pixel coordinates to normalized coordinates
                vec2 normalizedPos = vec2(
                    (a_position.x / ${this.canvas.width}.0) * 2.0 - 1.0,
                    1.0 - (a_position.y / ${this.canvas.height}.0) * 2.0
                );
                
                v_color = a_color;
                gl_Position = vec4(normalizedPos, 0.0, 1.0);
            }
        `, this.gl.VERTEX_SHADER);
        
        const fragmentShader = this.compileShader(`
            precision mediump float;
            varying vec3 v_color;
            
            void main() {
                gl_FragColor = vec4(v_color, 1.0);
            }
        `, this.gl.FRAGMENT_SHADER);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error('Curtain shader program failed to link');
        }
        
        // Get locations
        program.attribs = {
            position: this.gl.getAttribLocation(program, 'a_position'),
            color: this.gl.getAttribLocation(program, 'a_color')
        };
        program.uniforms = {};
        
        return program;
    }
    
    // Create wireframe shader program
    createWireframeShaderProgram() {
        const vertexShader = this.compileShader(`
            precision mediump float;
            attribute vec2 a_position;
            attribute float a_opacity;
            varying float v_opacity;
            
            void main() {
                // Convert pixel coordinates to normalized coordinates
                vec2 normalizedPos = vec2(
                    (a_position.x / ${this.canvas.width}.0) * 2.0 - 1.0,
                    1.0 - (a_position.y / ${this.canvas.height}.0) * 2.0
                );
                
                v_opacity = a_opacity;
                gl_Position = vec4(normalizedPos, -0.001, 1.0);
            }
        `, this.gl.VERTEX_SHADER);
        
        const fragmentShader = this.compileShader(`
            precision mediump float;
            uniform vec3 u_wireframeColor;
            varying float v_opacity;
            
            void main() {
                gl_FragColor = vec4(u_wireframeColor, v_opacity);
            }
        `, this.gl.FRAGMENT_SHADER);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error('Wireframe shader program failed to link');
        }
        
        // Get locations
        program.attribs = {
            position: this.gl.getAttribLocation(program, 'a_position'),
            opacity: this.gl.getAttribLocation(program, 'a_opacity')
        };
        program.uniforms = {
            wireframeColor: this.gl.getUniformLocation(program, 'u_wireframeColor')
        };
        
        return program;
    }
    
    // Create hexagon marker shader program
    createHexagonShaderProgram() {
        const vertexShader = this.compileShader(`
            precision mediump float;
            attribute vec2 a_position;
            
            void main() {
                // Convert pixel coordinates to normalized coordinates
                vec2 normalizedPos = vec2(
                    (a_position.x / ${this.canvas.width}.0) * 2.0 - 1.0,
                    1.0 - (a_position.y / ${this.canvas.height}.0) * 2.0
                );
                
                gl_Position = vec4(normalizedPos, -0.002, 1.0);
            }
        `, this.gl.VERTEX_SHADER);
        
        const fragmentShader = this.compileShader(`
            precision mediump float;
            uniform vec4 u_hexagonColor;
            
            void main() {
                gl_FragColor = u_hexagonColor;
            }
        `, this.gl.FRAGMENT_SHADER);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error('Hexagon shader program failed to link');
        }
        
        // Get locations
        program.attribs = {
            position: this.gl.getAttribLocation(program, 'a_position')
        };
        program.uniforms = {
            hexagonColor: this.gl.getUniformLocation(program, 'u_hexagonColor')
        };
        
        return program;
    }

    // Create outline shader program (simple, no per-vertex opacity)
    createOutlineShaderProgram() {
        const vertexShader = this.compileShader(`
            precision mediump float;
            attribute vec2 a_position;
            
            void main() {
                // Convert pixel coordinates to normalized coordinates
                vec2 normalizedPos = vec2(
                    (a_position.x / ${this.canvas.width}.0) * 2.0 - 1.0,
                    1.0 - (a_position.y / ${this.canvas.height}.0) * 2.0
                );
                
                gl_Position = vec4(normalizedPos, 0.001, 1.0);
            }
        `, this.gl.VERTEX_SHADER);
        
        const fragmentShader = this.compileShader(`
            precision mediump float;
            uniform vec4 u_outlineColor;
            
            void main() {
                gl_FragColor = u_outlineColor;
            }
        `, this.gl.FRAGMENT_SHADER);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error('Outline shader program failed to link');
        }
        
        // Get locations
        program.attribs = {
            position: this.gl.getAttribLocation(program, 'a_position')
        };
        program.uniforms = {
            outlineColor: this.gl.getUniformLocation(program, 'u_outlineColor')
        };
        
        return program;
    }
    
    // Compile shader helper
    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw new Error('Shader compilation error: ' + this.gl.getShaderInfoLog(shader));
        }
        
        return shader;
    }
    
    // Create hexagon geometry buffer
    createHexagonBuffer() {
        const radius = 10; // pixels
        const vertices = [];
        const indices = [];
        
        // Center point
        vertices.push(0, 0);
        
        // Hexagon vertices
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            vertices.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        
        // Create outline indices (lines connecting adjacent vertices)
        for (let i = 0; i < 6; i++) {
            indices.push(i + 1, ((i + 1) % 6) + 1);
        }
        
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        
        const indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);
        
        return {
            vertexBuffer: buffer,
            indexBuffer: indexBuffer,
            indexCount: indices.length
        };
    }
    
    // Create buffers from 2D vertex array
    createBuffersFromGrid(vertexGrid) {
        const rows = vertexGrid.length;
        const cols = vertexGrid[0].length;
        
        // Flatten vertex grid with opacity and color
        const vertices = [];
        const opacities = [];
        const colors = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                vertices.push(vertexGrid[row][col].x, vertexGrid[row][col].y);
                opacities.push(vertexGrid[row][col].opacity || 0.3); // Default opacity
                
                // Default to red velvet if no color specified
                const color = vertexGrid[row][col].color || [0.4, 0.08, 0.12];
                colors.push(color[0], color[1], color[2]);
            }
        }
        
        // Generate triangle indices
        const indices = [];
        for (let row = 0; row < rows - 1; row++) {
            for (let col = 0; col < cols - 1; col++) {
                const topLeft = row * cols + col;
                const topRight = topLeft + 1;
                const bottomLeft = (row + 1) * cols + col;
                const bottomRight = bottomLeft + 1;
                
                indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
            }
        }
        
        // Generate wireframe indices (lines)
        const wireframeIndices = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const current = row * cols + col;
                
                // Horizontal lines
                if (col < cols - 1) {
                    wireframeIndices.push(current, current + 1);
                }
                
                // Vertical lines
                if (row < rows - 1) {
                    wireframeIndices.push(current, current + cols);
                }
            }
        }
        
        // Generate outline indices (perimeter edges only)
        const outlineIndices = [];
        for (let col = 0; col < cols - 1; col++) {
            // Top edge
            outlineIndices.push(col, col + 1);
            // Bottom edge
            const bottomRow = (rows - 1) * cols;
            outlineIndices.push(bottomRow + col, bottomRow + col + 1);
        }
        for (let row = 0; row < rows - 1; row++) {
            // Left edge
            outlineIndices.push(row * cols, (row + 1) * cols);
            // Right edge
            const rightCol = cols - 1;
            outlineIndices.push(row * cols + rightCol, (row + 1) * cols + rightCol);
        }
        
        return {
            vertices: new Float32Array(vertices),
            opacities: new Float32Array(opacities),
            colors: new Float32Array(colors),
            indices: new Uint16Array(indices),
            wireframeIndices: new Uint16Array(wireframeIndices),
            outlineIndices: new Uint16Array(outlineIndices)
        };
    }
    
    // PUBLIC API: Create a curtain from 2D vertex grid
    createCurtain(id, vertexGrid, config = {}) {
        const bufferData = this.createBuffersFromGrid(vertexGrid);
        
        // Create WebGL buffers
        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, bufferData.vertices, this.gl.DYNAMIC_DRAW);
        
        const opacityBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, opacityBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, bufferData.opacities, this.gl.DYNAMIC_DRAW);
        
        const colorBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, bufferData.colors, this.gl.DYNAMIC_DRAW);
        
        const indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, bufferData.indices, this.gl.STATIC_DRAW);
        
        const wireframeBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, wireframeBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, bufferData.wireframeIndices, this.gl.STATIC_DRAW);
        
        const outlineBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, outlineBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, bufferData.outlineIndices, this.gl.STATIC_DRAW);
        
        this.curtains.set(id, {
            vertexBuffer: vertexBuffer,
            opacityBuffer: opacityBuffer,
            colorBuffer: colorBuffer,
            indexBuffer: indexBuffer,
            wireframeBuffer: wireframeBuffer,
            outlineBuffer: outlineBuffer,
            indexCount: bufferData.indices.length,
            wireframeCount: bufferData.wireframeIndices.length,
            outlineCount: bufferData.outlineIndices.length,
            wireframeColor: config.wireframeColor || [1.0, 1.0, 1.0],
            outlineColor: config.outlineColor || null
        });
        
        return this;
    }
    
    // PUBLIC API: Update curtain vertices
    updateCurtain(id, vertexGrid, config = null) {
        if (!this.curtains.has(id)) return this;
        
        const curtain = this.curtains.get(id);
        
        if (vertexGrid) {
            const bufferData = this.createBuffersFromGrid(vertexGrid);
            
            // Update vertex buffer
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, curtain.vertexBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, bufferData.vertices, this.gl.DYNAMIC_DRAW);
            
            // Update opacity buffer
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, curtain.opacityBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, bufferData.opacities, this.gl.DYNAMIC_DRAW);
            
            // Update color buffer
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, curtain.colorBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, bufferData.colors, this.gl.DYNAMIC_DRAW);
        }
        
        if (config) {
            Object.assign(curtain, config);
        }
        
        return this;
    }
    
    // PUBLIC API: Set hexagon marker position
    setHexagonMarker(targetPos, color = [1.0, 1.0, 0.0, 1.0]) {
        this.hexagonMarker = {
            position: targetPos,
            color: color
        };
        return this;
    }
    
    // PUBLIC API: Clear hexagon marker
    clearHexagonMarker() {
        this.hexagonMarker = null;
        return this;
    }
    
    // PUBLIC API: Get canvas dimensions for debugging
    getCanvasDimensions() {
        return {
            width: this.canvas.width,
            height: this.canvas.height,
            styleWidth: this.canvas.style.width,
            styleHeight: this.canvas.style.height,
            viewportWidth: this.gl.drawingBufferWidth,
            viewportHeight: this.gl.drawingBufferHeight
        };
    }

    clearCanvas() {
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent background
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
    
    // PUBLIC API: Render all curtains
    render() {
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent background
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        // Render each curtain
        for (const curtain of this.curtains.values()) {
            // 1. Render outline (underneath everything)
            if (curtain.outlineColor) {
                this.gl.useProgram(this.outlineProgram);
                this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, curtain.outlineBuffer);
                
                // Bind vertex positions
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, curtain.vertexBuffer);
                this.gl.enableVertexAttribArray(this.outlineProgram.attribs.position);
                this.gl.vertexAttribPointer(this.outlineProgram.attribs.position, 2, this.gl.FLOAT, false, 0, 0);
                
                this.gl.uniform4f(this.outlineProgram.uniforms.outlineColor, ...curtain.outlineColor);
                
                this.gl.drawElements(this.gl.LINES, curtain.outlineCount, this.gl.UNSIGNED_SHORT, 0);
            }
            
            // 2. Render filled curtain
            this.gl.useProgram(this.curtainProgram);
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, curtain.indexBuffer);
            
            // Bind vertex positions
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, curtain.vertexBuffer);
            this.gl.enableVertexAttribArray(this.curtainProgram.attribs.position);
            this.gl.vertexAttribPointer(this.curtainProgram.attribs.position, 2, this.gl.FLOAT, false, 0, 0);
            
            // Bind vertex colors
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, curtain.colorBuffer);
            this.gl.enableVertexAttribArray(this.curtainProgram.attribs.color);
            this.gl.vertexAttribPointer(this.curtainProgram.attribs.color, 3, this.gl.FLOAT, false, 0, 0);
            
            this.gl.drawElements(this.gl.TRIANGLES, curtain.indexCount, this.gl.UNSIGNED_SHORT, 0);
            
            // 3. Render wireframe overlay
            this.gl.useProgram(this.wireframeProgram);
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, curtain.wireframeBuffer);
            
            // Bind vertex positions
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, curtain.vertexBuffer);
            this.gl.enableVertexAttribArray(this.wireframeProgram.attribs.position);
            this.gl.vertexAttribPointer(this.wireframeProgram.attribs.position, 2, this.gl.FLOAT, false, 0, 0);
            
            // Bind vertex opacities
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, curtain.opacityBuffer);
            this.gl.enableVertexAttribArray(this.wireframeProgram.attribs.opacity);
            this.gl.vertexAttribPointer(this.wireframeProgram.attribs.opacity, 1, this.gl.FLOAT, false, 0, 0);
            
            this.gl.uniform3f(this.wireframeProgram.uniforms.wireframeColor, ...curtain.wireframeColor);
            
            this.gl.drawElements(this.gl.LINES, curtain.wireframeCount, this.gl.UNSIGNED_SHORT, 0);
        }
        
        // 4. Render hexagon marker (on top of everything)
        if (this.hexagonMarker) {
            this.gl.useProgram(this.hexagonProgram);
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.hexagonBuffer.indexBuffer);
            
            // Create temporary vertex buffer with translated hexagon position
            const hexVertices = [];
            const radius = 10; // pixels
            
            // Center point at target position
            hexVertices.push(this.hexagonMarker.position.x, this.hexagonMarker.position.y);
            
            // Hexagon vertices around target position
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI * 2) / 6;
                hexVertices.push(
                    this.hexagonMarker.position.x + Math.cos(angle) * radius,
                    this.hexagonMarker.position.y + Math.sin(angle) * radius
                );
            }
            
            // Update hexagon buffer with new position
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.hexagonBuffer.vertexBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(hexVertices), this.gl.DYNAMIC_DRAW);
            
            // Bind vertex positions
            this.gl.enableVertexAttribArray(this.hexagonProgram.attribs.position);
            this.gl.vertexAttribPointer(this.hexagonProgram.attribs.position, 2, this.gl.FLOAT, false, 0, 0);
            
            this.gl.uniform4f(this.hexagonProgram.uniforms.hexagonColor, ...this.hexagonMarker.color);
            
            this.gl.drawElements(this.gl.LINES, this.hexagonBuffer.indexCount, this.gl.UNSIGNED_SHORT, 0);
        }
        
        return this;
    }
    
    // PUBLIC API: Handle canvas resize
    resize() {
        // Update WebGL viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Only recreate shaders if canvas size actually changed
        if (!this.lastCanvasSize || 
            this.lastCanvasSize.width !== this.canvas.width || 
            this.lastCanvasSize.height !== this.canvas.height) {
            
            // Recreate shader programs with new canvas dimensions
            this.curtainProgram = this.createCurtainShaderProgram();
            this.wireframeProgram = this.createWireframeShaderProgram();
            this.outlineProgram = this.createOutlineShaderProgram();
            this.hexagonProgram = this.createHexagonShaderProgram();
            
            // Remember current canvas size
            this.lastCanvasSize = {
                width: this.canvas.width,
                height: this.canvas.height
            };
        }
        
        return this;
    }
}

// Export for use (works in both browser and module environments)
if (typeof window !== 'undefined') {
    window.CurtainRenderer = CurtainRenderer;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurtainRenderer;
} 