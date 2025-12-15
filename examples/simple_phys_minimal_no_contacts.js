/* simple_phys_minimal.js - Minimal ver of Simple 2D Physics Engine. CC0 License */

function mat2x2Solve(K, b) {
  // K * v = b, solve for v using Cramer's rule
  const det = K[0][0] * K[1][1] - K[0][1] * K[1][0];
  const invDet = det !== 0 ? 1.0 / det : 0;
  return new Vec2(invDet * (K[1][1] * b.x - K[0][1] * b.y), invDet * (K[0][0] * b.y - K[1][0] * b.x));
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

class CircleShape {/* removed for minimal ver. renderer errors without CircleShape symbol */}
class ContactConstraint {/* removed for minimal ver. renderer errors without ContactConstraint symbol */}

class ConvexPolygonShape {
  constructor(ccwVertices) { this.vertices = ccwVertices; }
  containsLocalPoint(point) { return ConvexPolygonShape.isPointInsideConvexPolygon(point, this.vertices); }
  static getNormals(verts) { return verts.map((v, i) => verts[(i + 1) % verts.length].sub(v).rotate90CW().normalized()); }
  static isPointInsideConvexPolygon(point, verts, tolerance = 0) { // Uses dot product, projects along normal of edges to check if point is inside all
    return ConvexPolygonShape.getNormals(verts).every((n, i) => n.dot(point.sub(verts[i])) < tolerance);
  }
}

class PhysObject {
  constructor(x, y, shapes, isStatic = false, mass = 1, momentOfInertia = 1) {
    this.position = new Vec2(x, y);
    this.velocity = new Vec2(0, 0);
    this.rotation = 0;
    this.angularVelocity = 0;

    this.shapes = shapes;
    this.isStatic = isStatic;
    this.mass = isStatic ? Infinity : mass;
    this.momentOfInertia = isStatic ? Infinity : momentOfInertia;

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
      shape.vertices.map(v => this.localToWorld(v)).forEach(v => aabb.expand([v]));
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
  constructor(bodyA, bodyB) { this.bodyA = bodyA; this.bodyB = bodyB; }
  update() { }
  solve(dt, baumgarteFactor) { }
}

class RevoluteConstraint extends Constraint {
  constructor(bodyA, bodyB, worldPoint) {
    super(bodyA, bodyB);
    this.localA = bodyA.worldToLocal(worldPoint);
    this.localB = bodyB.worldToLocal(worldPoint);
    this.update();
  }

  update() {
    // joint anchor positions
    this.worldA = this.bodyA.localToWorld(this.localA);
    this.worldB = this.bodyB.localToWorld(this.localB);
    this.rA = this.worldA.sub(this.bodyA.position);
    this.rB = this.worldB.sub(this.bodyB.position);

    this.invMassA = this.bodyA.isStatic ? 0 : 1 / this.bodyA.mass;
    this.invMassB = this.bodyB.isStatic ? 0 : 1 / this.bodyB.mass;
    this.invIA = this.bodyA.isStatic ? 0 : 1 / this.bodyA.momentOfInertia;
    this.invIB = this.bodyB.isStatic ? 0 : 1 / this.bodyB.momentOfInertia;
  }

  solve(dt, baumgarteFactor) {
    const [mA, mB, iA, iB, rA, rB] = [this.invMassA, this.invMassB, this.invIA, this.invIB, this.rA, this.rB];

    const velA = this.bodyA.velocity.add(rA.crossSv(this.bodyA.angularVelocity));
    const velB = this.bodyB.velocity.add(rB.crossSv(this.bodyB.angularVelocity));
    const Cdot = velB.sub(velA); // velocity error
    const C = this.worldB.sub(this.worldA); // positional error

    // Matrix to predict how an impulse will affect Cdot. Derived from the equations in PhysObject.applyImpulse
    const K = [[0, 0], [0, 0]];
    K[0][0] = mA + mB + rA.y * rA.y * iA + rB.y * rB.y * iB;
    K[0][1] = -rA.y * rA.x * iA - rB.y * rB.x * iB;
    K[1][0] = K[0][1];
    K[1][1] = mA + mB + rA.x * rA.x * iA + rB.x * rB.x * iB;

    let bias = C.scale(baumgarteFactor / dt);
    let impulse = mat2x2Solve(K, Cdot.add(bias).scale(-1));

    this.bodyA.applyImpulse(impulse.scale(-1), this.worldA);
    this.bodyB.applyImpulse(impulse, this.worldB);
  }
}

class PhysWorld {
  constructor() {
    this.objects = [];
    this.constraints = [];
    this.gravity = new Vec2(0, -9.81);
    this.constraintIterations = 10;
    this.baumgarteFactor = 0.1;
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

      this.solveConstraints(dt, this.constraintIterations);

      for (const obj of this.objects) {
        obj.step(dt);
      }

      this._accumulator -= dt;
    }
  }

  solveConstraints(dt, numIterations) {
    for (const constraint of this.constraints) {
      constraint.update();
    }

    for (let i = 0; i < numIterations; i++) {
      for (const constraint of this.constraints) {
        constraint.solve(dt, this.baumgarteFactor);
      }
    }
  }

  addRevoluteConstraint(objA, objB, worldPoint) {
    const constraint = new RevoluteConstraint(objA, objB, worldPoint);
    this.constraints.push(constraint);
    return constraint;
  }
}