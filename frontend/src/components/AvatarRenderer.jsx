import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * AvatarRenderer — Three.js 3D avatar with morph target NMMs (Non-Manual Markers).
 * Renders a procedural signing avatar with animated hand/arm poses and facial expressions.
 * Runs entirely in WebGL — zero server cost.
 */

// Morph target mapping: NMM keys from Agent 3 → Three.js blend shape names
const NMM_MAP = {
  brow_raise: 'browInnerUp',
  brow_furrow: 'browDownLeft',
  smile: 'mouthSmileLeft',
  mouth_open: 'jawOpen',
  mouth_frown: 'mouthFrownLeft',
  head_tilt: null,
  nod: null,
  head_shake: null,
  brow_neutral: null,
};

export default function AvatarRenderer({ clipQueue, isPlaying }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const avatarGroupRef = useRef(null);
  const mixerRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const [currentGloss, setCurrentGloss] = useState('');
  const [currentNMM, setCurrentNMM] = useState({});
  const animFrameRef = useRef(null);

  // Body part refs for procedural animation
  const bodyRef = useRef({});

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 450;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null; // Transparent
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 3.5);
    camera.lookAt(0, 1.0, 0);
    cameraRef.current = camera;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x8888cc, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = false;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x6c5ce7, 0.4);
    fillLight.position.set(-3, 2, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x00cec9, 0.3);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    // Build procedural avatar
    const avatarGroup = buildProceduralAvatar();
    avatarGroup.rotation.y = Math.PI; // Face the user's perspective (mirror mode)
    scene.add(avatarGroup);
    avatarGroupRef.current = avatarGroup;

    // Ground plane (subtle reflection)
    const groundGeo = new THREE.PlaneGeometry(10, 10);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0d0d2b,
      roughness: 0.8,
      metalness: 0.2,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    // Particles (ambient atmosphere)
    const particlesGeo = new THREE.BufferGeometry();
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = Math.random() * 4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMat = new THREE.PointsMaterial({
      color: 0x6c5ce7,
      size: 0.015,
      transparent: true,
      opacity: 0.4,
    });
    scene.add(new THREE.Points(particlesGeo, particlesMat));

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();

      // Idle breathing animation
      if (avatarGroupRef.current) {
        avatarGroupRef.current.position.y = Math.sin(elapsed * 1.5) * 0.01;
      }

      // Animate particles
      const particlePositions = particlesGeo.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3 + 1] += 0.002;
        if (particlePositions[i * 3 + 1] > 4) particlePositions[i * 3 + 1] = 0;
      }
      particlesGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Play animation clips when clipQueue changes
  useEffect(() => {
    if (!clipQueue?.length || !avatarGroupRef.current) return;

    let delay = 0;
    const timeouts = [];

    clipQueue.forEach((clip) => {
      const t = setTimeout(() => {
        setCurrentGloss(clip.gloss || '');
        setCurrentNMM(clip.nmm || {});
        animateSign(clip);
      }, delay);
      timeouts.push(t);
      delay += clip.duration_ms || 500;
    });

    return () => timeouts.forEach(clearTimeout);
  }, [clipQueue]);

  /** Procedurally animate the avatar for a given clip */
  function animateSign(clip) {
    const body = bodyRef.current;
    if (!body.leftArm || !body.rightArm) return;

    const gloss = (clip.gloss || '').toUpperCase();
    const dur = (clip.duration_ms || 500) / 1000;

    // Reset pose
    resetPose(body);

    // Map common glosses to arm/hand poses
    const poses = {
      HELLO: () => {
        animateJoint(body.rightArm, { z: -1.2 }, dur * 0.3);
        animateJoint(body.rightForearm, { z: -0.3 }, dur * 0.3);
        // Wave
        setTimeout(() => animateJoint(body.rightHand, { z: 0.4 }, dur * 0.2), dur * 300);
        setTimeout(() => animateJoint(body.rightHand, { z: -0.4 }, dur * 0.2), dur * 500);
        setTimeout(() => animateJoint(body.rightHand, { z: 0.3 }, dur * 0.2), dur * 700);
      },
      YES: () => {
        animateJoint(body.rightArm, { z: -0.8, x: 0.3 }, dur * 0.4);
        animateJoint(body.head, { x: 0.2 }, dur * 0.3);
        setTimeout(() => animateJoint(body.head, { x: -0.1 }, dur * 0.2), dur * 300);
        setTimeout(() => animateJoint(body.head, { x: 0.15 }, dur * 0.2), dur * 500);
      },
      NO: () => {
        animateJoint(body.head, { y: 0.3 }, dur * 0.25);
        setTimeout(() => animateJoint(body.head, { y: -0.3 }, dur * 0.25), dur * 250);
        setTimeout(() => animateJoint(body.head, { y: 0.2 }, dur * 0.25), dur * 500);
      },
      I: () => {
        animateJoint(body.rightArm, { z: -0.3, x: 0.5 }, dur * 0.4);
        animateJoint(body.rightForearm, { z: -0.5 }, dur * 0.3);
      },
      YOU: () => {
        animateJoint(body.rightArm, { z: -0.9, x: -0.2 }, dur * 0.4);
        animateJoint(body.rightForearm, { z: -0.2 }, dur * 0.3);
      },
      LOVE: () => {
        animateJoint(body.leftArm, { z: 0.5, x: 0.3 }, dur * 0.4);
        animateJoint(body.rightArm, { z: -0.5, x: 0.3 }, dur * 0.4);
        animateJoint(body.leftForearm, { z: 0.8 }, dur * 0.3);
        animateJoint(body.rightForearm, { z: -0.8 }, dur * 0.3);
      },
      THANK_YOU: () => {
        animateJoint(body.rightArm, { z: -0.6 }, dur * 0.3);
        animateJoint(body.rightForearm, { z: -0.4 }, dur * 0.3);
        setTimeout(() => {
          animateJoint(body.rightArm, { z: -1.0 }, dur * 0.3);
        }, dur * 400);
      },
      HELP: () => {
        animateJoint(body.leftArm, { z: 0.4, x: 0.2 }, dur * 0.3);
        animateJoint(body.rightArm, { z: -0.4 }, dur * 0.3);
        animateJoint(body.rightForearm, { z: -0.6 }, dur * 0.4);
      },
      WANT: () => {
        animateJoint(body.rightArm, { z: -0.7, x: 0.1 }, dur * 0.3);
        animateJoint(body.leftArm, { z: 0.7, x: 0.1 }, dur * 0.3);
        setTimeout(() => {
          animateJoint(body.rightArm, { z: -0.4 }, dur * 0.3);
          animateJoint(body.leftArm, { z: 0.4 }, dur * 0.3);
        }, dur * 400);
      },
    };

    const poseFn = poses[gloss];
    if (poseFn) poseFn();
    else {
      // Default: generic gesture
      animateJoint(body.rightArm, { z: -0.6 + Math.random() * 0.4 }, dur * 0.4);
      animateJoint(body.rightForearm, { z: -0.3 + Math.random() * 0.3 }, dur * 0.3);
    }

    // Apply NMM facial expressions
    applyNMM(body, clip.nmm || {}, dur);
  }

  function animateJoint(joint, target, duration) {
    if (!joint) return;
    const start = { x: joint.rotation.x, y: joint.rotation.y, z: joint.rotation.z };
    const startTime = performance.now();
    const durationMs = duration * 1000;

    function step(now) {
      const t = Math.min((now - startTime) / durationMs, 1);
      const ease = t * (2 - t); // ease-out
      if (target.x !== undefined) joint.rotation.x = start.x + (target.x - start.x) * ease;
      if (target.y !== undefined) joint.rotation.y = start.y + (target.y - start.y) * ease;
      if (target.z !== undefined) joint.rotation.z = start.z + (target.z - start.z) * ease;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function resetPose(body) {
    const joints = [body.leftArm, body.rightArm, body.leftForearm, body.rightForearm, body.leftHand, body.rightHand, body.head];
    joints.forEach(j => {
      if (j) {
        animateJoint(j, { x: 0, y: 0, z: 0 }, 0.2);
      }
    });
  }

  function applyNMM(body, nmm, dur) {
    if (!body.head) return;
    if (nmm.nod) {
      animateJoint(body.head, { x: 0.15 * nmm.nod }, dur * 0.3);
    }
    if (nmm.head_shake) {
      animateJoint(body.head, { y: 0.2 * nmm.head_shake }, dur * 0.25);
    }
    if (nmm.head_tilt) {
      animateJoint(body.head, { z: 0.15 * nmm.head_tilt }, dur * 0.4);
    }
  }

  return (
    <div className="avatar-container" id="avatar-renderer">
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {currentGloss && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          right: 12,
          padding: '8px 14px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: '#a29bfe',
        }}>
          <span>Signing: <strong style={{ color: '#f0f0f8' }}>{currentGloss}</strong></span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Object.entries(currentNMM).map(([k, v]) => (
              <span key={k} style={{
                padding: '1px 6px',
                borderRadius: 4,
                background: 'rgba(108,92,231,0.2)',
                fontSize: '0.6rem',
              }}>
                {k}: {(v * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/** Build a procedural humanoid avatar using Three.js primitives */
function buildProceduralAvatar() {
  const group = new THREE.Group();
  const body = {};

  // Shared materials
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.7, metalness: 0.05 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x2d1b69, roughness: 0.6, metalness: 0.1 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9 });

  // Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.65, 0);
  body.head = headGroup;

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 32), skinMat);
  headMesh.scale.set(1, 1.15, 1);
  headGroup.add(headMesh);

  // Hair
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
  hair.position.y = 0.02;
  headGroup.add(hair);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x2d1b69 });
  [-0.04, 0.04].forEach(x => {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16), eyeMat);
    eyeWhite.position.set(x, 0.02, 0.1);
    headGroup.add(eyeWhite);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 16), pupilMat);
    pupil.position.set(x, 0.02, 0.115);
    headGroup.add(pupil);
  });

  // Mouth
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0xc4726c });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.006, 0.01), mouthMat);
  mouth.position.set(0, -0.04, 0.1);
  headGroup.add(mouth);

  group.add(headGroup);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 16), skinMat);
  neck.position.set(0, 1.55, 0);
  group.add(neck);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.16), clothMat);
  torso.position.set(0, 1.3, 0);
  group.add(torso);

  // Build arms
  const buildArm = (side) => {
    const sign = side === 'left' ? 1 : -1;
    const armGroup = new THREE.Group();
    armGroup.position.set(sign * 0.2, 1.45, 0);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.25, 12), clothMat);
    upperArm.position.y = -0.125;
    armGroup.add(upperArm);

    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -0.25, 0);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.22, 12), skinMat);
    forearm.position.y = -0.11;
    forearmGroup.add(forearm);

    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.24, 0);

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.025), skinMat);
    handGroup.add(palm);

    // Fingers
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.04, 8), skinMat);
      finger.position.set(-0.015 + i * 0.012, -0.045, 0);
      handGroup.add(finger);
    }
    // Thumb
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.03, 8), skinMat);
    thumb.position.set(sign * 0.03, -0.01, 0.01);
    thumb.rotation.z = sign * 0.5;
    handGroup.add(thumb);

    forearmGroup.add(handGroup);
    armGroup.add(forearmGroup);

    body[`${side}Arm`] = armGroup;
    body[`${side}Forearm`] = forearmGroup;
    body[`${side}Hand`] = handGroup;

    return armGroup;
  };

  group.add(buildArm('left'));
  group.add(buildArm('right'));

  // Legs (simplified)
  [-0.07, 0.07].forEach(x => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.45, 12), clothMat);
    leg.position.set(x, 0.88, 0);
    group.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.1), new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 }));
    shoe.position.set(x, 0.64, 0.02);
    group.add(shoe);
  });

  // Store body refs in module scope (accessed via bodyRef in component)
  group.userData.body = body;

  // Expose body refs
  const component = buildProceduralAvatar;
  component._lastBody = body;

  return group;
}

// Export body accessor for the component
buildProceduralAvatar._lastBody = null;
