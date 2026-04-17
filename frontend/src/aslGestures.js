/**
 * ASL Gesture Definitions using fingerpose (github.com/andypotato/fingerpose)
 * Defines 26 ASL alphabet letters + common ASL signs using
 * finger curl + direction descriptors.
 *
 * Reference: https://www.handspeak.com/word/asl-abc/
 */
import {
  Finger,
  FingerCurl,
  FingerDirection,
  GestureDescription,
} from 'fingerpose';

// ─── Helper: sets all non-thumb fingers to full-curl ───
function allFingersCurled(gesture, weight = 1.0) {
  for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
    gesture.addCurl(f, FingerCurl.FullCurl, weight);
    gesture.addCurl(f, FingerCurl.HalfCurl, weight * 0.9);
  }
}

// ═══════════════════════════════════════════════════════
//  ASL ALPHABET (A-Z static signs — J and Z require motion)
// ═══════════════════════════════════════════════════════

// --- A: Fist with thumb to the side ---
const aslA = new GestureDescription('A');
aslA.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aslA.addDirection(Finger.Thumb, FingerDirection.VerticalUp, 1.0);
aslA.addDirection(Finger.Thumb, FingerDirection.DiagonalUpLeft, 0.9);
aslA.addDirection(Finger.Thumb, FingerDirection.DiagonalUpRight, 0.9);
allFingersCurled(aslA);

// --- B: Flat hand, fingers together pointing up, thumb across palm ---
const aslB = new GestureDescription('B');
aslB.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslB.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9);
for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslB.addCurl(f, FingerCurl.NoCurl, 1.0);
  aslB.addDirection(f, FingerDirection.VerticalUp, 1.0);
  aslB.addDirection(f, FingerDirection.DiagonalUpLeft, 0.8);
  aslB.addDirection(f, FingerDirection.DiagonalUpRight, 0.8);
}

// --- C: Curved hand like holding a cup ---
const aslC = new GestureDescription('C');
aslC.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aslC.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.8);
for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslC.addCurl(f, FingerCurl.HalfCurl, 1.0);
  aslC.addCurl(f, FingerCurl.NoCurl, 0.7);
}

// --- D: Index up, others curl into thumb ---
const aslD = new GestureDescription('D');
aslD.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslD.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslD.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
for (const f of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslD.addCurl(f, FingerCurl.FullCurl, 1.0);
  aslD.addCurl(f, FingerCurl.HalfCurl, 0.9);
}

// --- E: All fingers curled, thumb across ---
const aslE = new GestureDescription('E');
aslE.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslE.addCurl(f, FingerCurl.FullCurl, 1.0);
  aslE.addCurl(f, FingerCurl.HalfCurl, 0.9);
}

// --- F: OK sign — thumb+index pinch, 3 fingers up ---
const aslF = new GestureDescription('F');
aslF.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslF.addCurl(Finger.Index, FingerCurl.HalfCurl, 1.0);
aslF.addCurl(Finger.Index, FingerCurl.FullCurl, 0.8);
for (const f of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslF.addCurl(f, FingerCurl.NoCurl, 1.0);
  aslF.addDirection(f, FingerDirection.VerticalUp, 1.0);
}

// --- G: Index + thumb point sideways ---
const aslG = new GestureDescription('G');
aslG.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aslG.addDirection(Finger.Thumb, FingerDirection.HorizontalLeft, 1.0);
aslG.addDirection(Finger.Thumb, FingerDirection.HorizontalRight, 1.0);
aslG.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslG.addDirection(Finger.Index, FingerDirection.HorizontalLeft, 1.0);
aslG.addDirection(Finger.Index, FingerDirection.HorizontalRight, 1.0);
for (const f of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslG.addCurl(f, FingerCurl.FullCurl, 1.0);
  aslG.addCurl(f, FingerCurl.HalfCurl, 0.9);
}

// --- H: Index + middle point sideways ---
const aslH = new GestureDescription('H');
aslH.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslH.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9);
aslH.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslH.addDirection(Finger.Index, FingerDirection.HorizontalLeft, 1.0);
aslH.addDirection(Finger.Index, FingerDirection.HorizontalRight, 1.0);
aslH.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
aslH.addDirection(Finger.Middle, FingerDirection.HorizontalLeft, 1.0);
aslH.addDirection(Finger.Middle, FingerDirection.HorizontalRight, 1.0);
aslH.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0);
aslH.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0);

// --- I: Pinky up, all others curled ---
const aslI = new GestureDescription('I');
aslI.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslI.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9);
for (const f of [Finger.Index, Finger.Middle, Finger.Ring]) {
  aslI.addCurl(f, FingerCurl.FullCurl, 1.0);
  aslI.addCurl(f, FingerCurl.HalfCurl, 0.9);
}
aslI.addCurl(Finger.Pinky, FingerCurl.NoCurl, 1.0);
aslI.addDirection(Finger.Pinky, FingerDirection.VerticalUp, 1.0);

// --- K: Index up, middle angled, thumb between ---
const aslK = new GestureDescription('K');
aslK.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aslK.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslK.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
aslK.addDirection(Finger.Index, FingerDirection.DiagonalUpLeft, 0.9);
aslK.addDirection(Finger.Index, FingerDirection.DiagonalUpRight, 0.9);
aslK.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
aslK.addDirection(Finger.Middle, FingerDirection.DiagonalUpLeft, 1.0);
aslK.addDirection(Finger.Middle, FingerDirection.DiagonalUpRight, 1.0);
aslK.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0);
aslK.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0);

// --- L: L shape — thumb + index extended ---
const aslL = new GestureDescription('L');
aslL.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aslL.addDirection(Finger.Thumb, FingerDirection.HorizontalLeft, 1.0);
aslL.addDirection(Finger.Thumb, FingerDirection.HorizontalRight, 1.0);
aslL.addDirection(Finger.Thumb, FingerDirection.DiagonalUpLeft, 0.8);
aslL.addDirection(Finger.Thumb, FingerDirection.DiagonalUpRight, 0.8);
aslL.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslL.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
for (const f of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslL.addCurl(f, FingerCurl.FullCurl, 1.0);
  aslL.addCurl(f, FingerCurl.HalfCurl, 0.9);
}

// --- M: Three fingers over thumb ---
const aslM = new GestureDescription('M');
aslM.addCurl(Finger.Thumb, FingerCurl.FullCurl, 1.0);
aslM.addCurl(Finger.Index, FingerCurl.FullCurl, 1.0);
aslM.addCurl(Finger.Middle, FingerCurl.FullCurl, 1.0);
aslM.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0);
aslM.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0);

// --- N: Two fingers over thumb ---
const aslN = new GestureDescription('N');
aslN.addCurl(Finger.Thumb, FingerCurl.FullCurl, 1.0);
aslN.addCurl(Finger.Index, FingerCurl.FullCurl, 1.0);
aslN.addCurl(Finger.Middle, FingerCurl.FullCurl, 1.0);
aslN.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0);
aslN.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0);

// --- O: Fingers curved to meet thumb ---
const aslO = new GestureDescription('O');
aslO.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslO.addCurl(f, FingerCurl.HalfCurl, 1.0);
  aslO.addCurl(f, FingerCurl.FullCurl, 0.8);
}

// --- P: K hand pointing down ---
const aslP = new GestureDescription('P');
aslP.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aslP.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslP.addDirection(Finger.Index, FingerDirection.DiagonalDownLeft, 1.0);
aslP.addDirection(Finger.Index, FingerDirection.DiagonalDownRight, 1.0);
aslP.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
aslP.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0);
aslP.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0);

// --- Q: G hand pointing down ---
const aslQ = new GestureDescription('Q');
aslQ.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aslQ.addDirection(Finger.Thumb, FingerDirection.VerticalDown, 1.0);
aslQ.addDirection(Finger.Thumb, FingerDirection.DiagonalDownLeft, 0.9);
aslQ.addDirection(Finger.Thumb, FingerDirection.DiagonalDownRight, 0.9);
aslQ.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslQ.addDirection(Finger.Index, FingerDirection.VerticalDown, 1.0);
for (const f of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslQ.addCurl(f, FingerCurl.FullCurl, 1.0);
}

// --- R: Index + middle crossed ---
const aslR = new GestureDescription('R');
aslR.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslR.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslR.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
aslR.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
aslR.addDirection(Finger.Middle, FingerDirection.VerticalUp, 1.0);
aslR.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0);
aslR.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0);

// --- S: Fist with thumb across fingers ---
const aslS = new GestureDescription('S');
aslS.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslS.addCurl(Finger.Thumb, FingerCurl.NoCurl, 0.8);
for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslS.addCurl(f, FingerCurl.FullCurl, 1.0);
  aslS.addCurl(f, FingerCurl.HalfCurl, 0.8);
}

// --- T: Thumb between index and middle, fist ---
const aslT = new GestureDescription('T');
aslT.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
allFingersCurled(aslT);

// --- U: Index + middle up together ---
const aslU = new GestureDescription('U');
aslU.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslU.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9);
aslU.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslU.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
aslU.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
aslU.addDirection(Finger.Middle, FingerDirection.VerticalUp, 1.0);
aslU.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0);
aslU.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0);

// --- V: Victory / Peace ---
const aslV = new GestureDescription('V');
aslV.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslV.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9);
aslV.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslV.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
aslV.addDirection(Finger.Index, FingerDirection.DiagonalUpLeft, 0.9);
aslV.addDirection(Finger.Index, FingerDirection.DiagonalUpRight, 0.9);
aslV.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
aslV.addDirection(Finger.Middle, FingerDirection.VerticalUp, 1.0);
aslV.addDirection(Finger.Middle, FingerDirection.DiagonalUpLeft, 0.9);
aslV.addDirection(Finger.Middle, FingerDirection.DiagonalUpRight, 0.9);
aslV.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0);
aslV.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0);

// --- W: Three fingers up ---
const aslW = new GestureDescription('W');
aslW.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslW.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9);
aslW.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslW.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0);
aslW.addCurl(Finger.Ring, FingerCurl.NoCurl, 1.0);
aslW.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0);

// --- X: Index finger hooked ---
const aslX = new GestureDescription('X');
aslX.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslX.addCurl(Finger.Index, FingerCurl.HalfCurl, 1.0);
aslX.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0);
for (const f of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslX.addCurl(f, FingerCurl.FullCurl, 1.0);
}

// --- Y: Thumb + pinky out (shaka/hang loose) ---
const aslY = new GestureDescription('Y');
aslY.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aslY.addCurl(Finger.Index, FingerCurl.FullCurl, 1.0);
aslY.addCurl(Finger.Middle, FingerCurl.FullCurl, 1.0);
aslY.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0);
aslY.addCurl(Finger.Pinky, FingerCurl.NoCurl, 1.0);

// ═══════════════════════════════════════════════════════
//  COMMON ASL SIGNS (non-alphabet)
// ═══════════════════════════════════════════════════════

// --- THUMBS UP (Yes/Good) ---
const aslThumbsUp = new GestureDescription('THUMBS_UP');
aslThumbsUp.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aslThumbsUp.addDirection(Finger.Thumb, FingerDirection.VerticalUp, 1.0);
aslThumbsUp.addDirection(Finger.Thumb, FingerDirection.DiagonalUpLeft, 0.9);
aslThumbsUp.addDirection(Finger.Thumb, FingerDirection.DiagonalUpRight, 0.9);
allFingersCurled(aslThumbsUp);

// --- THUMBS DOWN (No/Bad) ---
const aslThumbsDown = new GestureDescription('THUMBS_DOWN');
aslThumbsDown.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aslThumbsDown.addDirection(Finger.Thumb, FingerDirection.VerticalDown, 1.0);
aslThumbsDown.addDirection(Finger.Thumb, FingerDirection.DiagonalDownLeft, 0.9);
aslThumbsDown.addDirection(Finger.Thumb, FingerDirection.DiagonalDownRight, 0.9);
allFingersCurled(aslThumbsDown);

// --- OPEN PALM (Hello/Stop/5) ---
const aslOpenPalm = new GestureDescription('OPEN_PALM');
for (const f of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslOpenPalm.addCurl(f, FingerCurl.NoCurl, 1.0);
}

// --- FIST (S / No) ---
const aslFist = new GestureDescription('FIST');
for (const f of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslFist.addCurl(f, FingerCurl.FullCurl, 1.0);
  aslFist.addCurl(f, FingerCurl.HalfCurl, 0.8);
}

// --- ILY (I Love You — thumb + index + pinky) ---
const aslILY = new GestureDescription('ILY');
aslILY.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
aslILY.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
aslILY.addCurl(Finger.Middle, FingerCurl.FullCurl, 1.0);
aslILY.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0);
aslILY.addCurl(Finger.Pinky, FingerCurl.NoCurl, 1.0);

// --- POINT (Index only — "You" / pointing) ---
const aslPoint = new GestureDescription('POINT');
aslPoint.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0);
aslPoint.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9);
aslPoint.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0);
for (const f of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  aslPoint.addCurl(f, FingerCurl.FullCurl, 1.0);
  aslPoint.addCurl(f, FingerCurl.HalfCurl, 0.9);
}

// --- CALL ME (Thumb + Pinky — "Phone") ---
const aslCallMe = new GestureDescription('CALL_ME');
aslCallMe.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0);
for (const f of [Finger.Index, Finger.Middle, Finger.Ring]) {
  aslCallMe.addCurl(f, FingerCurl.FullCurl, 1.0);
  aslCallMe.addCurl(f, FingerCurl.HalfCurl, 0.9);
}
aslCallMe.addCurl(Finger.Pinky, FingerCurl.NoCurl, 1.0);

// ═══════════════════════════════════════════════════════
//  EXPORT ALL GESTURES
// ═══════════════════════════════════════════════════════

export const ASL_GESTURES = [
  // Alphabet
  aslA, aslB, aslC, aslD, aslE, aslF, aslG, aslH, aslI,
  aslK, aslL, aslM, aslN, aslO, aslP, aslQ, aslR, aslS,
  aslT, aslU, aslV, aslW, aslX, aslY,
  // Common signs
  aslThumbsUp, aslThumbsDown, aslOpenPalm, aslFist, aslILY,
  aslPoint, aslCallMe,
];

// Human-readable labels
export const ASL_LABELS = {
  A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F',
  G: 'G', H: 'H', I: 'I', K: 'K', L: 'L', M: 'M',
  N: 'N', O: 'O', P: 'P', Q: 'Q', R: 'R', S: 'S',
  T: 'T', U: 'U', V: 'V', W: 'W', X: 'X', Y: 'Y',
  THUMBS_UP: 'Yes / Good 👍',
  THUMBS_DOWN: 'No / Bad 👎',
  OPEN_PALM: 'Hello / Stop ✋',
  FIST: 'Fist ✊',
  ILY: 'I Love You 🤟',
  POINT: 'You / Point ☝️',
  CALL_ME: 'Phone / Call Me 🤙',
};
