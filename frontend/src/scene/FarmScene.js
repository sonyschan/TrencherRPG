/**
 * FarmScene - Low-poly farm scene with Quaternius CC0 assets
 * Replaces hexagonal arena with a peaceful farm environment
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Asset cache for loaded models (shared across all instances)
const assetCache = new Map();

// GLTF Loader instance
const gltfLoader = new GLTFLoader();

// Memory stats for debugging
let memoryStatsEnabled = false;
export function enableMemoryStats(enabled = true) {
  memoryStatsEnabled = enabled;
}

export function getMemoryStats(renderer) {
  if (!renderer) return null;
  const info = renderer.info;
  return {
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: info.programs?.length || 0,
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    cacheSize: assetCache.size
  };
}

/**
 * Load a GLTF model with caching
 * @param {string} key - Cache key
 * @param {string} url - Model URL
 * @returns {Promise<{root: THREE.Object3D, animations: Array}>}
 */
async function loadGltf(key, url) {
  if (assetCache.has(key)) {
    const cached = assetCache.get(key);
    return { root: clone(cached.scene), animations: cached.animations };
  }

  const gltf = await gltfLoader.loadAsync(url);

  // Setup shadows and fix materials for all meshes
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        // Fix dark GLB models by removing metalness (metallic surfaces need environment maps)
        if (child.material.metalness !== undefined) {
          child.material.metalness = 0;
        }
        if (child.material.map) {
          child.material.map.colorSpace = THREE.SRGBColorSpace;
        }
      }
    }
  });

  assetCache.set(key, { scene: gltf.scene, animations: gltf.animations || [] });
  return { root: clone(gltf.scene), animations: gltf.animations || [] };
}

/**
 * Normalize model to target height and ground it
 * @param {THREE.Object3D} object - The 3D object to normalize
 * @param {number} targetHeight - Target height
 * @param {number} sink - How much to sink into ground
 */
function normalizeToHeightAndGround(object, targetHeight, sink = 0.0) {
  const boxBefore = new THREE.Box3().setFromObject(object);
  const heightBefore = (boxBefore.max.y - boxBefore.min.y) || 1;
  const scale = targetHeight / heightBefore;
  object.scale.setScalar(scale);

  const boxAfter = new THREE.Box3().setFromObject(object);
  object.position.y += (-boxAfter.min.y) + sink;
  return object;
}

export class FarmScene {
  constructor(container, onPartnerClick = null, translateFn = null) {
    this.container = container;
    this.onPartnerClick = onPartnerClick;
    this.t = translateFn || ((key) => key);  // Translation function
    this.partners = new Map();
    this.environmentObjects = [];
    this.animationId = null;
    this.assetsLoaded = false;
    this.assetManifest = null;

    // Raycaster for click detection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Pending partner data (for when updatePartners is called before assets are loaded)
    this.pendingPartnerData = null;

    // Speech bubble system
    this.speechTimer = null;
    this.currentSpeakingPartner = null;

    this.init();
  }

  /**
   * Update translation function (called when language changes)
   */
  setTranslation(translateFn) {
    this.t = translateFn || ((key) => key);
    // Update translation for all partners
    for (const partner of this.partners.values()) {
      partner.setTranslation(this.t);
    }
  }

  /**
   * Start the random speech timer (10-30 seconds interval)
   */
  startSpeechTimer() {
    this.stopSpeechTimer();

    const randomDelay = (10 + Math.random() * 20) * 1000; // 10-30 seconds
    this.speechTimer = setTimeout(() => {
      this.triggerRandomSpeech();
      this.startSpeechTimer(); // Schedule next speech
    }, randomDelay);
  }

  /**
   * Stop the speech timer
   */
  stopSpeechTimer() {
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }
  }

  /**
   * Trigger a random partner to speak
   */
  triggerRandomSpeech() {
    if (this.partners.size === 0) return;

    // If someone is already speaking, skip
    if (this.currentSpeakingPartner) return;

    // Pick a random partner
    const partnerArray = Array.from(this.partners.values());
    const randomIndex = Math.floor(Math.random() * partnerArray.length);
    const partner = partnerArray[randomIndex];

    if (partner && partner.data) {
      this.currentSpeakingPartner = partner;

      // Generate speech text based on state (using translation)
      const state = partner.data.state;
      const priceChange = partner.data.priceChange24h;
      let speechText;

      if (state === 'increasing' && priceChange > 0) {
        speechText = this.t('speech.increasing', { percent: priceChange.toFixed(1) });
      } else if (state === 'decreasing' && priceChange < 0) {
        speechText = this.t('speech.decreasing', { percent: Math.abs(priceChange).toFixed(1) });
      } else {
        speechText = this.t('speech.stable');
      }

      partner.showSpeechBubble(speechText, () => {
        this.currentSpeakingPartner = null;
      });
    }
  }

  async init() {
    // Scene setup with sky blue background
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    this.scene.fog = new THREE.Fog(0x87ceeb, 20, 60);

    // Get container dimensions with fallback
    let width = this.container.clientWidth || window.innerWidth;
    let height = this.container.clientHeight || window.innerHeight;

    // Safety check: if dimensions are still 0, wait a frame and retry
    if (width === 0 || height === 0) {
      console.warn('FarmScene: Container has 0 dimensions, using window size');
      width = window.innerWidth;
      height = window.innerHeight - 120; // Account for header
    }

    // Camera setup - lower angle, closer zoom for farm view
    const aspect = width / height || 1;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    this.camera.position.set(0, 8, 18); // Y=8 height, Z=18 distance

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio < 2, // Disable antialiasing on high DPI mobile
      alpha: true,
      powerPreference: 'high-performance' // Request GPU for mobile
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // Controls
    this.setupControls();

    // Lighting
    this.setupLighting();

    // Ground
    this.setupGround();

    // Load assets and environment
    await this.loadAssets();

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this));

    // Handle click for partner selection
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
    this.renderer.domElement.addEventListener('touchend', this.onTouchEnd.bind(this));

    // Start animation loop
    this.animate();

    // Delayed resize check for mobile (layout may not be complete at init time)
    setTimeout(() => {
      this.onResize();
    }, 100);
  }

  /**
   * Handle click events for partner selection
   */
  onClick(event) {
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.checkPartnerClick();
  }

  /**
   * Handle touch events for partner selection (mobile)
   */
  onTouchEnd(event) {
    if (event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

    this.checkPartnerClick();
  }

  /**
   * Use raycaster to check if a partner was clicked
   */
  checkPartnerClick() {
    if (!this.onPartnerClick) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Collect all clickable objects from partners
    const clickableObjects = [];
    for (const [address, partner] of this.partners) {
      if (partner.group) {
        // Add all meshes in the partner group
        partner.group.traverse((child) => {
          if (child.isMesh) {
            child.userData.partnerAddress = address;
            clickableObjects.push(child);
          }
        });
      }
    }

    const intersects = this.raycaster.intersectObjects(clickableObjects, false);

    if (intersects.length > 0) {
      const address = intersects[0].object.userData.partnerAddress;
      const partner = this.partners.get(address);
      if (partner && partner.data) {
        this.onPartnerClick(partner.data);
      }
    }
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minPolarAngle = Math.PI / 6;
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

    const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
    const right = new THREE.Vector3();
    right.crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

    const panOffset = new THREE.Vector3();

    if (this.keysPressed.w) panOffset.add(forward.clone().multiplyScalar(this.panSpeed));
    if (this.keysPressed.s) panOffset.add(forward.clone().multiplyScalar(-this.panSpeed));
    if (this.keysPressed.a) panOffset.add(right.clone().multiplyScalar(this.panSpeed));
    if (this.keysPressed.d) panOffset.add(right.clone().multiplyScalar(-this.panSpeed));

    if (panOffset.length() > 0) {
      this.camera.position.add(panOffset);
      this.controls.target.add(panOffset);
    }
  }

  setupLighting() {
    // Bright ambient light for daytime feel
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    // Sun light (reduced shadow map for better performance)
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    sunLight.position.set(10, 20, 10);
    sunLight.castShadow = true;
    // Reduced from 2048 to 1024 for memory savings (~4x less memory)
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    this.scene.add(sunLight);

    // Hemisphere light for natural sky/ground coloring
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5c3a, 0.4);
    this.scene.add(hemiLight);
  }

  setupGround() {
    // Large grass plane
    const groundGeometry = new THREE.PlaneGeometry(80, 80);
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: 0x4a7c4e, // Grass green
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Add subtle ground variation with small patches
    this.addGroundPatches();
  }

  addGroundPatches() {
    // Darker grass patches for variety - elevated above ground to prevent z-fighting
    const patchGeometry = new THREE.CircleGeometry(2, 8);
    const patchColors = [0x3d6b40, 0x5a8f5d, 0x426b45];

    for (let i = 0; i < 20; i++) {
      const material = new THREE.MeshLambertMaterial({
        color: patchColors[Math.floor(Math.random() * patchColors.length)]
      });
      const patch = new THREE.Mesh(patchGeometry, material);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(
        (Math.random() - 0.5) * 40,
        0.05,  // Raised higher to completely eliminate z-fighting
        (Math.random() - 0.5) * 40
      );
      patch.scale.setScalar(0.5 + Math.random() * 1.5);
      patch.receiveShadow = true;
      this.scene.add(patch);
    }
  }

  async loadAssets() {
    try {
      const response = await fetch('/assets.json');
      this.assetManifest = await response.json();

      // Setup environment decorations
      await this.setupEnvironment();

      this.assetsLoaded = true;

      // Process any pending partner data that arrived before assets were loaded
      if (this.pendingPartnerData) {
        await this.updatePartners(this.pendingPartnerData);
        this.pendingPartnerData = null;
      }

      // Start the speech timer after assets are loaded
      this.startSpeechTimer();
    } catch (error) {
      console.error('Failed to load assets:', error);
      this.assetsLoaded = true; // Continue without environment

      // Still try to process pending partners with fallback models
      if (this.pendingPartnerData) {
        await this.updatePartners(this.pendingPartnerData);
        this.pendingPartnerData = null;
      }

      // Start the speech timer even on error
      this.startSpeechTimer();
    }
  }

  async setupEnvironment() {
    if (!this.assetManifest) return;

    const envAssets = this.assetManifest.environment;
    const farmRadius = 12;
    const outerRadius = 16;

    // Trees around the perimeter (reduced from 15 to 10)
    const treeAssets = envAssets.filter(a => a.key.startsWith('tree'));
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
      const radius = outerRadius + Math.random() * 5;  // 16-21 units from center
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const treeAsset = treeAssets[Math.floor(Math.random() * treeAssets.length)];
      try {
        const { root } = await loadGltf(treeAsset.key, treeAsset.path);
        normalizeToHeightAndGround(root, 3 + Math.random() * 2);
        root.position.set(x, 0, z);
        root.rotation.y = Math.random() * Math.PI * 2;
        this.scene.add(root);
        this.environmentObjects.push(root);
      } catch (e) {
        console.warn('Failed to load tree:', e);
      }
    }

    // Bushes around the farm area (reduced from 12 to 8)
    const bushAsset = envAssets.find(a => a.key === 'bush');
    if (bushAsset) {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
        const radius = farmRadius + 2 + Math.random() * 3;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        try {
          const { root } = await loadGltf(bushAsset.key, bushAsset.path);
          normalizeToHeightAndGround(root, 0.8 + Math.random() * 0.4);
          root.position.set(x, 0, z);
          root.rotation.y = Math.random() * Math.PI * 2;
          this.scene.add(root);
          this.environmentObjects.push(root);
        } catch (e) {
          console.warn('Failed to load bush:', e);
        }
      }
    }

    // Flowers scattered in the farm (reduced from 20 to 12)
    const flowerAssets = envAssets.filter(a => a.key.startsWith('flower'));
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() - 0.5) * farmRadius * 2;
      const z = (Math.random() - 0.5) * farmRadius * 2;

      // Don't place flowers too close to center
      if (Math.sqrt(x*x + z*z) < 4) continue;

      const flowerAsset = flowerAssets[Math.floor(Math.random() * flowerAssets.length)];
      if (flowerAsset) {
        try {
          const { root } = await loadGltf(flowerAsset.key, flowerAsset.path);
          normalizeToHeightAndGround(root, 0.3 + Math.random() * 0.2);
          root.position.set(x, 0, z);
          root.rotation.y = Math.random() * Math.PI * 2;
          this.scene.add(root);
          this.environmentObjects.push(root);
        } catch (e) {
          console.warn('Failed to load flower:', e);
        }
      }
    }

    // Grass tufts (reduced from 30 to 15)
    const grassAssets = envAssets.filter(a => a.key.startsWith('grass'));
    for (let i = 0; i < 15; i++) {
      const x = (Math.random() - 0.5) * 30;
      const z = (Math.random() - 0.5) * 30;

      const grassAsset = grassAssets[Math.floor(Math.random() * grassAssets.length)];
      if (grassAsset) {
        try {
          const { root } = await loadGltf(grassAsset.key, grassAsset.path);
          normalizeToHeightAndGround(root, 0.2 + Math.random() * 0.1);
          root.position.set(x, 0, z);
          root.rotation.y = Math.random() * Math.PI * 2;
          this.scene.add(root);
          this.environmentObjects.push(root);
        } catch (e) {
          console.warn('Failed to load grass:', e);
        }
      }
    }

    // Rocks scattered (reduced from 8 to 5)
    const rockAssets = envAssets.filter(a => a.key.startsWith('rock'));
    for (let i = 0; i < 5; i++) {
      const x = (Math.random() - 0.5) * 25;
      const z = (Math.random() - 0.5) * 25;

      const rockAsset = rockAssets[Math.floor(Math.random() * rockAssets.length)];
      if (rockAsset) {
        try {
          const { root } = await loadGltf(rockAsset.key, rockAsset.path);
          normalizeToHeightAndGround(root, 0.3 + Math.random() * 0.3);
          root.position.set(x, 0, z);
          root.rotation.y = Math.random() * Math.PI * 2;
          this.scene.add(root);
          this.environmentObjects.push(root);
        } catch (e) {
          console.warn('Failed to load rock:', e);
        }
      }
    }
  }

  /**
   * Update partners display with low-poly character models
   * @param {Array} partnerData - Array of partner objects from API
   */
  async updatePartners(partnerData) {
    // If assets aren't loaded yet, save the data for later processing
    if (!this.assetsLoaded) {
      this.pendingPartnerData = partnerData;
      return;
    }

    const currentAddresses = new Set(partnerData.map(p => p.tokenAddress));

    // Remove partners that are no longer in top 10
    for (const [address, partner] of this.partners) {
      if (!currentAddresses.has(address)) {
        this.removePartner(address);
      }
    }

    // Add or update partners
    for (let i = 0; i < partnerData.length; i++) {
      const data = partnerData[i];
      if (this.partners.has(data.tokenAddress)) {
        this.updatePartner(data);
      } else {
        await this.addPartner(data, i);
      }
    }

    // Arrange partners in a semi-circle
    this.arrangePartners(partnerData.length);
  }

  /**
   * Add a new partner with character model
   */
  async addPartner(data, index) {
    // First token (index 0) uses Adventurer with state-based animations
    const isFirstToken = (index === 0);
    const partner = new PartnerCharacter(data, this.assetManifest, isFirstToken, this.t);
    await partner.init();
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
   * Arrange partners in a grid/spread around center (0, 0)
   */
  arrangePartners(count) {
    const partners = Array.from(this.partners.values());

    // Arrange in a spread pattern centered at (0, 0)
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = 6; // Space between characters (increased to prevent overlap)

    partners.forEach((partner, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;

      // Center the grid
      const totalWidth = (cols - 1) * spacing;
      const totalDepth = (Math.ceil(count / cols) - 1) * spacing;

      const targetX = col * spacing - totalWidth / 2;
      const targetZ = row * spacing - totalDepth / 2;

      partner.setTargetPosition(targetX, 0, targetZ);
      // Direction is set by pickNewDirection() in setTargetPosition
    });
  }

  animate() {
    this.animationId = requestAnimationFrame(this.animate.bind(this));

    // Handle keyboard pan
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
    // Get actual dimensions with fallback
    let width = this.container.clientWidth;
    let height = this.container.clientHeight;

    // Skip if dimensions are 0 (container not visible)
    if (width === 0 || height === 0) {
      return;
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Get memory and rendering statistics for debugging
   * @returns {object} Stats object
   */
  getStats() {
    return getMemoryStats(this.renderer);
  }

  dispose() {
    // Stop speech timer
    this.stopSpeechTimer();

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    for (const partner of this.partners.values()) {
      partner.dispose();
    }

    for (const obj of this.environmentObjects) {
      obj.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          child.material?.dispose();
        }
      });
    }

    if (this.controls) {
      this.controls.dispose();
    }

    // Remove event listeners
    this.renderer.domElement.removeEventListener('click', this.onClick.bind(this));
    this.renderer.domElement.removeEventListener('touchend', this.onTouchEnd.bind(this));

    this.renderer.dispose();
    window.removeEventListener('resize', this.onResize.bind(this));

    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

/**
 * PartnerCharacter - Individual token partner using character model
 * Character skin is determined by partner.skin from backend
 * State-based animation: up=Running+Cheer, down=Situps, flat=Walking
 * Available skins: villager, villager2, villagerGirl, villagerGirl2, adventurer, mage, knight
 */
class PartnerCharacter {
  constructor(data, assetManifest, isFirstToken = false, translateFn = null) {
    this.data = data;
    this.assetManifest = assetManifest;
    this.isFirstToken = isFirstToken;  // Legacy flag, all tokens now use animated characters
    this.t = translateFn || ((key) => key);  // Translation function
    this.group = new THREE.Group();
    this.basePosition = new THREE.Vector3();  // Center position for wandering
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = 0;
    this.hpAnimationProgress = 0;
    this.model = null;
    this.mixer = null;
    this.animationClips = null;  // Store raw animation clips
    this.currentAction = null;
    this.clock = new THREE.Clock();

    // State-based animation for animated characters (Villager/Adventurer)
    this.characterType = 'villager';  // Default character type
    this.animationModels = {};  // Cache: { walking, running, cheer, situps, talk }
    this.currentAnimationType = null;
    this.cheerAlternateTimer = 0;  // Timer for Running/Cheer alternation
    this.isCheeringPhase = false;  // Track which phase of up animation
    this.faceAwayDuringCheer = false;  // Rotate 180° during cheer

    // Simplified movement state - characters can roam the entire farm
    this.moveState = {
      isMoving: true,
      moveDirection: new THREE.Vector3(),
      moveSpeed: 0.5,  // Default: walking speed (half of running)
      farmRadius: 11,  // Characters can roam within farm area (slightly inside boundary)
      directionChangeTimer: 0
    };

    // Speech bubble state
    this.speechBubble = null;
    this.isSpeaking = false;
    this.speechTimeout = null;
    this.fadeTimeout = null;
    this.animationBeforeSpeech = null;
    this.rotationBeforeSpeech = null;
    this.headBone = null;
    this.headRotationBeforeSpeech = null;
    this.speakingHeadTilt = undefined;
  }

  async init() {
    await this.loadCharacterModel();
    this.createHPBar();
    // Level badge removed to reduce visual clutter
    this.createNameLabel();
    this.createSpeechBubble();
    // Adjust positions based on initial animation state (e.g., situps needs lower positions)
    this.adjustPositionsForAnimation();
    this.startAnimation();
    // pickNewDirection() is called by setTargetPosition() when position is assigned
  }

  /**
   * Update translation function (called when language changes)
   */
  setTranslation(translateFn) {
    this.t = translateFn || ((key) => key);
  }

  /**
   * Adjust HP bar and name label positions based on current animation
   */
  adjustPositionsForAnimation() {
    const anim = this.currentAnimationType;
    const hpBars = this.data.hpBars;
    const showBar2 = hpBars?.bar2?.show && hpBars?.bar2?.green > 0;
    const showBar3 = hpBars?.bar3?.show && hpBars?.bar3?.green > 0;

    if (anim === 'situps') {
      // Situps: lower positions, but still account for number of HP bars
      if (showBar3) {
        if (this.hpBarGroup) this.hpBarGroup.position.y = 1.3;
        if (this.nameLabel) this.nameLabel.position.y = 1.9;
      } else if (showBar2) {
        if (this.hpBarGroup) this.hpBarGroup.position.y = 1.2;
        if (this.nameLabel) this.nameLabel.position.y = 1.6;
      } else {
        if (this.hpBarGroup) this.hpBarGroup.position.y = 1.2;
        if (this.nameLabel) this.nameLabel.position.y = 1.45;
      }
    } else {
      // Default positions
      if (this.hpBarGroup) this.hpBarGroup.position.y = 2.2;
      if (this.nameLabel) {
        if (showBar3) {
          this.nameLabel.position.y = 2.7;
        } else if (showBar2) {
          this.nameLabel.position.y = 2.65;
        } else {
          this.nameLabel.position.y = 2.45;
        }
      }
    }
  }

  /**
   * Create the speech bubble (hidden by default)
   */
  createSpeechBubble() {
    // Create canvas for speech bubble
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    this.speechCanvas = canvas;
    this.speechContext = canvas.getContext('2d');

    // Preload token logo for speech bubble
    this.tokenLogoImage = null;
    this.logoLoadAttempts = 0;
    this.loadTokenLogo();

    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false
    });

    this.speechBubble = new THREE.Sprite(material);
    this.speechBubble.scale.set(3, 1.5, 1);
    this.speechBubble.position.y = 3.5; // Above the character
    this.speechBubble.visible = false;

    this.group.add(this.speechBubble);
  }

  /**
   * Load the token logo with retry mechanism
   */
  loadTokenLogo() {
    if (!this.data.logoUrl || this.tokenLogoImage) return;

    const logoUrl = this.data.logoUrl;
    this.logoLoadAttempts++;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.tokenLogoImage = img;
      // If bubble is currently visible, redraw it with the logo
      if (this.speechBubble?.visible && this.currentSpeechText) {
        this.drawSpeechBubble(this.currentSpeechText);
      }
    };
    img.onerror = () => {
      // Retry up to 3 times with delay
      if (this.logoLoadAttempts < 3) {
        setTimeout(() => this.loadTokenLogo(), 1000 * this.logoLoadAttempts);
      } else {
        console.warn('Failed to load token logo after retries:', logoUrl);
      }
    };
    img.src = logoUrl;
  }

  /**
   * Draw the speech bubble with text and token logo (RPG dialog style)
   */
  drawSpeechBubble(text) {
    const ctx = this.speechContext;
    const canvas = this.speechCanvas;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bubble background
    const padding = 20;
    const bubbleWidth = canvas.width - padding * 2;
    const bubbleHeight = canvas.height - 60;
    const cornerRadius = 20;

    // Logo dimensions
    const logoSize = 70;
    const logoMargin = 15;
    const hasLogo = !!this.tokenLogoImage;
    const textOffsetX = hasLogo ? logoSize + logoMargin * 2 : 0;

    ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;

    // Rounded rectangle
    ctx.beginPath();
    ctx.moveTo(padding + cornerRadius, padding);
    ctx.lineTo(padding + bubbleWidth - cornerRadius, padding);
    ctx.quadraticCurveTo(padding + bubbleWidth, padding, padding + bubbleWidth, padding + cornerRadius);
    ctx.lineTo(padding + bubbleWidth, padding + bubbleHeight - cornerRadius);
    ctx.quadraticCurveTo(padding + bubbleWidth, padding + bubbleHeight, padding + bubbleWidth - cornerRadius, padding + bubbleHeight);

    // Tail (pointing down)
    ctx.lineTo(canvas.width / 2 + 15, padding + bubbleHeight);
    ctx.lineTo(canvas.width / 2, padding + bubbleHeight + 30);
    ctx.lineTo(canvas.width / 2 - 15, padding + bubbleHeight);

    ctx.lineTo(padding + cornerRadius, padding + bubbleHeight);
    ctx.quadraticCurveTo(padding, padding + bubbleHeight, padding, padding + bubbleHeight - cornerRadius);
    ctx.lineTo(padding, padding + cornerRadius);
    ctx.quadraticCurveTo(padding, padding, padding + cornerRadius, padding);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Draw token logo as avatar (RPG style)
    if (hasLogo) {
      const logoX = padding + logoMargin;
      const logoY = padding + (bubbleHeight - logoSize) / 2;

      // Draw circular clip for logo
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.tokenLogoImage, logoX, logoY, logoSize, logoSize);
      ctx.restore();

      // Draw border around logo
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Word wrap with adjusted width for logo
    const textAreaWidth = bubbleWidth - textOffsetX - 40;
    const lineHeight = 36;
    const words = text.split('');
    let line = '';
    const lines = [];

    for (const char of words) {
      const testLine = line + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > textAreaWidth && line !== '') {
        lines.push(line);
        line = char;
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // Draw lines (left-aligned after logo)
    const totalHeight = lines.length * lineHeight;
    const startY = padding + (bubbleHeight - totalHeight) / 2 + lineHeight / 2;
    const textX = padding + textOffsetX + 10;

    lines.forEach((line, i) => {
      ctx.fillText(line, textX, startY + i * lineHeight);
    });

    // Update texture
    this.speechBubble.material.map.needsUpdate = true;
  }

  /**
   * Show speech bubble with text, switch to talk animation, and auto-hide after 5 seconds
   */
  showSpeechBubble(text, onComplete) {
    // Clear any existing timeouts
    if (this.speechTimeout) clearTimeout(this.speechTimeout);
    if (this.fadeTimeout) clearTimeout(this.fadeTimeout);

    // Store text for potential redraw when logo loads
    this.currentSpeechText = text;

    // Try to load logo if not yet loaded
    if (!this.tokenLogoImage && this.data.logoUrl) {
      this.logoLoadAttempts = 0;
      this.loadTokenLogo();
    }

    // Draw the bubble
    this.drawSpeechBubble(text);

    // Show bubble
    this.speechBubble.visible = true;
    this.speechBubble.material.opacity = 1;
    this.isSpeaking = true;

    // Store current animation to restore later
    this.animationBeforeSpeech = this.currentAnimationType;

    // Switch to talk animation
    this.switchToTalkAnimation();

    // After 5 seconds, start fade out
    this.speechTimeout = setTimeout(() => {
      this.currentSpeechText = null;
      this.fadeSpeechBubble(onComplete);
    }, 5000);
  }

  /**
   * Switch to talk animation while speaking
   */
  async switchToTalkAnimation() {
    // Store current rotation to restore later
    this.rotationBeforeSpeech = this.group.rotation.y;

    // Lazy load talk animation if not yet loaded
    if (!this.animationModels.talk && this.characterType) {
      await this.loadSingleAnimation(this.characterType, 'talk');
    }

    // For Adventurer with multiple animation models
    if (this.animationModels.talk) {
      // Hide all models, show the talk one
      for (const [type, data] of Object.entries(this.animationModels)) {
        if (data.root) {
          data.root.visible = (type === 'talk');
        }
      }
      this.currentAnimationType = 'talk';
      this.model = this.animationModels.talk.root;

      // Adjust positions back to default (talk is not situps)
      this.adjustPositionsForAnimation();

      // Tilt head up 0 degrees when speaking
      this.tiltHeadUp(this.model, 0 * Math.PI / 180);
    }

    // Face the camera (rotate to face toward viewer, slightly to the right by 5 degrees)
    this.group.rotation.y = -5 * Math.PI / 180;

    // Stop movement
    this.moveState.isMoving = false;
  }

  /**
   * Tilt the character's head up
   * @param {THREE.Object3D} model - The character model
   * @param {number} angle - Angle in radians (positive = look up)
   */
  tiltHeadUp(model, angle) {
    if (!model) return;

    // Common head bone names in different models
    const headBoneNames = ['Head', 'head', 'Bip001_Head', 'mixamorigHead'];

    let headBone = null;
    for (const name of headBoneNames) {
      headBone = model.getObjectByName(name);
      if (headBone) break;
    }

    // If not found by name, search for any bone containing 'head'
    if (!headBone) {
      model.traverse((child) => {
        if (child.isBone && child.name.toLowerCase().includes('head')) {
          headBone = child;
        }
      });
    }

    if (headBone) {
      // Store original rotation and bone reference
      this.headRotationBeforeSpeech = headBone.rotation.x;
      this.headBone = headBone;

      // Set the tilt value to be applied continuously in animate()
      // (negative X rotation = look up)
      this.speakingHeadTilt = -angle;
      console.log(`Head bone "${headBone.name}" tilted up ${(angle * 180 / Math.PI).toFixed(0)} degrees`);
    } else {
      console.log('Head bone not found. Available bones:');
      model.traverse((child) => {
        if (child.isBone) console.log('  -', child.name);
      });
    }
  }

  /**
   * Fade out the speech bubble over 1 second
   */
  fadeSpeechBubble(onComplete) {
    const startOpacity = 1;
    const duration = 1000;
    const startTime = Date.now();

    const fade = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const opacity = startOpacity * (1 - progress);

      this.speechBubble.material.opacity = opacity;

      if (progress < 1) {
        this.fadeTimeout = setTimeout(fade, 16);
      } else {
        this.speechBubble.visible = false;
        this.isSpeaking = false;
        // Restore to animation before speech
        this.restoreAnimationAfterSpeech();
        if (onComplete) onComplete();
      }
    };

    fade();
  }

  /**
   * Restore animation state after speaking
   */
  restoreAnimationAfterSpeech() {
    // Restore body rotation
    if (this.rotationBeforeSpeech !== undefined) {
      this.group.rotation.y = this.rotationBeforeSpeech;
      this.targetRotation = this.rotationBeforeSpeech;
    }

    // Clear head tilt override
    this.speakingHeadTilt = undefined;

    // For characters with multiple animation models
    if (Object.keys(this.animationModels).length > 0) {
      // Force update to state-based animation
      this.currentAnimationType = null; // Reset so updateAdventurerAnimation will re-apply
      this.updateAdventurerAnimation();
    } else {
      // For other characters, resume via resumeAnimation
      this.resumeAnimation();
    }
  }

  /**
   * Pause all animations
   */
  pauseAnimation() {
    // For characters with multiple animation models
    if (Object.keys(this.animationModels).length > 0) {
      for (const data of Object.values(this.animationModels)) {
        if (data.mixer) {
          data.mixer.timeScale = 0;
        }
      }
    }

    // For other characters
    if (this.mixer) {
      this.mixer.timeScale = 0;
    }

    // Stop movement
    this.moveState.isMoving = false;
  }

  /**
   * Resume all animations
   */
  resumeAnimation() {
    // For characters with multiple animation models
    if (Object.keys(this.animationModels).length > 0) {
      for (const data of Object.values(this.animationModels)) {
        if (data.mixer) {
          data.mixer.timeScale = 1;
        }
      }
    }

    // For other characters
    if (this.mixer) {
      this.mixer.timeScale = 1;
    }

    // Resume movement based on state
    const state = this.data.state;
    if (state === 'decreasing') {
      this.moveState.isMoving = false;
    } else {
      this.moveState.isMoving = true;
    }
  }

  async loadCharacterModel() {
    if (!this.assetManifest) {
      this.createFallbackModel();
      return;
    }

    // ALL tokens use animated character with state-based animations
    // Use the skin from partner data, fallback to 'villager' if not set
    const skin = this.data.skin || 'villager';
    const animKey = `${skin}Animations`;

    if (this.assetManifest[animKey]) {
      await this.loadAnimatedCharacter(skin);
      return;
    }

    // Fallback to villager if the specified skin animations aren't found
    if (this.assetManifest.villagerAnimations) {
      await this.loadAnimatedCharacter('villager');
      return;
    }

    // Fallback: Select character model based on token symbol hash (no state-based animations)
    const characters = this.assetManifest.characters;
    const hash = this.hashString(this.data.tokenAddress || 'default');
    const characterAsset = characters[hash % characters.length];

    try {
      const { root, animations } = await loadGltf(
        characterAsset.key + '_' + this.data.tokenAddress,
        characterAsset.path
      );

      this.model = root;

      // Use fixed scale for Meshy GLB models
      if (characterAsset.path.endsWith('.glb')) {
        this.model.scale.setScalar(1);
        this.model.position.y = 0; // Ground level
      } else {
        normalizeToHeightAndGround(this.model, 1.5);
      }

      // Fix dark/washed-out colors by removing metalness
      this.model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.metalness = 0;
          child.material.roughness = 1;
        }
      });

      this.group.add(this.model);

      // Setup animation mixer and store animation clips
      if (animations && animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.model);
        this.animationClips = animations; // Store raw clips
        console.log('Loaded animations:', animations.map(c => c.name));
      }

      // Skip level tint for now - may cause color issues with GLB models
      // this.applyLevelTint();
    } catch (error) {
      console.warn('Failed to load character model:', error);
      this.createFallbackModel();
    }
  }

  /**
   * Load animated character models with lazy loading
   * Only loads the animation needed for current state initially
   * Other animations are loaded on-demand when state changes
   * @param {string} characterType - Character skin type (villager, villager2, villagerGirl, villagerGirl2, adventurer, mage, knight)
   */
  async loadAnimatedCharacter(characterType = 'villager') {
    // Look up animation paths dynamically based on character type
    const animKey = `${characterType}Animations`;
    const animPaths = this.assetManifest[animKey];

    if (!animPaths) {
      console.warn(`No animations found for ${characterType}, falling back to villager`);
      // Try villager as fallback
      if (characterType !== 'villager' && this.assetManifest.villagerAnimations) {
        await this.loadAnimatedCharacter('villager');
        return;
      }
      this.createFallbackModel();
      return;
    }

    this.characterType = characterType;
    this.animPaths = animPaths;  // Store for lazy loading

    // Determine which animation to load based on initial state
    const state = this.data.state;
    let initialAnim;
    if (state === 'increasing') {
      initialAnim = 'running';  // Will alternate with cheer later
    } else if (state === 'decreasing') {
      initialAnim = 'situps';
    } else {
      initialAnim = 'walking';
    }

    // Only load the initial animation (lazy loading)
    await this.loadSingleAnimation(characterType, initialAnim);

    // Apply character-specific scale (villagerGirl is a younger/smaller character)
    const characterScales = {
      villagerGirl: 0.8
    };
    const scaleFactor = characterScales[characterType] || 1.0;
    this.group.scale.setScalar(scaleFactor);

    // Set initial animation
    this.updateAdventurerAnimation();
  }

  /**
   * Load a single animation model on demand
   * @param {string} characterType - Character type
   * @param {string} animType - Animation type (walking, running, cheer, situps, talk)
   */
  async loadSingleAnimation(characterType, animType) {
    // Skip if already loaded
    if (this.animationModels[animType]) return;

    const animKey = `${characterType}Animations`;
    const animPaths = this.assetManifest[animKey];
    if (!animPaths) return;

    const path = animPaths[animType];
    if (!path) return;

    try {
      // IMPORTANT: Cache key is just characterType_type so all instances share the same loaded model
      // SkeletonUtils.clone() creates instance-specific copies with shared geometry
      const { root, animations } = await loadGltf(
        `${characterType}_${animType}`,
        path
      );

      // Setup model
      root.scale.setScalar(1);
      root.position.y = 0;
      root.visible = false;  // Start hidden

      // Ensure consistent material settings after clone (fix washed-out colors)
      root.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.metalness = 0;
          child.material.roughness = 1;
        }
      });

      this.group.add(root);

      // Setup mixer and start animation
      let mixer = null;
      let action = null;
      if (animations && animations.length > 0) {
        mixer = new THREE.AnimationMixer(root);
        action = mixer.clipAction(animations[0]);
        action.setLoop(THREE.LoopRepeat);
        action.play();
      }

      this.animationModels[animType] = { root, mixer, action };
      console.log(`Lazy loaded ${characterType} ${animType} animation`);
    } catch (error) {
      console.warn(`Failed to load ${characterType} ${animType} animation:`, error);
    }
  }

  /**
   * Update animated character (Villager/Adventurer) animation based on token state
   * - increasing: Running + Cheer alternating (Cheer faces away)
   * - decreasing: Situps (stationary)
   * - stable/null: Walking (slower movement)
   */
  async updateAdventurerAnimation() {
    const state = this.data.state;
    let targetAnim;

    if (state === 'increasing') {
      // Alternate between running and cheer
      targetAnim = this.isCheeringPhase ? 'cheer' : 'running';
      // Running: move at full speed; Cheer: stay stationary to avoid drifting
      this.moveState.isMoving = !this.isCheeringPhase;
      this.moveState.moveSpeed = 1;  // Full speed when running
    } else if (state === 'decreasing') {
      targetAnim = 'situps';
      this.moveState.isMoving = false;  // Stop moving during situps
    } else {
      // stable or no state
      targetAnim = 'walking';
      this.moveState.isMoving = true;
      this.moveState.moveSpeed = 0.5;  // Half speed for walking
    }

    if (targetAnim === this.currentAnimationType) return;

    // Lazy load the animation if not yet loaded
    if (!this.animationModels[targetAnim] && this.characterType) {
      await this.loadSingleAnimation(this.characterType, targetAnim);
    }

    // Check if animation is available after loading attempt
    if (!this.animationModels[targetAnim]) {
      console.warn(`Animation ${targetAnim} not available for ${this.characterType}`);
      return;
    }

    // Hide all models, show the target one
    for (const [type, data] of Object.entries(this.animationModels)) {
      if (data.root) {
        data.root.visible = (type === targetAnim);
      }
    }

    // Cheer faces toward camera (faceAwayDuringCheer = false)
    this.faceAwayDuringCheer = false;

    this.currentAnimationType = targetAnim;
    this.model = this.animationModels[targetAnim]?.root;

    // Adjust nameLabel and HP bar position based on animation
    this.adjustPositionsForAnimation();

    console.log(`Animation: ${targetAnim}, moving: ${this.moveState.isMoving}`);
  }

  /**
   * Start the Walking animation (for non-Adventurer characters)
   */
  startAnimation() {
    // Animated characters use separate animation models, skip this
    if (Object.keys(this.animationModels).length > 0) return;

    if (!this.mixer || !this.animationClips) {
      console.warn('No mixer or animation clips available');
      return;
    }

    console.log('Available clips:', this.animationClips.map((c, i) => `${i}: ${c.name}`));

    // Stop all animations
    this.mixer.stopAllAction();

    // Find Walking animation or use first available
    let clip = this.animationClips.find(c => c.name.toLowerCase().includes('walk'));
    if (!clip && this.animationClips.length > 0) {
      clip = this.animationClips[0];
    }

    if (!clip) {
      console.warn('No animation clips found');
      return;
    }

    // Create and play the action
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.clampWhenFinished = false;
    action.setLoop(THREE.LoopRepeat);
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    action.play();
    this.currentAction = action;
    console.log('Started animation:', clip.name);
  }

  /**
   * Pick a new random movement direction
   */
  pickNewDirection() {
    const angle = Math.random() * Math.PI * 2;
    this.moveState.moveDirection.set(
      Math.cos(angle),
      0,
      Math.sin(angle)
    );
    this.targetRotation = Math.atan2(
      this.moveState.moveDirection.x,
      this.moveState.moveDirection.z
    );
    this.moveState.directionChangeTimer = 2 + Math.random() * 3; // Change direction every 2-5 seconds
  }

  createFallbackModel() {
    // Simple box character as fallback
    const geometry = new THREE.BoxGeometry(0.6, 1.2, 0.4);
    const material = new THREE.MeshLambertMaterial({
      color: this.getColorFromSymbol(this.data.tokenSymbol)
    });
    this.model = new THREE.Mesh(geometry, material);
    this.model.position.y = 0.6;
    this.model.castShadow = true;
    this.group.add(this.model);
  }

  applyLevelTint() {
    if (!this.model) return;

    const level = this.data.level || 1;
    let tintColor;

    if (level >= 60) {
      tintColor = new THREE.Color(0xffd700); // Gold
    } else if (level >= 50) {
      tintColor = new THREE.Color(0xff69b4); // Pink
    } else if (level >= 40) {
      tintColor = new THREE.Color(0x9966ff); // Purple
    } else if (level >= 30) {
      tintColor = new THREE.Color(0xff8c00); // Orange
    } else if (level >= 20) {
      tintColor = new THREE.Color(0x4169e1); // Blue
    } else if (level >= 10) {
      tintColor = new THREE.Color(0x32cd32); // Green
    } else {
      return; // No tint for low level
    }

    // Apply subtle emissive tint
    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.emissive = tintColor;
        child.material.emissiveIntensity = 0.15;
      }
    });
  }

  createHPBar() {
    const barGroup = new THREE.Group();
    barGroup.position.y = 2.2;

    // HP bar configuration
    const barWidth = 1.2;
    const barHeight = 0.12;
    const segmentCount = 10;
    const segmentGap = 0.02;
    const segmentWidth = (barWidth - segmentGap * (segmentCount - 1)) / segmentCount;
    const barSpacing = 0.16; // Vertical spacing between bars

    // Store segment meshes for each bar
    this.hpSegments = { bar1: [], bar2: [], bar3: [] };

    // Create 3 bars (bar1 at bottom, bar3 at top)
    for (let barIndex = 0; barIndex < 3; barIndex++) {
      const barKey = `bar${barIndex + 1}`;
      const barY = barIndex * barSpacing;

      // Background for this bar
      const bgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
      const bgMaterial = new THREE.MeshBasicMaterial({
        color: 0x1a1a1a,
        transparent: true,
        opacity: barIndex === 0 ? 0.9 : 0.6
      });
      const bg = new THREE.Mesh(bgGeometry, bgMaterial);
      bg.position.y = barY;
      bg.visible = barIndex === 0; // Only bar1 visible by default
      barGroup.add(bg);

      // Store background reference for visibility control
      if (barIndex === 1) this.hpBar2Bg = bg;
      if (barIndex === 2) this.hpBar3Bg = bg;

      // Create 10 segments for this bar
      for (let i = 0; i < segmentCount; i++) {
        const segGeometry = new THREE.PlaneGeometry(segmentWidth - 0.01, barHeight - 0.02);
        const segMaterial = new THREE.MeshBasicMaterial({
          color: 0x22c55e, // Default green
          transparent: true,
          opacity: 0.95
        });
        const segment = new THREE.Mesh(segGeometry, segMaterial);

        // Position segment (left to right)
        const xPos = -barWidth / 2 + segmentWidth / 2 + i * (segmentWidth + segmentGap);
        segment.position.set(xPos, barY, 0.01);
        segment.visible = barIndex === 0; // Only bar1 visible by default

        barGroup.add(segment);
        this.hpSegments[barKey].push(segment);
      }
    }

    this.hpBarGroup = barGroup;
    this.group.add(barGroup);

    // Initial update
    this.updateHPBars();
  }

  /**
   * Update HP bars based on hpBars data from backend
   */
  updateHPBars() {
    const hpBars = this.data.hpBars;

    if (!hpBars || !this.hpSegments) {
      // Fallback: show full green bar1
      this.hpSegments?.bar1?.forEach(seg => {
        seg.visible = true;
        seg.material.color.setHex(0x22c55e);
      });
      return;
    }

    const greenColor = 0x22c55e;
    const redColor = 0xef4444;

    // Update Bar 1 (always visible)
    const bar1Data = hpBars.bar1 || { green: 10, red: 0 };
    this.hpSegments.bar1.forEach((seg, i) => {
      seg.visible = true;
      // Green segments from left, red segments from right
      if (i < bar1Data.green) {
        seg.material.color.setHex(greenColor);
      } else {
        seg.material.color.setHex(redColor);
      }
    });

    // Update Bar 2 (shows when multiplier > 1)
    const bar2Data = hpBars.bar2 || { green: 0, show: false };
    const showBar2 = bar2Data.show && bar2Data.green > 0;

    if (this.hpBar2Bg) {
      this.hpBar2Bg.visible = showBar2; // Show dark background when bar2 is active
    }
    this.hpSegments.bar2.forEach((seg, i) => {
      // Only show filled green blocks, hide empty ones
      const isFilled = i < bar2Data.green;
      seg.visible = showBar2 && isFilled;
      if (seg.visible) {
        seg.material.color.setHex(greenColor);
        seg.material.opacity = 0.95;
      }
    });

    // Update Bar 3 (shows when multiplier >= 10)
    const bar3Data = hpBars.bar3 || { green: 0, show: false };
    const showBar3 = bar3Data.show && bar3Data.green > 0;

    if (this.hpBar3Bg) {
      this.hpBar3Bg.visible = showBar3; // Show dark background when bar3 is active
    }
    this.hpSegments.bar3.forEach((seg, i) => {
      // Only show filled green blocks, hide empty ones
      const isFilled = i < bar3Data.green;
      seg.visible = showBar3 && isFilled;
      if (seg.visible) {
        seg.material.color.setHex(greenColor);
        seg.material.opacity = 0.95;
      }
    });

    // Adjust name label position based on number of visible bars
    if (this.nameLabel) {
      if (showBar3) {
        this.nameLabel.position.y = 2.7; // Move up when 3 bars visible
      } else if (showBar2) {
        this.nameLabel.position.y = 2.6; // Move up when 2 bars visible
      } else {
        this.nameLabel.position.y = 2.45; // Default position for 1 bar
      }
    }
  }

  createLevelBadge() {
    const level = this.data.level || 1;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Badge background
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = this.getLevelColor();
    ctx.fill();

    // Level text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(level.toString(), 32, 34);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    this.levelBadge = new THREE.Sprite(material);
    this.levelBadge.scale.set(0.5, 0.5, 1);
    this.levelBadge.position.set(0.5, 1.8, 0);
    this.group.add(this.levelBadge);
  }

  createNameLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Clear background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Token symbol text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const symbol = this.data.tokenSymbol || '???';
    ctx.fillText(symbol.length > 8 ? symbol.slice(0, 8) + '...' : symbol, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });
    this.nameLabel = new THREE.Sprite(material);
    this.nameLabel.scale.set(2, 0.5, 1);

    // Calculate initial Y position based on number of HP bars
    const hpBars = this.data.hpBars;
    const showBar2 = hpBars?.bar2?.show && hpBars?.bar2?.green > 0;
    const showBar3 = hpBars?.bar3?.show && hpBars?.bar3?.green > 0;
    let nameLabelY = 2.45;
    if (showBar3) {
      nameLabelY = 2.7;
    } else if (showBar2) {
      nameLabelY = 2.6;
    }

    this.nameLabel.position.set(0, nameLabelY, 0);
    this.group.add(this.nameLabel);
  }

  getHPColor() {
    if (!this.data.state) return 0x22c55e;
    if (this.data.state === 'increasing') return 0x22c55e;
    if (this.data.state === 'decreasing') return 0xef4444;
    return 0x888888;
  }

  getLevelColor() {
    const level = this.data.level || 1;
    if (level >= 60) return '#ffd700';
    if (level >= 50) return '#ff69b4';
    if (level >= 40) return '#9966ff';
    if (level >= 30) return '#ff8c00';
    if (level >= 20) return '#4169e1';
    if (level >= 10) return '#32cd32';
    return '#808080';
  }

  getColorFromSymbol(symbol) {
    let hash = 0;
    for (let i = 0; i < (symbol || 'X').length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (hash & 0x00ffffff) | 0x404040;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  setTargetPosition(x, y, z) {
    this.basePosition.set(x, y, z);

    // Determine spawn position based on animation state
    const state = this.data.state;
    let spawnX, spawnZ;

    if (state === 'decreasing') {
      // Situps (stationary) - spawn at grid position to maintain spacing
      spawnX = x;
      spawnZ = z;
    } else {
      // Moving characters - spawn at random position within farm, but offset from base
      const spawnAngle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.random() * this.moveState.farmRadius * 0.6;
      spawnX = Math.cos(spawnAngle) * spawnRadius;
      spawnZ = Math.sin(spawnAngle) * spawnRadius;
    }

    this.group.position.set(spawnX, y, spawnZ);
    this.targetPosition.set(spawnX, y, spawnZ);

    // Set initial direction and rotation to match
    this.pickNewDirection();
    this.group.rotation.y = this.targetRotation;
  }

  setTargetRotation(rotation) {
    this.targetRotation = rotation;
  }

  update(data) {
    const prevState = this.data.state;
    this.data = data;

    // Trigger HP animation if state changed
    if (prevState !== data.state) {
      this.hpAnimationProgress = 0;

      // Update character animation based on new state
      if (Object.keys(this.animationModels).length > 0) {
        // Reset cheer alternation when state changes
        this.isCheeringPhase = false;
        this.cheerAlternateTimer = 5 + Math.random() * 5;  // Start with running (5-10s)
        this.updateAdventurerAnimation();
      }
    }

    // Update HP bars with new hpBars data
    this.updateHPBars();
  }

  animate() {
    const delta = this.clock.getDelta();

    // When speaking, only update the talk animation mixer
    if (this.isSpeaking) {
      // Update talk animation mixer
      if (this.animationModels.talk?.mixer) {
        this.animationModels.talk.mixer.update(delta);
      }

      // Apply head tilt AFTER animation update (to override animation)
      if (this.headBone && this.speakingHeadTilt !== undefined) {
        this.headBone.rotation.x = this.speakingHeadTilt;
      }

      // Still update HP bar billboard (face camera)
      if (this.hpBarGroup && this.camera) {
        this.hpBarGroup.lookAt(this.camera.position);
      }
      return;
    }

    // Update animation mixers
    const hasAnimatedModel = Object.keys(this.animationModels).length > 0;
    if (hasAnimatedModel) {
      // Update all animation mixers for animated characters
      for (const data of Object.values(this.animationModels)) {
        if (data.mixer) {
          data.mixer.update(delta);
        }
      }

      // Handle Running/Cheer alternation for "increasing" state
      if (this.data.state === 'increasing') {
        this.cheerAlternateTimer -= delta;
        if (this.cheerAlternateTimer <= 0) {
          this.isCheeringPhase = !this.isCheeringPhase;
          // Running for 5-10 seconds (random), Cheer for 2 seconds
          this.cheerAlternateTimer = this.isCheeringPhase ? 2 : (5 + Math.random() * 5);
          this.updateAdventurerAnimation();
        }
      }
    } else if (this.mixer) {
      this.mixer.update(delta);
    }

    // Handle continuous walking movement (not during situps)
    if (this.moveState.isMoving) {
      // Direction change timer
      this.moveState.directionChangeTimer -= delta;
      if (this.moveState.directionChangeTimer <= 0) {
        this.pickNewDirection();
      }

      // Move character
      const moveAmount = delta * this.moveState.moveSpeed * 1.5;
      const newPos = this.group.position.clone().add(
        this.moveState.moveDirection.clone().multiplyScalar(moveAmount)
      );

      // Keep within farm boundary (centered at origin)
      const farmCenter = new THREE.Vector3(0, 0, 0);
      const distFromCenter = newPos.distanceTo(farmCenter);
      if (distFromCenter > this.moveState.farmRadius) {
        // Turn back toward farm center
        const toCenter = farmCenter.clone().sub(newPos).normalize();
        this.moveState.moveDirection.lerp(toCenter, 0.15);
        this.targetRotation = Math.atan2(
          this.moveState.moveDirection.x,
          this.moveState.moveDirection.z
        );
      }

      this.group.position.add(
        this.moveState.moveDirection.clone().multiplyScalar(moveAmount)
      );
    }

    // Smooth rotation interpolation
    let targetRot = this.targetRotation;
    // Face away during cheer animation (add 180 degrees)
    if (this.faceAwayDuringCheer) {
      targetRot += Math.PI;
    }
    const currentRot = this.group.rotation.y;

    // Normalize rotation difference to [-PI, PI]
    let rotDiff = targetRot - currentRot;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

    this.group.rotation.y += rotDiff * 0.08;

    // HP bar always faces camera (billboard)
    if (this.hpBarGroup && this.camera) {
      this.hpBarGroup.lookAt(this.camera.position);
    }

    // HP animation
    if (this.hpAnimationProgress < 1) {
      this.hpAnimationProgress += 0.02;
      this.animateHP();
    }
  }

  animateHP() {
    // Skip emissive HP animation for animated characters (causes color issues with multiple models)
    if (Object.keys(this.animationModels).length > 0) return;

    if (!this.data.state || this.data.state === 'stable') return;
    if (!this.model) return;

    const intensity = Math.sin(this.hpAnimationProgress * Math.PI) * 0.3;
    const emissiveColor = this.data.state === 'increasing'
      ? new THREE.Color(0x004400)
      : new THREE.Color(0x440000);

    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.emissive = emissiveColor;
        child.material.emissiveIntensity = intensity;
      }
    });

    if (this.hpAnimationProgress >= 1) {
      this.model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.emissiveIntensity = 0;
        }
      });
    }
  }

  dispose() {
    // Clear speech bubble timeouts
    if (this.speechTimeout) clearTimeout(this.speechTimeout);
    if (this.fadeTimeout) clearTimeout(this.fadeTimeout);

    // Dispose speech bubble
    if (this.speechBubble) {
      if (this.speechBubble.material.map) {
        this.speechBubble.material.map.dispose();
      }
      this.speechBubble.material.dispose();
    }

    // Dispose animated character models
    const hasAnimatedModels = Object.keys(this.animationModels).length > 0;
    if (hasAnimatedModels) {
      for (const data of Object.values(this.animationModels)) {
        if (data.mixer) {
          data.mixer.stopAllAction();
        }
        if (data.root) {
          data.root.traverse((child) => {
            if (child.isMesh) {
              child.geometry?.dispose();
              if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
              }
            }
          });
        }
      }
    } else if (this.model) {
      // Dispose single model (fallback characters)
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      });
    }

    // Dispose HP bar segments
    if (this.hpSegments) {
      Object.values(this.hpSegments).forEach(barSegments => {
        barSegments.forEach(seg => {
          seg.geometry?.dispose();
          seg.material?.dispose();
        });
      });
    }

    // Dispose HP bar backgrounds
    if (this.hpBar2Bg) {
      this.hpBar2Bg.geometry?.dispose();
      this.hpBar2Bg.material?.dispose();
    }
    if (this.hpBar3Bg) {
      this.hpBar3Bg.geometry?.dispose();
      this.hpBar3Bg.material?.dispose();
    }

    if (this.levelBadge) {
      this.levelBadge.material.map.dispose();
      this.levelBadge.material.dispose();
    }
    if (this.nameLabel) {
      this.nameLabel.material.map.dispose();
      this.nameLabel.material.dispose();
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
  }
}
