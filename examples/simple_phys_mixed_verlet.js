// simple_phys_mixed_verlet.js - extends simple_phys.js with basic Verlet integration support
// This file assumes simple_phys.js has been loaded first.  It introduces a new PhysWorldMixed
// that allows some PhysObject instances to be integrated using Verlet while others continue
// to use the existing Euler integrator.  It also provides a simple distance constraint used
// for building soft bodies from multiple particles.

(function() {
    // --- Toggle Verlet mode on PhysObject --------------------------------------------------
    PhysObject.prototype.enableVerlet = function(dt = 1 / 240) {
        if (this.useVerlet) return;
        this.useVerlet = true;
        // store previous state so velocity/rotation are preserved
        this.prevPosition = this.position.sub(this.velocity.scale(dt));
        this.prevRotation = this.rotation - this.angularVelocity * dt;
    };

    PhysObject.prototype.disableVerlet = function(dt = 1 / 240) {
        if (!this.useVerlet) return;
        // derive velocities from position history before disabling
        this.velocity = this.position.sub(this.prevPosition).scale(1 / dt);
        this.angularVelocity = (this.rotation - this.prevRotation) / dt;
        this.useVerlet = false;
    };

    // --- Distance constraint for Verlet objects (position based) ---------------------------
    class DistanceConstraintVerlet {
        constructor(objA, objB, restLength = null, stiffness = 1) {
            this.objA = objA;
            this.objB = objB;
            this.restLength = restLength !== null ? restLength : objA.position.sub(objB.position).length();
            this.stiffness = stiffness; // 0..1, 1 = rigid
            // store the initial angular offset so we can keep bodies from rotating relative
            this.restAngle = objB.rotation - objA.rotation;
        }
        solve(invIterations = 1) {
            const delta = this.objB.position.sub(this.objA.position);
            const dist = delta.length();
            if (dist === 0) return;
            const diff = (dist - this.restLength) / dist * this.stiffness * invIterations;
            const correction = delta.scale(0.5 * diff);
            if (!this.objA.isStatic) {
                this.objA.position = this.objA.position.add(correction);
            }
            if (!this.objB.isStatic) {
                this.objB.position = this.objB.position.sub(correction);
            }

            // lock relative rotation so friction behaves as expected
            const angleDiff = (this.objB.rotation - this.objA.rotation) - this.restAngle;
            const angleCorrection = angleDiff * 0.5 * this.stiffness * invIterations;
            if (!this.objA.isStatic) {
                this.objA.rotation += angleCorrection;
            }
            if (!this.objB.isStatic) {
                this.objB.rotation -= angleCorrection;
            }

            this.lockAngularVelocities(invIterations);
        }

        lockAngularVelocities(invIterations = 1) {
            // Reduce relative spin so linked particles keep their mutual orientation
            const angVelDiff = this.objB.angularVelocity - this.objA.angularVelocity;
            const angVelCorrection = angVelDiff * 0.5 * this.stiffness * invIterations;
            if (!this.objA.isStatic) {
                this.objA.angularVelocity += angVelCorrection;
            }
            if (!this.objB.isStatic) {
                this.objB.angularVelocity -= angVelCorrection;
            }
        }
    }

    // --- Angle locking constraint for individual Verlet bodies -----------------------------
    class AngleConstraintVerlet {
        constructor(obj, targetAngle = 0, stiffness = 1) {
            this.obj = obj;
            this.targetAngle = targetAngle;
            this.stiffness = stiffness; // 0..1, 1 = rigid
        }
        solve(invIterations = 1) {
            const angleDiff = this.obj.rotation - this.targetAngle;
            const correction = angleDiff * this.stiffness * invIterations;
            if (!this.obj.isStatic) {
                this.obj.rotation -= correction;
            }
        }
        lockAngularVelocities(invIterations = 1) {
            if (!this.obj.isStatic) {
                this.obj.angularVelocity -= this.obj.angularVelocity * this.stiffness * invIterations;
            }
        }
    }

    // --- Mixed world that handles Euler and Verlet objects ---------------------------------
    class PhysWorldMixed extends PhysWorld {
        constructor() {
            super();
            this.distanceConstraints = [];
            this.angleConstraints = [];
            this.distanceConstraintIterations = 8;
            this.onDetectCollisions = null;
        }

        addVerletCircle(x, y, radius, density = 1, isStatic = false) {
            const c = this.addCircle(x, y, radius, density, isStatic);
            c.enableVerlet();
            return c;
        }

        addDistanceConstraint(objA, objB, restLength = null, stiffness = 1) {
            const c = new DistanceConstraintVerlet(objA, objB, restLength, stiffness);
            this.distanceConstraints.push(c);
            return c;
        }

        addAngleConstraint(obj, targetAngle = 0, stiffness = 1) {
            const c = new AngleConstraintVerlet(obj, targetAngle, stiffness);
            this.angleConstraints.push(c);
            return c;
        }

        resolvePenetrations() {
            const allowed = typeof SLOP_LINEAR !== 'undefined' ? SLOP_LINEAR : 0;
            for (const constraint of this.constraints) {
                if (!(constraint instanceof ContactConstraint)) continue;
                const penetration = constraint.penetration - allowed;
                if (penetration <= 0) continue;

                const a = constraint.bodyA;
                const b = constraint.bodyB;

                // Only separate contacts where at least one body uses Verlet.
                const aVerlet = a.useVerlet;
                const bVerlet = b.useVerlet;
                if (!aVerlet && !bVerlet) continue;

                const invMassA = aVerlet && !a.isStatic ? 1 / a.mass : 0;
                const invMassB = bVerlet && !b.isStatic ? 1 / b.mass : 0;
                const invTotal = invMassA + invMassB;
                if (invTotal === 0) continue;

                const correction = constraint.normal.scale(penetration / invTotal);
                if (aVerlet && !a.isStatic) {
                    a.position = a.position.sub(correction.scale(invMassA));
                }
                if (bVerlet && !b.isStatic) {
                    b.position = b.position.add(correction.scale(invMassB));
                }
            }
        }

        step(timeElapsedSinceLastCalled = 0, dt = 1 / 240, maxSteps = 10) {
            this._accumulator += timeElapsedSinceLastCalled;
            const maxAccumulatedTime = maxSteps * dt;
            if (this._accumulator > maxAccumulatedTime) this._accumulator = maxAccumulatedTime;

            while (this._accumulator >= dt) {
                // Apply gravity and compute velocities from previous positions for Verlet bodies
                for (const obj of this.objects) {
                    if (obj.isStatic) continue;
                    if (obj.useVerlet) {
                        if (!obj.prevPosition) obj.prevPosition = obj.position;
                        if (!obj.prevRotation) obj.prevRotation = obj.rotation;
                        obj.velocity = obj.position.sub(obj.prevPosition).scale(1 / dt);
                        obj.angularVelocity = (obj.rotation - obj.prevRotation) / dt;
                    }
                    obj.velocity = obj.velocity.add(this.gravity.scale(dt));
                }

                // Integrate only Verlet bodies at this stage; Euler bodies remain at their
                // previous poses so existing Euler-only scenes behave the same as with
                // the standard PhysWorld.
                for (const obj of this.objects) {
                    if (obj.isStatic) continue;
                    if (obj.useVerlet) {
                        const nextPos = obj.position.add(obj.velocity.scale(dt));
                        obj.prevPosition = obj.position;
                        obj.position = nextPos;
                        obj.prevRotation = obj.rotation;
                        obj.rotation += obj.angularVelocity * dt;
                    }
                }

                // Solve distance and angle constraints in a position based manner
                const invIter = 1 / this.distanceConstraintIterations;
                for (let i = 0; i < this.distanceConstraintIterations; i++) {
                    for (const c of this.distanceConstraints) c.solve(invIter);
                    for (const a of this.angleConstraints) a.solve(invIter);
                }

                // Update velocities from corrected positions for Verlet objects only.
                // Euler bodies keep their pre-correction velocities so their instability
                // compared to Verlet integration becomes apparent when constraints move them.
                for (const obj of this.objects) {
                    if (obj.isStatic || !obj.useVerlet) continue;
                    obj.velocity = obj.position.sub(obj.prevPosition).scale(1 / dt);
                    obj.angularVelocity = (obj.rotation - obj.prevRotation) / dt;
                }

                // Now handle collisions and constraints so friction uses the corrected velocities
                this.detectCollisions();
                if (this.onDetectCollisions) this.onDetectCollisions();
                this.solveConstraints(dt, this.constraintIterations);

                // Deep impacts could still leave objects interpenetrating. Push them apart
                // using a simple position correction based on contact penetration depth.
                this.resolvePenetrations();

                // Integrate Euler bodies now that collisions and constraints have updated velocities
                for (const obj of this.objects) {
                    if (obj.isStatic || obj.useVerlet) continue;
                    obj.step(dt);
                }

                // Collision impulses can introduce relative spin; damp it out
                for (let i = 0; i < this.distanceConstraintIterations; i++) {
                    for (const c of this.distanceConstraints) c.lockAngularVelocities(invIter);
                    for (const a of this.angleConstraints) a.lockAngularVelocities(invIter);
                }

                // Store previous state for Verlet bodies for the next step
                for (const obj of this.objects) {
                    if (obj.isStatic || !obj.useVerlet) continue;
                    obj.prevPosition = obj.position.sub(obj.velocity.scale(dt));
                    obj.prevRotation = obj.rotation - obj.angularVelocity * dt;
                }

                this._accumulator -= dt;
            }
        }

        detectCollisions() {
            super.detectCollisions();
            if (this.onDetectCollisions) this.onDetectCollisions();
        }
        
        }

        // Expose to global scope
        window.PhysWorldMixed = PhysWorldMixed;
})();

