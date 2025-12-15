// Physics Renderer using EZDraw

const PhysRenderer = {
	// Color management
	colors: {
		staticBody: "#C4D7E0",     // Soft pastel blue-gray
		outline: "#2F3437",        // Dark gray outline
		selected: "#FF9E9E",       // Soft red
		constraint: "#4A5559",     // Dark gray for constraints
		constraintPoint: "#2F3437", // Slightly darker for constraint points
		clockwisePolygon: "#FF0000" // Red for clockwise polygons
	},

	// Store assigned colors for dynamic bodies
	_objectColors: new WeakMap(),

	// Counter for deterministic color assignment
	_objectCounter: 0,

	// Pastel color palette for dynamic bodies
	_palette: [
		"#FFB3BA", // pink
		"#BAFFC9", // mint
		"#BAE1FF", // light blue
		"#FFFFBA", // light yellow
		"#FFB5E8", // pastel pink
		"#B5FFCE", // pastel green
		"#B5B9FF", // pastel blue
		"#F3FFB5", // pastel yellow
		"#FFC9DE", // rose
		"#C9FFF7", // aqua
		"#C5A3FF", // lavender
		"#FFE5A3"  // peach
	],

	// Add to existing properties
	_mouseConstraint: null,
	_mouseObject: null,
	_mousePos: null,

	_renderConstraints: true,

	// Pinch zoom properties
	_pinchState: null,
	_activeTouchId: null, // Track which touch is being used for dragging
	_isMouseDown: false, // Track if mouse is currently down
	_isTouchDown: false, // Track if touch is currently down

	_getCanvasPosFromTouch(touch) {
		const rect = ez.canvas.getBoundingClientRect();
		const scaleX = ez.canvas.width / rect.width;
		const scaleY = ez.canvas.height / rect.height;
		return vec2(
			(touch.clientX - rect.left) * scaleX,
			(touch.clientY - rect.top) * scaleY
		);
	},

	_screenToCameraSpace(screenPos) {
		let x = screenPos.x;
		let y = screenPos.y;
		if (ez.centerOrigin || ez.centerOriginX) {
			x -= ez.canvas.width / 2;
		}
		if (ez.centerOrigin || ez.centerOriginY) {
			y -= ez.canvas.height / 2;
		}
		return vec2(x, y);
	},

	_initPinchFromTouches(touches) {
		if (!touches || touches.length < 2) {
			this._pinchState = null;
			return false;
		}

		const trackedTouches = Array.from(touches)
			.slice(0, 2)
			.map((touch) => {
				const screenPos = this._getCanvasPosFromTouch(touch);
				const worldPos = ez.screenToWorld(screenPos);
				return {
					id: touch.identifier,
					screenStart: screenPos,
					world: new Vec2(worldPos.x, worldPos.y),
				};
			});

		if (trackedTouches.length < 2) {
			this._pinchState = null;
			return false;
		}

		const dx = trackedTouches[1].screenStart.x - trackedTouches[0].screenStart.x;
		const dy = trackedTouches[1].screenStart.y - trackedTouches[0].screenStart.y;
		const startDistance = Math.hypot(dx, dy) || 1;

		this._pinchState = {
			startCamera: {
				scaleX: ez.camera.matrix.col1.x,
				scaleY: ez.camera.matrix.col2.y,
				posX: ez.camera.matrix.col4.x,
				posY: ez.camera.matrix.col4.y,
			},
			touches: trackedTouches,
			startDistance,
		};

		return true;
	},

	// Function to detect if polygon vertices are wound clockwise
	_isClockwiseWinding(vertices) {
		if (vertices.length < 3) return false;

		// Calculate signed area using the shoelace formula
		let signedArea = 0;
		for (let i = 0; i < vertices.length; i++) {
			const j = (i + 1) % vertices.length;
			signedArea += (vertices[j].x - vertices[i].x) * (vertices[j].y + vertices[i].y);
		}

		// If signed area is positive, vertices are clockwise
		// If negative, vertices are counter-clockwise
		return signedArea > 0;
	},

	// Get or assign a color for an object
	_getObjectColor(obj) {
		if (obj.isStatic) {
			return obj._renderColorHint ?? this.colors.staticBody;
		}

		// Check if any of the object's shapes are clockwise polygons
		if (obj.shapes && Array.isArray(obj.shapes)) {
			for (const shape of obj.shapes) {
				if (shape instanceof ConvexPolygonShape) {
					const vertices = shape.vertices;
					if (this._isClockwiseWinding(vertices)) {
						return this.colors.clockwisePolygon;
					}
				}
			}
		}

		let color = this._objectColors.get(obj);
		if (!color) {
			const hash = Math.abs(Math.floor(
				(obj.position.x * 1000) +
				(obj.position.y * 2000) +
				this._objectCounter++
			));
			color = this._palette[hash % this._palette.length];
			this._objectColors.set(obj, color);
		}
		return color;
	},

	// Reset the renderer state
	reset() {
		this._objectCounter = 0;
		this._objectColors = new WeakMap();
	},

	// Initialize mouse controls
	initMouseControls(world) {
		this.world = world;

		ez.onMouseMove(() => {
			const mouseWorld = ez.getMousePosWorld();
			this._mousePos = new Vec2(mouseWorld.x, mouseWorld.y);
		});

		ez.onMouseDown(() => {
			this._isMouseDown = true;
			const hoveredObject = this._findHoveredObject();
			if (hoveredObject) {
				this._grabObject(hoveredObject);
			}
		});

		ez.onMouseUp(() => {
			this._isMouseDown = false;
			this._releaseObject();
		});

		// Touch event support for mobile
		ez.canvas.addEventListener("touchstart", (e) => {
			e.preventDefault();

			// If second finger added, release any grabbed object and start pinch zoom
			if (e.touches.length >= 2) {
				this._isTouchDown = false;
				this._releaseObject(); // Release any grabbed object
				this._activeTouchId = null; // Clear active touch
				this._initPinchFromTouches(e.touches);
				return;
			}

			// Handle single touch for dragging objects (only if no active touch)
			if (e.touches.length === 1 && this._activeTouchId === null) {
				this._pinchState = null;
				const touch = e.touches[0];
				const canvasPos = this._getCanvasPosFromTouch(touch);
				const worldPos = ez.screenToWorld(canvasPos);
				this._mousePos = new Vec2(worldPos.x, worldPos.y);

				const hoveredObject = this._findHoveredObject();
				if (!hoveredObject) {
					this._isTouchDown = false;
					this._releaseObject();
					return;
				}

				this._isTouchDown = true;
				this._activeTouchId = touch.identifier; // Track this touch
				this._grabObject(hoveredObject);
			}
		}, { passive: false });

		ez.canvas.addEventListener("touchmove", (e) => {
			e.preventDefault();

			// Handle pinch zoom (two fingers)
			if (this._pinchState) {
				const pinch = this._pinchState;
				const touchMap = new Map(Array.from(e.touches, (t) => [t.identifier, t]));
				const tracked = pinch.touches
					.map((info) => {
						const touch = touchMap.get(info.id);
						return touch ? { info, touch } : null;
					})
					.filter(Boolean);

				if (tracked.length === pinch.touches.length) {
					const firstPos = this._getCanvasPosFromTouch(tracked[0].touch);
					const secondPos = this._getCanvasPosFromTouch(tracked[1].touch);
					const dx = secondPos.x - firstPos.x;
					const dy = secondPos.y - firstPos.y;
					const currentDistance = Math.hypot(dx, dy) || 1;
					const scaleFactor = Math.max(currentDistance / pinch.startDistance, 1e-4);

					const newScaleX = pinch.startCamera.scaleX / scaleFactor;
					const newScaleY = pinch.startCamera.scaleY / scaleFactor;

					const screen0 = this._screenToCameraSpace(firstPos);
					const screen1 = this._screenToCameraSpace(secondPos);
					const world0 = tracked[0].info.world;
					const world1 = tracked[1].info.world;

					const camPosCandidate0 = {
						x: world0.x - screen0.x * newScaleX,
						y: world0.y - screen0.y * newScaleY,
					};
					const camPosCandidate1 = {
						x: world1.x - screen1.x * newScaleX,
						y: world1.y - screen1.y * newScaleY,
					};

					const newPosX = (camPosCandidate0.x + camPosCandidate1.x) / 2;
					const newPosY = (camPosCandidate0.y + camPosCandidate1.y) / 2;

					// Update camera matrix
					ez.camera.matrix.col1.x = newScaleX;
					ez.camera.matrix.col2.y = newScaleY;
					ez.camera.matrix.col4.x = newPosX;
					ez.camera.matrix.col4.y = newPosY;
					return;
				} else if (e.touches.length >= 2) {
					if (this._initPinchFromTouches(e.touches)) {
						return;
					}
				} else {
					this._pinchState = null;
				}
			}

			// Handle single touch for dragging objects
			// Only update if the active touch is moving
			if (this._mouseConstraint && this._activeTouchId !== null) {
				// Find the touch that matches our active touch ID
				const activeTouch = Array.from(e.touches).find(t => t.identifier === this._activeTouchId);
				if (activeTouch) {
					const canvasPos = this._getCanvasPosFromTouch(activeTouch);
					const worldPos = ez.screenToWorld(canvasPos);
					this._mousePos = new Vec2(worldPos.x, worldPos.y);
				}
			}
		}, { passive: false });

		ez.canvas.addEventListener("touchend", (e) => {
			e.preventDefault();

			// Check if our active touch ended
			if (this._activeTouchId !== null) {
				const activeTouchStillPresent = Array.from(e.touches).some(t => t.identifier === this._activeTouchId);
				if (!activeTouchStillPresent) {
					this._isTouchDown = false;
					this._releaseObject();
					this._activeTouchId = null;
				}
			}

			// If no touches remain, ensure everything is released
			if (e.touches.length === 0) {
				this._isTouchDown = false;
				this._releaseObject();
				this._activeTouchId = null;
			}

			// Reset pinch zoom state if less than 2 touches remain
			if (e.touches.length < 2) {
				this._pinchState = null;
			}
		}, { passive: false });

		ez.canvas.addEventListener("touchcancel", (e) => {
			e.preventDefault();
			this._isTouchDown = false;
			this._pinchState = null;
			this._activeTouchId = null;
			this._releaseObject();
		}, { passive: false });

		// Add this event listener for window blur
		window.addEventListener("blur", () => {
			this._isMouseDown = false;
			this._isTouchDown = false;
			this._pinchState = null;
			this._activeTouchId = null;
			this._releaseObject();
		});
	},

	// Find the topmost non-static object under the mouse, respecting z-index
	_findHoveredObject() {
		if (!this._mousePos || !this.world) return null;
		// Iterate through sorted objects (highest z-index first)
		return this.getSortedObjects(this.world).toReversed().find(obj =>
			!obj._renderHidden && !obj.isStatic && obj.containsPoint(this._mousePos)
		);
	},

	_grabObject(obj) {
		this._mouseObject = obj;

		// Create a static anchor point at mouse position
		const mouseAnchor = new PhysObject(
			this._mousePos.x,
			this._mousePos.y,
			[], // No shapes
			true       // Static
		);

		// Create distance constraint between mouse and object
		this._mouseConstraint = this.world.addRevoluteConstraint(
			mouseAnchor,
			obj,
			this._mousePos
		);
		this._mouseConstraint._isMouseGrabConstraint = true;
		this._mouseConstraint.constraintSettings = {
			mode: 'baumgarte',
			baumgarteFactor: 0.25,
			warmStarting: true,
		};
	},

	_removeStaleMouseConstraints(preserveActive = true) {
		if (!this.world || !Array.isArray(this.world.constraints)) return;
		const activeConstraint = preserveActive ? this._mouseConstraint : null;
		this.world.constraints = this.world.constraints.filter((constraint) => {
			if (!constraint?._isMouseGrabConstraint) {
				return true;
			}
			return constraint === activeConstraint;
		});
	},

	_releaseObject() {
		this._removeStaleMouseConstraints(false);
		this._mouseConstraint = null;
		this._mouseObject = null;
	},

	// Update mouse anchor position in render loop
	update() {
		this._removeStaleMouseConstraints(true);
		// Safety check: if constraint exists but no input is active, release it
		if (this._mouseConstraint && !this._isMouseDown && !this._isTouchDown) {
			this._releaseObject();
			return;
		}

		if (this._mouseConstraint) {
			const mouseWorld = ez.getMousePosWorld();
			this._mousePos = new Vec2(mouseWorld.x, mouseWorld.y);

			// Update the mouse anchor position
			this._mouseConstraint.bodyA.position = this._mousePos;
		}
	},

	// New function to get objects sorted by z-index
	getSortedObjects(world) {
		if (!world || !world.objects) return [];
		return [...world.objects].sort((a, b) => {
			const zIndexA = a._renderZIndex ?? 0;
			const zIndexB = b._renderZIndex ?? 0;
			return zIndexA - zIndexB;
		});
	},

	// Render function
	render(world) {
		if (!world || !world.objects) return;
		ez.fast2DModeWithNoCameraRotation = true

		ez.save();

		// Update mouse interaction before rendering
		this.update();

		// Get objects sorted by z-index
		const sortedObjects = this.getSortedObjects(world);

		// First render all object shadows based on sorted order
		for (const obj of sortedObjects) {
			if (obj._renderHidden) continue;
			this.renderObjectShadow(obj);
		}

		// Then render all objects based on sorted order
		for (const obj of sortedObjects) {
			if (obj._renderHidden) continue;
			this.renderObject(obj);
		}

		// Finally render all constraints (so they appear on top of objects)
		if (this._renderConstraints && world.constraints) {
			for (const constraint of world.constraints) {
				this.renderConstraint(constraint);
			}
		}

		ez.restore();
	},

	// Internal function to build or update the cached shapes for an object
	_buildOrUpdateObjectShapes(obj) {
		const rotation = obj.rotation;
		const cos = Math.cos(rotation);
		const sin = Math.sin(rotation);
		let posX = obj.position.x;
		let posY = obj.position.y;

		// Initialize shape cache as array if it doesn't exist
		if (!obj.ezdrawShapeCache) {
			obj.ezdrawShapeCache = [];
		}

		let shapes = obj.ezdrawShapeCache;

		// Handle special hint cases (these create single shapes)
		if (obj._boxHints) {
			if (shapes.length === 0) {
				const { width, height } = obj._boxHints;
				shapes.push(ez.rect([0, 0], [width, height], 0));
			}
		} else if (obj._capsuleHints) {
			if (shapes.length === 0) {
				const { length, r1, r2, offset } = obj._capsuleHints;
				shapes.push(ez.capsule(vec2(0, 0), 0, length, r1, r2));
			}
			// Handle capsule offset calculation
			const { offset } = obj._capsuleHints;
			const localXOffset = -offset;
			const worldOffsetX = localXOffset * cos;
			const worldOffsetY = localXOffset * sin;
			posX += worldOffsetX;
			posY += worldOffsetY;
		} else if (obj.shapes && Array.isArray(obj.shapes)) {
			// Ensure we have the right number of cached shapes
			while (shapes.length < obj.shapes.length) {
				shapes.push(null);
			}
			while (shapes.length > obj.shapes.length) {
				shapes.pop();
			}

			// Create shapes for each physics shape
			for (let i = 0; i < obj.shapes.length; i++) {
				if (!shapes[i]) {
					const physShape = obj.shapes[i];
					if (physShape instanceof ConvexPolygonShape) {
						const localVerts = physShape.vertices.map(v => vec2(v.x, v.y));
						shapes[i] = ez.path(localVerts, true, false);
					} else if (physShape instanceof CircleShape) {
						shapes[i] = ez.circle(vec2(0, 0), physShape.radius);
					} else {
						// Fallback: small circle
						shapes[i] = ez.circle(vec2(0, 0), 0.05);
					}
				}
			}
		} else {
			// Fallback rendering
			if (shapes.length === 0) {
				shapes.push(ez.circle(vec2(0, 0), 0.05));
			}
		}

		// Update transforms for all shapes
		for (let i = 0; i < shapes.length; i++) {
			const shape = shapes[i];
			if (shape) {
				// For multiple physics shapes, apply individual shape offsets
				let shapeX = posX;
				let shapeY = posY;

				if (obj.shapes && obj.shapes[i] && obj.shapes[i].offset) {
					const offset = obj.shapes[i].offset;
					const worldOffsetX = offset.x * cos - offset.y * sin;
					const worldOffsetY = offset.x * sin + offset.y * cos;
					shapeX += worldOffsetX;
					shapeY += worldOffsetY;
				}

				// Set transform: rotation + translation
				const col1 = vec4(cos, sin, 0, 0);
				const col2 = vec4(-sin, cos, 0, 0);
				const col3 = vec4(0, 0, 1, 0);
				const col4 = vec4(shapeX, shapeY, 0, 1);
				shape.transform = new mat3x4(col1, col2, col3, col4);
			}
		}

		return shapes;
	},

	// Internal function to render object (non-shadow)
	_renderObjectShape(obj, isShadowMode) {
		const fillColor = obj._renderColorHint ?? this._getObjectColor(obj);
		const shadowFill = "rgba(0,0,0,0.2)";
		const outlineColor = this.colors.outline;

		const shapes = this._buildOrUpdateObjectShapes(obj);

		if (isShadowMode) {
			for (const shape of shapes) {
				if (shape) {
					shape.fill(shadowFill);
				}
			}
		} else {
			for (const shape of shapes) {
				if (shape) {
					shape.fillAndStroke(fillColor + (obj._renderTransparencyHint ?? "EE"), outlineColor);
				}
			}
		}

		// Draw rotation indicator lines for circles in non-shadow mode
		// Only for objects with a single circle shape (not for capsules or multi-shape objects)
		if (!isShadowMode && obj.shapes && obj.shapes.length === 1 && obj.shapes[0] instanceof CircleShape) {
			const physShape = obj.shapes[0];
			const worldCenter = obj.localToWorld(physShape.offset);
			const angle = obj.rotation;
			const endX = worldCenter.x + physShape.radius * Math.cos(angle);
			const endY = worldCenter.y + physShape.radius * Math.sin(angle);
			ez.line(vec2(worldCenter.x, worldCenter.y), vec2(endX, endY))
				.stroke(outlineColor, 2);
		}
	},

	renderObject(obj) {
		if (obj._renderHidden) return;
		ez.ctx.lineWidth = 1;
		this._renderObjectShape(obj, false);
	},

	renderObjectShadow(obj) {
		if (obj._renderHidden) return;
		ez.ctx.save();
		ez.ctx.shadowColor = ez.parseColor("rgba(0,0,0,0.55)");
		ez.ctx.shadowBlur = 10;
		ez.ctx.shadowOffsetX = 5;
		ez.ctx.shadowOffsetY = 5;

		this._renderObjectShape(obj, true);

		ez.ctx.restore();
	},

	// Build or update cached shapes for a contact constraint
	_buildOrUpdateContactConstraintShapes(constraint) {
		const worldPosA = constraint.bodyA.localToWorld(constraint.localA);
		const worldPosB = constraint.bodyB.localToWorld(constraint.localB);
		const normal = vec2(constraint.normal.x, constraint.normal.y);
		const penetration = constraint.penetration;

		// Contact circle
		let contactCircle = constraint.ezdrawShapeCache?.contactCircle;
		if (!contactCircle) {
			contactCircle = ez.circle(vec2(0, 0), 0.02);
			constraint.ezdrawShapeCache = constraint.ezdrawShapeCache || {};
			constraint.ezdrawShapeCache.contactCircle = contactCircle;
		}
		// Set transform for contact circle
		contactCircle.transform = new mat3x4(
			vec4(1, 0, 0, 0), vec4(0, 1, 0, 0), vec4(0, 0, 1, 0), vec4(worldPosA.x, worldPosA.y, 0, 1)
		);

		return {
			contactCircle,
			worldPosA,
			worldPosB,
			normal,
			penetration
		};
	},

	renderContactConstraint(constraint) {
		if (!constraint.ezdrawShapeCache) {
			constraint.ezdrawShapeCache = {};
		}
		const { contactCircle, worldPosA, worldPosB, normal, penetration } = this._buildOrUpdateContactConstraintShapes(constraint);

		// Draw contact circle (cached)
		contactCircle.fillAndStroke(constraint.isReused ? "#FF6B6B44" : "#000000", this.colors.outline);

		// Draw lines directly (not cached due to transformation issues)
		const worldA = vec2(worldPosA.x, worldPosA.y);
		const worldB = vec2(worldPosB.x, worldPosB.y);
		const penetrationEnd = vec2(
			worldA.x + normal.x * penetration,
			worldA.y + normal.y * penetration
		);

		// Draw line between contact points
		ez.line(worldA, worldB).stroke("#FF6B6B44");

		// Draw penetration vector
		ez.line(worldA, penetrationEnd).stroke("#FF6B6B88");
	},

	renderRevoluteConstraint(constraint) {
		const worldPosA = constraint.bodyA.localToWorld
			? constraint.bodyA.localToWorld(constraint.localA)
			: constraint.bodyA.position.add(constraint.localA);

		ez.ctx.lineWidth = 2; // Set lineWidth for pivot circle and arcs

		// Revolute pivot circle
		let pivotCircle = constraint.ezdrawShapeCache?.pivotCircle;
		if (!pivotCircle) {
			pivotCircle = ez.circle(vec2(0, 0), 0.015);
			constraint.ezdrawShapeCache = constraint.ezdrawShapeCache || {};
			constraint.ezdrawShapeCache.pivotCircle = pivotCircle;
		}
		pivotCircle.transform = new mat3x4(
			vec4(1, 0, 0, 0), vec4(0, 1, 0, 0), vec4(0, 0, 1, 0), vec4(worldPosA.x, worldPosA.y, 0, 1)
		);
		pivotCircle.fillAndStroke(this.colors.constraintPoint, this.colors.outline);

		// Draw angle limits for revolute constraints if they exist
		if ((constraint.lowerAngleLimit !== null || constraint.upperAngleLimit !== null) &&
			constraint._limitsRotationRendererHint !== undefined &&
			constraint.upperAngleLimit !== constraint.lowerAngleLimit) {

			const range = constraint.upperAngleLimit - constraint.lowerAngleLimit;
			const bodyRelativeAngle = constraint.bodyB.rotation - constraint.bodyA.rotation;
			const bodyRelativeAngleMinusLowerLimit = bodyRelativeAngle - constraint.lowerAngleLimit;
			const pctAcrossRange = bodyRelativeAngleMinusLowerLimit / range;
			const radius = 0.2;

			const arc1 = ez.arc(
				vec2(worldPosA.x, worldPosA.y),
				-constraint.bodyA.rotation + (constraint._limitsRotationRendererHint || 0),
				range,
				radius
			);
			arc1.stroke("#FF6B6B88");

			const arc2 = ez.arc(
				vec2(worldPosA.x, worldPosA.y),
				-constraint.bodyA.rotation + (1.0 - pctAcrossRange) * range + (constraint._limitsRotationRendererHint || 0),
				0.0,
				radius
			);
			arc2.stroke("#4A90E2AA");
		}

		ez.ctx.lineWidth = 1;
	},

	renderConstraint(constraint) {
		if (!constraint) return;

		if (constraint instanceof ContactConstraint) {
			if (constraint.bodyA._renderHidden || constraint.bodyB._renderHidden) return;
			this.renderContactConstraint(constraint);
		} else if (constraint instanceof RevoluteConstraint) {
			// Hide revolute constraints that involve any hidden body (e.g., slime nodes)
			if ((constraint.bodyA && constraint.bodyA._renderHidden) || (constraint.bodyB && constraint.bodyB._renderHidden)) return;
			this.renderRevoluteConstraint(constraint);
		}
	},

	// Debug visualization methods
	drawBoundingBox(obj) {
		const shapes = this._buildOrUpdateObjectShapes(obj);
		// Draw a green bounding box around the object's cached shape
		// Assuming shape has width/height or bounding box info
		if (obj._boxHints) {
			for (const shape of shapes) {
				ez.rect(
					obj.position,
					[obj._boxHints.width, obj._boxHints.height],
					obj.rotation
				).stroke("#98FF98");
			}
		}
	}
};
