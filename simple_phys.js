/* simple_phys.js - Simple 2D Physics Engine. CC0 License */

const SLOP_LINEAR = 0.002; // Small slop like Box2D has, prevents jitter and improves contact persistence

function mat2x2Solve(K, b) {
	// K * v = b, solve for v using Cramer's rule
	const det = K[0][0] * K[1][1] - K[0][1] * K[1][0];
	const invDet = det !== 0 ? 1.0 / det : 0;
	return new Vec2(invDet * (K[1][1] * b.x - K[0][1] * b.y), invDet * (K[0][0] * b.y - K[1][0] * b.x));
}

function getSoftConstraintParams(hertz, dampingRatio, timeStep) {
	// Equivalent to Box2D's b2MakeSoft, tuneable mass-spring-damper bias for constraints
	if (hertz === 0) {
		return { biasRate: 0, massScale: 0, impulseScale: 0 };
	}
	const omega = 2 * Math.PI * hertz;
	const a1 = 2 * dampingRatio + timeStep * omega;
	const a2 = timeStep * omega * a1;
	const a3 = 1 / (1 + a2);
	return {
		biasRate: omega / a1,
		massScale: a2 * a3,
		impulseScale: a3,
	};
}

class Vec2 {
	constructor(x, y) { this.x = x; this.y = y; }
	add(other) { return new Vec2(this.x + other.x, this.y + other.y); }
	sub(other) { return new Vec2(this.x - other.x, this.y - other.y); }
	scale(scalar) { return new Vec2(this.x * scalar, this.y * scalar); }
	dot(other) { return this.x * other.x + this.y * other.y; }
	cross(other) { return this.x * other.y - this.y * other.x; }
	crossSv(scalar) { return new Vec2(-this.y * scalar, this.x * scalar); } // s × v
	length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
	normalized() { return (Math.abs(this.x) < 1e-10 && Math.abs(this.y) < 1e-10) ? new Vec2(1, 0) : this.scale(1 / this.length()); }
	rotate(angle) { const cos = Math.cos(angle); const sin = Math.sin(angle); return new Vec2(this.x * cos - this.y * sin, this.x * sin + this.y * cos); }
	rotate90CW() { return new Vec2(this.y, -this.x); }
	min(other) { return new Vec2(Math.min(this.x, other.x), Math.min(this.y, other.y)); }
	max(other) { return new Vec2(Math.max(this.x, other.x), Math.max(this.y, other.y)); }
}

class AABB {
	constructor(min, max) { this.min = min; this.max = max; }
	overlaps(other) { return this.min.x <= other.max.x && this.max.x >= other.min.x && this.min.y <= other.max.y && this.max.y >= other.min.y; }
	expand(points) { for (const point of points) { this.min = this.min.min(point); this.max = this.max.max(point); } }
}

class CircleShape {
	constructor(radius, offset = new Vec2(0, 0)) { this.radius = radius; this.offset = offset; }
	containsLocalPoint(point) { return point.sub(this.offset).length() <= this.radius; }
}

class ConvexPolygonShape {
	constructor(ccwVertices) { this.vertices = ccwVertices; }
	containsLocalPoint(point) { return ConvexPolygonShape.isPointInsideConvexPolygon(point, this.vertices); }
	static getNormals(verts) { return verts.map((v, i) => verts[(i + 1) % verts.length].sub(v).rotate90CW().normalized()); }
	static isPointInsideConvexPolygon(point, verts, tolerance = 0) { // Uses dot product, projects along normal of edges to check if point is inside all
		return ConvexPolygonShape.getNormals(verts).every((n, i) => n.dot(point.sub(verts[i])) < tolerance);
	}
}

class PhysObject {
	static _nextId = 1;
	
	constructor(x, y, shapes, isStatic = false, mass = 1, momentOfInertia = 1) {
		this.id = PhysObject._nextId++;
		this.position = new Vec2(x, y);
		this.velocity = new Vec2(0, 0);
		this.rotation = 0;
		this.angularVelocity = 0;

		this.shapes = Array.isArray(shapes) ? shapes : [shapes];
		// Assign shape IDs for contact persistence
		for (let i = 0; i < this.shapes.length; i++) {
			this.shapes[i].id = i;
		}
		this.isStatic = isStatic;
		this.mass = isStatic ? Infinity : mass;
		this.momentOfInertia = isStatic ? Infinity : momentOfInertia;

		this.collisionMask = 0xFFFFFF;
		this.collisionMaskIgnore = 0x000000;
		this.friction = 0.6;
		this.restitution = 0.05;
	}

	step(dt) {
		if (this.isStatic) return;
		this.rotation += this.angularVelocity * dt;
		this.position = this.position.add(this.velocity.scale(dt));
	}

	localToWorld(localPoint) {
		return this.position.add(localPoint.rotate(this.rotation));
	}

	worldToLocal(worldPoint) {
		return worldPoint.sub(this.position).rotate(-this.rotation);
	}

	getAABB() {
		let aabb = new AABB(new Vec2(Infinity, Infinity), new Vec2(-Infinity, -Infinity));
		for (let shape of this.shapes) {
			if (shape instanceof CircleShape) {
				const worldCenter = this.localToWorld(shape.offset);
				aabb.expand([worldCenter.sub(new Vec2(shape.radius, shape.radius)), worldCenter.add(new Vec2(shape.radius, shape.radius))]);
			} else {
				shape.vertices.map(v => this.localToWorld(v)).forEach(v => aabb.expand([v]));
			}
		}
		return aabb;
	}

	containsPoint(worldPoint) {
		const localPoint = this.worldToLocal(worldPoint);
		return this.shapes.some(shape => shape.containsLocalPoint(localPoint));
	}

	applyImpulse(impulse, worldPoint) {
		const r = worldPoint.sub(this.position);
		const angularImpulse = r.cross(impulse);

		this.velocity = this.velocity.add(impulse.scale(1 / this.mass));
		this.angularVelocity += angularImpulse / this.momentOfInertia;
	}
}

class Constraint {
	constructor(bodyA, bodyB) { this.bodyA = bodyA; this.bodyB = bodyB; this.constraintSettings = null; }
	update(constraintSettings) { }
	solve(dt, constraintSettings) { }
}

class RevoluteConstraint extends Constraint {
	constructor(bodyA, bodyB, worldPoint, lowerAngleLimit = null, upperAngleLimit = null, stiffness = 1.0) {
		super(bodyA, bodyB);

		// Basic joint properties
		this.localA = bodyA.worldToLocal(worldPoint);
		this.localB = bodyB.worldToLocal(worldPoint);

		// Angle-limit properties
		this.lowerAngleLimit = lowerAngleLimit;
		this.upperAngleLimit = upperAngleLimit;
		this.stiffness = stiffness;
		this.currentAngle = 0;
		this.angleViolation = 0;

		// Motor properties
		this.motorEnabled = false;
		this.motorSpeed = 0; // constant-speed mode
		this.maxMotorForce = 5;
		this.motorTargetAngle = null; // servo mode
		this.motorFreq = 6.0; // [Hz] natural frequency for servo mode
		this.motorDampingRatio = 1.0; // for servo mode. 1 = critically damped

		this.accumulatedPointImpulse = new Vec2(0, 0);

		// Shared scratch vars
		this.worldA = new Vec2(0, 0);
		this.worldB = new Vec2(0, 0);
		this.rA = new Vec2(0, 0);
		this.rB = new Vec2(0, 0);
		this.K = [[0, 0], [0, 0]];

		// Pre-compute inverse masses / inertias
		this.invMassA = bodyA.isStatic ? 0 : 1 / bodyA.mass;
		this.invMassB = bodyB.isStatic ? 0 : 1 / bodyB.mass;
		this.invIA = bodyA.isStatic ? 0 : 1 / bodyA.momentOfInertia;
		this.invIB = bodyB.isStatic ? 0 : 1 / bodyB.momentOfInertia;
	}

	update(constraintSettings) {
		// joint anchor positions
		this.worldA = this.bodyA.localToWorld(this.localA);
		this.worldB = this.bodyB.localToWorld(this.localB);
		this.rA = this.worldA.sub(this.bodyA.position);
		this.rB = this.worldB.sub(this.bodyB.position);

		// relative angle
		this.currentAngle = this.bodyB.rotation - this.bodyA.rotation;

		this.invMassA = this.bodyA.isStatic ? 0 : 1 / this.bodyA.mass;
		this.invMassB = this.bodyB.isStatic ? 0 : 1 / this.bodyB.mass;
		this.invIA = this.bodyA.isStatic ? 0 : 1 / this.bodyA.momentOfInertia;
		this.invIB = this.bodyB.isStatic ? 0 : 1 / this.bodyB.momentOfInertia;

		// Warm starting: apply the accumulated point impulse from the previous frame
		const cs = this.constraintSettings || constraintSettings;
		if (cs?.warmStarting !== false) {
			this.bodyA.applyImpulse(this.accumulatedPointImpulse.scale(-1), this.worldA);
			this.bodyB.applyImpulse(this.accumulatedPointImpulse, this.worldB);
		}

		// angle-limit violation
		if (this.lowerAngleLimit !== null && this.currentAngle < this.lowerAngleLimit) {
			this.angleViolation = this.currentAngle - this.lowerAngleLimit;
		} else if (this.upperAngleLimit !== null && this.currentAngle > this.upperAngleLimit) {
			this.angleViolation = this.currentAngle - this.upperAngleLimit;
		} else {
			this.angleViolation = 0;
		}
	}

	solve(dt, constraintSettings) {
		const cs = this.constraintSettings || constraintSettings;
		this.solvePointConstraint(dt, cs);
		this.solveMotor(dt);
		this.solveAngleLimits(dt, cs);
	}

	solvePointConstraint(dt, constraintSettings) {
		const [mA, mB, iA, iB, rA, rB] = [this.invMassA, this.invMassB, this.invIA, this.invIB, this.rA, this.rB];

		// Matrix to predict how an impulse will affect Cdot. Derived from the equations in PhysObject.applyImpulse
		this.K[0][0] = mA + mB + rA.y * rA.y * iA + rB.y * rB.y * iB;
		this.K[0][1] = -rA.y * rA.x * iA - rB.y * rB.x * iB;
		this.K[1][0] = this.K[0][1];
		this.K[1][1] = mA + mB + rA.x * rA.x * iA + rB.x * rB.x * iB;

		const velA = this.bodyA.velocity.add(rA.crossSv(this.bodyA.angularVelocity));
		const velB = this.bodyB.velocity.add(rB.crossSv(this.bodyB.angularVelocity));
		const Cdot = velB.sub(velA); // velocity error
		const C = this.worldB.sub(this.worldA); // positional error

		let bias = new Vec2(0, 0);
		let massScale = 1.0;
		let impulseScale = 0.0;
		if (constraintSettings.mode === 'baumgarte') {
			bias = C.scale(constraintSettings.baumgarteFactor / dt);
		} else if (constraintSettings.mode === 'soft') {
			const maxHertz = 0.25 / dt;
			const hz = Math.min(constraintSettings.jointSoft.hertz, maxHertz);
			const soft = getSoftConstraintParams(hz, constraintSettings.jointSoft.dampingRatio, dt);
			bias = C.scale(soft.biasRate);
			massScale = soft.massScale;
			impulseScale = soft.impulseScale;
		}

		let impulse = mat2x2Solve(this.K, (Cdot.add(bias)).scale(-1));

		if (constraintSettings.mode === 'soft') {
			impulse.x = massScale * impulse.x - impulseScale * this.accumulatedPointImpulse.x;
			impulse.y = massScale * impulse.y - impulseScale * this.accumulatedPointImpulse.y;
		}

		// Apply impulse (either full lambda or delta impulse)
		this.bodyA.applyImpulse(impulse.scale(-1), this.worldA);
		this.bodyB.applyImpulse(impulse, this.worldB);

		if (constraintSettings?.warmStarting !== false) {
			this.accumulatedPointImpulse = this.accumulatedPointImpulse.add(impulse);
		}
	}

	solveAngleLimits(dt, constraintSettings) {
		if ((this.lowerAngleLimit === null && this.upperAngleLimit === null) || this.angleViolation === 0) return;

		const invI = this.invIA + this.invIB;
		if (invI < 1e-6) return;

		const C = this.angleViolation;
		const Cdot = this.bodyB.angularVelocity - this.bodyA.angularVelocity;

		let bias = 0;
		let massScale = 1.0;
		let impulseScale = 0.0;
		if (constraintSettings.mode === 'baumgarte') {
			bias = (constraintSettings.baumgarteFactor / dt) * C;
		} else if (constraintSettings.mode === 'soft') {
			const maxHertz = 0.25 / dt;
			const hz = Math.min(constraintSettings.jointSoft.hertz, maxHertz);
			const soft = getSoftConstraintParams(hz, constraintSettings.jointSoft.dampingRatio, dt);
			bias = soft.biasRate * C;
			massScale = soft.massScale;
			impulseScale = soft.impulseScale;
		}

		let lambda = -(massScale * (Cdot + bias) + impulseScale * 0) / invI; // Just -(Cdot + bias) / invI; for baumgarte

		// clamp to correct direction only
		if (C > 0) lambda = Math.min(lambda, 0); // above upper limit
		else lambda = Math.max(lambda, 0); // below lower limit

		this.bodyA.angularVelocity -= this.invIA * lambda;
		this.bodyB.angularVelocity += this.invIB * lambda;
	}

	solveMotor(dt) {
		if (!this.motorEnabled) return;

		const invI = this.invIA + this.invIB;
		if (invI === 0) return;

		let impulse = 0;
		const relVel = this.bodyB.angularVelocity - this.bodyA.angularVelocity;

		// motorTargetAngle mode, intended to behave more like a springy limb/muscle
		if (this.motorTargetAngle !== null) {
			const Ieff = 1 / invI;
			const omega = 2 * Math.PI * this.motorFreq;
			const k = Ieff * omega * omega;
			const c = 2 * Ieff * this.motorDampingRatio * omega;
			const gamma = 1 / (dt * (c + k * dt));
			const motorBias = (this.currentAngle - this.motorTargetAngle) * k * dt * gamma;

			impulse = -(relVel + motorBias) / (invI + gamma);
		} else { // constant speed mode
			impulse = (this.motorSpeed - relVel) / invI;
		}

		const maxImp = this.maxMotorForce * dt;
		if (impulse > maxImp) impulse = maxImp;
		if (impulse < -maxImp) impulse = -maxImp;

		this.bodyA.angularVelocity -= this.invIA * impulse;
		this.bodyB.angularVelocity += this.invIB * impulse;
	}

	setMotorTargetAngle(targetAngle = null, maxForce = null, freq = null, dampingRatio = null, targetToWrappedClosest = true) {
		if (targetToWrappedClosest) {
			const angleDiffRad = (a, b) => ((a - b + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
			let delta = Math.atan2(Math.sin(targetAngle - this.currentAngle), Math.cos(targetAngle - this.currentAngle)); // short diff
			targetAngle = this.currentAngle + delta;

			if (this.lowerAngleLimit !== null && this.upperAngleLimit !== null && (targetAngle < this.lowerAngleLimit || targetAngle > this.upperAngleLimit)) {
				if (Math.abs(angleDiffRad(this.lowerAngleLimit, targetAngle)) < Math.abs(angleDiffRad(this.upperAngleLimit, targetAngle))) {
					targetAngle = this.lowerAngleLimit;
				} else {
					targetAngle = this.upperAngleLimit;
				}
			}
			targetAngle = Math.min(Math.max(targetAngle, this.lowerAngleLimit ?? -Infinity), this.upperAngleLimit ?? Infinity);
		}

		this.motorEnabled = true;
		this.motorTargetAngle = targetAngle;
		if (maxForce !== null) this.maxMotorForce = maxForce;
		if (freq !== null) this.motorFreq = freq;
		if (dampingRatio !== null) this.motorDampingRatio = dampingRatio;
	}

	getRotation() {
		return this.bodyB.rotation - this.bodyA.rotation;
	}
}

class ContactConstraint extends Constraint {
	constructor(objA, objB, worldPoint, normal, penetration, featureId = null) {
		super(objA, objB);
		this.featureId = featureId; // For contact persistence
		this.isReused = false; // Flag to track if this contact was reused from previous frame
		this.friction = Math.sqrt(objA.friction * objB.friction); // Use geometric mean like box2d-lite
		this.restitution = Math.sqrt(objA.restitution * objB.restitution);
		this.accumulatedNormalLambda = 0;
		this.accumulatedFrictionLambda = 0;

		this.invMassA = objA.isStatic ? 0 : 1 / objA.mass;
		this.invMassB = objB.isStatic ? 0 : 1 / objB.mass;
		this.invIA = objA.isStatic ? 0 : 1 / objA.momentOfInertia;
		this.invIB = objB.isStatic ? 0 : 1 / objB.momentOfInertia;

		// Initialize all geometric/contact-derived properties
		this.setCollisionData(worldPoint, normal, penetration, featureId);

		// Store initial relative velocity for restitution (before any solving)
		const velA = this.bodyA.velocity.add(this.rA.crossSv(this.bodyA.angularVelocity));
		const velB = this.bodyB.velocity.add(this.rB.crossSv(this.bodyB.angularVelocity));
		const relVel = velB.sub(velA);
		this.relativeVelocity = this.normal.dot(relVel);
	}

	setCollisionData(worldPoint, normal, penetration) {
		this.worldPoint = worldPoint;
		this.normal = normal;
		this.penetration = penetration;

		this.localA = this.bodyA.worldToLocal(worldPoint);
		this.localB = this.bodyB.worldToLocal(worldPoint);
		this.worldA = this.bodyA.localToWorld(this.localA);
		this.worldB = this.bodyB.localToWorld(this.localB);
		this.rA = this.worldA.sub(this.bodyA.position);
		this.rB = this.worldB.sub(this.bodyB.position);
		this.tangent = this.normal.rotate90CW();
	}

	update() {
		this.worldA = this.bodyA.localToWorld(this.localA);
		this.worldB = this.bodyB.localToWorld(this.localB);
		this.rA = this.worldA.sub(this.bodyA.position);
		this.rB = this.worldB.sub(this.bodyB.position);
		this.invMassA = this.bodyA.isStatic ? 0 : 1 / this.bodyA.mass;
		this.invMassB = this.bodyB.isStatic ? 0 : 1 / this.bodyB.mass;
		this.invIA = this.bodyA.isStatic ? 0 : 1 / this.bodyA.momentOfInertia;
		this.invIB = this.bodyB.isStatic ? 0 : 1 / this.bodyB.momentOfInertia;

		// Store relative velocity BEFORE warm starting for restitution
		const velA = this.bodyA.velocity.add(this.rA.crossSv(this.bodyA.angularVelocity));
		const velB = this.bodyB.velocity.add(this.rB.crossSv(this.bodyB.angularVelocity));
		const relVel = velB.sub(velA);
		this.relativeVelocity = this.normal.dot(relVel);

		// Warm starting: apply the accumulated point impulse from the previous frame
		const normalImpulse = this.normal.scale(this.accumulatedNormalLambda);
		const frictionImpulse = this.tangent.scale(this.accumulatedFrictionLambda);
		const totalImpulse = normalImpulse.add(frictionImpulse);
		this.bodyA.velocity = this.bodyA.velocity.sub(totalImpulse.scale(this.invMassA));
		this.bodyA.angularVelocity -= this.invIA * this.rA.cross(totalImpulse);
		this.bodyB.velocity = this.bodyB.velocity.add(totalImpulse.scale(this.invMassB));
		this.bodyB.angularVelocity += this.invIB * this.rB.cross(totalImpulse);
	}

	solve(dt, constraintSettings) {
		const cs = this.constraintSettings || constraintSettings;
		this.solveContact(dt, cs);
		this.solveFriction();
	}

	solveContact(dt, constraintSettings) {
		const velA = this.bodyA.velocity.add(this.rA.crossSv(this.bodyA.angularVelocity));
		const velB = this.bodyB.velocity.add(this.rB.crossSv(this.bodyB.angularVelocity));
		const relVel = velB.sub(velA);
		const Cdot = this.normal.dot(relVel);

		const rnA = this.rA.cross(this.normal);
		const rnB = this.rB.cross(this.normal);
		const effectiveMass = this.invMassA + this.invMassB + rnA * rnA * this.invIA + rnB * rnB * this.invIB;
		if (effectiveMass < 0.000001) return; // Prevent division by zero

		const allowedPenetration = SLOP_LINEAR;
		let velocityBias = 0;
		let massScale = 1.0;
		let impulseScale = 0.0;
		if (constraintSettings.mode === 'baumgarte') {
			velocityBias = (constraintSettings.baumgarteFactor / dt) * Math.min(0, -this.penetration + allowedPenetration);
		} else if (constraintSettings.mode === 'soft') {
			const maxHertz = 0.25 / dt;
			const hz = Math.min(constraintSettings.contactSoft.hertz, maxHertz);
			const soft = getSoftConstraintParams(hz, constraintSettings.contactSoft.dampingRatio, dt);
			const separation = Math.min(0, -this.penetration + allowedPenetration);
			velocityBias = Math.max(soft.biasRate * separation, -constraintSettings.contactSpeed);
			massScale = soft.massScale;
			impulseScale = soft.impulseScale;
		}

		// Compute normal impulse with bias included
		// No soft constraints simplifies to (-Cdot + velocityBias) / effectiveMass;
		let lambda = -(massScale * Cdot + velocityBias) / effectiveMass;
		lambda += -impulseScale * this.accumulatedNormalLambda / effectiveMass;
		
		// Clamp the accumulated impulse
		const oldAccum = this.accumulatedNormalLambda;
		this.accumulatedNormalLambda = Math.max(oldAccum + lambda, 0);
		lambda = this.accumulatedNormalLambda - oldAccum;

		if (lambda === 0) return;
		
		const impulse = this.normal.scale(lambda);
		this.bodyA.applyImpulse(impulse.scale(-1), this.worldA);
		this.bodyB.applyImpulse(impulse, this.worldB);
	}

	solveFriction() {
		if (this.friction <= 0) return;
		const velA = this.bodyA.velocity.add(this.rA.crossSv(this.bodyA.angularVelocity));
		const velB = this.bodyB.velocity.add(this.rB.crossSv(this.bodyB.angularVelocity));
		const relVel = velB.sub(velA);
		const Cdot = this.tangent.dot(relVel);

		const rtA = this.rA.cross(this.tangent);
		const rtB = this.rB.cross(this.tangent);
		const effectiveMassTangent = this.invMassA + this.invMassB + rtA * rtA * this.invIA + rtB * rtB * this.invIB;
		if (effectiveMassTangent < 0.000001) return;

		let lambda = -Cdot / effectiveMassTangent;
		
		// Compute the maximum friction impulse according to Coulomb's model
		const maxFriction = this.friction * this.accumulatedNormalLambda;
		
		// Clamp force between -maxFriction and maxFriction
		const oldAccum = this.accumulatedFrictionLambda;
		this.accumulatedFrictionLambda = Math.max(-maxFriction, Math.min(oldAccum + lambda, maxFriction));
		lambda = this.accumulatedFrictionLambda - oldAccum;

		const frictionImpulse = this.tangent.scale(lambda);
		this.bodyA.applyImpulse(frictionImpulse.scale(-1), this.worldA);
		this.bodyB.applyImpulse(frictionImpulse, this.worldB);
	}

	applyRestitution() {
		// Only apply restitution if:
		// 1. There's a restitution coefficient > 0
		// 2. The contact point is new this step (not persisted)
		// 3. The initial relative velocity was approaching fast enough
		const restitutionThreshold = 1.0; // Increased threshold
		
		if (this.restitution === 0 || this.isReused) {
				return;
		}
		
		if (this.relativeVelocity > -restitutionThreshold) {
				return;
		}

		const rnA = this.rA.cross(this.normal);
		const rnB = this.rB.cross(this.normal);
		const effectiveMass = this.invMassA + this.invMassB + rnA * rnA * this.invIA + rnB * rnB * this.invIB;
		if (effectiveMass < 0.000001) return;

		// Calculate current velocities
		const velA = this.bodyA.velocity.add(this.rA.crossSv(this.bodyA.angularVelocity));
		const velB = this.bodyB.velocity.add(this.rB.crossSv(this.bodyB.angularVelocity));
		const relVel = velB.sub(velA);
		const vn = this.normal.dot(relVel);

		// Compute restitution impulse
		// We want the final velocity to be -e * initial velocity
		// So we need to change from current vn to -e * relativeVelocity
		// velocity change = -e * relativeVelocity - vn
		// impulse = mass * velocity change
		const impulse = -(vn + this.restitution * this.relativeVelocity) / effectiveMass;

		// Only apply positive impulses (separating)
		if (impulse > 0) {
				const restitutionImpulse = this.normal.scale(impulse);
				this.bodyA.applyImpulse(restitutionImpulse.scale(-1), this.worldA);
				this.bodyB.applyImpulse(restitutionImpulse, this.worldB);
		}
	}
}

class PhysWorld {
	constructor() {
		this.objects = [];
		this.constraints = [];
		this.gravity = new Vec2(0, -9.81);
		this.constraintIterations = 10;
		this.constraintSettings = {
			// Constraint mode: 'off' | 'baumgarte' | 'soft'
			mode: 'soft',
			// Baumgarte and soft defaults similar to Box2D
			baumgarteFactor: 0.1,
			contactSoft: { hertz: 30.0, dampingRatio: 10.0 },
			jointSoft: { hertz: 60.0, dampingRatio: 0.0 },
			contactSpeed: 3.0,
			warmStarting: true,
		};
		this._accumulator = 0; // accumulated real time for fixed-step simulation
	}

	addBox(x, y, w, h, density = 1, isStatic = false) {
		const mass = isStatic ? Infinity : density * w * h;
		const momentOfInertia = isStatic ? Infinity : (mass * (w * w + h * h)) / 12;

		const hw = w / 2, hh = h / 2;
		const boxShape = new ConvexPolygonShape([new Vec2(-hw, -hh), new Vec2(hw, -hh), new Vec2(hw, hh), new Vec2(-hw, hh)]);

		const box = new PhysObject(x, y, [boxShape], isStatic, mass, momentOfInertia);
		box._boxHints = { width: w, height: h };
		this.objects.push(box);
		return box;
	}

	addCapsule(x, y, length, r1, r2, density = 1, isStatic = false) {
		const halfLen = length / 2;
		const dr = r2 - r1;
		const com = length * (r2 * r2 - r1 * r1) / (4 * (r1 * r1 + r1 * r2 + r2 * r2));
		const mass = isStatic ? Infinity : density * (length * (r1 + r2) + 0.5 * Math.PI * (r1 * r1 + r2 * r2));

		// analytic MoI about COM, unit density
		function capsuleMomentOfInertia(L, a, b) {
			const numer = 3 * L ** 2 * (a ** 4 + 4 * a ** 3 * b + 10 * a ** 2 * b ** 2 + 4 * a * b ** 3 + b ** 4) + 24 *
				(a ** 6 + 2 * a ** 5 * b + 3 * a ** 4 * b ** 2 + 4 * a ** 3 * b ** 3 + 3 * a ** 2 * b ** 4 + 2 * a * b ** 5 + b ** 6);
			return Math.PI * L * numer / (240 * (a ** 2 + a * b + b ** 2));
		}

		// Calculate the box shape connecting the two circles
		const factor = Math.sqrt(1 - (dr * dr) / (length * length));
		const topX1 = -halfLen - (dr * r1) / length - com, botX1 = topX1, topY1 = r1 * factor, botY1 = -topY1;
		const topX2 = halfLen - (dr * r2) / length - com, botX2 = topX2, topY2 = r2 * factor, botY2 = -topY2;

		const shapes = [
			new ConvexPolygonShape([new Vec2(botX1, botY1), new Vec2(botX2, botY2), new Vec2(topX2, topY2), new Vec2(topX1, topY1)]),
			new CircleShape(r1, new Vec2(-halfLen - com, 0)),
			new CircleShape(r2, new Vec2(halfLen - com, 0))
		];

		const body = new PhysObject(x, y, shapes, isStatic, mass, isStatic ? Infinity : density * capsuleMomentOfInertia(length, r1, r2));
		body._capsuleHints = { length, r1, r2, offset: com };
		this.objects.push(body);
		return body;
	}

	addCircle(x, y, radius, density = 1, isStatic = false) {
		const mass = isStatic ? Infinity : density * Math.PI * radius * radius;
		const momentOfInertia = isStatic ? Infinity : (mass * radius * radius) / 2;
		const circleShape = new CircleShape(radius, new Vec2(0, 0));
		const circle = new PhysObject(x, y, [circleShape], isStatic, mass, momentOfInertia);
		this.objects.push(circle);
		return circle;
	}

	step(timeElapsedSinceLastCalled = 0, dt = 1 / 240, maxSteps = 10) {
		// Accumulate real time from the render/update loop
		this._accumulator += timeElapsedSinceLastCalled;

		// Prevent spiral of death when resuming after long pauses
		const maxAccumulatedTime = maxSteps * dt;
		if (this._accumulator > maxAccumulatedTime) this._accumulator = maxAccumulatedTime;

		// Run a fixed number of physics substeps based on accumulated time
		while (this._accumulator >= dt) {
			for (const obj of this.objects) {
				if (obj.isStatic) continue;
				obj.velocity = obj.velocity.add(this.gravity.scale(dt));
			}

			this.detectCollisions();
			this.solveConstraints(dt, this.constraintIterations);

			for (const obj of this.objects) {
				obj.step(dt);
			}

			this._accumulator -= dt;
		}
	}

	solveConstraints(dt, numIterations) {
		const constraintSettings = this.constraintSettings;
		for (const constraint of this.constraints) {
			constraint.update(constraintSettings);
		}

		for (let i = 0; i < numIterations; i++) {
			for (const constraint of this.constraints) {
				constraint.solve(dt, constraintSettings);
			}
		}

		for (const constraint of this.constraints) {
			if (constraint instanceof ContactConstraint) {
				constraint.applyRestitution();
			}
		}
	}

	addRevoluteConstraint(objA, objB, worldPoint, lowerAngleLimit = null, upperAngleLimit = null, stiffness = 1.0) {
		const constraint = new RevoluteConstraint(objA, objB, worldPoint, lowerAngleLimit, upperAngleLimit, stiffness);
		this.constraints.push(constraint);
		return constraint;
	}

	detectCollisions() {
		const contactConstraintsForReuse = this.constraints.filter(c => c instanceof ContactConstraint);
		this.constraints = this.constraints.filter(c => !(c instanceof ContactConstraint));
		const newContacts = CollisionHelper.handleCollisions(this.objects, contactConstraintsForReuse);
		this.constraints.push(...newContacts);
	}
}

class CollisionHelper {
	static shouldCollide(objA, objB) {
		if (objA.isStatic && objB.isStatic) return false;
		if ((objA.collisionMask & objB.collisionMask) === 0) return false;
		if ((objA.collisionMaskIgnore & objB.collisionMask) === objB.collisionMask) return false;
		if ((objB.collisionMaskIgnore & objA.collisionMask) === objA.collisionMask) return false;
		return true;
	}

	static projectVerts(verts, axis) {
		let min = Infinity, max = -Infinity;
		for (const v of verts) {
			const p = v.dot(axis);
			min = Math.min(min, p);
			max = Math.max(max, p);
		}
		return [min, max];
	}

	static clipLineSegmentToLine(p1, p2, normal, offset) {
		let clippedPoints = [];
		const distance0 = p1.sub(offset).dot(normal);
		const distance1 = p2.sub(offset).dot(normal);
		// If the points are behind the plane, don't clip
		if (distance0 <= 0) clippedPoints.push(p1);
		if (distance1 <= 0) clippedPoints.push(p2);
		// If one is in front of the plane, have to clip it to the intersection point
		// clippedPoints.length < 2 for edge case where 1 point is exactly on the plane
		if (Math.sign(distance0) !== Math.sign(distance1) && clippedPoints.length < 2) {
			const pctAcross = distance1 / (distance1 - distance0);
			const intersectionPt = p2.add(p1.sub(p2).scale(pctAcross));
			clippedPoints.push(intersectionPt);
		}
		return clippedPoints; // Returns 2 or 0 points
	}

	static handleCollisions(objects, contactConstraintsForReuse = []) {
		const newContacts = [];

		for (let i = 0; i < objects.length; i++) {
			for (let j = i + 1; j < objects.length; j++) {
				const bodyA = objects[i];
				const bodyB = objects[j];
				const results = CollisionHelper.checkCollision(bodyA, bodyB, contactConstraintsForReuse);
				for (const cNew of results) {
					newContacts.push(cNew);
				}
			}
		}

		return newContacts;
	}

	static checkCollision(objA, objB, contactConstraintsForReuse = []) {
		if (!this.shouldCollide(objA, objB)) return [];
		if (!objA.getAABB().overlaps(objB.getAABB())) return [];

		const contactConstraints = [];

		for (let idxA = 0; idxA < objA.shapes.length; idxA++) {
			const shapeA = objA.shapes[idxA];
			for (let idxB = 0; idxB < objB.shapes.length; idxB++) {
				const shapeB = objB.shapes[idxB];

				let collision = {};

				if (shapeA instanceof CircleShape && shapeB instanceof CircleShape) {
					collision = this.circleToCircleSAT(objA, shapeA, objB, shapeB);
				} else if (shapeA instanceof CircleShape && shapeB instanceof ConvexPolygonShape) {
					collision = this.circleToPolySAT(objA, shapeA, objB, shapeB);
				} else if (shapeA instanceof ConvexPolygonShape && shapeB instanceof CircleShape) {
					collision = this.circleToPolySAT(objB, shapeB, objA, shapeA);
				} else {
					collision = this.polyToPolySAT(objA, shapeA, objB, shapeB);
				}

				if (!collision.normal) continue;
				// Ensure normal is always pointing A->B
				// CollisionConstraint expects this because it applies impulse from A->B in normal direction
				// If the normal does not point A->B, it will pull them towards each other instead of acting repulsive
				if (collision.normal.dot(objB.position.sub(objA.position)) < 0) {
					collision.normal = collision.normal.scale(-1);
				}

				// Determine clipped contact points
				let clippedResult = { points: [], featureIds: [] };
				if (shapeA instanceof CircleShape && shapeB instanceof CircleShape) {
					clippedResult = this.clipCircleToCircle(objA, shapeA, objB, shapeB, collision);
				} else if (shapeA instanceof CircleShape && shapeB instanceof ConvexPolygonShape) {
					clippedResult = this.clipCircleToPoly(objA, shapeA, objB, shapeB, collision);
				} else if (shapeA instanceof ConvexPolygonShape && shapeB instanceof CircleShape) {
					clippedResult = this.clipCircleToPoly(objB, shapeB, objA, shapeA, collision);
				} else {
					if (collision.referenceIsA) {
						clippedResult = this.clipPolyToPoly(objA, shapeA, objB, shapeB, collision);
					} else {
						clippedResult = this.clipPolyToPoly(objB, shapeB, objA, shapeA, collision);
					}
				}

				// Create ContactConstraints with feature IDs for persistence
				for (let ptIdx = 0; ptIdx < clippedResult.points.length; ptIdx++) {
					const wp = clippedResult.points[ptIdx];
					const featureId = clippedResult.featureIds[ptIdx];
					
					// Try to reuse existing contact constraint
					let reusedConstraint = null;
					for (let k = 0; k < contactConstraintsForReuse.length; k++) {
						const oldContact = contactConstraintsForReuse[k];
						if (oldContact.bodyA === objA && oldContact.bodyB === objB && oldContact.featureId === featureId) {
							reusedConstraint = oldContact;
							contactConstraintsForReuse.splice(k, 1)
							break;
						}
					}
					
					if (reusedConstraint) {
						// Update existing constraint with new collision data
						reusedConstraint.isReused = true;
						reusedConstraint.setCollisionData(wp, collision.normal, collision.penetration);
						contactConstraints.push(reusedConstraint);
					} else {
						// Create new constraint
						contactConstraints.push(new ContactConstraint(objA, objB, wp, collision.normal, collision.penetration, featureId));
					}
				}
			}
		}

		return contactConstraints;
	}

	static polyToPolySAT(objA, shapeA, objB, shapeB) {
		// SAT poly-vs-poly: test all face normals, compute penetration depth, and pick reference face for clipping
		const vertsA = shapeA.vertices.map(v => objA.localToWorld(v));
		const vertsB = shapeB.vertices.map(v => objB.localToWorld(v));
		const normalsA = ConvexPolygonShape.getNormals(vertsA);
		const normalsB = ConvexPolygonShape.getNormals(vertsB);

		let minSepA = -Infinity, minEdgeA = 0;
		let minSepB = -Infinity, minEdgeB = 0;

		// SAT axes = A's face normals
		for (let i = 0; i < normalsA.length; i++) {
			const [minA, maxA] = this.projectVerts(vertsA, normalsA[i]);
			const [minB, maxB] = this.projectVerts(vertsB, normalsA[i]);
			if (minA > maxB || minB > maxA) return {};
			// Track one-sided separation for A's outward normal
			const sep = minB - maxA;
			if (sep > minSepA) { minSepA = sep; minEdgeA = i; }
		}

		// SAT axes = B's face normals
		for (let i = 0; i < normalsB.length; i++) {
			const [minA, maxA] = this.projectVerts(vertsA, normalsB[i]);
			const [minB, maxB] = this.projectVerts(vertsB, normalsB[i]);
			if (minA > maxB || minB > maxA) return {};
			// Track one-sided separation for B's outward normal
			const sep = minA - maxB;
			if (sep > minSepB) { minSepB = sep; minEdgeB = i; }
		}

		// Pick reference face: larger one-sided separation (i.e., closer to 0)
		let referenceIsA = true;
		let referenceEdgeIndex = minEdgeA;
		let normal = normalsA[referenceEdgeIndex];
		// Add a small buffer so we don't flip faces when they're nearly tied
		const FACE_SWITCH_TOL = 1e-4;
		if (minSepB > minSepA + FACE_SWITCH_TOL) {
			referenceIsA = false;
			referenceEdgeIndex = minEdgeB;
			normal = normalsB[referenceEdgeIndex];
		}

		return { normal, penetration: referenceIsA ? -minSepA : -minSepB, referenceIsA, referenceEdgeIndex };
	}

	static circleToPolySAT(objA, shapeA, objB, shapeB) {
		const circlePos = objA.localToWorld(shapeA.offset);
		const verts = shapeB.vertices.map(v => objB.localToWorld(v));
		let minPen = Infinity;
		let normal = null;
		const normals = ConvexPolygonShape.getNormals(verts);

		// Normal SAT
		for (const n of normals) {
			const [minA, maxA] = this.projectVerts(verts, n);
			const [minB, maxB] = [circlePos.dot(n) - shapeA.radius, circlePos.dot(n) + shapeA.radius];
			if (minA > maxB || minB > maxA) return {}; // Found separating axis

			const pen = Math.min(maxA, maxB) - Math.max(minA, minB);
			if (pen < minPen) {
				minPen = pen;
				normal = n;
			}
		}

		// Special case, closest point is vertex rather than an edge
		let closestVert = verts[0];
		let minDist = closestVert.sub(circlePos).length();
		for (const v of verts) {
			const d = v.sub(circlePos).length();
			if (d < minDist) { closestVert = v; minDist = d; }
		}
		const axis = closestVert.sub(circlePos).normalized();
		const [minA, maxA] = this.projectVerts(verts, axis);
		const cProj = circlePos.dot(axis);
		const minB = cProj - shapeA.radius;
		const maxB = cProj + shapeA.radius;
		if (minA > maxB || minB > maxA) return {};		// Separating axis on circle edge

		const pen = Math.min(maxA, maxB) - Math.max(minA, minB);
		if (pen < minPen) {
			minPen = pen;
			normal = axis;
		}

		return { normal, penetration: minPen };
	}

	static circleToCircleSAT(objA, shapeA, objB, shapeB) {
		const worldA = objA.localToWorld(shapeA.offset);
		const worldB = objB.localToWorld(shapeB.offset);
		const d = worldB.sub(worldA);
		const dist = d.length();
		const total = shapeA.radius + shapeB.radius;
		if (dist > total) return {};
		else {
			return { normal: d.normalized(), penetration: total - dist };
		}
	}

	static clipPolyToPoly(refObj, refShape, incObj, incShape, collision) {
		// Generate contact points with reference object/shape and incident object/shape
		const refVerts = refShape.vertices.map(v => refObj.localToWorld(v));
		const incVerts = incShape.vertices.map(v => incObj.localToWorld(v));
		const refNormals = ConvexPolygonShape.getNormals(refVerts);
		const incNormals = ConvexPolygonShape.getNormals(incVerts);

		const a1 = refVerts[collision.referenceEdgeIndex];
		const a2 = refVerts[(collision.referenceEdgeIndex + 1) % refVerts.length];
		const n = refNormals[collision.referenceEdgeIndex];

		// Incident edge selection: edge with normal pointing most opposite to n
		let lowestDot = Infinity;
		let incidentIndex = 0;
		for (let i = 0; i < incNormals.length; i++) {
			const d = n.dot(incNormals[i]);
			if (d < lowestDot) { lowestDot = d; incidentIndex = i; }
		}
		let b2 = incVerts[incidentIndex];
		let b1 = incVerts[(incidentIndex + 1) % incVerts.length];

		// Clip to start and end faces. Tangents on ends of reference edge. |-----|
		const refTangent = a2.sub(a1).normalized();
		let clippedPoints = this.clipLineSegmentToLine(b1, b2, refTangent.scale(-1), a1);
		if(clippedPoints.length === 0) return { points: [], featureIds: [] };
		clippedPoints = this.clipLineSegmentToLine(clippedPoints[0], clippedPoints[1], refTangent, a2);

		// Keep points that are behind the reference face, plus speculative slop like Box2D
		const finalPoints = clippedPoints.filter(v => n.dot(v.sub(a1)) <= SLOP_LINEAR);
		
		// Box2D style feature IDs: combine object/shape IDs with vertex indices
		const i11 = collision.referenceEdgeIndex; // ref edge start vertex
		const i12 = (i11 + 1) % refVerts.length; // ref edge end vertex
		const i21 = (incidentIndex + 1) % incVerts.length; // incident edge start vertex (b1)
		const i22 = incidentIndex; // incident edge end vertex (b2)
		const prefix =
			((refObj.id & 0xFF) << 24) | ((incObj.id & 0xFF) << 16) |
			((refShape.id & 0xF) << 12) | ((incShape.id & 0xF) << 8);
		const featureIds = finalPoints.map((_, idx) => {
			const vertexBits = idx === 0 ?
				((i11 & 0xF) << 4) | (i22 & 0xF) : // [reference edge start vert, incident edge start vert]
				((i12 & 0xF) << 4) | (i21 & 0xF); // [reference edge end vert, incident edge end vert]
			return prefix | vertexBits;
		});
		return { points: finalPoints, featureIds };
	}

	static clipCircleToPoly(objA, shapeA, objB, shapeB, collision) {
		const circleCenter = objA.localToWorld(shapeA.offset);
		const dirToPoly = objB.position.sub(circleCenter);
		// Choose sign so that we always march from the circle center towards the polygon along the normal.
		const sign = Math.sign(collision.normal.dot(dirToPoly)) || 1; // default to 1 if zero
		const point = circleCenter.add(collision.normal.scale(shapeA.radius * sign));
		
		// Simple feature ID for circle collisions: just object and shape IDs
		const featureId = ((objA.id & 0xFF) << 24) | ((objB.id & 0xFF) << 16) | 
		                  ((shapeA.id & 0xFF) << 8) | (shapeB.id & 0xFF);
		
		return { points: [point], featureIds: [featureId] };
	}

	static clipCircleToCircle(objA, shapeA, objB, shapeB, collision) {
		// At this point collision.normal is guaranteed to point from objA to objB
		// Use the point on circle A along the normal direction as the contact point.
		const worldCenterA = objA.localToWorld(shapeA.offset);
		const point = worldCenterA.add(collision.normal.scale(shapeA.radius));
		
		// Simple feature ID for circle collisions: just object and shape IDs
		const featureId = ((objA.id & 0xFF) << 24) | ((objB.id & 0xFF) << 16) | 
		                  ((shapeA.id & 0xFF) << 8) | (shapeB.id & 0xFF);
		
		return { points: [point], featureIds: [featureId] };
	}
}