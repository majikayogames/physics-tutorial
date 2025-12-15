(function() {
    'use strict';

    function addSlime(world, x, y, radius = 1.0, sides = 7, stiffness = 0.03) {
        const particleRadius = 0.05;
        const friction = 1.0;
        const center = world.addVerletCircle(x, y, particleRadius);
        center.friction = friction;
        center._renderHidden = true;
        world.addAngleConstraint(center);

        const nodes = [];
        const constraints = [];
        for (let i = 0; i < sides; i++) {
            const angle = i / sides * Math.PI * 2;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            const node = world.addVerletCircle(px, py, particleRadius);
            node.friction = friction;
            node._renderHidden = true;
            world.addAngleConstraint(node);
            nodes.push(node);
            const c = world.addDistanceConstraint(center, node, null, stiffness);
            constraints.push({ constraint: c, base: stiffness });
        }
        for (let i = 0; i < sides; i++) {
            let c = world.addDistanceConstraint(nodes[i], nodes[(i + 1) % sides], null, stiffness);
            constraints.push({ constraint: c, base: stiffness });
            c = world.addDistanceConstraint(nodes[i], nodes[(i + 2) % sides], null, stiffness * 0.5);
            constraints.push({ constraint: c, base: stiffness * 0.5 });
            c = world.addDistanceConstraint(nodes[i], nodes[(i + 3) % sides], null, stiffness * 0.3);
            constraints.push({ constraint: c, base: stiffness * 0.3 });
        }
        return { center, nodes, constraints };
    }

    function convexHull(points) {
        if (points.length < 3) return points;
        let bottom = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].y < points[bottom].y || (points[i].y === points[bottom].y && points[i].x < points[bottom].x)) {
                bottom = i;
            }
        }
        [points[0], points[bottom]] = [points[bottom], points[0]];
        const pivot = points[0];
        const sorted = points.slice(1).sort((a, b) => {
            const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
            const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
            if (angleA !== angleB) return angleA - angleB;
            const distA = (a.x - pivot.x) ** 2 + (a.y - pivot.y) ** 2;
            const distB = (b.x - pivot.x) ** 2 + (b.y - pivot.y) ** 2;
            return distA - distB;
        });
        const hull = [pivot];
        for (const p of sorted) {
            while (hull.length > 1) {
                const p1 = hull[hull.length - 2], p2 = hull[hull.length - 1];
                if (((p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x)) <= 0) {
                    hull.pop();
                } else {
                    break;
                }
            }
            hull.push(p);
        }
        return hull;
    }

    class MixedSlime {
        constructor(world, renderer, x, y, options = {}) {
            const { radius = 0.8, sides = 7, stiffness = 0.03, speed = 0.1, groundAccel = speed, airAccel = speed * 0.35, coyoteTimeMs = 120, maxHorizSpeed = 3 } = options;
            this.world = world;
            this.renderer = renderer;
            this.slime = addSlime(world, x, y, radius, sides, stiffness);
            this.instance = null;
            this.speed = speed; // legacy input; prefer groundAccel/airAccel below
            this.groundAccel = groundAccel; // units/s^2 applied to implied velocity
            this.airAccel = airAccel;       // reduced control in air
            this.left = false;
            this.right = false;
            this.sleepy = false;
            this.grabbing = false;
            this.grabConstraints = new Map();
            this.coyoteTimeMs = coyoteTimeMs;
            this.lastGroundedAt = -Infinity;
            this.maxHorizSpeed = maxHorizSpeed;
            this._bindKeys();
        }

        _bindKeys() {
            document.addEventListener('keydown', (e) => {
                if (e.repeat) return;
                if (e.key === 'a' || e.key === 'A') this.left = true;
                if (e.key === 'd' || e.key === 'D') this.right = true;
                if (e.key === ' ') this.toggleSleepy();
                if (e.key === 'g' || e.key === 'G') {
                    this.grabbing = true;
                    this._updateGrabs();
                }
            });
            document.addEventListener('keyup', (e) => {
                if (e.key === 'a' || e.key === 'A') this.left = false;
                if (e.key === 'd' || e.key === 'D') this.right = false;
                if (e.key === 'g' || e.key === 'G') {
                    this.grabbing = false;
                    this._clearGrabs();
                }
            });
        }

        setSleepy(flag) {
            this.sleepy = flag;
            for (const entry of this.slime.constraints) {
                entry.constraint.stiffness = entry.base * (flag ? 0.08 : 1);
            }
            if (this.instance) {
                this.renderer.setSlimeEyeStyle(this.instance, flag ? 'sleepy' : 'normal');
            }
        }

        toggleSleepy() {
            this.setSleepy(!this.sleepy);
        }

        preStep(dt) {
            const now = performance.now();

            // Determine grounded state and grace window at the start of the step
            const isGroundedNow = this._isGrounded();
            if (isGroundedNow) this.lastGroundedAt = now;
            const withinCoyoteWindow = (now - this.lastGroundedAt) <= this.coyoteTimeMs;

            // Horizontal movement only when grounded or within coyote-time grace period
            let inputDir = 0;
            if (this.left) inputDir -= 1;
            if (this.right) inputDir += 1;
            if (inputDir !== 0) {
                const center = this.slime.center;
                const currentVx = (center.position.x - center.prevPosition.x) / dt;

                // Base acceleration intent from input (slower in air)
                const baseAccel = (isGroundedNow || withinCoyoteWindow) ? this.groundAccel : this.airAccel;
                let desiredAccel = baseAccel * inputDir; // in units/s^2 added to implied velocity

                // If accelerating in current velocity direction, limit so we don't exceed maxHorizSpeed
                if (Math.sign(currentVx) === inputDir && Math.abs(currentVx) >= this.maxHorizSpeed) {
                    desiredAccel = 0;
                } else if (Math.sign(currentVx) === inputDir) {
                    const remaining = this.maxHorizSpeed - Math.abs(currentVx);
                    if (Math.abs(desiredAccel) > remaining) desiredAccel = inputDir * remaining;
                }

                if (desiredAccel !== 0) {
                    const delta = desiredAccel * dt;
                    for (const p of [this.slime.center, ...this.slime.nodes]) {
                        p.prevPosition.x -= delta;
                    }
                }

                // Enforce hard cap on implied horizontal speed for stability
                for (const p of [this.slime.center, ...this.slime.nodes]) {
                    const impliedVx = (p.position.x - p.prevPosition.x) / dt;
                    if (Math.abs(impliedVx) > this.maxHorizSpeed) {
                        const clamped = Math.sign(impliedVx) * this.maxHorizSpeed;
                        p.prevPosition.x = p.position.x - clamped * dt;
                    }
                }
            }

            if (this.renderer && this.renderer.selectedNode) {
                const n = this.renderer.selectedNode;
                n.position.x = this.renderer.mouseWorldPos.x;
                n.position.y = this.renderer.mouseWorldPos.y;
                n.prevPosition.x = n.position.x;
                n.prevPosition.y = n.position.y;
            }

            // No jump capability

            if (this.grabbing) this._updateGrabs();
        }

        render() {
            const allBodies = [this.slime.center, ...this.slime.nodes];
            this.renderer.updateClosestNode(allBodies);

            const points = allBodies.map(n => ({ x: n.position.x, y: n.position.y }));
            const hull = convexHull(points);
            if (!this.instance) {
                this.instance = this.renderer.createSlime(hull);
                this.renderer.setSlimeEyeStyle(this.instance, this.sleepy ? 'sleepy' : 'normal');
            } else {
                this.renderer.updateSlime(this.instance, hull);
            }

            const constraintLines = [];
            for (const entry of this.slime.constraints) {
                const c = entry.constraint;
                const current = c.objA.position.sub(c.objB.position).length();
                const stretch = (current - c.restLength) / c.restLength;
                constraintLines.push({ pointA: c.objA.position, pointB: c.objB.position, weight: stretch * c.stiffness * 3 });
            }
            // Do not draw grab constraints in the slime renderer; they are engine joints

            const target = this.renderer.selectedNode || this.renderer.closestNode;
            this.renderer.renderSelectionMarker(target ? target.position : null);
            this.renderer.renderConstraints(allBodies.map(b => b.position), constraintLines, this.renderer.mouseWorldPos);
        }

        _isGrounded() {
            const slimeBodies = new Set([this.slime.center, ...this.slime.nodes]);
            for (const c of this.world.constraints) {
                if (!(c instanceof ContactConstraint)) continue;
                if (slimeBodies.has(c.bodyA) || slimeBodies.has(c.bodyB)) {
                    return true;
                }
            }
            return false;
        }

        _updateGrabs() {
            // Only allow one grabbed object at a time
            if (this.grabConstraints.size >= 1) return;
            const slimeBodies = new Set([this.slime.center, ...this.slime.nodes]);
            for (const c of this.world.constraints) {
                if (!(c instanceof ContactConstraint)) continue;
                let slimeBody = null;
                let other = null;
                if (slimeBodies.has(c.bodyA) && !slimeBodies.has(c.bodyB)) {
                    slimeBody = c.bodyA; other = c.bodyB;
                } else if (slimeBodies.has(c.bodyB) && !slimeBodies.has(c.bodyA)) {
                    slimeBody = c.bodyB; other = c.bodyA;
                } else {
                    continue;
                }
                if (other.isStatic || this.grabConstraints.has(other)) continue;
                // Attach at the actual contact point so we don't pull toward centers,
                // and use a revolute joint so rotation is not artificially locked.
                const grab = this.world.addRevoluteConstraint(slimeBody, other, c.worldPoint, null, null, 0.25);
                this.grabConstraints.set(other, grab);
                break; // stop after grabbing one
            }
        }

        _clearGrabs() {
            for (const c of this.grabConstraints.values()) {
                let idx = this.world.distanceConstraints ? this.world.distanceConstraints.indexOf(c) : -1;
                if (idx >= 0) {
                    this.world.distanceConstraints.splice(idx, 1);
                    continue;
                }
                // Fallback for engine constraints (e.g., RevoluteConstraint)
                idx = this.world.constraints ? this.world.constraints.indexOf(c) : -1;
                if (idx >= 0) this.world.constraints.splice(idx, 1);
            }
            this.grabConstraints.clear();
        }
    }

    window.MixedSlime = MixedSlime;
})();
