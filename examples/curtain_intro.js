(function(global){
    // Simple 2D vector used by the curtain physics
    class Vec2 {
        constructor(x, y) { this.x = x; this.y = y; }
        add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
        sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
        scale(s) { return new Vec2(this.x * s, this.y * s); }
        length() { return Math.hypot(this.x, this.y); }
    }

    // Basic Verlet integration particle
    class VerletObject {
        constructor(x, y, pinned = false) {
            this.position = new Vec2(x, y);
            this.prevPosition = new Vec2(x, y);
            this.pinned = pinned;
            this.originalX = x; // stored for pin animation
            this.pinIndex = -1;
        }

        step(dt, gravity) {
            if (this.pinned) return;
            const velocity = this.position.sub(this.prevPosition).add(gravity.scale(dt * dt));
            const next = this.position.add(velocity);
            this.prevPosition = this.position;
            this.position = next;
        }
    }

    // Distance constraint between two particles
    class VerletConstraint {
        constructor(a, b, rest = null, stiffness = 1) {
            this.a = a;
            this.b = b;
            this.rest = rest !== null ? rest : a.position.sub(b.position).length();
            this.stiffness = stiffness;
        }

        solve(stepCoef) {
            const delta = this.b.position.sub(this.a.position);
            const dist = delta.length();
            if (dist === 0) return;
            const diff = (dist - this.rest) / dist * this.stiffness * stepCoef;
            const correction = delta.scale(0.5 * diff);
            if (!this.a.pinned) this.a.position = this.a.position.add(correction);
            if (!this.b.pinned) this.b.position = this.b.position.sub(correction);
        }
    }

    // Minimal Verlet world
    class VerletWorld {
        constructor() {
            this.objects = [];
            this.constraints = [];
            this.gravity = new Vec2(0, 0); // configured per-scene
            this.iterations = 5;
        }

        addDistanceConstraint(a, b, rest, stiffness = 1) {
            const c = new VerletConstraint(a, b, rest, stiffness);
            this.constraints.push(c);
            return c;
        }

        step(dt) {
            for (const obj of this.objects) {
                obj.step(dt, this.gravity);
            }
            const stepCoef = 1 / this.iterations;
            for (let i = 0; i < this.iterations; i++) {
                for (const c of this.constraints) c.solve(stepCoef);
            }
        }
    }

    // Minimal WebGL renderer for curtains with wireframe grid
    class CurtainRenderer {
        constructor(canvas) {
            this.canvas = canvas;
            this.gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) ||
                       canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
            if (!this.gl) throw new Error('WebGL not supported');

            this.gl.enable(this.gl.DEPTH_TEST);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

            this.fillProgram = this.initFillProgram();
            this.fillAttribs = {
                position: this.gl.getAttribLocation(this.fillProgram, 'a_position'),
                color: this.gl.getAttribLocation(this.fillProgram, 'a_color')
            };

            this.wireProgram = this.initWireProgram();
            this.wireAttribs = {
                position: this.gl.getAttribLocation(this.wireProgram, 'a_position'),
                opacity: this.gl.getAttribLocation(this.wireProgram, 'a_opacity')
            };
            this.wireUniforms = {
                color: this.gl.getUniformLocation(this.wireProgram, 'u_color')
            };

            this.curtains = new Map();
        }

        initFillProgram() {
            const vsSource = `
                attribute vec2 a_position;
                attribute vec3 a_color;
                varying vec3 v_color;

                void main() {
                    vec2 normalizedPos = vec2(
                        (a_position.x / ${this.canvas.width}.0) * 2.0 - 1.0,
                        1.0 - (a_position.y / ${this.canvas.height}.0) * 2.0
                    );
                    v_color = a_color;
                    gl_Position = vec4(normalizedPos, 0.0, 1.0);
                }
            `;

            const fsSource = `
                precision mediump float;
                varying vec3 v_color;
                void main() {
                    gl_FragColor = vec4(v_color, 1.0);
                }
            `;

            return this.linkProgram(vsSource, fsSource);
        }

        initWireProgram() {
            const vsSource = `
                attribute vec2 a_position;
                attribute float a_opacity;
                varying float v_opacity;

                void main() {
                    vec2 normalizedPos = vec2(
                        (a_position.x / ${this.canvas.width}.0) * 2.0 - 1.0,
                        1.0 - (a_position.y / ${this.canvas.height}.0) * 2.0
                    );
                    v_opacity = a_opacity;
                    gl_Position = vec4(normalizedPos, -0.001, 1.0);
                }
            `;

            const fsSource = `
                precision mediump float;
                uniform vec3 u_color;
                varying float v_opacity;
                void main() {
                    gl_FragColor = vec4(u_color, v_opacity);
                }
            `;

            return this.linkProgram(vsSource, fsSource);
        }

        linkProgram(vsSource, fsSource) {
            const vertexShader = this.compileShader(vsSource, this.gl.VERTEX_SHADER);
            const fragmentShader = this.compileShader(fsSource, this.gl.FRAGMENT_SHADER);
            const program = this.gl.createProgram();
            this.gl.attachShader(program, vertexShader);
            this.gl.attachShader(program, fragmentShader);
            this.gl.linkProgram(program);
            if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
                throw new Error('Could not initialize shaders');
            }
            return program;
        }

        compileShader(source, type) {
            const shader = this.gl.createShader(type);
            this.gl.shaderSource(shader, source);
            this.gl.compileShader(shader);
            if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                throw new Error('Shader compile failed: ' + this.gl.getShaderInfoLog(shader));
            }
            return shader;
        }

        createBuffersFromGrid(grid) {
            const rows = grid.length;
            const cols = grid[0].length;
            const vertices = [];
            const colors = [];
            const opacities = [];
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const v = grid[y][x];
                    vertices.push(v.x, v.y);
                    const color = v.color || [0.4, 0.08, 0.12];
                    colors.push(color[0], color[1], color[2]);
                    opacities.push(v.opacity !== undefined ? v.opacity : 0.03);
                }
            }
            const indices = [];
            for (let y = 0; y < rows - 1; y++) {
                for (let x = 0; x < cols - 1; x++) {
                    const tl = y * cols + x;
                    const tr = tl + 1;
                    const bl = (y + 1) * cols + x;
                    const br = bl + 1;
                    indices.push(tl, bl, tr, tr, bl, br);
                }
            }

            const wireIndices = [];
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const idx = y * cols + x;
                    // Skip border edges so only the interior grid is drawn
                    if (x < cols - 1 && y > 0 && y < rows - 1) {
                        wireIndices.push(idx, idx + 1);
                    }
                    if (y < rows - 1 && x > 0 && x < cols - 1) {
                        wireIndices.push(idx, idx + cols);
                    }
                }
            }

            return {
                vertices: new Float32Array(vertices),
                colors: new Float32Array(colors),
                opacities: new Float32Array(opacities),
                indices: new Uint16Array(indices),
                wireIndices: new Uint16Array(wireIndices)
            };
        }

        createCurtain(id, grid) {
            const data = this.createBuffersFromGrid(grid);
            const gl = this.gl;
            const vertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);

            const colorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, data.colors, gl.DYNAMIC_DRAW);

            const opacityBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, opacityBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, data.opacities, gl.DYNAMIC_DRAW);

            const indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);

            const wireBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.wireIndices, gl.STATIC_DRAW);

            this.curtains.set(id, {
                vertexBuffer,
                colorBuffer,
                opacityBuffer,
                indexBuffer,
                wireBuffer,
                indexCount: data.indices.length,
                wireCount: data.wireIndices.length
            });
            return this;
        }

        updateCurtain(id, grid) {
            const curtain = this.curtains.get(id);
            if (!curtain) return this;
            const data = this.createBuffersFromGrid(grid);
            const gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, curtain.vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, curtain.colorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, data.colors, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, curtain.opacityBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, data.opacities, gl.DYNAMIC_DRAW);
            return this;
        }

        render() {
            const gl = this.gl;
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            const drawCurtain = curtain => {
                // Filled curtain (draw opaque, no blending)
                gl.disable(gl.BLEND);
                gl.useProgram(this.fillProgram);
                gl.bindBuffer(gl.ARRAY_BUFFER, curtain.vertexBuffer);
                gl.enableVertexAttribArray(this.fillAttribs.position);
                gl.vertexAttribPointer(this.fillAttribs.position, 2, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ARRAY_BUFFER, curtain.colorBuffer);
                gl.enableVertexAttribArray(this.fillAttribs.color);
                gl.vertexAttribPointer(this.fillAttribs.color, 3, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, curtain.indexBuffer);
                gl.drawElements(gl.TRIANGLES, curtain.indexCount, gl.UNSIGNED_SHORT, 0);

                // Wireframe grid
                gl.enable(gl.BLEND);
                gl.useProgram(this.wireProgram);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, curtain.wireBuffer);

                gl.bindBuffer(gl.ARRAY_BUFFER, curtain.vertexBuffer);
                gl.enableVertexAttribArray(this.wireAttribs.position);
                gl.vertexAttribPointer(this.wireAttribs.position, 2, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ARRAY_BUFFER, curtain.opacityBuffer);
                gl.enableVertexAttribArray(this.wireAttribs.opacity);
                gl.vertexAttribPointer(this.wireAttribs.opacity, 1, gl.FLOAT, false, 0, 0);

                // Use lighter wireframe color via uniform for better visibility
                gl.uniform3f(this.wireUniforms.color, 0.8, 0.8, 0.8);
                gl.drawElements(gl.LINES, curtain.wireCount, gl.UNSIGNED_SHORT, 0);
            };

            // Draw right then left so the left curtain overlays any seam artifacts
            const drawOrder = ['right', 'left'];
            for (const id of drawOrder) {
                const curtain = this.curtains.get(id);
                if (!curtain) continue;
                drawCurtain(curtain);
                if (id === 'right') gl.clear(gl.DEPTH_BUFFER_BIT);
            }

            return this;
        }
    }


    // Main function to play curtain intro
    function playCurtainIntro(baseCanvas, options = {}) {
        return new Promise(resolve => {
            const curtainWidth = options.curtainWidth || 25;
            const curtainHeight = options.curtainHeight || 35;
            const overlapRatio = options.overlapRatio || 0.1; // 10% center overlap
            const speed = options.openingSpeed || 360; // px/s

            // Create overlay WebGL canvas
            const glCanvas = document.createElement('canvas');
            glCanvas.width = baseCanvas.width;
            glCanvas.height = baseCanvas.height;
            glCanvas.style.position = 'absolute';
            glCanvas.style.left = baseCanvas.offsetLeft + 'px';
            glCanvas.style.top = baseCanvas.offsetTop + 'px';
            glCanvas.style.pointerEvents = 'none'; // allow interactions with underlying canvas
            glCanvas.style.border = 'none';
            glCanvas.style.outline = 'none';
            baseCanvas.parentNode.appendChild(glCanvas);

            const renderer = new CurtainRenderer(glCanvas);

            const overlap = baseCanvas.width * overlapRatio;
            const halfWidth = baseCanvas.width / 2;
            // Can set this to 0.08 to get rid of small gaps at side
            const edgeOverscan = options.edgeOverscan != null ? options.edgeOverscan : Math.round(baseCanvas.width * 0.0);
            const curtainCoverageWidth = halfWidth + overlap + edgeOverscan;
            const segX = curtainCoverageWidth / (curtainWidth - 1);
            const segY = baseCanvas.height / (curtainHeight - 1);
            const pinSpacing = segX * 6;

            const leftWorld = new VerletWorld();
            const rightWorld = new VerletWorld();

            // Gravity scaled for a natural curtain sag/weight feel
            const gravity = new Vec2(0, 9.81 * (baseCanvas.height / 10));
            leftWorld.gravity = gravity;
            rightWorld.gravity = gravity;

            function createCurtain(world, startX) {
                for (let y = 0; y < curtainHeight; y++) {
                    for (let x = 0; x < curtainWidth; x++) {
                        const pinned = y === 0 && x % 6 === 0;
                        const node = new VerletObject(startX + x * segX, y * segY, pinned);
                        if (pinned) node.pinIndex = Math.floor(x / 6);
                        world.objects.push(node);
                        if (x > 0) {
                            const left = world.objects[world.objects.length - 2];
                            world.addDistanceConstraint(node, left, segX, 0.075);
                        }
                        if (y > 0) {
                            const above = world.objects[(y - 1) * curtainWidth + x];
                            world.addDistanceConstraint(node, above, segY, 0.075);
                        }
                    }
                }
            }

            // Start curtains with slight overscan so edges remain covered after sagging
            createCurtain(leftWorld, -edgeOverscan);
            createCurtain(rightWorld, halfWidth - overlap);

            // Build vertex grid with simple curtain lighting and folds
            function buildVertexGrid(world) {
                const grid = [];
                for (let y = 0; y < curtainHeight; y++) {
                    grid[y] = [];
                    for (let x = 0; x < curtainWidth; x++) {
                        const node = world.objects[y * curtainWidth + x];

                        // deformation based on neighbours
                        let deformation = 0;
                        let count = 0;
                        if (x > 0) {
                            const left = world.objects[y * curtainWidth + x - 1];
                            const dist = node.position.sub(left.position).length();
                            deformation += Math.abs(dist - segX) / segX; count++;
                        }
                        if (y > 0) {
                            const above = world.objects[(y - 1) * curtainWidth + x];
                            const dist = node.position.sub(above.position).length();
                            deformation += Math.abs(dist - segY) / segY; count++;
                        }
                        deformation = count > 0 ? deformation / count : 0;
                        deformation = Math.min(deformation, 1.0);

                        const baseRed = 0.55;
                        const baseGreen = 0.07;
                        const baseBlue = 0.12;
                        let intensity = 0.95;
                        const foldPhase = (x / 6) * Math.PI * 2;
                        const foldWave = Math.cos(foldPhase);
                        intensity += foldWave * -0.08;
                        const wrinkle = Math.sin(foldPhase * 4.0 + y * 0.3) * 0.5 + 0.5;
                        intensity += (wrinkle - 0.5) * 0.08;
                        const vPos = y / (curtainHeight - 1);
                        intensity += (1.0 - vPos) * 0.08;
                        intensity *= (1.0 - 0.3 * deformation);
                        intensity = Math.min(1.0, Math.max(0.0, intensity));

                        const red = baseRed * intensity;
                        const green = baseGreen * intensity;
                        const blue = baseBlue * intensity;

                        grid[y][x] = {
                            x: node.position.x,
                            y: node.position.y,
                            opacity: 0.03,
                            color: [red, green, blue]
                        };
                    }
                }
                return grid;
            }

            renderer.createCurtain('left', buildVertexGrid(leftWorld));
            renderer.createCurtain('right', buildVertexGrid(rightWorld));

            let startTime = null;
            function frame(time) {
                if (!startTime) startTime = time;
                const dt = 1 / 240; // physics step
                const elapsed = (time - startTime) / 1000;

                const timeToReachNextPin = pinSpacing / speed;

                // Move pinned nodes with cascading start times
                for (const node of leftWorld.objects) {
                    if (node.pinned) {
                        const maxPinIndex = Math.floor((curtainWidth - 1) / 6);
                        const pinOrder = maxPinIndex - node.pinIndex;
                        const start = pinOrder * timeToReachNextPin;
                        if (elapsed >= start) {
                            const move = (elapsed - start) * speed;
                            const newX = node.originalX - move;
                            node.position.x = newX;
                            node.prevPosition.x = newX;
                        }
                    }
                }
                for (const node of rightWorld.objects) {
                    if (node.pinned) {
                        const pinOrder = node.pinIndex;
                        const start = pinOrder * timeToReachNextPin;
                        if (elapsed >= start) {
                            const move = (elapsed - start) * speed;
                            const newX = node.originalX + move;
                            node.position.x = newX;
                            node.prevPosition.x = newX;
                        }
                    }
                }

                leftWorld.step(dt);
                rightWorld.step(dt);

                renderer.updateCurtain('left', buildVertexGrid(leftWorld));
                renderer.updateCurtain('right', buildVertexGrid(rightWorld));
                renderer.render();

                const leftOff = leftWorld.objects.every(o => o.position.x < -edgeOverscan - segX);
                const rightOff = rightWorld.objects.every(o => o.position.x > baseCanvas.width + edgeOverscan + segX);
                if (leftOff && rightOff) {
                    glCanvas.remove();
                    resolve();
                    return;
                }
                requestAnimationFrame(frame);
            }

            requestAnimationFrame(frame);
        });
    }

    // Export for browser or Node environments
    global.playCurtainIntro = playCurtainIntro;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = playCurtainIntro;
    }
})(typeof window !== 'undefined' ? window : globalThis);
