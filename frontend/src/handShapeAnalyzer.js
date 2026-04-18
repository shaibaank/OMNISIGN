/**
 * Hand Shape Analyzer — Uses raw MediaPipe 21 landmarks to detect hand configurations
 * beyond the 7 built-in GestureRecognizer classes.
 *
 * Landmark indices: 0=wrist, 4=thumb_tip, 8=index_tip, 12=middle_tip, 16=ring_tip, 20=pinky_tip
 * PIP joints: 3=thumb_ip, 6=index_pip, 10=middle_pip, 14=ring_pip, 18=pinky_pip
 * MCP joints: 2=thumb_mcp, 5=index_mcp, 9=middle_mcp, 13=ring_mcp, 17=pinky_mcp
 */

function ext(lm, tip, pip) { return lm[tip].y < lm[pip].y; }
function dist(lm, a, b) { return Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y); }
function thumbExt(lm) { return Math.abs(lm[4].x - lm[0].x) > Math.abs(lm[3].x - lm[0].x) * 1.2; }

export function analyzeHandShape(landmarks) {
  if (!landmarks || landmarks.length < 21) return null;
  const lm = landmarks;

  const thumb = thumbExt(lm);
  const index = ext(lm, 8, 6);
  const middle = ext(lm, 12, 10);
  const ring = ext(lm, 16, 14);
  const pinky = ext(lm, 20, 18);
  const fingers = [thumb, index, middle, ring, pinky];
  const count = fingers.filter(Boolean).length;

  // Pinch: thumb tip touching index tip
  const pinchDist = dist(lm, 4, 8);
  const isPinch = pinchDist < 0.045;

  // Flat hand: all fingers extended and close together
  const fingerSpread = dist(lm, 8, 20);
  const isFlat = count === 5 && fingerSpread < 0.12;

  // Claw: all fingers bent (tips below PIPs but above MCPs)
  const isClaw = !index && !middle && !ring && !pinky &&
    lm[8].y > lm[6].y && lm[8].y < lm[5].y;

  // Hand orientation
  const palmUp = lm[0].y > lm[9].y;
  const palmDown = lm[0].y < lm[9].y;
  const palmFacing = lm[0].z > lm[9].z;

  // Letter shapes
  // C: curved hand, thumb and fingers form C
  const isC = thumb && !isPinch && count <= 2 &&
    Math.abs(lm[4].y - lm[8].y) < 0.06 && dist(lm, 4, 8) > 0.06;

  // L: thumb + index extended at right angle
  const isL = thumb && index && !middle && !ring && !pinky &&
    Math.abs(lm[4].y - lm[2].y) > 0.03;

  // O: all fingertips touching thumb (circle)
  const isO = dist(lm, 4, 8) < 0.05 && dist(lm, 4, 12) < 0.07 && count <= 1;

  // W: index + middle + ring extended, others closed
  const isW = !thumb && index && middle && ring && !pinky;

  // R: index and middle crossed
  const isR = index && middle && !ring && !pinky &&
    Math.abs(lm[8].x - lm[12].x) < 0.02;

  // B: flat hand, thumb tucked
  const isB = !thumb && index && middle && ring && pinky && fingerSpread < 0.15;

  // D: index up, others closed around thumb
  const isD = !thumb && index && !middle && !ring && !pinky;

  // F: OK sign with 3 fingers up
  const isF = isPinch && middle && ring && pinky;

  // Y: thumb + pinky extended
  const isY = thumb && !index && !middle && !ring && pinky;

  // S: fist with thumb over fingers
  const isS = count === 0;

  // A: fist with thumb beside
  const isA = count === 1 && thumb && !index;

  // Horns: index + pinky extended (rock sign)
  const isHorns = !thumb && index && !middle && !ring && pinky;

  return {
    fingers, count, thumb, index, middle, ring, pinky,
    isPinch, isFlat, isClaw, palmUp, palmDown,
    isC, isL, isO, isW, isR, isB, isD, isF, isY, isS, isA, isHorns,
    // Computed shape label
    shape: getShapeLabel(count, fingers, isPinch, isFlat, isC, isL, isO, isW, isR, isB, isD, isF, isY, isS, isA, isHorns, isClaw),
  };
}

function getShapeLabel(count, f, pinch, flat, C, L, O, W, R, B, D, F, Y, S, A, horns, claw) {
  if (pinch && f[2] && f[3] && f[4]) return 'F_HAND';
  if (pinch) return 'PINCH';
  if (O) return 'O_HAND';
  if (flat) return 'FLAT_HAND';
  if (B) return 'B_HAND';
  if (W) return 'W_HAND';
  if (R) return 'R_HAND';
  if (C) return 'C_HAND';
  if (L) return 'L_HAND';
  if (D) return 'D_HAND';
  if (F) return 'F_HAND';
  if (Y) return 'Y_HAND';
  if (horns) return 'HORNS';
  if (claw) return 'CLAW';
  if (A) return 'A_HAND';
  if (S) return 'S_HAND';
  if (count === 5) return 'OPEN_5';
  if (count === 0) return 'FIST';
  return 'OTHER';
}

/**
 * Combine hand shape + body location for real ASL signs
 * Returns a sign name or null
 */
export function detectASLSign(handShape, poseLandmarks, handLandmarks) {
  if (!handShape || !poseLandmarks || poseLandmarks.length < 25 || !handLandmarks) return null;

  const wrist = handLandmarks[0];
  const nose = poseLandmarks[0];
  const ls = poseLandmarks[11], rs = poseLandmarks[12];
  const lEar = poseLandmarks[7], rEar = poseLandmarks[8];
  const lMouth = poseLandmarks[9], rMouth = poseLandmarks[10];
  if (!nose || !ls || !rs) return null;

  const chestX = (ls.x + rs.x) / 2, chestY = (ls.y + rs.y) / 2 + 0.1;
  const toChest = Math.hypot(wrist.x - chestX, wrist.y - chestY);
  const toHead = Math.hypot(wrist.x - nose.x, wrist.y - nose.y);
  const toEar = lEar && rEar ? Math.min(
    Math.hypot(wrist.x - lEar.x, wrist.y - lEar.y),
    Math.hypot(wrist.x - rEar.x, wrist.y - rEar.y)
  ) : 1;
  const mX = lMouth && rMouth ? (lMouth.x + rMouth.x) / 2 : nose.x;
  const mY = lMouth && rMouth ? (lMouth.y + rMouth.y) / 2 : nose.y + 0.03;
  const toMouth = Math.hypot(wrist.x - mX, wrist.y - mY);
  const eyeY = nose.y - 0.04;
  const toEyes = Math.hypot(wrist.x - nose.x, wrist.y - eyeY);

  const onChest = toChest < 0.22;
  const onHead = toHead < 0.20;
  const onEar = toEar < 0.18;
  const onMouth = toMouth < 0.18;
  const onEyes = toEyes < 0.15;
  const raised = wrist.y < rs.y;

  const s = handShape.shape;
  const c = 0.88;

  // ─── ASL Signs by hand shape + location ───

  // WATER: W-hand tapping chin
  if (s === 'W_HAND' && onMouth) return { name: 'ASL_WATER', confidence: c };
  // FINE: OPEN_5 on chest (thumb touching chest)
  if (s === 'OPEN_5' && onChest) return { name: 'ASL_FINE', confidence: c };
  // UNDERSTAND: S fist near forehead, then open
  if (s === 'FIST' && onHead) return { name: 'ASL_UNDERSTAND', confidence: c };
  // WHERE: D_HAND (index only) wagging
  if (s === 'D_HAND' && raised) return { name: 'ASL_WHERE', confidence: 0.82 };
  // BATHROOM: A_HAND (thumb out fist) shaking
  if (s === 'A_HAND' && !onChest && !onHead) return { name: 'ASL_BATHROOM', confidence: 0.80 };
  // HOME: O/pinch near mouth then ear area
  if ((s === 'PINCH' || s === 'O_HAND') && onMouth) return { name: 'ASL_HOME', confidence: c };
  // FAMILY: F_HAND in front, both hands circling
  if (s === 'F_HAND' && !onChest && !onHead) return { name: 'ASL_FAMILY', confidence: 0.82 };
  // LIKE: open hand from chest, pulling out (L shape at chest)
  if (s === 'L_HAND' && onChest) return { name: 'ASL_LIKE', confidence: c };
  // MONEY: flat hand tapping open palm
  if (s === 'FLAT_HAND' && !onHead && !onChest && !onMouth) return { name: 'ASL_MONEY', confidence: 0.78 };
  // WORK: S fist tapping on other fist
  if (s === 'S_HAND' && !onHead && !onChest) return { name: 'ASL_WORK', confidence: 0.80 };
  // SCHOOL: flat hand clapping
  if (s === 'FLAT_HAND' && onChest) return { name: 'ASL_SCHOOL', confidence: 0.80 };
  // TIME: D (index) tapping wrist
  if (s === 'D_HAND' && !raised && !onHead) return { name: 'ASL_TIME', confidence: 0.82 };
  // PHONE: Y hand near ear
  if (s === 'Y_HAND' && onEar) return { name: 'ASL_PHONE', confidence: c };
  // HEAR: D near ear
  if (s === 'D_HAND' && onEar) return { name: 'ASL_HEAR', confidence: c };
  // SLEEP: open hand pulling down face
  if (s === 'OPEN_5' && onEyes) return { name: 'ASL_SLEEP', confidence: 0.82 };
  // MORE: pinch both hands together (flat O tips touching)
  if (s === 'PINCH' && !onHead && !onChest && !onMouth) return { name: 'ASL_MORE', confidence: 0.80 };
  // AGAIN: bent hand tapping palm
  if (s === 'CLAW' && !onHead) return { name: 'ASL_AGAIN', confidence: 0.78 };

  return null;
}
