// Self-balancing ragdoll helper extracted from self_balancing_ragdoll.html
// Provides spawnSelfBalancingRagdoll(world, baseX, baseY) which returns an
// object with { rig, update(dt) } to keep the ragdoll balanced.

function _shortDiff(a, b) {
  let d = a - b;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  return d;
}

class Limb {
  constructor(world, type, params = {}) {
    this.world = world;
    this.type = type;
    this.body = null;
    this.lowerLimitFromCenter = null;
    this.upperLimitFromCenter = null;
    this.centerOffsetFromParent = 0;
    this.parentLimb = null;
    this.offsetFromJoint = new Vec2(0, 0);

    if (type === "capsule") {
      const { x = 0, y = 0, length = 1, radiusA = 0.2, radiusB = 0.2, isStatic = false, rotation = 0, zIndex = 0 } = params;
      const density = 2.5;
      this.body = world.addCapsule(x, y, length, radiusA, radiusB, density, isStatic);
      this.body.rotation = rotation;
      this.body._renderZIndex = zIndex;
    } else if (type === "circle") {
      const { x = 0, y = 0, radius = 0.5, isStatic = false, rotation = 0, zIndex = 0 } = params;
      this.body = world.addCircle(x, y, radius, 1, isStatic);
      this.body.rotation = rotation;
      this.body._renderZIndex = zIndex;
    } else {
      throw new Error("Invalid limb type");
    }

    if (type === "capsule") {
      this._startOffset = this.body.shapes[1].offset; // endA
      this._endOffset = this.body.shapes[2].offset;   // endB
    } else {
      this._startOffset = this._endOffset = new Vec2(0, 0);
    }

    this.body.restitution = 0.0;
    this.body.friction = 1.0;
    this.parentJoint = null;
  }

  isColliding() {
    return this.world.constraints.filter(c => (c instanceof ContactConstraint) && (c.bodyA === this.body || c.bodyB === this.body)).length > 0;
  }

  _localAnchor(which) { return which === "end" ? this._endOffset : this._startOffset; }
  getWorldAnchor(which) {
    const r = this._localAnchor(which).rotate(this.body.rotation);
    return this.body.position.add(r);
  }
}

class Rig {
  constructor(world, collisionGroupIndex = 2) {
    this.world = world;
    this.limbs = {};
    this.constraints = [];
    this.groupBit = 1 << collisionGroupIndex;
  }

  addLimb(name, type, params = {}, parentName = null, jointOpts = {}) {
    if (this.limbs[name]) throw new Error(`Limb "${name}" already exists`);
    const limb = new Limb(this.world, type, params);
    if (params.rotation === undefined && parentName && this.limbs[parentName])
      limb.body.rotation = this.limbs[parentName].body.rotation + (jointOpts.center ?? 0);
    limb.name = name;
    const { offsetX = 0, offsetY = 0 } = params;
    limb.offsetFromJoint = new Vec2(offsetX, offsetY);

    limb.body.collisionMask = 0x0F0000;
    limb.body.collisionMaskIgnore = 0x0F0000;
    limb.body._renderColorHint = "#FFB3BA";

    this.limbs[name] = limb;

    let joint = null;
    if (parentName) {
      const parent = this.limbs[parentName];
      const anchorA = jointOpts.anchorA ?? "end";
      const anchorB = jointOpts.anchorB ?? "start";

      const worldAnchor = parent.getWorldAnchor(anchorA);
      const localB = limb._localAnchor(anchorB);
      const rotB = localB.rotate(limb.body.rotation);
      limb.body.position = worldAnchor.sub(rotB);

      const parentRot = parent.body.rotation;
      const additionalOffsetRotated = limb.offsetFromJoint.rotate(parentRot);
      limb.body.position = limb.body.position.add(additionalOffsetRotated);

      const centerOffset = jointOpts.center ?? 0;
      const totalRange = jointOpts.limit ?? (Math.PI / 2);
      const halfSpan = totalRange * 0.5;
      const lower = centerOffset - halfSpan;
      const upper = centerOffset + halfSpan;

      if (jointOpts.limit !== undefined) {
        limb.lowerLimitFromCenter = lower;
        limb.upperLimitFromCenter = upper;
        limb.centerOffsetFromParent = centerOffset;
      }
      limb.parentLimb = parent;

      joint = this.world.addRevoluteConstraint(parent.body, limb.body, worldAnchor, jointOpts.limit !== undefined ? lower : undefined, jointOpts.limit !== undefined ? upper : undefined);
      joint._originalLimitsRotationRendererHint = -(centerOffset + halfSpan);

      limb.parentJoint = joint;
      this.constraints.push(joint);
    }
    return { limb, joint };
  }

  getCenterOfMass() {
    let totalMass = 0;
    let weightedPosSum = new Vec2(0, 0);

    for (const name in this.limbs) {
      const limb = this.limbs[name];
      const body = limb.body;
      if (body.mass === Infinity) continue;
      const mass = body.mass;
      const pos = body.position;

      totalMass += mass;
      weightedPosSum = weightedPosSum.add(pos.scale(mass));
    }

    if (totalMass === 0) {
      return new Vec2(0, 0);
    }

    return weightedPosSum.scale(1 / totalMass);
  }
}

class IKChain {
  constructor(rig, limbNames, maxForce = 15, freq = 12, dampingRatio = 2) {
    this.rig = rig;
    this.limbs = limbNames.map(n => rig.limbs[n]);
    this.joints = this.limbs.map(l => l.parentJoint);
    this.maxForce = maxForce;
    this.freq = freq;
    this.dampingRatio = dampingRatio;
    this.segLens = this._getSegLens();
    this.lastSolvedPts = [];
    this.lastTarget = null;
    this.lastRelTargets = [];
    this.obeyFirstJointLimits = false;
  }

  _getSegLens() {
    const pts = this._worldPts();
    return pts.slice(1).map((p, i) => p.sub(pts[i]).length());
  }

  _worldPts() {
    const pts = [];
    const base = this.limbs[0].getWorldAnchor("start");
    pts.push(vec2(base.x, base.y));
    for (const l of this.limbs) {
      const e = l.getWorldAnchor("end");
      pts.push(vec2(e.x, e.y));
    }
    return pts;
  }

  _runFabrik(chain, target, limbLimits, tol = 0.001, maxIt = 15) {
    chain = chain.map(c => vec2(c));
    target = vec2(target);
    const base = chain[0].clone();
    const totalLen = this.segLens.reduce((s, l) => s + l, 0);
    const segLens = chain.slice(1).map((c, i) => c.sub(chain[i]).length());

    const applyConstraintsToSegment = (i) => {
      const limits = limbLimits[i];
      if (limits && limits.lower !== null && limits.upper !== null) {
        if (i === 0 && this.obeyFirstJointLimits) {
          let rootSegment = chain[1].sub(chain[0]);
          let rootDesiredWorldAngle = rootSegment.angle();
          let rootAngleRelToCenter = _shortDiff(rootSegment.angle(), limits.centerPoint);
          let centerDiff = rootAngleRelToCenter - rootDesiredWorldAngle;
          const halfSpan = (limits.upper - limits.lower) / 2;
          const constrainedRootAngleRelToCenter = Math.max(-halfSpan, Math.min(halfSpan, rootAngleRelToCenter));
          if (constrainedRootAngleRelToCenter !== rootAngleRelToCenter) {
            chain[1] = chain[0].add(new Vec2(1, 0).rotate(constrainedRootAngleRelToCenter - centerDiff).scale(segLens[0]));
          }
        } else if (i > 0) {
          const parentSegment = chain[i].sub(chain[i - 1]);
          const childSegmentDesired = chain[i + 1].sub(chain[i]);

          const parentAngle = parentSegment.angle();
          const childDesiredWorldAngle = childSegmentDesired.angle();
          let desiredRelAngle = _shortDiff(childDesiredWorldAngle, parentAngle);

          const clampedRelAngle = Math.max(limits.lower, Math.min(limits.upper, desiredRelAngle));

          if (clampedRelAngle !== desiredRelAngle) {
            const constrainedWorldAngle = parentAngle + clampedRelAngle;
            chain[i + 1] = chain[i].add(new Vec2(1, 0).rotate(constrainedWorldAngle).scale(segLens[i]));
          }
        }
      }
    };

    if (target.sub(base).length() > totalLen) {
      const dir = target.sub(base).normalize();
      for (let i = 1; i < chain.length; i++) {
        chain[i] = chain[i - 1].add(dir.scale(this.segLens[i - 1]));
        applyConstraintsToSegment(i - 1);
      }
      return chain;
    }

    const flipChain = (chain) => {
      chain = chain.map(p => vec2(p));
      const axis = target.sub(base).normalize();
      for (let i = 1; i < chain.length; i++) {
        const v = chain[i].sub(base);
        const proj = axis.scale(v.dot(axis));
        const perp = v.sub(proj);
        const flipped = proj.sub(perp);
        chain[i] = base.add(flipped);
      }
      return chain;
    };

    const getError = (chain) => {
      const effector = chain[chain.length - 1];
      const diff = effector.sub(target);
      return diff.length();
    };

    let normalChain = chain;
    let flippedChain = flipChain(chain);

    for (let tri_f of ["normal", "flipped"]) {
      chain = tri_f === "flipped" ? flippedChain : normalChain;
      for (let iter = 0; iter < maxIt; iter++) {
        const effector = chain[chain.length - 1];
        const diff = effector.sub(target);
        const err = diff.length();
        if (err < tol) break;

        chain[chain.length - 1] = target.clone();
        for (let i = chain.length - 2; i >= 0; i--) {
          const len = segLens[i];
          const dir = chain[i + 1].sub(chain[i]).normalize();
          chain[i] = chain[i + 1].sub(dir.scale(len));
          applyConstraintsToSegment(i);
        }

        chain[0] = base.clone();
        for (let i = 0; i < chain.length - 1; i++) {
          const len = segLens[i];
          const dir = chain[i + 1].sub(chain[i]).normalize();
          chain[i + 1] = chain[i].add(dir.scale(len));
          applyConstraintsToSegment(i);
        }
      }
    }

    return getError(normalChain) < getError(flippedChain) ? normalChain : flippedChain;
  }

  solve(target) {
    this.lastTarget = target;
    const pts = this._worldPts();
    const limbLimits = this.limbs.map(l => ({ lower: l.lowerLimitFromCenter, upper: l.upperLimitFromCenter, centerPoint: l.centerOffsetFromParent + l.parentLimb.body.rotation }));
    if (limbLimits[0].lower !== null && limbLimits[0].upper !== null) {
      limbLimits[0].centerPoint = Math.atan2(Math.sin(limbLimits[0].centerPoint), Math.cos(limbLimits[0].centerPoint));
      limbLimits[0].lower += limbLimits[0].centerPoint;
      limbLimits[0].upper += limbLimits[0].centerPoint;
    }
    const solved = this._runFabrik(pts.map(p => p.clone()), target, limbLimits);
    this.lastSolvedPts = solved;
    this.lastRelTargets = [];

    let lastDiff = 0;
    for (let i = 0; i < this.joints.length; i++) {
      const joint = this.joints[i];
      if (!joint) continue;

      const dir = solved[i + 1].sub(solved[i]);
      const desiredWorld = dir.angle();
      let relTarget = _shortDiff(desiredWorld, joint.bodyA.rotation + lastDiff);
      lastDiff = relTarget - (joint.bodyB.rotation - joint.bodyA.rotation);

      joint.setMotorTargetAngle(
        relTarget,
        this.maxForce,
        this.freq,
        this.dampingRatio,
        true
      );

      this.lastRelTargets.push(relTarget);
    }
  }

  clearDebugDraw() {
    this.lastSolvedPts = [];
    this.lastRelTargets = [];
  }
}

const elbowRestAngle = 0.3;

class StepController {
  constructor(rig) {
    this.legR = {
      chain: new IKChain(rig, ["r_thigh", "r_calf"]),
      knee: rig.limbs["r_calf"].parentJoint,
      hip: rig.limbs["r_thigh"].parentJoint,
      foot: rig.limbs["r_foot"],
      thigh: rig.limbs["r_thigh"],
      calf: rig.limbs["r_calf"],
      getAnklePos: () => vec2(rig.limbs["r_calf"].body.position).add(vec2(rig.limbs["r_calf"]._endOffset).rotated(rig.limbs["r_calf"].body.rotation)),
      defaultHipAngle: rig.limbs["r_thigh"].parentJoint.getRotation(),
      defaultKneeAngle: rig.limbs["r_calf"].parentJoint.getRotation() / 2,
      ankle: rig.limbs["r_foot"].parentJoint
    };
    this.legL = {
      chain: new IKChain(rig, ["l_thigh", "l_calf"]),
      knee: rig.limbs["l_calf"].parentJoint,
      hip: rig.limbs["l_thigh"].parentJoint,
      foot: rig.limbs["l_foot"],
      thigh: rig.limbs["l_thigh"],
      calf: rig.limbs["l_calf"],
      getAnklePos: () => vec2(rig.limbs["l_calf"].body.position).add(vec2(rig.limbs["l_calf"]._endOffset).rotated(rig.limbs["l_calf"].body.rotation)),
      defaultHipAngle: rig.limbs["l_thigh"].parentJoint.getRotation(),
      defaultKneeAngle: rig.limbs["l_calf"].parentJoint.getRotation() / 2,
      ankle: rig.limbs["l_foot"].parentJoint
    };

    this.armR = {
      chain: new IKChain(rig, ["r_bicep"]),
      shoulder: rig.limbs["r_bicep"].parentJoint,
      elbow: rig.limbs["r_fore"].parentJoint,
      hand: rig.limbs["r_hand"]
    };
    this.armL = {
      chain: new IKChain(rig, ["l_bicep"]),
      shoulder: rig.limbs["l_bicep"].parentJoint,
      elbow: rig.limbs["l_fore"].parentJoint,
      hand: rig.limbs["l_hand"]
    };

    this.stepLegStartX = 0;
    this.stepClearance = 0;
    this.stepStartTime = 0;
    this.steppingLeg = null;
    this.supportLeg = null;
    this.lastLegSwitchTime = 0;
    this.isSteppingForward = false;

    this.rig = rig;
    this.resetMotorTargetAnglesToCurrentAngles();
  }

  isGrounded(leg) {
    return leg.foot.isColliding();
  }

  resetMotorTargetAnglesToCurrentAngles() {
    this.rig.limbs["r_fore"].parentJoint.setMotorTargetAngle(elbowRestAngle, 10, 5, 5, false);
    this.rig.limbs["l_fore"].parentJoint.setMotorTargetAngle(elbowRestAngle, 10, 5, 5, false);

    this.legR.hip.setMotorTargetAngle(this.legR.hip.getRotation(), 25, 20, 5, false);
    this.legL.hip.setMotorTargetAngle(this.legL.hip.getRotation(), 25, 20, 5, false);
    this.legR.knee.setMotorTargetAngle(this.legR.knee.getRotation(), 25, 20, 5, false);
    this.legL.knee.setMotorTargetAngle(this.legL.knee.getRotation(), 25, 20, 5, false);

    this.armR.shoulder.setMotorTargetAngle(this.armR.shoulder.getRotation(), 25, 20, 5, false);
    this.armL.shoulder.setMotorTargetAngle(this.armL.shoulder.getRotation(), 25, 20, 5, false);
  }

  feetOnSameSide(comX) {
    const lx = this.legL.getAnklePos().x;
    const rx = this.legR.getAnklePos().x;
    return (lx < comX && rx < comX) || (lx > comX && rx > comX);
  }

  flipAcrossCOM(pos, com, scale = 1) {
    return vec2(pos).sub(com).scale(vec2(-1 * scale, 1)).add(com);
  }

  update(dt) {
    const com = this.rig.getCenterOfMass();
    const onGroundR = this.isGrounded(this.legR);
    const onGroundL = this.isGrounded(this.legL);

    let l_dist_from_com = Math.abs(this.legL.getAnklePos().x - com.x);
    let r_dist_from_com = Math.abs(this.legR.getAnklePos().x - com.x);

    let stepping_leg;
    if (onGroundR === onGroundL) {
      stepping_leg = l_dist_from_com > r_dist_from_com && Math.abs(l_dist_from_com - r_dist_from_com) > 0.01 ? this.legL : this.legR;
    } else {
      stepping_leg = onGroundR ? this.legL : this.legR;
    }

    if (Date.now() - this.lastLegSwitchTime < 200) {
      stepping_leg = this.steppingLeg;
    }

    let support_leg = stepping_leg === this.legR ? this.legL : this.legR;

    let support_leg_arm = support_leg === this.legR ? this.armL : this.armR;
    let stepping_leg_arm = stepping_leg === this.legR ? this.armL : this.armR;

    let step_target = this.flipAcrossCOM(support_leg.getAnklePos(), com);

    if (stepping_leg !== this.steppingLeg) {
      this.steppingLeg = stepping_leg;
      this.supportLeg = support_leg;
      this.stepLegStartX = stepping_leg.getAnklePos().x;
      this.stepClearance = ez.lerpClamp(0.1, 1.0, Math.abs(step_target.x - this.stepLegStartX) / 2.0);
      this.stepStartTime = Date.now();
      this.lastLegSwitchTime = Date.now();
      this.isSteppingForward = step_target.x > this.stepLegStartX;
    }

    if (this.isSteppingForward) {
      step_target = this.flipAcrossCOM(support_leg.getAnklePos(), com, 0.7);
    } else {
      step_target = this.flipAcrossCOM(support_leg.getAnklePos(), com, 1.05);
    }

    const lift_foot_for_clearance = 0.4 * Math.min(1, Math.abs((step_target.x - stepping_leg.getAnklePos().x)) / 1.0);
    step_target.y += lift_foot_for_clearance;

    const curX = stepping_leg.getAnklePos().x;
    const dstX = step_target.x;
    const span = Math.abs(dstX - this.stepLegStartX) || 1e-6;

    stepping_leg.chain.solve(step_target);

    support_leg.knee.setMotorTargetAngle(support_leg.defaultKneeAngle, 15, 5, 2, false);

    let bodyAngleFromUp = _shortDiff(Math.PI / 2, this.rig.limbs["pelvis"].body.rotation);
    support_leg.hip.setMotorTargetAngle(support_leg.hip.getRotation() - bodyAngleFromUp, 15, 8, 4, false);

    let arm_target_y = this.rig.limbs["pelvis"].body.position.y - 0.5;
    support_leg_arm.chain.solve(vec2(support_leg.getAnklePos().x, arm_target_y));
    stepping_leg_arm.chain.solve(vec2(stepping_leg.getAnklePos().x, arm_target_y));

    const bicepLength = 0.95;
    const forearmLength = 1.05;
    let angleOffset = Math.abs(vec2(bicepLength, 0).add(vec2(forearmLength, 0).rotated(elbowRestAngle)).angle());
    this.armR.shoulder.motorTargetAngle -= angleOffset;
    this.armL.shoulder.motorTargetAngle -= angleOffset;

    this.legR.ankle.setMotorTargetAngle(-this.legR.calf.body.rotation - 0.042, 2, 12, 2, true);
    this.legL.ankle.setMotorTargetAngle(-this.legL.calf.body.rotation - 0.042, 2, 12, 2, true);

    support_leg.chain.clearDebugDraw();
  }
}

function spawnSelfBalancingRagdoll(world, baseX = 0, baseY = 0) {
  const rig = new Rig(world);

  const pelvis = rig.addLimb("pelvis", "capsule", { x: baseX, y: baseY + 1.46, length: 0.55, radiusA: 0.30, radiusB: 0.30, isStatic: false, rotation: Math.PI / 2, zIndex: 2 }).limb;

  const mid = rig.addLimb("mid", "capsule", { length: 0.55, radiusA: 0.30, radiusB: 0.30, isStatic: false, rotation: Math.PI / 2, zIndex: 2 }, "pelvis", { limit: Math.PI / 6 }).limb;
  mid.parentJoint.setMotorTargetAngle(0, 200, 100, 15, true);

  const chest = rig.addLimb("chest", "capsule", { length: 0.65, radiusA: 0.3, radiusB: 0.3, isStatic: false, rotation: Math.PI / 2, zIndex: 2 }, "mid", { limit: Math.PI / 6 }).limb;
  chest.parentJoint.setMotorTargetAngle(0, 200, 100, 15, true);

  const neck = rig.addLimb("neck", "capsule", { length: 0.68, radiusA: 0.18, radiusB: 0.18, rotation: Math.PI / 2, zIndex: 1 }, "chest", { limit: 0 }).limb;
  rig.addLimb("head", "circle", { radius: 0.4, zIndex: 2 }, "neck", { limit: 0, center: -Math.PI / 2 });

  const armLim = Math.PI * 1.4;
  const elbowLim = Math.PI * 0.8;
  rig.addLimb("r_bicep", "capsule", { length: 0.95, radiusA: 0.22, radiusB: 0.18, zIndex: 4, rotation: Math.PI * 1.3 }, "chest", {});
  rig.addLimb("r_fore", "capsule", { length: 1.05, radiusA: 0.18, radiusB: 0.14, zIndex: 4 }, "r_bicep", { limit: elbowLim, center: elbowLim / 2 });
  rig.addLimb("r_hand", "circle", { radius: 0.21, zIndex: 4 }, "r_fore", { limit: 0 });
  rig.addLimb("l_bicep", "capsule", { length: 0.95, radiusA: 0.22, radiusB: 0.18, zIndex: 0, rotation: Math.PI * 1.7 }, "chest", {});
  rig.addLimb("l_fore", "capsule", { length: 1.05, radiusA: 0.18, radiusB: 0.14, zIndex: 0 }, "l_bicep", { limit: elbowLim, center: elbowLim / 2 });
  rig.addLimb("l_hand", "circle", { radius: 0.21, zIndex: 0 }, "l_fore", { limit: 0 });

  const hipR = Math.PI * 0.75;
  const kneeR = Math.PI * 0.8;
  const ankR = Math.PI * 0.65;
  rig.addLimb("r_thigh", "capsule", { length: 1.45, radiusA: 0.3, radiusB: 0.22, zIndex: 3, rotation: Math.PI * 1.6 }, "pelvis", { anchorA: "start", anchorB: "start", limit: hipR, center: Math.PI });
  rig.addLimb("r_calf", "capsule", { length: 1.45, radiusA: 0.22, radiusB: 0.16, zIndex: 3, rotation: Math.PI * 1.5 }, "r_thigh", { limit: kneeR, center: -Math.PI / 2 + Math.PI * 0.1 });
  rig.addLimb("r_foot", "capsule", { length: 0.70, radiusA: 0.14, radiusB: 0.10, zIndex: 3, offsetX: 0.05, offsetY: -0.05 }, "r_calf", { limit: ankR, center: Math.PI / 2 });
  rig.limbs["r_foot"].parentJoint.setMotorTargetAngle(Math.PI * 0.5, 20, 10, 5, true);

  rig.addLimb("l_thigh", "capsule", { length: 1.45, radiusA: 0.3, radiusB: 0.22, zIndex: 1, rotation: Math.PI * 1.4 }, "pelvis", { anchorA: "start", anchorB: "start", limit: hipR, center: Math.PI });
  rig.addLimb("l_calf", "capsule", { length: 1.45, radiusA: 0.22, radiusB: 0.16, zIndex: 1, rotation: Math.PI * 1.3 }, "l_thigh", { limit: kneeR, center: -Math.PI / 2 + Math.PI * 0.1 });
  rig.addLimb("l_foot", "capsule", { length: 0.70, radiusA: 0.14, radiusB: 0.10, zIndex: 1, offsetX: 0.05, offsetY: -0.05 }, "l_calf", { limit: ankR, center: Math.PI / 2 });
  rig.limbs["l_foot"].parentJoint.setMotorTargetAngle(Math.PI * 0.5, 20, 10, 5, true);

  const stepper = new StepController(rig);
  const fixedDt = 1 / 240;
  const maxSubsteps = 32;

  return {
    rig,
    update: dt => stepper.update(dt),
    fixedDt,
    maxSubsteps
  };
}

if (typeof window !== "undefined") {
  window.spawnSelfBalancingRagdoll = spawnSelfBalancingRagdoll;
}