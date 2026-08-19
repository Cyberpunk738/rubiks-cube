/**
 * 3D Rubik's Cube Engine (Three.js)
 * Manages 3D scene, materials, lighting, 27 cubelet geometries,
 * kinematic pivot rotations, move queue, camera presets, and solved state detection.
 */

class Cube3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.cubelets = []; // 27 cubelet meshes
    this.moveQueue = [];
    this.isAnimating = false;
    this.moveHistory = [];
    this.scrambleMoves = [];
    
    // Cubelet dimensions
    this.CUBELET_SIZE = 1.0;
    this.SPACING = 0.04;
    this.STEP = this.CUBELET_SIZE + this.SPACING; // ~1.04 unit grid

    // Scene & Camera
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.pivot = null;
    this.cubeRoot = null;

    // Camera Orbit State
    this.isOrbiting = false;
    this.prevPointerPos = { x: 0, y: 0 };
    const initialRadius = this.getBaseRadius();
    this.targetCameraRot = { theta: 0.65, phi: 0.45, radius: initialRadius }; // spherical coords
    this.currentCameraRot = { theta: 0.65, phi: 0.45, radius: initialRadius };

    // Callbacks
    this.onMoveComplete = null;
    this.onSolved = null;

    this.init();
  }

  getBaseRadius() {
    const width = (this.container && this.container.clientWidth) ? this.container.clientWidth : window.innerWidth;
    const height = (this.container && this.container.clientHeight) ? this.container.clientHeight : window.innerHeight;
    const aspect = width / (height || 1);

    if (aspect < 0.7) {
      // Mobile portrait (phones) - reduced significantly for clean visibility & margin
      return Math.max(14.0, Math.min(17.5, 7.2 / aspect));
    } else if (aspect < 1.15 || width < 768) {
      // Small screens / tablets / mobile landscape
      return 12.2;
    } else {
      // Desktop - reduced a bit from original 9.2 to 10.8
      return 10.8;
    }
  }

  init() {
    this.createScene();
    this.createLighting();
    this.createCubelets();
    this.setupEvents();
    this.animate();
  }

  createScene() {
    this.scene = new THREE.Scene();
    
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // Root groups
    this.cubeRoot = new THREE.Group();
    this.scene.add(this.cubeRoot);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    // Soft pedestal shadow under the cube
    const shadowGeo = new THREE.PlaneGeometry(5, 5);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.7 });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -2.2;
    this.scene.add(shadowMesh);
  }

  createLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    // Key light (Top-front-right)
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(6, 8, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    this.scene.add(keyLight);

    // Fill light (Bottom-back-left)
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.4);
    fillLight.position.set(-6, -4, -6);
    this.scene.add(fillLight);

    // Rim light (Top-back)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(0, 6, -8);
    this.scene.add(rimLight);
  }

  /**
   * Generates rounded sticker textures with sleek bevelled borders
   */
  createStickerTexture(colorHex, isInterior = false) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const theme = window.themeManager ? window.themeManager.getThemeData() : { body: 0x111318 };
    const bodyColorHex = '#' + theme.body.toString(16).padStart(6, '0');

    // Fill body base
    ctx.fillStyle = bodyColorHex;
    ctx.fillRect(0, 0, size, size);

    if (!isInterior) {
      // Rounded sticker inset
      const pad = 14;
      const radius = 24;
      const stickerColor = typeof colorHex === 'string' ? colorHex : '#' + colorHex.toString(16).padStart(6, '0');

      ctx.beginPath();
      ctx.moveTo(pad + radius, pad);
      ctx.lineTo(size - pad - radius, pad);
      ctx.quadraticCurveTo(size - pad, pad, size - pad, pad + radius);
      ctx.lineTo(size - pad, size - pad - radius);
      ctx.quadraticCurveTo(size - pad, size - pad, size - pad - radius, size - pad);
      ctx.lineTo(pad + radius, size - pad);
      ctx.quadraticCurveTo(pad, size - pad, pad, size - pad - radius);
      ctx.lineTo(pad, pad + radius);
      ctx.quadraticCurveTo(pad, pad, pad + radius, pad);
      ctx.closePath();

      ctx.fillStyle = stickerColor;
      ctx.fill();

      // Subtle specular shine gradient over the sticker
      const grad = ctx.createLinearGradient(pad, pad, size - pad, size - pad);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Subtle sticker outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  createCubelets() {
    this.cubelets = [];
    const theme = window.themeManager.getThemeData();

    // BoxGeometry for each cubelet
    const geometry = new THREE.BoxGeometry(this.CUBELET_SIZE, this.CUBELET_SIZE, this.CUBELET_SIZE);

    // 3x3x3 grid coordinates: x in [-1,0,1], y in [-1,0,1], z in [-1,0,1]
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const materials = [
            // Face 0: Right (+X, Red)
            new THREE.MeshStandardMaterial({
              map: this.createStickerTexture(theme.colors.R, x !== 1),
              roughness: theme.roughness,
              metalness: theme.metalness
            }),
            // Face 1: Left (-X, Orange)
            new THREE.MeshStandardMaterial({
              map: this.createStickerTexture(theme.colors.L, x !== -1),
              roughness: theme.roughness,
              metalness: theme.metalness
            }),
            // Face 2: Up (+Y, White)
            new THREE.MeshStandardMaterial({
              map: this.createStickerTexture(theme.colors.U, y !== 1),
              roughness: theme.roughness,
              metalness: theme.metalness
            }),
            // Face 3: Down (-Y, Yellow)
            new THREE.MeshStandardMaterial({
              map: this.createStickerTexture(theme.colors.D, y !== -1),
              roughness: theme.roughness,
              metalness: theme.metalness
            }),
            // Face 4: Front (+Z, Green)
            new THREE.MeshStandardMaterial({
              map: this.createStickerTexture(theme.colors.F, z !== 1),
              roughness: theme.roughness,
              metalness: theme.metalness
            }),
            // Face 5: Back (-Z, Blue)
            new THREE.MeshStandardMaterial({
              map: this.createStickerTexture(theme.colors.B, z !== -1),
              roughness: theme.roughness,
              metalness: theme.metalness
            })
          ];

          const mesh = new THREE.Mesh(geometry, materials);
          mesh.position.set(x * this.STEP, y * this.STEP, z * this.STEP);
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          // Store initial and current grid position
          mesh.userData = {
            gridPos: new THREE.Vector3(x, y, z),
            initialGridPos: new THREE.Vector3(x, y, z),
            isCenter: (Math.abs(x) + Math.abs(y) + Math.abs(z) === 1),
            isEdge: (Math.abs(x) + Math.abs(y) + Math.abs(z) === 2),
            isCorner: (Math.abs(x) + Math.abs(y) + Math.abs(z) === 3),
            isCore: (x === 0 && y === 0 && z === 0)
          };

          this.cubeRoot.add(mesh);
          this.cubelets.push(mesh);
        }
      }
    }
  }

  updateMaterials() {
    const theme = window.themeManager.getThemeData();
    this.cubelets.forEach(mesh => {
      const orig = mesh.userData.initialGridPos;
      const materials = [
        new THREE.MeshStandardMaterial({
          map: this.createStickerTexture(theme.colors.R, orig.x !== 1),
          roughness: theme.roughness,
          metalness: theme.metalness
        }),
        new THREE.MeshStandardMaterial({
          map: this.createStickerTexture(theme.colors.L, orig.x !== -1),
          roughness: theme.roughness,
          metalness: theme.metalness
        }),
        new THREE.MeshStandardMaterial({
          map: this.createStickerTexture(theme.colors.U, orig.y !== 1),
          roughness: theme.roughness,
          metalness: theme.metalness
        }),
        new THREE.MeshStandardMaterial({
          map: this.createStickerTexture(theme.colors.D, orig.y !== -1),
          roughness: theme.roughness,
          metalness: theme.metalness
        }),
        new THREE.MeshStandardMaterial({
          map: this.createStickerTexture(theme.colors.F, orig.z !== 1),
          roughness: theme.roughness,
          metalness: theme.metalness
        }),
        new THREE.MeshStandardMaterial({
          map: this.createStickerTexture(theme.colors.B, orig.z !== -1),
          roughness: theme.roughness,
          metalness: theme.metalness
        })
      ];
      mesh.material = materials;
    });
  }

  /**
   * Executes or queues a Rubik's notation move (e.g. "R", "U'", "F2", "M", "x")
   */
  turn(moveNotation, options = { recordHistory: true, instant: false, onDone: null }) {
    const moveDef = CubeNotation.MOVES[moveNotation];
    if (!moveDef) {
      console.warn("Invalid move notation:", moveNotation);
      if (options.onDone) options.onDone();
      return;
    }

    if (this.isAnimating && !options.instant) {
      this.moveQueue.push({ notation: moveNotation, options });
      return;
    }

    this.executeMove(moveNotation, moveDef, options);
  }

  /**
   * Executes sequence of moves sequentially
   */
  turnSequence(moves, options = { recordHistory: true, speedMultiplier: 1.0, onDone: null }) {
    if (!Array.isArray(moves)) {
      moves = CubeNotation.parseSequence(moves);
    }
    if (moves.length === 0) {
      if (options.onDone) options.onDone();
      return;
    }

    const nextMove = (idx) => {
      if (idx >= moves.length) {
        if (options.onDone) options.onDone();
        return;
      }
      this.turn(moves[idx], {
        recordHistory: options.recordHistory,
        speedMultiplier: options.speedMultiplier,
        onDone: () => nextMove(idx + 1)
      });
    };

    nextMove(0);
  }

  executeMove(moveNotation, moveDef, options) {
    this.isAnimating = true;
    const duration = options.instant ? 0 : (window.themeManager.animationSpeed / (options.speedMultiplier || 1.0));

    // Sound effect
    if (!options.instant && window.soundEngine) {
      window.soundEngine.playTurnSound(options.speedMultiplier || 1.0);
    }

    // 1. Identify which cubelets belong to this slice / move
    const targetCubelets = [];
    const threshold = 0.45;

    this.cubelets.forEach(cubelet => {
      // Get current world coordinate relative to cube root
      const pos = cubelet.position;
      let inSlice = false;

      if (moveDef.isFullCube) {
        inSlice = true;
      } else if (moveDef.axis === 'x') {
        const gridX = Math.round(pos.x / this.STEP);
        if (gridX === moveDef.layer) inSlice = true;
      } else if (moveDef.axis === 'y') {
        const gridY = Math.round(pos.y / this.STEP);
        if (gridY === moveDef.layer) inSlice = true;
      } else if (moveDef.axis === 'z') {
        const gridZ = Math.round(pos.z / this.STEP);
        if (gridZ === moveDef.layer) inSlice = true;
      }

      if (inSlice) {
        targetCubelets.push(cubelet);
      }
    });

    // 2. Attach cubelets to pivot
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.position.set(0, 0, 0);
    this.scene.attach(this.pivot);

    targetCubelets.forEach(cubelet => {
      this.pivot.attach(cubelet);
    });

    // 3. Animation execution
    const targetAngle = moveDef.angle;
    const rotAxis = moveDef.axis; // 'x', 'y', or 'z'

    if (duration <= 0) {
      // Instant execution
      this.pivot.rotation[rotAxis] = targetAngle;
      this.finishMove(targetCubelets, moveNotation, options);
    } else {
      const startTime = performance.now();
      const startAngle = 0;

      const animateStep = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1.0);

        // Smooth cubic easeInOut curve
        const ease = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        this.pivot.rotation[rotAxis] = startAngle + targetAngle * ease;

        if (progress < 1.0) {
          requestAnimationFrame(animateStep);
        } else {
          this.pivot.rotation[rotAxis] = targetAngle;
          this.finishMove(targetCubelets, moveNotation, options);
        }
      };

      requestAnimationFrame(animateStep);
    }
  }

  finishMove(targetCubelets, moveNotation, options) {
    // 1. Re-attach cubelets back to cubeRoot and normalize transforms
    this.pivot.updateMatrixWorld(true);

    targetCubelets.forEach(cubelet => {
      cubelet.updateMatrixWorld(true);
      this.cubeRoot.attach(cubelet);

      // Snap position to exact grid coordinates
      const gx = Math.round(cubelet.position.x / this.STEP);
      const gy = Math.round(cubelet.position.y / this.STEP);
      const gz = Math.round(cubelet.position.z / this.STEP);
      cubelet.position.set(gx * this.STEP, gy * this.STEP, gz * this.STEP);
      cubelet.userData.gridPos.set(gx, gy, gz);

      // Snap rotation to exact 90-degree orthogonal increments
      const euler = new THREE.Euler().setFromQuaternion(cubelet.quaternion, 'XYZ');
      const snap = Math.PI / 2;
      euler.x = Math.round(euler.x / snap) * snap;
      euler.y = Math.round(euler.y / snap) * snap;
      euler.z = Math.round(euler.z / snap) * snap;
      cubelet.quaternion.setFromEuler(euler);
      cubelet.updateMatrix();
    });

    this.pivot.rotation.set(0, 0, 0);
    this.isAnimating = false;

    // Record history
    if (options.recordHistory) {
      this.moveHistory.push(moveNotation);
    }

    if (options.onDone) {
      options.onDone();
    }

    if (this.onMoveComplete) {
      this.onMoveComplete(moveNotation);
    }

    // Process next queued move if any
    if (this.moveQueue.length > 0) {
      const next = this.moveQueue.shift();
      this.turn(next.notation, next.options);
    } else {
      // Check if solved
      if (this.checkIsSolved() && this.moveHistory.length > 0) {
        if (this.onSolved) this.onSolved();
      }
    }
  }

  /**
   * Checks if all 6 outer faces have uniform sticker orientation
   */
  checkIsSolved() {
    const faces = [
      { axis: 'x', dir: 1,  expectedNormal: new THREE.Vector3(1, 0, 0),  matIndex: 0 },
      { axis: 'x', dir: -1, expectedNormal: new THREE.Vector3(-1, 0, 0), matIndex: 1 },
      { axis: 'y', dir: 1,  expectedNormal: new THREE.Vector3(0, 1, 0),  matIndex: 2 },
      { axis: 'y', dir: -1, expectedNormal: new THREE.Vector3(0, -1, 0), matIndex: 3 },
      { axis: 'z', dir: 1,  expectedNormal: new THREE.Vector3(0, 0, 1),  matIndex: 4 },
      { axis: 'z', dir: -1, expectedNormal: new THREE.Vector3(0, 0, -1), matIndex: 5 }
    ];

    for (const face of faces) {
      const faceCubelets = this.cubelets.filter(c => {
        const p = c.userData.gridPos;
        return p[face.axis] === face.dir;
      });

      // All cubelets on this face must have their face normal pointing in the expected direction
      for (const cubelet of faceCubelets) {
        const normal = face.expectedNormal.clone().applyQuaternion(cubelet.quaternion);
        // If the normal is not aligned with expected direction (dot product < 0.95), not solved
        if (normal.dot(face.expectedNormal) < 0.95) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Resets the cube to pristine solved state instantly
   */
  resetSolved() {
    this.moveQueue = [];
    this.isAnimating = false;
    this.moveHistory = [];

    this.cubelets.forEach(mesh => {
      const orig = mesh.userData.initialGridPos;
      mesh.position.set(orig.x * this.STEP, orig.y * this.STEP, orig.z * this.STEP);
      mesh.userData.gridPos.copy(orig);
      mesh.quaternion.identity();
      mesh.updateMatrix();
    });
  }

  // Camera Orbit Controls
  setupEvents() {
    window.addEventListener('resize', () => this.onResize());

    // Mouse / Touch orbit on empty background or right click
    const dom = this.container;

    dom.addEventListener('pointerdown', (e) => {
      // If right click or middle click or gesture subagent didn't handle it
      if (e.button === 2 || e.button === 1 || e.target === dom || e.target.tagName === 'CANVAS') {
        this.isOrbiting = true;
        this.prevPointerPos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isOrbiting) return;
      const dx = e.clientX - this.prevPointerPos.x;
      const dy = e.clientY - this.prevPointerPos.y;
      this.prevPointerPos = { x: e.clientX, y: e.clientY };

      const rotSpeed = 0.007;
      this.targetCameraRot.theta -= dx * rotSpeed;
      this.targetCameraRot.phi = Math.max(0.08, Math.min(Math.PI - 0.08, this.targetCameraRot.phi - dy * rotSpeed));
    });

    window.addEventListener('pointerup', () => {
      this.isOrbiting = false;
    });

    // Touch pinch to zoom support
    let initialPinchDist = null;
    let initialPinchRadius = null;

    dom.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.isOrbiting = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);
        initialPinchRadius = this.targetCameraRot.radius;
      }
    }, { passive: true });

    dom.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialPinchDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = initialPinchDist / Math.max(10, dist);
        this.targetCameraRot.radius = Math.max(6.0, Math.min(26.0, initialPinchRadius * factor));
      }
    }, { passive: true });

    dom.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        initialPinchDist = null;
      }
    });

    // Zoom on wheel
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomSpeed = 0.002;
      this.targetCameraRot.radius = Math.max(6.0, Math.min(26.0, this.targetCameraRot.radius + e.deltaY * zoomSpeed));
    }, { passive: false });

    // Context menu disable on 3D canvas
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setCameraPreset(theta, phi, radius = null) {
    this.targetCameraRot.theta = theta;
    this.targetCameraRot.phi = phi;
    this.targetCameraRot.radius = (radius !== null && radius !== undefined) ? radius : this.getBaseRadius();
  }

  updateCameraPosition() {
    // Smooth camera damping
    const lerp = 0.12;
    this.currentCameraRot.theta += (this.targetCameraRot.theta - this.currentCameraRot.theta) * lerp;
    this.currentCameraRot.phi += (this.targetCameraRot.phi - this.currentCameraRot.phi) * lerp;
    this.currentCameraRot.radius += (this.targetCameraRot.radius - this.currentCameraRot.radius) * lerp;

    const { theta, phi, radius } = this.currentCameraRot;
    this.camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
    this.camera.position.y = radius * Math.cos(phi);
    this.camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
    this.camera.lookAt(0, 0, 0);
  }

  onResize() {
    if (!this.container || !this.camera || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.targetCameraRot.radius = this.getBaseRadius();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.updateCameraPosition();
    this.renderer.render(this.scene, this.camera);
  }
}

window.Cube3D = Cube3D;
