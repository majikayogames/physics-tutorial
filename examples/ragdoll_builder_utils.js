// ──────────────────────────────────────────────────────────────
// Reset Function
// ──────────────────────────────────────────────────────────────
function resetSimulation() {
  // Clear physics world
  world.objects = [];
  world.constraints = [];

  // Clear saved state
  localStorage.removeItem('ragdollState');

  // Re-run setup
  setupScene();

  console.log("Simulation reset.");
}


// ──────────────────────────────────────────────────────────────
// Save/Load State
// ──────────────────────────────────────────────────────────────
function saveRagdollState(rig) {
  const state = {};
  for (const name in rig.limbs) {
    const limb = rig.limbs[name];
    state[name] = {
      position: [limb.body.position[0], limb.body.position[1]],
      rotation: limb.body.rotation,
      // Optional: Save velocity too if needed for more precise restoration
      velocity: [limb.body.velocity[0], limb.body.velocity[1]],
      angularVelocity: limb.body.angularVelocity,
      isStatic: limb.body.isStatic
    };
  }
  // Add pause state
  state.paused = physPaused;
  // Add GUI state
  state.showDebug = guiControls["Show debug"];
  state.timeScale = guiControls["Time scale"];

  localStorage.setItem('ragdollState', JSON.stringify(state));
}

function loadRagdollState(rig) {
  const savedStateJSON = localStorage.getItem('ragdollState');
  if (!savedStateJSON) {
    console.log("No saved ragdoll state found.");
    return;
  }

  try {
    const savedState = JSON.parse(savedStateJSON);
    for (const name in savedState) {
      if (rig.limbs[name]) {
        const limb = rig.limbs[name];
        const state = savedState[name];
        limb.body.position = vec2(state.position[0], state.position[1]);
        limb.body.rotation = state.rotation;

        // Optional: Restore velocity
        if (state.velocity) {
          limb.body.velocity = vec2(state.velocity[0], state.velocity[1]);
        }
        if (state.angularVelocity !== undefined) {
          limb.body.angularVelocity = state.angularVelocity;
        }
        // Restore static state
        if (state.isStatic !== undefined) {
          limb.body.isStatic = state.isStatic;
        }
        // Important: Reset forces/impulses after loading position/velocity
        limb.body.force = vec2(0, 0);
        limb.body.torque = 0;
      } else {
        console.warn(`Saved state found for limb "${name}", but it doesn't exist in the current rig.`);
      }
    }
    // Load the pause state
    if (savedState.paused !== undefined) {
      physPaused = savedState.paused;
      // Update GUI checkbox state if needed (assuming ez.gui updates reflect variable changes)
      // guiControls["Pause simulation [Space]"] = physPaused; // This might not be the correct way depending on ez.gui
      // You might need to directly interact with the GUI element or trigger an update if the library requires it.
      console.log("Pause state loaded:", physPaused);
    } else {
      physPaused = false; // Default if not found in saved state
    }

    // Load GUI state
    if (savedState.showDebug !== undefined) {
      guiControls["Show debug"] = savedState.showDebug;
      console.log("Show debug state loaded:", guiControls["Show debug"]);
    } else {
      guiControls["Show debug"] = true; // Default if not found
    }
    if (savedState.timeScale !== undefined) {
      guiControls["Time scale"] = savedState.timeScale;
      console.log("Time scale state loaded:", guiControls["Time scale"]);
    } else {
      guiControls["Time scale"] = 1; // Default if not found
    }

    console.log("Ragdoll state loaded.");
  } catch (e) {
    console.error("Error loading ragdoll state:", e);
    // Optionally clear the bad state
    // localStorage.removeItem('ragdollState');
  }
}