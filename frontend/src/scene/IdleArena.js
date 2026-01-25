/**
 * IdleArena - Main Three.js scene manager
 * Handles the 3D scene setup, camera, lighting, and rendering
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class IdleArena {
  constructor(container) {
    this.container = container;
    this.partners = new Map();
    this.animationId = null;

    this.init();
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);
    this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.02);

    // Camera setup
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(0, 12, 18);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls for 360° rotation
    this.setupControls();

    // Lighting
    this.setupLighting();

    // Ground/Arena
    this.setupArena();

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this));

    // Start animation loop
    this.animate();
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI / 2.2; // Prevent looking under
    this.controls.minPolarAngle = Math.PI / 6;   // Prevent looking too much from above
    this.controls.target.set(0, 0, 0);
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.5;

    // WASD keyboard controls
    this.setupKeyboardControls();
  }

  setupKeyboardControls() {
    this.keysPressed = { w: false, a: false, s: false, d: false };
    this.panSpeed = 0.3;

    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (this.keysPressed.hasOwnProperty(key)) {
        this.keysPressed[key] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (this.keysPressed.hasOwnProperty(key)) {
        this.keysPressed[key] = false;
      }
    });
  }

  handleKeyboardPan() {
    if (!this.keysPressed) return;

    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);

    // Forward/backward direction (projected to XZ plane)
    const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();

    // Right direction
    const right = new THREE.Vector3();
    right.crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

    const panOffset = new THREE.Vector3();

    if (this.keysPressed.w) {
      panOffset.add(forward.clone().multiplyScalar(this.panSpeed));
    }
    if (this.keysPressed.s) {
      panOffset.add(forward.clone().multiplyScalar(-this.panSpeed));
    }
    if (this.keysPressed.a) {
      panOffset.add(right.clone().multiplyScalar(this.panSpeed));
    }
    if (this.keysPressed.d) {
      panOffset.add(right.clone().multiplyScalar(-this.panSpeed));
    }

    if (panOffset.length() > 0) {
      this.camera.position.add(panOffset);
      this.controls.target.add(panOffset);
    }
  }

  setupLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambient);

    // Main directional light
    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 10, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    this.scene.add(mainLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x6366f1, 0.3);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);

    // Rim light
    const rimLight = new THREE.DirectionalLight(0xff6b6b, 0.2);
    rimLight.position.set(0, 5, -10);
    this.scene.add(rimLight);
  }

  setupArena() {
    // Create hexagonal tiled floor
    this.createHexagonalFloor();

    // Circular arena boundary (subtle glow ring)
    const ringGeometry = new THREE.RingGeometry(9, 9.15, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);
  }

  /**
   * Create hexagonal tiled floor like BeedogETF
   */
  createHexagonalFloor() {
    const hexRadius = 1.2;
    const hexHeight = 0.15;
    const rows = 12;
    const cols = 12;

    // Hexagon shape
    const hexShape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * hexRadius;
      const y = Math.sin(angle) * hexRadius;
      if (i === 0) {
        hexShape.moveTo(x, y);
      } else {
        hexShape.lineTo(x, y);
      }
    }
    hexShape.closePath();

    const extrudeSettings = {
      depth: hexHeight,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 1
    };

    const hexGeometry = new THREE.ExtrudeGeometry(hexShape, extrudeSettings);

    // Calculate hex spacing for tiled pattern
    const hexWidth = hexRadius * 2;
    const hexHeightOffset = hexRadius * Math.sqrt(3);

    // Color palette for hexagons
    const colors = [
      0x1a1a2e, // Dark blue
      0x16213e, // Navy
      0x0f3460, // Deep blue
      0x12121a, // Dark
    ];

    // Create hexagon tiles
    for (let row = -rows / 2; row < rows / 2; row++) {
      for (let col = -cols / 2; col < cols / 2; col++) {
        // Calculate position with offset for hex grid pattern
        const offsetX = (row % 2) * (hexWidth * 0.75);
        const x = col * hexWidth * 1.5 + offsetX;
        const z = row * hexHeightOffset * 0.5;

        // Only create hexagons within circular arena
        const distance = Math.sqrt(x * x + z * z);
        if (distance > 15) continue;

        // Vary color based on distance from center
        const colorIndex = Math.floor((distance / 15) * colors.length) % colors.length;
        const baseColor = colors[colorIndex];

        // Add slight variation
        const colorVariation = (Math.random() - 0.5) * 0.1;
        const color = new THREE.Color(baseColor);
        color.offsetHSL(0, 0, colorVariation);

        const material = new THREE.MeshPhongMaterial({
          color: color,
          emissive: 0x1a1a2e,
          emissiveIntensity: 0.1,
          shininess: 30,
          specular: 0x222244,
          transparent: true,
          opacity: 0.9
        });

        const hex = new THREE.Mesh(hexGeometry, material);
        hex.rotation.x = -Math.PI / 2;
        hex.position.set(x, -hexHeight / 2, z);
        hex.receiveShadow = true;
        this.scene.add(hex);

        // Add subtle edge glow for some hexagons
        if (Math.random() > 0.7) {
          const edges = new THREE.EdgesGeometry(hexGeometry);
          const edgeMaterial = new THREE.LineBasicMaterial({
            color: 0x6366f1,
            transparent: true,
            opacity: 0.3
          });
          const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
          edgeLines.rotation.x = -Math.PI / 2;
          edgeLines.position.set(x, -hexHeight / 2 + 0.01, z);
          this.scene.add(edgeLines);
        }
      }
    }
  }

  /**
   * Update partners display
   * @param {Array} partnerData - Array of partner objects from API
   */
  updatePartners(partnerData) {
    const currentAddresses = new Set(partnerData.map(p => p.tokenAddress));

    // Remove partners that are no longer in top 10
    for (const [address, partner] of this.partners) {
      if (!currentAddresses.has(address)) {
        this.removePartner(address);
      }
    }

    // Add or update partners
    partnerData.forEach((data, index) => {
      if (this.partners.has(data.tokenAddress)) {
        this.updatePartner(data);
      } else {
        this.addPartner(data, index);
      }
    });

    // Rearrange positions
    this.arrangePartners(partnerData.length);
  }

  /**
   * Add a new partner to the scene
   */
  addPartner(data, index) {
    const partner = new PartnerToken(data);
    this.partners.set(data.tokenAddress, partner);
    this.scene.add(partner.group);
  }

  /**
   * Update existing partner
   */
  updatePartner(data) {
    const partner = this.partners.get(data.tokenAddress);
    if (partner) {
      partner.update(data);
    }
  }

  /**
   * Remove partner from scene
   */
  removePartner(address) {
    const partner = this.partners.get(address);
    if (partner) {
      partner.dispose();
      this.scene.remove(partner.group);
      this.partners.delete(address);
    }
  }

  /**
   * Arrange partners in a semi-circle
   */
  arrangePartners(count) {
    const partners = Array.from(this.partners.values());
    const radius = 5;
    const angleStep = Math.PI / (count + 1);

    partners.forEach((partner, i) => {
      const angle = angleStep * (i + 1) - Math.PI / 2;
      const targetX = Math.cos(angle) * radius;
      const targetZ = Math.sin(angle) * radius + 2;

      partner.setTargetPosition(targetX, 0, targetZ);
    });
  }

  animate() {
    this.animationId = requestAnimationFrame(this.animate.bind(this));

    // Handle keyboard pan (WASD)
    this.handleKeyboardPan();

    // Update orbit controls
    if (this.controls) {
      this.controls.update();
    }

    // Update all partners
    for (const partner of this.partners.values()) {
      partner.animate();
    }

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    for (const partner of this.partners.values()) {
      partner.dispose();
    }

    if (this.controls) {
      this.controls.dispose();
    }

    this.renderer.dispose();
    window.removeEventListener('resize', this.onResize.bind(this));

    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

/**
 * PartnerToken - Individual token partner 3D object
 */
class PartnerToken {
  constructor(data) {
    this.data = data;
    this.group = new THREE.Group();
    this.targetPosition = new THREE.Vector3();
    this.hpAnimationProgress = 0;

    this.create();
  }

  create() {
    // Main body - Sphere with token texture
    const geometry = new THREE.SphereGeometry(0.6, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.3,
      roughness: 0.4,
      emissive: 0x222222
    });

    this.body = new THREE.Mesh(geometry, material);
    this.body.castShadow = true;
    this.body.position.y = 1;
    this.group.add(this.body);

    // Load token logo as texture
    if (this.data.logoUrl) {
      const loader = new THREE.TextureLoader();
      loader.crossOrigin = 'anonymous';
      loader.load(
        this.data.logoUrl,
        (texture) => {
          this.body.material.map = texture;
          this.body.material.needsUpdate = true;
        },
        undefined,
        () => {
          // Error loading texture, use colored material based on symbol
          this.body.material.color.setHex(this.getColorFromSymbol(this.data.tokenSymbol));
        }
      );
    } else {
      this.body.material.color.setHex(this.getColorFromSymbol(this.data.tokenSymbol));
    }

    // Glow ring based on level
    this.createLevelGlow();

    // HP bar
    this.createHPBar();

    // Floating animation offset
    this.floatOffset = Math.random() * Math.PI * 2;
  }

  createLevelGlow() {
    const level = this.data.level || 1;
    let glowColor, glowIntensity;

    if (level >= 60) {
      glowColor = 0xffd700; // Gold for legendary
      glowIntensity = 1;
    } else if (level >= 50) {
      glowColor = 0xff69b4; // Pink for elite
      glowIntensity = 0.8;
    } else if (level >= 40) {
      glowColor = 0x9966ff; // Purple for veteran
      glowIntensity = 0.6;
    } else if (level >= 30) {
      glowColor = 0xff8c00; // Orange for senior
      glowIntensity = 0.5;
    } else if (level >= 20) {
      glowColor = 0x4169e1; // Blue for intermediate
      glowIntensity = 0.4;
    } else if (level >= 10) {
      glowColor = 0x32cd32; // Green for junior
      glowIntensity = 0.3;
    } else {
      glowColor = 0x808080; // Gray for novice
      glowIntensity = 0.2;
    }

    // Ring glow
    const ringGeometry = new THREE.RingGeometry(0.7, 0.85, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: glowIntensity,
      side: THREE.DoubleSide
    });
    this.glowRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.glowRing.rotation.x = -Math.PI / 2;
    this.glowRing.position.y = 0.05;
    this.group.add(this.glowRing);

    // Point light for glow effect
    this.glowLight = new THREE.PointLight(glowColor, glowIntensity * 0.5, 3);
    this.glowLight.position.y = 1;
    this.group.add(this.glowLight);
  }

  createHPBar() {
    // HP bar background
    const bgGeometry = new THREE.PlaneGeometry(1, 0.12);
    const bgMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.8
    });
    this.hpBg = new THREE.Mesh(bgGeometry, bgMaterial);
    this.hpBg.position.y = 2;
    this.group.add(this.hpBg);

    // HP bar fill
    const fillGeometry = new THREE.PlaneGeometry(0.98, 0.1);
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: this.getHPColor(),
      transparent: true,
      opacity: 0.9
    });
    this.hpFill = new THREE.Mesh(fillGeometry, fillMaterial);
    this.hpFill.position.y = 2;
    this.hpFill.position.z = 0.01;
    this.group.add(this.hpFill);
  }

  getHPColor() {
    if (!this.data.state) return 0x22c55e;
    if (this.data.state === 'increasing') return 0x22c55e;
    if (this.data.state === 'decreasing') return 0xef4444;
    return 0x888888;
  }

  getColorFromSymbol(symbol) {
    // Generate consistent color from symbol
    let hash = 0;
    for (let i = 0; i < (symbol || 'X').length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (hash & 0x00ffffff) | 0x404040;
  }

  setTargetPosition(x, y, z) {
    this.targetPosition.set(x, y, z);
  }

  update(data) {
    const prevState = this.data.state;
    this.data = data;

    // Trigger HP animation if state changed
    if (prevState !== data.state) {
      this.hpAnimationProgress = 0;
    }

    // Update HP bar color
    if (this.hpFill) {
      this.hpFill.material.color.setHex(this.getHPColor());
    }
  }

  animate() {
    const time = Date.now() * 0.001;

    // Smooth position interpolation
    this.group.position.lerp(this.targetPosition, 0.05);

    // Floating animation
    this.body.position.y = 1 + Math.sin(time * 2 + this.floatOffset) * 0.1;

    // Gentle rotation
    this.body.rotation.y += 0.005;

    // HP bar always faces camera (billboard)
    if (this.hpBg) {
      this.hpBg.lookAt(0, this.hpBg.position.y, 10);
      this.hpFill.lookAt(0, this.hpFill.position.y, 10);
    }

    // HP animation
    if (this.hpAnimationProgress < 1) {
      this.hpAnimationProgress += 0.02;
      this.animateHP();
    }

    // Glow ring pulse
    if (this.glowRing) {
      const pulse = 0.8 + Math.sin(time * 3) * 0.2;
      this.glowRing.material.opacity = pulse * (this.data.level >= 60 ? 1 : this.data.level / 60);
    }
  }

  animateHP() {
    if (!this.data.state || this.data.state === 'stable') return;

    const intensity = Math.sin(this.hpAnimationProgress * Math.PI) * 0.3;

    if (this.data.state === 'increasing') {
      // Green pulse effect
      this.body.material.emissive.setHex(0x004400);
      this.body.material.emissiveIntensity = intensity;
    } else if (this.data.state === 'decreasing') {
      // Red pulse effect
      this.body.material.emissive.setHex(0x440000);
      this.body.material.emissiveIntensity = intensity;
    }

    if (this.hpAnimationProgress >= 1) {
      this.body.material.emissive.setHex(0x222222);
      this.body.material.emissiveIntensity = 0;
    }
  }

  dispose() {
    this.body.geometry.dispose();
    this.body.material.dispose();
    if (this.body.material.map) {
      this.body.material.map.dispose();
    }
    if (this.glowRing) {
      this.glowRing.geometry.dispose();
      this.glowRing.material.dispose();
    }
    if (this.hpBg) {
      this.hpBg.geometry.dispose();
      this.hpBg.material.dispose();
    }
    if (this.hpFill) {
      this.hpFill.geometry.dispose();
      this.hpFill.material.dispose();
    }
  }
}
