class Vec2 {
  constructor(x, y) { this.x = x; this.y = y; }
  add(other) { return new Vec2(this.x + other.x, this.y + other.y); }
  sub(other) { return new Vec2(this.x - other.x, this.y - other.y); }
  scale(scalar) { return new Vec2(this.x * scalar, this.y * scalar); }
}

class PhysObject {
  constructor(x, y) {
    this.position = new Vec2(x, y);
    this.velocity = new Vec2(0, 0);
    this.rotation = 0;
    this.angularVelocity = 0;
  }
  
  step(dt) {
    // Integrate position and rotation based on velocities and timestep.
    this.rotation += this.angularVelocity * dt;
    this.position = this.position.add(this.velocity.scale(dt));
  }
}

class PhysWorld {
  constructor() {
    this.objects = [];
    this.gravity = new Vec2(0, 0);
  }
  
  step(dt) {
    // Apply gravity to all objects
    for (const obj of this.objects) {
      obj.velocity = obj.velocity.add(this.gravity.scale(dt));
    }
    
    // Update all objects
    for (const obj of this.objects) {
      obj.step(dt);
    }
  }
}