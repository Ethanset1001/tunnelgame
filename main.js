import * as THREE from 'https://esm.sh/three@0.160.0';
import nipplejs from 'https://esm.sh/nipplejs';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 10, 40);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 0;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Tunnel parameters
const CUBES_PER_RING = 32;
const RING_RADIUS = 5;
const RING_SPACING = 1.0;
const TOTAL_RINGS = 60;
const CUBE_SIZE = 1.0;
const OFFSET_AMOUNT = 0.15; // Small random variation

// Create cube geometry (shared for performance)
const cubeGeometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

const palette = [0xeba134, 0x7deb34, 0x348feb, 0x7a34eb, 0xeb346e];
const paletteMaterials = palette.map(color => new THREE.MeshLambertMaterial({ color }));

const neonMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xffffff,
  emissive: 0xffffff,
  emissiveIntensity: 2
});

// Health system state
let health = 5;
const MAX_HEALTH = 5;
let invincibilityFrames = 0;
let lastRegenTime = Date.now();
const REGEN_INTERVAL = 15000; // 15 seconds
let isGameOver = false;
let gameStarted = false;
let gameStartTime = 0;
let lastHitTime = 0;

function updateHealthUI() {
  const ui = document.getElementById('ui');
  if (!ui) return;
  ui.innerHTML = '';
  for (let i = 0; i < MAX_HEALTH; i++) {
    const heart = document.createElement('div');
    heart.className = i < health ? 'heart' : 'heart empty';
    ui.appendChild(heart);
  }
}

function triggerHitEffect() {
  const flash = document.getElementById('hit-flash');
  if (flash) {
    flash.style.opacity = '1';
    setTimeout(() => flash.style.opacity = '0', 100);
  }
  
  // Shake camera slightly (simulated in animation loop)
  window.hitShake = 10;

  // Despawn all current hazards
  rings.forEach(ring => {
    const hazards = ring.children.filter(child => child.userData.isHazard);
    hazards.forEach(h => ring.remove(h));
  });
  
  lastHitTime = Date.now();
}

function showMenu() {
  isGameOver = true;
  const menu = document.getElementById('menu-overlay');
  if (menu) menu.classList.add('visible');
}

function startGame() {
  gameStarted = true;
  gameStartTime = Date.now();
  lastHitTime = 0;
  health = MAX_HEALTH;
  isGameOver = false;
  invincibilityFrames = 0;
  lastRegenTime = Date.now();
  updateHealthUI();
  const startMenu = document.getElementById('start-menu');
  const menuOverlay = document.getElementById('menu-overlay');
  if (startMenu) startMenu.classList.remove('visible');
  if (menuOverlay) menuOverlay.classList.remove('visible');
  
  // Reset ring positions and clear any existing hazards
  rings.forEach((ring, i) => {
    ring.position.z = -i * RING_SPACING;
    ring.userData.baseZ = ring.position.z;
    ring.userData.ringIndex = i;
    // Clear all children and refill (without hazards initially)
    while(ring.children.length > 0) ring.remove(ring.children[0]);
    populateRing(ring, i, false);
  });
}

function restartGame() {
  startGame();
}

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
if (startBtn) startBtn.addEventListener('click', startGame);
if (restartBtn) restartBtn.addEventListener('click', restartGame);

updateHealthUI();

// Add directional light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 10);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// Array to hold all rings
const rings = [];

function populateRing(ring, ringIndex, allowHazards) {
  // Determine if this ring should have neon lights (every 10 rings)
  const hasNeonLights = ringIndex % 10 === 0;
  
  for (let i = 0; i < CUBES_PER_RING; i++) {
    const angle = (i / CUBES_PER_RING) * Math.PI * 2;
    const x = Math.cos(angle) * RING_RADIUS;
    const y = Math.sin(angle) * RING_RADIUS;
    const offsetX = (Math.random() - 0.5) * OFFSET_AMOUNT;
    const offsetY = (Math.random() - 0.5) * OFFSET_AMOUNT;
    const offsetZ = (Math.random() - 0.5) * OFFSET_AMOUNT;
    const isNeonBlock = hasNeonLights && (i === 0 || i === CUBES_PER_RING / 2);
    
    let material;
    if (isNeonBlock) {
      material = neonMaterial;
    } else {
      const colorIndex = Math.floor((i + ringIndex) / 5) % paletteMaterials.length;
      material = paletteMaterials[colorIndex];
    }
    
    if (allowHazards && Math.random() < 1 / 450) {
      const isHorizontal = Math.abs(x) > Math.abs(y);
      const STRETCH_LENGTH = 30;
      const NUM_SUB_BLOCKS = 25;
      for (let j = 0; j < NUM_SUB_BLOCKS; j++) {
        const t = (j / (NUM_SUB_BLOCKS - 1)) - 0.5;
        const stretchPos = t * STRETCH_LENGTH;
        for (let k = 0; k < 5; k++) {
          const subCube = new THREE.Mesh(cubeGeometry, material);
          subCube.userData.isHazard = true;
          const subOffsetX = (Math.random() - 0.5) * OFFSET_AMOUNT * 3;
          const subOffsetY = (Math.random() - 0.5) * OFFSET_AMOUNT * 3;
          const subOffsetZ = (Math.random() - 0.5) * OFFSET_AMOUNT * 3;
          if (isHorizontal) {
            subCube.position.set(x + stretchPos + subOffsetX, y + subOffsetY, offsetZ + subOffsetZ);
          } else {
            subCube.position.set(x + subOffsetX, y + stretchPos + subOffsetY, offsetZ + subOffsetZ);
          }
          ring.add(subCube);
        }
      }
      if (isNeonBlock) {
        const light = new THREE.PointLight(0xffffff, 2, 15);
        light.position.set(x, y, offsetZ);
        ring.add(light);
      }
    } else {
      const cube = new THREE.Mesh(cubeGeometry, material);
      cube.position.set(x + offsetX, y + offsetY, offsetZ);
      ring.add(cube);
      if (isNeonBlock) {
        const light = new THREE.PointLight(0xffffff, 2, 8);
        light.position.set(x + offsetX, y + offsetY, offsetZ);
        ring.add(light);
      }
    }
  }
}

function createRing(zPosition, ringIndex) {
  const ring = new THREE.Group();
  populateRing(ring, ringIndex, false); // No hazards on initial spawn
  ring.position.z = zPosition;
  ring.userData.baseZ = zPosition;
  ring.userData.ringIndex = ringIndex;
  return ring;
}

// Initialize tunnel
for (let i = 0; i < TOTAL_RINGS; i++) {
  const ring = createRing(-i * RING_SPACING, i);
  rings.push(ring);
  scene.add(ring);
}

// Movement speed
const SPEED = 0.3;
const CAMERA_MOVE_SPEED = 0.06; // Increased by 1.8x from previous 0.033
const MAX_CAMERA_RADIUS = 3.5; // Keep camera away from walls (RING_RADIUS is 5)

// Keyboard state
const keys = {};
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// Mobile joystick
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let joystickData = { x: 0, y: 0 };

if (isMobile) {
  const joystickZone = document.createElement('div');
  joystickZone.style.position = 'fixed';
  joystickZone.style.bottom = '20px';
  joystickZone.style.right = '20px';
  joystickZone.style.width = '150px';
  joystickZone.style.height = '150px';
  document.body.appendChild(joystickZone);
  
  const joystick = nipplejs.create({
    zone: joystickZone,
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: '#FFD700',
    size: 150
  });
  
  joystick.on('move', (evt, data) => {
    if (data.vector) {
      joystickData.x = data.vector.x;
      joystickData.y = data.vector.y;
    }
  });
  
  joystick.on('end', () => {
    joystickData.x = 0;
    joystickData.y = 0;
  });
}

// Pulse effect
let pulseTime = 0;

// Animation loop
window.hitShake = 0;
const tempV3 = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  
  if (isGameOver || !gameStarted) {
    renderer.render(scene, camera);
    return;
  }

  const now = Date.now();
  pulseTime += 0.05;
  
  // Handle Regen
  if (health < MAX_HEALTH) {
    const elapsed = now - lastRegenTime;
    const progress = Math.min(elapsed / REGEN_INTERVAL, 1);
    const progressEl = document.getElementById('regen-progress');
    if (progressEl) progressEl.style.width = (progress * 100) + '%';
    
    if (elapsed >= REGEN_INTERVAL) {
      health++;
      lastRegenTime = now;
      updateHealthUI();
      // Visual feedback for regen
      const hearts = document.querySelectorAll('.heart');
      const newHeart = hearts[health - 1];
      if (newHeart) newHeart.classList.add('regen-ping');
      setTimeout(() => { if(newHeart) newHeart.classList.remove('regen-ping') }, 1000);
    }
  } else {
    const progressEl = document.getElementById('regen-progress');
    if (progressEl) progressEl.style.width = '100%';
    lastRegenTime = now; // Keep reset if full
  }

  // Handle camera movement with WASD or joystick
  if (keys['w']) camera.position.y += CAMERA_MOVE_SPEED;
  if (keys['s']) camera.position.y -= CAMERA_MOVE_SPEED;
  if (keys['a']) camera.position.x -= CAMERA_MOVE_SPEED;
  if (keys['d']) camera.position.x += CAMERA_MOVE_SPEED;
  
  // Mobile joystick movement
  camera.position.x += joystickData.x * CAMERA_MOVE_SPEED;
  camera.position.y += joystickData.y * CAMERA_MOVE_SPEED;
  
  // Clamp camera position to stay within tunnel
  const distanceFromCenter = Math.sqrt(camera.position.x ** 2 + camera.position.y ** 2);
  if (distanceFromCenter > MAX_CAMERA_RADIUS) {
    const angle = Math.atan2(camera.position.y, camera.position.x);
    camera.position.x = Math.cos(angle) * MAX_CAMERA_RADIUS;
    camera.position.y = Math.sin(angle) * MAX_CAMERA_RADIUS;
  }

  // Camera Shake Effect
  if (window.hitShake > 0) {
    camera.position.x += (Math.random() - 0.5) * window.hitShake * 0.05;
    camera.position.y += (Math.random() - 0.5) * window.hitShake * 0.05;
    window.hitShake *= 0.9;
  }
  
  // Move all rings backward with pulsing effect
  rings.forEach((ring, index) => {
    // Store base z position for pulsing (initialize on first frame)
    if (ring.userData.baseZ === undefined) {
      ring.userData.baseZ = ring.position.z;
    }
    
    // Calculate pulse factors - entire tunnel pulses together
    const sinPulse = Math.sin(pulseTime);
    const pulseOffset = sinPulse * 3; // Amplitude of 3 units for movement
    
    // Scale pulse: 0.9 is the midpoint, 0.1 is the amplitude, resulting in 0.8 to 1.0 range
    // We use -sinPulse so that when it moves forward (positive offset), it shrinks (smaller scale)
    const pulseScale = 0.9 - sinPulse * 0.1;
    
    // Apply pulse to position and scale
    ring.position.z = ring.userData.baseZ + pulseOffset;
    ring.scale.set(pulseScale, pulseScale, pulseScale);
    
    // Move base position forward
    ring.userData.baseZ += SPEED;
    
    // Recycle rings that have passed the camera
    if (ring.userData.baseZ > camera.position.z + 5) {
      ring.userData.baseZ -= TOTAL_RINGS * RING_SPACING;
      // Re-populate ring with new blocks
      while(ring.children.length > 0) ring.remove(ring.children[0]);
      
      const timeSinceStart = Date.now() - gameStartTime;
      const timeSinceHit = Date.now() - lastHitTime;
      const canSpawn = timeSinceStart > 1000 && timeSinceHit > 1000;
      
      // Update the ringIndex tracker to keep colors continuous
      ring.userData.ringIndex += TOTAL_RINGS;
      populateRing(ring, ring.userData.ringIndex, canSpawn);
    }

    // Collision Detection with Hazards (Stretched Blocks)
    if (invincibilityFrames > 0) {
      invincibilityFrames--;
    } else {
      // Only check rings close to the camera
      const zDiff = Math.abs(ring.position.z - camera.position.z);
      if (zDiff < 2.0) {
        ring.children.forEach(child => {
          if (child.userData.isHazard) {
            // Get world position of hazard
            tempV3.copy(child.position).applyMatrix4(ring.matrixWorld);
            const dist = tempV3.distanceTo(camera.position);
            
            if (dist < 0.8) { // Collision threshold
              health--;
              invincibilityFrames = 180; // 3 seconds at 60fps
              updateHealthUI();
              triggerHitEffect();
              lastRegenTime = Date.now(); // Reset regen timer on hit
              if (health <= 0) {
                showMenu();
              }
            }
          }
        });
      }
    }
  });
  
  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();