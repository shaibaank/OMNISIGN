import { useEffect, useRef, useState } from 'react';
import { GestureStateMachine, detectBodySign, detectFaceNMM } from '../gestureClassifier.js';

/**
 * Holistic GestureCapture — MediaPipe GestureRecognizer + PoseLandmarker + FaceLandmarker
 * Tracks hands, body skeleton, and face mesh simultaneously.
 */

// Pose skeleton connections
const POSE_CONN = [
  [11,12],[11,13],[13,15],[12,14],[14,16], // arms
  [11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28], // torso+legs
  [27,29],[28,30],[29,31],[30,32], // feet
];

// Face oval landmark indices (simplified)
const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];

export default function GestureCapture({ onLandmarks, onGestureDetected, sessionId, isActive }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const gestureRecRef = useRef(null);
  const poseRef = useRef(null);
  const faceRef = useRef(null);
  const animRef = useRef(null);
  const stateRef = useRef(new GestureStateMachine({ confirmFrames: 4, cooldownMs: 2000, bufferSize: 7, lostFrames: 8, minConfidence: 0.65 }));
  const frameIdx = useRef(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [poseDetected, setPoseDetected] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [currentSign, setCurrentSign] = useState(null);
  const [smState, setSmState] = useState('IDLE');
  const [loadingModel, setLoadingModel] = useState('Starting...');
  const [fps, setFps] = useState(0);
  const fc = useRef(0);
  const lastFps = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    let stream = null;

    async function init() {
      // 1. Camera
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      } catch (e) { console.error('Webcam failed:', e); return; }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraReady(true);

      // 2. Load models
      const { FilesetResolver, GestureRecognizer, PoseLandmarker, FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');

      setLoadingModel('Loading hand model...');
      gestureRecRef.current = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task', delegate: 'GPU' },
        numHands: 2, runningMode: 'VIDEO',
      });

      setLoadingModel('Loading pose model...');
      poseRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'GPU' },
        numPoses: 1, runningMode: 'VIDEO',
      });

      setLoadingModel('Loading face model...');
      faceRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'GPU' },
        numFaces: 1, runningMode: 'VIDEO', outputFaceBlendshapes: true,
      });

      setLoadingModel('');
      console.log('✅ Holistic models loaded (hands + pose + face)');

      // 3. Detection loop
      function detect() {
        if (cancelled) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) { animRef.current = requestAnimationFrame(detect); return; }

        fc.current++;
        const now = Date.now();
        if (now - lastFps.current >= 1000) { setFps(fc.current); fc.current = 0; lastFps.current = now; }

        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const W = canvas.width, H = canvas.height;
        const ts = performance.now();
        frameIdx.current++;

        let gestureResult = null;
        let poseResult = null;
        let faceResult = null;

        if (!isActive) { animRef.current = requestAnimationFrame(detect); return; }

        // ── Hand gesture (every frame) ──
        if (gestureRecRef.current) {
          gestureResult = gestureRecRef.current.recognizeForVideo(video, ts);
        }

        // ── Pose (every 2nd frame) ──
        if (poseRef.current && frameIdx.current % 2 === 0) {
          try { poseResult = poseRef.current.detectForVideo(video, ts); } catch {}
        }

        // ── Face (every 3rd frame) ──
        if (faceRef.current && frameIdx.current % 3 === 0) {
          try { faceResult = faceRef.current.detectForVideo(video, ts); } catch {}
        }

        // ── Draw Pose Skeleton ──
        if (poseResult?.landmarks?.[0]) {
          setPoseDetected(true);
          const pose = poseResult.landmarks[0];
          ctx.strokeStyle = 'rgba(0, 184, 148, 0.5)';
          ctx.lineWidth = 2;
          POSE_CONN.forEach(([a, b]) => {
            if (pose[a] && pose[b]) {
              ctx.beginPath();
              ctx.moveTo(pose[a].x * W, pose[a].y * H);
              ctx.lineTo(pose[b].x * W, pose[b].y * H);
              ctx.stroke();
            }
          });
          pose.forEach((pt, i) => {
            if (i >= 11 && i <= 32) {
              ctx.beginPath();
              ctx.arc(pt.x * W, pt.y * H, 3, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(0, 184, 148, 0.7)';
              ctx.fill();
            }
          });
        }

        // ── Draw Face Mesh ──
        if (faceResult?.faceLandmarks?.[0]) {
          setFaceDetected(true);
          const face = faceResult.faceLandmarks[0];
          ctx.strokeStyle = 'rgba(253, 121, 168, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          FACE_OVAL.forEach((idx, i) => {
            if (face[idx]) {
              const x = face[idx].x * W, y = face[idx].y * H;
              i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
          });
          ctx.closePath();
          ctx.stroke();
          // Eyes
          [33, 133, 362, 263].forEach(idx => {
            if (face[idx]) {
              ctx.beginPath();
              ctx.arc(face[idx].x * W, face[idx].y * H, 2, 0, Math.PI * 2);
              ctx.fillStyle = '#fd79a8';
              ctx.fill();
            }
          });
        }

        // ── Draw Hand Skeleton ──
        const hasHands = gestureResult?.landmarks?.length > 0;
        setHandDetected(hasHands);

        if (hasHands) {
          gestureResult.landmarks.forEach((hand, hi) => {
            const color = hi === 0 ? 'rgba(108, 92, 231, 0.7)' : 'rgba(253, 121, 168, 0.7)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]].forEach(([a, b]) => {
              ctx.beginPath();
              ctx.moveTo(hand[a].x * W, hand[a].y * H);
              ctx.lineTo(hand[b].x * W, hand[b].y * H);
              ctx.stroke();
            });
            hand.forEach((pt, i) => {
              ctx.beginPath();
              ctx.arc(pt.x * W, pt.y * H, i === 0 ? 5 : 3, 0, Math.PI * 2);
              ctx.fillStyle = i < 5 ? '#fd79a8' : '#6c5ce7';
              ctx.fill();
            });
          });
        }

        // ── Classify ──
        let gestureName = gestureResult?.gestures?.[0]?.[0]?.categoryName || 'None';
        let confidence = gestureResult?.gestures?.[0]?.[0]?.score || 0;

        // Body-pose augmentation
        if (poseResult?.landmarks?.[0] && (gestureName === 'None' || confidence < 0.5)) {
          const bodySig = detectBodySign(poseResult.landmarks[0]);
          if (bodySig) { gestureName = bodySig.name; confidence = bodySig.confidence; }
        }

        // Face NMM (for display only)
        if (faceResult?.faceBlendshapes) {
          detectFaceNMM(faceResult.faceBlendshapes);
        }

        // State machine
        const emitted = stateRef.current.process(gestureName, confidence);
        const display = stateRef.current.getDisplay();
        setCurrentSign(display);
        setSmState(['IDLE', 'DETECTING', 'HOLD'][stateRef.current.state]);

        if (emitted && onGestureDetected) onGestureDetected(emitted);

        if (onLandmarks && gestureResult?.landmarks?.[0]) {
          const flat = gestureResult.landmarks[0].flatMap(p => [p.x, p.y]);
          onLandmarks({ landmarks: flat, session_id: sessionId, frame_id: Date.now() });
        }

        animRef.current = requestAnimationFrame(detect);
      }
      detect();
    }

    init();
    return () => { cancelled = true; cancelAnimationFrame(animRef.current); if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  const stColor = { IDLE: '#636e72', DETECTING: '#fdcb6e', HOLD: '#6c5ce7' };

  return (
    <div className="camera-container" id="gesture-capture">
      <video ref={videoRef} muted playsInline style={{ display: cameraReady ? 'block' : 'none' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }} />

      {loadingModel && (
        <div className="empty-state" style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(15,15,30,0.85)' }}>
          <span className="empty-icon">🧠</span>
          <span>{loadingModel}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Loading holistic models...</span>
        </div>
      )}

      {currentSign && currentSign.gloss !== 'None' && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', padding: '8px 20px', background: 'rgba(108, 92, 231, 0.85)', backdropFilter: 'blur(10px)', borderRadius: 24, fontSize: '1rem', fontWeight: 700, color: '#fff', boxShadow: '0 4px 20px rgba(108, 92, 231, 0.4)', animation: 'scale-in 0.2s ease-out', zIndex: 5, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.3rem' }}>🤟</span>
          <span>{currentSign.meaning || currentSign.gloss}</span>
          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{(currentSign.confidence * 100).toFixed(0)}%</span>
        </div>
      )}

      {currentSign && currentSign.gloss !== 'None' && (
        <div style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', padding: '4px 14px', background: 'rgba(0,0,0,0.6)', borderRadius: 12, fontSize: '0.65rem', color: stColor[smState], zIndex: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: stColor[smState], animation: smState === 'HOLD' ? 'status-pulse 1.5s ease infinite' : 'none' }} />
          {smState === 'IDLE' && 'Waiting...'}{smState === 'DETECTING' && 'Hold still...'}{smState === 'HOLD' && 'Holding — change gesture'}
        </div>
      )}

      {!cameraReady && !loadingModel && (
        <div className="empty-state" style={{ position: 'absolute', inset: 0 }}>
          <span className="empty-icon">📷</span><span>Allow webcam access...</span>
        </div>
      )}

      <div className="camera-overlay">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isActive && cameraReady && <span className="rec-dot" />}
          <span>{cameraReady ? (isActive ? 'Live' : 'Paused') : '...'}</span>
        </div>
        <span>{fps} FPS</span>
        <div style={{ display: 'flex', gap: 8, fontSize: '0.7rem' }}>
          <span style={{ color: handDetected ? '#6c5ce7' : '#636e72' }}>✋</span>
          <span style={{ color: poseDetected ? '#00b894' : '#636e72' }}>🦴</span>
          <span style={{ color: faceDetected ? '#fd79a8' : '#636e72' }}>😊</span>
        </div>
      </div>
    </div>
  );
}
