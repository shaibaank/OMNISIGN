/**
 * ASL Gesture Classifier — Holistic State Machine
 * Works with MediaPipe GestureRecognizer + PoseLandmarker + FaceLandmarker
 *
 * Pipeline: frame → classify → smooth → state change → emit
 * States:   IDLE → DETECTING → HOLD (emit once, wait for change)
 */

const State = { IDLE: 0, DETECTING: 1, HOLD: 2 };

export class GestureStateMachine {
  constructor(cfg = {}) {
    this.confirmFrames = cfg.confirmFrames ?? 4;
    this.cooldownMs = cfg.cooldownMs ?? 2000;
    this.bufferSize = cfg.bufferSize ?? 7;
    this.lostFrames = cfg.lostFrames ?? 8;
    this.minConfidence = cfg.minConfidence ?? 0.65;
    this.state = State.IDLE;
    this.candidate = null;
    this.candidateCount = 0;
    this.lostCount = 0;
    this.lastEmitted = null;
    this.lastEmitTime = 0;
    this.buffer = [];
    this.currentDisplay = null;
  }

  process(name, confidence) {
    const now = Date.now();
    const ok = name && name !== 'None' && confidence >= this.minConfidence;

    if (ok) {
      this.buffer.push(name);
      if (this.buffer.length > this.bufferSize) this.buffer.shift();
      this.lostCount = 0;
    } else {
      this.lostCount++;
    }

    const maj = this._majority();
    const sm = maj?.name;
    const ratio = maj?.ratio || 0;

    if (sm && ratio >= 0.4) {
      this.currentDisplay = { gloss: sm, confidence: ratio, meaning: MEANINGS[sm] || sm };
    } else if (this.lostCount > 3) {
      this.currentDisplay = null;
    }

    switch (this.state) {
      case State.IDLE:
        if (sm && ratio >= 0.5) {
          this.candidate = sm;
          this.candidateCount = 1;
          this.state = State.DETECTING;
        }
        return null;

      case State.DETECTING:
        if (!sm || ratio < 0.5) {
          if (this.lostCount >= this.lostFrames) this._reset();
          return null;
        }
        if (sm === this.candidate) {
          this.candidateCount++;
          if (this.candidateCount >= this.confirmFrames) {
            if (sm === this.lastEmitted && now - this.lastEmitTime < this.cooldownMs) {
              this.state = State.HOLD;
              return null;
            }
            this.state = State.HOLD;
            this.lastEmitted = sm;
            this.lastEmitTime = now;
            return { gloss: sm, confidence: ratio, meaning: MEANINGS[sm] || sm };
          }
        } else {
          this.candidate = sm;
          this.candidateCount = 1;
        }
        return null;

      case State.HOLD:
        if (!sm || this.lostCount >= this.lostFrames) { this._reset(); return null; }
        if (sm !== this.lastEmitted) {
          this.candidate = sm;
          this.candidateCount = 1;
          this.state = State.DETECTING;
        }
        return null;
    }
    return null;
  }

  _majority() {
    if (!this.buffer.length) return null;
    const c = {};
    this.buffer.forEach(g => { c[g] = (c[g] || 0) + 1; });
    const s = Object.entries(c).sort((a, b) => b[1] - a[1]);
    return { name: s[0][0], count: s[0][1], ratio: s[0][1] / this.buffer.length };
  }

  _reset() { this.state = State.IDLE; this.candidate = null; this.candidateCount = 0; this.lostCount = 0; this.buffer = []; }
  getDisplay() { return this.currentDisplay; }
  reset() { this._reset(); this.lastEmitted = null; this.lastEmitTime = 0; this.currentDisplay = null; }
}

// ─── Meanings ───
export const MEANINGS = {
  'Closed_Fist': 'Fist / S / Stop',
  'Open_Palm': 'Hello / Stop',
  'Pointing_Up': 'Point / You / D',
  'Thumb_Down': 'No / Bad',
  'Thumb_Up': 'Yes / Good',
  'Victory': 'Peace / V',
  'ILoveYou': 'I Love You 🤟',
  // Body-augmented signs (detected from pose)
  'HAND_ON_CHEST': 'Me / I / Sorry',
  'HAND_RAISED': 'Help / Attention',
  'BOTH_HANDS_UP': 'Emergency / Stop',
  'HEAD_NOD': 'Yes (nod)',
  'HEAD_SHAKE': 'No (shake)',
  'None': '',
};

// ─── Body-Pose Sign Detection ───
export function detectBodySign(poseLandmarks) {
  if (!poseLandmarks || poseLandmarks.length < 25) return null;
  const lw = poseLandmarks[15]; // left wrist
  const rw = poseLandmarks[16]; // right wrist
  const ls = poseLandmarks[11]; // left shoulder
  const rs = poseLandmarks[12]; // right shoulder
  const nose = poseLandmarks[0];

  // Both hands above shoulders = emergency
  if (lw && rw && ls && rs && lw.y < ls.y - 0.05 && rw.y < rs.y - 0.05) {
    return { name: 'BOTH_HANDS_UP', confidence: 0.8 };
  }
  // One hand raised high above head
  if (rw && nose && rw.y < nose.y - 0.15) {
    return { name: 'HAND_RAISED', confidence: 0.75 };
  }
  if (lw && nose && lw.y < nose.y - 0.15) {
    return { name: 'HAND_RAISED', confidence: 0.75 };
  }
  return null;
}

// ─── Face NMM Detection ───
export function detectFaceNMM(blendshapes) {
  if (!blendshapes || !blendshapes.length) return null;
  const shapes = {};
  blendshapes[0]?.categories?.forEach(c => { shapes[c.categoryName] = c.score; });

  const browUp = (shapes['browInnerUp'] || 0) > 0.4;
  const mouthOpen = (shapes['jawOpen'] || 0) > 0.3;
  const smile = ((shapes['mouthSmileLeft'] || 0) + (shapes['mouthSmileRight'] || 0)) / 2 > 0.3;

  return { browUp, mouthOpen, smile };
}

// ─── Sentence Patterns ───
const PATTERNS = [
  // Basic
  { p: ['Open_Palm'], s: 'Hello' },
  { p: ['ILoveYou'], s: 'I love you' },
  { p: ['Thumb_Up'], s: 'Yes' },
  { p: ['Thumb_Down'], s: 'No' },

  // Greetings
  { p: ['Open_Palm', 'ILoveYou'], s: 'Hello, nice to meet you!' },
  { p: ['Open_Palm', 'Thumb_Up'], s: 'Hello, how are you?' },
  { p: ['Open_Palm', 'Victory'], s: 'Hi, peace!' },
  { p: ['Open_Palm', 'Open_Palm'], s: 'Hello! Welcome!' },
  { p: ['ILoveYou', 'Thumb_Up'], s: 'Thank you so much!' },

  // Needs / Requests
  { p: ['Pointing_Up', 'Thumb_Down'], s: 'I am not feeling well' },
  { p: ['Pointing_Up', 'Closed_Fist'], s: 'I need help' },
  { p: ['Pointing_Up', 'Thumb_Up'], s: 'I am doing well' },
  { p: ['Pointing_Up', 'ILoveYou'], s: 'I appreciate you' },
  { p: ['Closed_Fist', 'Open_Palm'], s: 'Please stop' },
  { p: ['Closed_Fist', 'Thumb_Up'], s: "Let's go!" },
  { p: ['Victory', 'Thumb_Up'], s: 'Great, sounds good!' },

  // Hospital / Medical
  { p: ['Pointing_Up', 'Thumb_Down', 'Closed_Fist'], s: 'I am in pain, I need help' },
  { p: ['Pointing_Up', 'Closed_Fist', 'Pointing_Up'], s: 'I need to see a doctor' },
  { p: ['Pointing_Up', 'Open_Palm', 'Thumb_Down'], s: 'I need medicine, I feel bad' },
  { p: ['Thumb_Down', 'Thumb_Down'], s: 'Very bad / Severe pain' },
  { p: ['Thumb_Up', 'Thumb_Up'], s: 'Very good! All clear!' },
  { p: ['Closed_Fist', 'Closed_Fist'], s: 'Urgent / Emergency!' },
  { p: ['Open_Palm', 'Pointing_Up', 'Thumb_Up'], s: 'Hello, I have an appointment' },
  { p: ['Open_Palm', 'Pointing_Up', 'Closed_Fist'], s: 'Hello, I need help urgently' },
  { p: ['Pointing_Up', 'Victory'], s: 'I need a second opinion' },
  { p: ['Victory', 'Pointing_Up'], s: 'Wait a moment please' },

  // Body-augmented
  { p: ['HAND_RAISED'], s: 'I need attention!' },
  { p: ['BOTH_HANDS_UP'], s: 'Emergency! Help!' },
  { p: ['HAND_RAISED', 'Thumb_Down'], s: 'Help! Something is wrong!' },
  { p: ['HAND_RAISED', 'Open_Palm'], s: 'Excuse me, hello!' },
];

export function matchSentence(seq) {
  if (!seq || seq.length < 1) return null;
  const sorted = [...PATTERNS].sort((a, b) => b.p.length - a.p.length);
  for (const { p, s } of sorted) {
    if (seq.length < p.length) continue;
    const tail = seq.slice(-p.length);
    if (p.every((x, i) => x === tail[i])) return { sentence: s, matchLength: p.length };
  }
  return null;
}

// ─── Practice Scenarios ───
export const PRACTICE_SCENARIOS = [
  {
    title: '👋 Basic Greetings',
    steps: [
      { gesture: 'Open_Palm ✋', phrase: 'Hello', instruction: 'Show open palm facing camera' },
      { gesture: 'Open_Palm → ILoveYou 🤟', phrase: 'Hello, nice to meet you!', instruction: 'Open palm, then ILY sign (thumb + index + pinky)' },
      { gesture: 'Thumb_Up 👍', phrase: 'Yes / I\'m good', instruction: 'Thumbs up' },
      { gesture: 'ILoveYou 🤟', phrase: 'I love you / Thank you', instruction: 'Thumb + index + pinky extended' },
    ],
  },
  {
    title: '🏥 Hospital Appointment',
    steps: [
      { gesture: 'Open_Palm → Pointing_Up → Thumb_Up', phrase: 'Hello, I have an appointment', instruction: 'Wave hello, point up, then thumbs up' },
      { gesture: 'Pointing_Up → Closed_Fist', phrase: 'I need help', instruction: 'Point up (I), then show fist (need/urgent)' },
      { gesture: 'Pointing_Up → Thumb_Down', phrase: 'I am not feeling well', instruction: 'Point up (I), then thumbs down (bad/sick)' },
      { gesture: 'Pointing_Up → Thumb_Down → Closed_Fist', phrase: 'I am in pain, I need help', instruction: 'Point (I), thumbs down (pain), fist (help)' },
      { gesture: 'Thumb_Up 👍', phrase: 'Yes, I understand', instruction: 'Thumbs up to confirm' },
      { gesture: 'Thumb_Down 👎', phrase: 'No', instruction: 'Thumbs down to decline' },
      { gesture: 'ILoveYou → Thumb_Up', phrase: 'Thank you so much!', instruction: 'ILY sign then thumbs up' },
    ],
  },
  {
    title: '🚨 Emergency Signs',
    steps: [
      { gesture: 'Closed_Fist → Closed_Fist ✊✊', phrase: 'Urgent / Emergency!', instruction: 'Show fist twice quickly' },
      { gesture: 'Raise hand above head 🙋', phrase: 'I need attention!', instruction: 'Raise your hand high above your head' },
      { gesture: 'Thumb_Down → Thumb_Down 👎👎', phrase: 'Very bad / Severe pain', instruction: 'Thumbs down twice' },
      { gesture: 'Pointing_Up → Closed_Fist → Pointing_Up', phrase: 'I need to see a doctor', instruction: 'Point (I), fist (need), point (doctor)' },
    ],
  },
];
