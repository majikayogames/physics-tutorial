// 2nd generation, Option 1


class StepController {
  constructor(rig) {
    // --------------- legs ---------------
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

    this.legR.chain._drawTargetDebug = true;
    this.legL.chain._drawTargetDebug = true;
    // --------------- arms ---------------
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
    this.steppingLeg = null;
    this.supportLeg = null;
    this.lastLegSwitchTime = 0;
    this.isSteppingForward = false;

    // --- Hysteresis parameters (Option 3) ---
    this.hysteresisDist = 0.12;      // min COM–foot Δ to begin considering a switch (m)
    this.hysteresisTime = 120;        // how long that Δ must persist (ms)
    this.pendingLegCandidate = null;  // leg currently being considered
    this.candidateStartTime = 0;

    // --- Finish-the-Swing gate parameters (Option 1) ---
    this.finishProgress = 0.9;        // required % of horizontal travel
    this.maxSwingTime   = 600;        // timeout to avoid being stuck (ms)
    this.stepTargetX    = 0;          // cached X-target for current swing

    this.resetMotorTargetAnglesToCurrentAngles();

    this.rig = rig;
  }

  /* --------------------------------------------------------- */
  isGrounded(leg) {
    return leg.foot.isColliding();
  }

  resetMotorTargetAnglesToCurrentAngles() {
    rig.limbs["r_fore"].parentJoint.setMotorTargetAngle(elbowRestAngle, 10, 5, 5, false);
    rig.limbs["l_fore"].parentJoint.setMotorTargetAngle(elbowRestAngle, 10, 5, 5, false);

    // Init all to neutral
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
    return (lx < comX && rx < comX) ||
      (lx > comX && rx > comX);
  }

  flipAcrossCOM(pos, com, scale = 1) {
    return vec2(pos).sub(com).scale(vec2(-1*scale, 1)).add(com);
  }

  /* --------------------------------------------------------- */
  update(dt) {
    const now = Date.now();
    const com = this.rig.getCenterOfMass();
    const onGroundR = this.isGrounded(this.legR);
    const onGroundL = this.isGrounded(this.legL);

    // --------------------------------------------------
    // 1)  Finish-the-Swing gate         (Option 1 core)
    // --------------------------------------------------
    let swingIncomplete = false;
    if (this.steppingLeg) {
      const curX  = this.steppingLeg.getAnklePos().x;
      const span  = Math.abs((this.stepTargetX || this.stepLegStartX) - this.stepLegStartX) || 1e-6;
      const prog  = Math.abs(curX - this.stepLegStartX) / span;  // 0 … 1

      swingIncomplete = !this.isGrounded(this.steppingLeg) &&
                 prog < this.finishProgress &&
                 (now - this.stepStartTime) < this.maxSwingTime;
    }

    // Default to current stepping leg (may be null)
    let stepping_leg = this.steppingLeg;

    // --------------------------------------------------
    // 2)  Hysteresis-based selection if swing finished
    // --------------------------------------------------
    if (!swingIncomplete) {
      let lDist = Math.abs(this.legL.getAnklePos().x - com.x);
      let rDist = Math.abs(this.legR.getAnklePos().x - com.x);

      if (onGroundR === onGroundL) {
        const distDiff = lDist - rDist; // +ve => left further
        if (Math.abs(distDiff) > this.hysteresisDist) {
          const candidate = distDiff > 0 ? this.legL : this.legR;
          if (candidate !== this.steppingLeg) {
            if (candidate !== this.pendingLegCandidate) {
              this.pendingLegCandidate = candidate;
              this.candidateStartTime = now;
            }
            if (now - this.candidateStartTime >= this.hysteresisTime) {
              stepping_leg = candidate;
            }
          } else {
            this.pendingLegCandidate = null;
          }
        } else {
          this.pendingLegCandidate = null;
        }
      } else {
        // One foot on ground, one in air — immediately choose the airborne leg
        stepping_leg = onGroundR ? this.legL : this.legR;
        this.pendingLegCandidate = null;
      }

      // Rapid-switch suppression
      if (now - this.lastLegSwitchTime < 200) {
        stepping_leg = this.steppingLeg;
      }

      if (!stepping_leg) {
        stepping_leg = lDist > rDist ? this.legL : this.legR;
      }
    }

    // --------------------------------------------------
    // 3)  Proceed with motion commands (unchanged below)
    // --------------------------------------------------
    let support_leg = stepping_leg === this.legR ? this.legL : this.legR;

    let support_leg_arm = support_leg === this.legR ? this.armL : this.armR;
    let stepping_leg_arm = stepping_leg === this.legR ? this.armL : this.armR;

    let step_target = this.flipAcrossCOM(support_leg.getAnklePos(), com);

    let stepJustChanged = false;
    if (stepping_leg !== this.steppingLeg) {
      stepJustChanged = true;
      this.steppingLeg = stepping_leg;
      this.supportLeg = support_leg;
      this.stepLegStartX = stepping_leg.getAnklePos().x;
      this.stepClearance = ez.lerpClamp(0.1, 1.0, Math.abs(step_target.x - this.stepLegStartX) / 2.0);
      this.stepStartTime = now;
      this.lastLegSwitchTime = now;
      this.isSteppingForward = step_target.x > this.stepLegStartX;
    }

    if (this.isSteppingForward) {
      step_target = this.flipAcrossCOM(support_leg.getAnklePos(), com, 0.7);
    } else {
      step_target = this.flipAcrossCOM(support_leg.getAnklePos(), com, 1.05);
    }

    if (stepJustChanged) {
      this.stepTargetX = step_target.x;
    }

    // Foot clearance
    const lift = 0.4 * Math.min(1, Math.abs(step_target.x - stepping_leg.getAnklePos().x) / 1.0);
    step_target.y += lift;

    stepping_leg.chain.solve(step_target);

    // -------------------------
    // Support leg placement attempts
    // -------------------------
    // I think just setting the knee to the default angle makes sense
    support_leg.knee.setMotorTargetAngle(support_leg.defaultKneeAngle, 15, 8, 2, false);

    // Idea: just rotate the supprot leg hip to the default angle. Didn't work that well.
    //support_leg.hip.setMotorTargetAngle(support_leg.defaultHipAngle, 15, 8, 2, false);

    // Idea: Make the support leg hip rotate to the opposite of the stepping leg hip. Didn't seem to work well.
    //support_leg.hip.setMotorTargetAngle(_shortDiff(stepping_leg.hip.motorTargetAngle, Math.PI) * -1 + Math.PI, 12, 4, 2, false);

    // Idea: rotate the support leg hip, to rotate the BODY upright. Calculate the angle of the body, and set the support leg hip to the opposite.
    // This works pretty well. Might be it.
    let bodyAngleFromUp = _shortDiff(Math.PI / 2, this.rig.limbs["pelvis"].body.rotation);
    support_leg.hip.setMotorTargetAngle(support_leg.hip.getRotation() - bodyAngleFromUp, 15, 8, 4, false);
    // -------------------------

    // Move arms to match legs. Right arm follows left leg, left arm follows right leg
    let arm_target_y = this.rig.limbs["pelvis"].body.position.y - 0.5;
    // Idea: Target foot position X of opposite leg
    support_leg_arm.chain.solve(vec2(support_leg.getAnklePos().x, arm_target_y));
    stepping_leg_arm.chain.solve(vec2(stepping_leg.getAnklePos().x, arm_target_y));
    //support_leg_arm.chain.solve(vec2(support_leg.foot.body.position[0], arm_target_y));
    //stepping_leg_arm.chain.solve(vec2(stepping_leg.foot.body.position[0], arm_target_y));
    
    // Idea: Flip opposite leg X position across COM
    //support_leg_arm.chain.solve([this.flipAcrossCOM(support_leg.getAnklePos(), com)[0], arm_target_y]);
    //stepping_leg_arm.chain.solve([this.flipAcrossCOM(step_target, com)[0], arm_target_y]); // Use step target
    //support_leg_arm.chain.solve([this.flipAcrossCOM(support_leg.getAnklePos(), com)[0], arm_target_y]);

    // Idea: IK to step target, predictive. Seems to be a little less stable.
    //support_leg_arm.chain.solve(vec2(support_leg.foot.body.position[0], arm_target_y));
    //stepping_leg_arm.chain.solve(vec2(step_target[0], arm_target_y));

    // Just doing IK on shoulder to simplify, adjust angle IK'd to to match the elbow offset angle
    const bicepLength = 0.95;
    const forearmLength = 1.05;
    let angleOffset = Math.abs(vec2(bicepLength, 0).add(vec2(forearmLength, 0).rotated(elbowRestAngle)).angle());
    this.armR.shoulder.motorTargetAngle -= angleOffset;
    this.armL.shoulder.motorTargetAngle -= angleOffset;

    // Set feet target angle so they are parallel to the ground
    this.legR.ankle.setMotorTargetAngle(-this.legR.calf.body.rotation, 15, 12, 5, true);
    this.legL.ankle.setMotorTargetAngle(-this.legL.calf.body.rotation, 15, 12, 5, true);

    support_leg.chain.clearDebugDraw();
  }

  /* --------------------------------------------------------- */
  drawDebug() {
    this.legR.chain.drawDebug(ez.ctx, "maroon");
    this.legL.chain.drawDebug(ez.ctx);
    this.armR.chain.drawDebug();
    this.armL.chain.drawDebug();

    ez.circle(vec2(this.legR.getAnklePos()), 0.06).fill("aliceblue");
    ez.circle(vec2(this.legL.getAnklePos()), 0.06).fill("aliceblue");
  }
}