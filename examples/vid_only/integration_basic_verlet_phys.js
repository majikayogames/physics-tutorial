class Vec2 {
  constructor(x, y) { this.x = x; this.y = y; }
  add(other) { return new Vec2(this.x + other.x, this.y + other.y); }
  sub(other) { return new Vec2(this.x - other.x, this.y - other.y); }
  scale(scalar) { return new Vec2(this.x * scalar, this.y * scalar); }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  normalized() { return this.length() < 1e-9 ? new Vec2(1, 0) : this.scale(1 / this.length()); }
}

class VerletObject {
  constructor(x, y) {
    this.position = new Vec2(x, y);
    this.prevPosition = new Vec2(x, y);
  }
  
  step(dt, acceleration) {
    // Calculate next position using Verlet formula
    let movementOverDt = this.position.sub(this.prevPosition);
    movementOverDt = movementOverDt.add(acceleration.scale(dt * dt));
    const nextPos = this.position.add(movementOverDt);

    // Roll positions and rotations forward
    this.prevPosition = this.position;
    this.position = nextPos;
  }
}

// Simple distance constraint for Verlet objects
class VerletDistanceConstraint {
  constructor(objA, objB, restLength = null, stiffness = 1) {
    this.objA = objA;
    this.objB = objB;
    this.restLength =
      restLength ?? objA.position.sub(objB.position).length();
    this.stiffness = stiffness; // 0..1, 1 = full correction
  }
  
  solve() {
    const delta = this.objB.position.sub(this.objA.position);
    const dist = delta.length();
    const diff = (dist - this.restLength) / dist;
    const correction = delta.scale(0.5 * diff * this.stiffness);
    this.objA.position = this.objA.position.add(correction);
    this.objB.position = this.objB.position.sub(correction);
  }
}

class PhysWorldVerlet {
  constructor() {
    this.objects = [];
    this.constraints = [];
    this.gravity = new Vec2(0, 0);
    this.constraintIterations = 8;
  }
  
  addObject(obj) {
    this.objects.push(obj);
    return obj;
  }
  
  step(dt) {
    // Integrate all objects
    for (const obj of this.objects) {
      obj.step(dt, this.gravity);
    }

    // Satisfy constraints in a position-based manner
    const invIterations = 1 / this.constraintIterations;
    for (let i = 0; i < this.constraintIterations; i++) {
      for (const c of this.constraints) {
        c.solve(invIterations);
      }
    }
  }
}