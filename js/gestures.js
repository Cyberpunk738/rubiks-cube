/**
 * Direct Face-Dragging Gesture Controller
 * Allows natural mouse/touch dragging on cube stickers to turn slices intuitively.
 */

class GestureController {
  constructor(cube3d) {
    this.cube3d = cube3d;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.isDraggingFace = false;
    this.startPointer = { x: 0, y: 0 };
    this.hitCubelet = null;
    this.hitNormal = null;
    this.hitPoint = null;

    this.DRAG_THRESHOLD = 16; // pixels

    this.setupListeners();
  }

  setupListeners() {
    const dom = this.cube3d.container;

    dom.addEventListener('pointerdown', (e) => this.onPointerDown(e), false);
    window.addEventListener('pointermove', (e) => this.onPointerMove(e), false);
    window.addEventListener('pointerup', (e) => this.onPointerUp(e), false);
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e), false);
  }

  onPointerDown(e) {
    // Only handle primary button (Left click or touch)
    if (e.button !== 0) return;
    if (this.cube3d.isAnimating) return;

    const rect = this.cube3d.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.cube3d.camera);
    const intersects = this.raycaster.intersectObjects(this.cube3d.cubelets, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const normal = hit.face.normal.clone();
      // Transform normal by cubelet's world orientation
      normal.transformDirection(hit.object.matrixWorld);

      // Snap normal to nearest principal axis (X, Y, Z)
      const absX = Math.abs(normal.x);
      const absY = Math.abs(normal.y);
      const absZ = Math.abs(normal.z);

      if (absX > absY && absX > absZ) {
        normal.set(Math.sign(normal.x), 0, 0);
      } else if (absY > absX && absY > absZ) {
        normal.set(0, Math.sign(normal.y), 0);
      } else {
        normal.set(0, 0, Math.sign(normal.z));
      }

      this.isDraggingFace = true;
      this.startPointer = { x: e.clientX, y: e.clientY };
      this.hitCubelet = hit.object;
      this.hitNormal = normal;
      this.hitPoint = hit.point.clone();

      // Temporarily disable camera orbit when dragging a face
      this.cube3d.isOrbiting = false;
    }
  }

  onPointerMove(e) {
    if (!this.isDraggingFace || !this.hitCubelet || !this.hitNormal) return;

    const dx = e.clientX - this.startPointer.x;
    const dy = e.clientY - this.startPointer.y;
    const dist = Math.hypot(dx, dy);

    if (dist < this.DRAG_THRESHOLD) return;

    // Determine the turn from the 2D gesture direction
    this.resolveTurnFromGesture(dx, dy);
    this.isDraggingFace = false;
    this.hitCubelet = null;
    this.hitNormal = null;
  }

  onPointerUp(e) {
    this.isDraggingFace = false;
    this.hitCubelet = null;
    this.hitNormal = null;
  }

  /**
   * Projects 3D tangent vectors onto screen space and finds the closest match to the user's drag vector
   */
  resolveTurnFromGesture(screenDx, screenDy) {
    const camera = this.cube3d.camera;
    const N = this.hitNormal;
    const pos = this.hitCubelet.userData.gridPos; // {x, y, z} in [-1, 0, 1]

    // Find 2 orthogonal tangent axes perpendicular to face normal N
    let tangentAxes = [];
    if (Math.abs(N.x) > 0.5) {
      tangentAxes = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    } else if (Math.abs(N.y) > 0.5) {
      tangentAxes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)];
    } else {
      tangentAxes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)];
    }

    const rect = this.cube3d.container.getBoundingClientRect();
    const dragVec2D = new THREE.Vector2(screenDx, screenDy).normalize();

    let bestScore = -Infinity;
    let chosenTangent = null;
    let chosenSign = 1;

    tangentAxes.forEach(tangent => {
      // Project hitPoint and (hitPoint + tangent) to screen coords
      const p0 = this.hitPoint.clone();
      const p1 = this.hitPoint.clone().add(tangent.clone().multiplyScalar(0.5));

      const screen0 = this.toScreenPosition(p0, camera, rect);
      const screen1 = this.toScreenPosition(p1, camera, rect);

      const tangentScreenDir = new THREE.Vector2(screen1.x - screen0.x, screen1.y - screen0.y).normalize();
      const dot = dragVec2D.dot(tangentScreenDir);

      if (Math.abs(dot) > bestScore) {
        bestScore = Math.abs(dot);
        chosenTangent = tangent;
        chosenSign = dot >= 0 ? 1 : -1;
      }
    });

    if (!chosenTangent) return;

    // The 3D drag direction vector:
    const dragDir3D = chosenTangent.clone().multiplyScalar(chosenSign);

    // Rotation Axis = FaceNormal cross DragDirection
    const rotAxis = new THREE.Vector3().crossVectors(N, dragDir3D);

    // Find which standard move this corresponds to
    const moveNotation = this.identifyMove(rotAxis, pos);
    if (moveNotation) {
      this.cube3d.turn(moveNotation, { recordHistory: true });
    }
  }

  toScreenPosition(vector3D, camera, rect) {
    const v = vector3D.clone().project(camera);
    return {
      x: ((v.x + 1) * rect.width) / 2,
      y: ((-v.y + 1) * rect.height) / 2
    };
  }

  /**
   * Maps 3D rotation axis and cubelet layer coordinate to Singmaster notation (e.g. "R", "U'", "F")
   */
  identifyMove(rotAxis, gridPos) {
    // Find dominant axis of rotAxis
    const ax = Math.abs(rotAxis.x);
    const ay = Math.abs(rotAxis.y);
    const az = Math.abs(rotAxis.z);

    if (ay > ax && ay > az) {
      // Rotation around Y
      const sign = Math.sign(rotAxis.y);
      const layer = gridPos.y; // 1 (Up), 0 (Equator), -1 (Down)
      
      if (layer === 1) {
        return sign > 0 ? "U'" : "U";
      } else if (layer === -1) {
        return sign > 0 ? "D" : "D'";
      } else {
        return sign > 0 ? "E" : "E'";
      }
    } else if (ax > ay && ax > az) {
      // Rotation around X
      const sign = Math.sign(rotAxis.x);
      const layer = gridPos.x; // 1 (Right), 0 (Middle), -1 (Left)

      if (layer === 1) {
        return sign > 0 ? "R'" : "R";
      } else if (layer === -1) {
        return sign > 0 ? "L" : "L'";
      } else {
        return sign > 0 ? "M" : "M'";
      }
    } else if (az > ax && az > ay) {
      // Rotation around Z
      const sign = Math.sign(rotAxis.z);
      const layer = gridPos.z; // 1 (Front), 0 (Standing), -1 (Back)

      if (layer === 1) {
        return sign > 0 ? "F'" : "F";
      } else if (layer === -1) {
        return sign > 0 ? "B" : "B'";
      } else {
        return sign > 0 ? "S'" : "S";
      }
    }

    return null;
  }
}

window.GestureController = GestureController;
