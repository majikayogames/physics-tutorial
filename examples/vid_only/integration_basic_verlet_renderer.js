// Extremely small renderer for Verlet-only demos.
// Draws particles as circles and constraints as simple line segments.

let _verletDragObject = null;
let _verletDragOffset = null; // Vec2 from mouse to object center (world space)
let _lastMouseWorld = null;   // Vec2 in world space, to compute drag velocity
const _VERLET_DRAG_RADIUS = 0.4; // World-space radius for picking

const VerletRenderer = {
  render(world) {
    if (!world || !world.objects) return;

    ez.fast2DModeWithNoCameraRotation = true;

    ez.save();

    // Draw constraints first (so particles appear on top)
    if (world.constraints && world.constraints.length > 0) {
      for (const c of world.constraints) {
        const a = c.objA.position;
        const b = c.objB.position;
        ez.line(vec2(a.x, a.y), vec2(b.x, b.y)).stroke("#888888");
      }
    }

    // Draw particles
    for (const obj of world.objects) {
      const p = obj.position;
      const r = 0.12;
      // Black dots with a subtle outline
      ez.circle(vec2(p.x, p.y), r).fillAndStroke("#000000", "#111111");
    }

    ez.restore();
  },

  // Call once after the world is created to enable click-and-drag on particles.
  initInteraction(world) {
    // Mouse down: pick the closest particle within a small radius.
    ez.onMouseDown(() => {
      if (!world || !world.objects || world.objects.length === 0) return;
      const m = ez.getMousePosWorld ? ez.getMousePosWorld() : null;
      if (!m) return;

      let closest = null;
      let closestDistSq = _VERLET_DRAG_RADIUS * _VERLET_DRAG_RADIUS;

      for (const obj of world.objects) {
        const dx = obj.position.x - m.x;
        const dy = obj.position.y - m.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= closestDistSq) {
          closestDistSq = distSq;
          closest = obj;
        }
      }

      if (closest) {
        _verletDragObject = closest;
        const mouseVec = new Vec2(m.x, m.y);
        _verletDragOffset = closest.position.sub(mouseVec);
        _lastMouseWorld = mouseVec;
      }
    });

    // Mouse up / leave: release the dragged particle.
    ez.onMouseUp(() => {
      _verletDragObject = null;
      _verletDragOffset = null;
      _lastMouseWorld = null;
    });
    if (ez.onMouseLeave) {
      ez.onMouseLeave(() => {
        _verletDragObject = null;
        _verletDragOffset = null;
        _lastMouseWorld = null;
      });
    }
  },

  // Call once per frame so dragged particles follow the mouse.
  updateDragging() {
    if (!_verletDragObject) return;
    const m = ez.getMousePosWorld ? ez.getMousePosWorld() : null;
    if (!m) return;

    const mouseVec = new Vec2(m.x, m.y);
    if (!_lastMouseWorld) {
      _lastMouseWorld = mouseVec;
    }

    // Approximate velocity from mouse movement in world space
    const mouseVelocity = mouseVec.sub(_lastMouseWorld);

    const targetPos = _verletDragOffset
      ? mouseVec.add(_verletDragOffset)
      : mouseVec;

    // Set prevPosition so that (position - prevPosition) ~= mouse velocity,
    // giving the particle a "fling" when the mouse is released.
    const prevPos = targetPos.sub(mouseVelocity);
    _verletDragObject.prevPosition = prevPos;
    _verletDragObject.position = targetPos;

    _lastMouseWorld = mouseVec;
  },
};


