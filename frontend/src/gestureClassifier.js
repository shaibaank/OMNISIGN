/**
 * ASL Gesture Classifier — Holistic State Machine
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
    if (ok) { this.buffer.push(name); if (this.buffer.length > this.bufferSize) this.buffer.shift(); this.lostCount = 0; }
    else { this.lostCount++; }

    const maj = this._majority();
    const sm = maj?.name;
    const ratio = maj?.ratio || 0;

    if (sm && ratio >= 0.4) { this.currentDisplay = { gloss: sm, confidence: ratio, meaning: MEANINGS[sm] || sm }; }
    else if (this.lostCount > 3) { this.currentDisplay = null; }

    switch (this.state) {
      case State.IDLE:
        if (sm && ratio >= 0.5) { this.candidate = sm; this.candidateCount = 1; this.state = State.DETECTING; }
        return null;
      case State.DETECTING:
        if (!sm || ratio < 0.5) { if (this.lostCount >= this.lostFrames) this._reset(); return null; }
        if (sm === this.candidate) {
          this.candidateCount++;
          if (this.candidateCount >= this.confirmFrames) {
            if (sm === this.lastEmitted && now - this.lastEmitTime < this.cooldownMs) { this.state = State.HOLD; return null; }
            this.state = State.HOLD; this.lastEmitted = sm; this.lastEmitTime = now;
            return { gloss: sm, confidence: ratio, meaning: MEANINGS[sm] || sm };
          }
        } else { this.candidate = sm; this.candidateCount = 1; }
        return null;
      case State.HOLD:
        if (!sm || this.lostCount >= this.lostFrames) { this._reset(); return null; }
        if (sm !== this.lastEmitted) { this.candidate = sm; this.candidateCount = 1; this.state = State.DETECTING; }
        return null;
    }
    return null;
  }

  _majority() {
    if (!this.buffer.length) return null;
    const c = {}; this.buffer.forEach(g => { c[g] = (c[g] || 0) + 1; });
    const s = Object.entries(c).sort((a, b) => b[1] - a[1]);
    return { name: s[0][0], count: s[0][1], ratio: s[0][1] / this.buffer.length };
  }
  _reset() { this.state = State.IDLE; this.candidate = null; this.candidateCount = 0; this.lostCount = 0; this.buffer = []; }
  getDisplay() { return this.currentDisplay; }
  reset() { this._reset(); this.lastEmitted = null; this.lastEmitTime = 0; this.currentDisplay = null; }
}

// ─── Meanings ───
export const MEANINGS = {
  'Closed_Fist': 'Fist / S / Stop', 'Open_Palm': 'Hello / Stop', 'Pointing_Up': 'Point / D',
  'Thumb_Down': 'No / Bad', 'Thumb_Up': 'Yes / Good', 'Victory': 'Peace / V', 'ILoveYou': 'I Love You 🤟',
  // Real ASL Compound Signs
  'ASL_SORRY': 'Sorry 😔', 'ASL_PLEASE': 'Please 🙏', 'ASL_THINK': 'Think / Know 🧠',
  'ASL_DEAF': 'Deaf 🧏', 'ASL_THANK_YOU': 'Thank You', 'ASL_LOVE': 'Love ❤️', 'ASL_SICK': 'Sick 🤒',
  'ASL_SEE': 'See / Look 👀', 'ASL_EAT': 'Eat / Food 🍽️', 'ASL_DRINK': 'Drink 🥤',
  'ASL_GOOD': 'Good 👍', 'ASL_HELP': 'Help 🆘', 'ASL_DOCTOR': 'Doctor 🩺',
  'ASL_WANT': 'Want', 'ASL_NAME': 'Name',
  // Hand shape analyzer signs
  'ASL_WATER': 'Water 💧', 'ASL_FINE': 'Fine / Okay', 'ASL_UNDERSTAND': 'Understand 💡',
  'ASL_WHERE': 'Where?', 'ASL_BATHROOM': 'Bathroom 🚻', 'ASL_HOME': 'Home 🏠',
  'ASL_FAMILY': 'Family 👨‍👩‍👧', 'ASL_LIKE': 'Like 👍', 'ASL_MONEY': 'Money 💰',
  'ASL_WORK': 'Work 💼', 'ASL_SCHOOL': 'School 🏫', 'ASL_TIME': 'Time ⏰',
  'ASL_PHONE': 'Phone 📱', 'ASL_HEAR': 'Hear 👂', 'ASL_SLEEP': 'Sleep 😴',
  'ASL_MORE': 'More', 'ASL_AGAIN': 'Again / Repeat',
  // Generic Body/Face
  'HAND_ON_CHEST': 'Me / I / My', 'HAND_ON_HEAD': 'Head / Mind',
  'HAND_RAISED': 'Help / Attention', 'BOTH_HANDS_UP': 'Emergency / Stop',
  'ARMS_CROSSED': 'Wait / Angry', 'HAND_ON_EAR': 'Listen / Hear', 'HAND_ON_MOUTH': 'Quiet / Secret',
  'FACE_SMILE': 'Happy / Smile', 'FACE_SURPRISE': 'Wow / Surprised', 'FACE_FROWN': 'Angry / Frown',
  'J': 'Letter J', 'Z': 'Letter Z', 'WAVE_HELLO': 'Wave Hello',
  'None': '',
};

// ─── Body-Pose Sign Detection ───
export function detectBodySign(poseLandmarks, handGesture = 'None', handConf = 0) {
  if (!poseLandmarks || poseLandmarks.length < 25) return null;
  const lw = poseLandmarks[15], rw = poseLandmarks[16];
  const ls = poseLandmarks[11], rs = poseLandmarks[12];
  const nose = poseLandmarks[0];
  const lEar = poseLandmarks[7], rEar = poseLandmarks[8];
  const lMouth = poseLandmarks[9], rMouth = poseLandmarks[10];
  if (!lw || !rw || !ls || !rs || !nose) return null;

  const chestX = (ls.x + rs.x) / 2, chestY = (ls.y + rs.y) / 2 + 0.1;
  const rwC = Math.hypot(rw.x - chestX, rw.y - chestY);
  const lwC = Math.hypot(lw.x - chestX, lw.y - chestY);
  const rwH = Math.hypot(rw.x - nose.x, rw.y - nose.y);
  const lwH = Math.hypot(lw.x - nose.x, lw.y - nose.y);
  const rwE = rEar ? Math.hypot(rw.x - rEar.x, rw.y - rEar.y) : 1;
  const lwE = lEar ? Math.hypot(lw.x - lEar.x, lw.y - lEar.y) : 1;
  const mX = lMouth && rMouth ? (lMouth.x + rMouth.x) / 2 : nose.x;
  const mY = lMouth && rMouth ? (lMouth.y + rMouth.y) / 2 : nose.y;
  const rwM = Math.hypot(rw.x - mX, rw.y - mY);
  const lwM = Math.hypot(lw.x - mX, lw.y - mY);
  const lwRs = Math.hypot(lw.x - rs.x, lw.y - rs.y);
  const rwLs = Math.hypot(rw.x - ls.x, rw.y - ls.y);

  const onChest = rwC < 0.22 || lwC < 0.22;
  const onHead = rwH < 0.20 || lwH < 0.20;
  const onEar = rwE < 0.18 || lwE < 0.18;
  const onMouth = rwM < 0.18 || lwM < 0.18;
  const crossed = lwRs < 0.25 && rwLs < 0.25;

  // Eye area (above mouth, beside nose)
  const eyeY = nose.y - 0.04;
  const rwEye = Math.hypot(rw.x - nose.x, rw.y - eyeY);
  const lwEye = Math.hypot(lw.x - nose.x, lw.y - eyeY);
  const onEyes = rwEye < 0.15 || lwEye < 0.15;

  // Wrist area (opposite hand's wrist)
  const le = poseLandmarks[13]; // left elbow
  const re = poseLandmarks[14]; // right elbow
  const rwToLw = Math.hypot(rw.x - lw.x, rw.y - lw.y);
  const onWrist = rwToLw < 0.12;

  // ─── REAL ASL COMPOUND SIGNS ───
  // SORRY: Fist on chest (circular rub in real ASL)
  if (handGesture === 'Closed_Fist' && onChest) return { name: 'ASL_SORRY', confidence: 0.90 };
  // PLEASE: Open Palm on chest (circular rub)
  if (handGesture === 'Open_Palm' && onChest) return { name: 'ASL_PLEASE', confidence: 0.90 };
  // THINK/KNOW: Index finger at forehead
  if (handGesture === 'Pointing_Up' && onHead) return { name: 'ASL_THINK', confidence: 0.90 };
  // DEAF: Index finger touches ear then mouth
  if (handGesture === 'Pointing_Up' && onEar) return { name: 'ASL_DEAF', confidence: 0.90 };
  // THANK YOU / GOOD: Open Palm from chin forward
  if (handGesture === 'Open_Palm' && onMouth) return { name: 'ASL_THANK_YOU', confidence: 0.90 };
  // SEE/LOOK: V-hand (Victory) near eyes, pointing outward
  if (handGesture === 'Victory' && onEyes) return { name: 'ASL_SEE', confidence: 0.90 };
  // EAT/FOOD: Closed hand (fingertips) tapping mouth
  if (handGesture === 'Closed_Fist' && onMouth) return { name: 'ASL_EAT', confidence: 0.90 };
  // DRINK: Thumb_Up (C-shape) tilting to mouth
  if (handGesture === 'Thumb_Up' && onMouth) return { name: 'ASL_DRINK', confidence: 0.90 };
  // GOOD: Thumb_Up near chin (real ASL: flat hand from chin forward)
  if (handGesture === 'Thumb_Up' && onHead) return { name: 'ASL_GOOD', confidence: 0.88 };
  // HELP: ILoveYou hand raised up
  if (handGesture === 'ILoveYou' && (rw.y < rs.y || lw.y < ls.y)) return { name: 'ASL_HELP', confidence: 0.90 };
  // DOCTOR: Victory (V/2) tapping on opposite wrist (pulse-taking)
  if (handGesture === 'Victory' && onWrist) return { name: 'ASL_DOCTOR', confidence: 0.88 };
  // WANT: Open palms pulling toward body (hands in front, pulling)
  if (handGesture === 'Open_Palm' && rw.y > rs.y && rw.y < chestY + 0.15 && rwC > 0.15 && rwC < 0.35) return { name: 'ASL_WANT', confidence: 0.85 };
  // NAME: Victory (H-fingers) tapping near chest/shoulder
  if (handGesture === 'Victory' && onChest) return { name: 'ASL_NAME', confidence: 0.88 };
  // LOVE: Both arms crossed with fists
  if (handGesture === 'Closed_Fist' && crossed) return { name: 'ASL_LOVE', confidence: 0.90 };
  // SICK: One hand on head, one on chest
  if ((rwH < 0.22 && lwC < 0.22) || (lwH < 0.22 && rwC < 0.22)) return { name: 'ASL_SICK', confidence: 0.85 };

  // ─── GENERIC BODY POSES ───
  if (handGesture === 'None' || handConf < 0.5) {
    if (crossed) return { name: 'ARMS_CROSSED', confidence: 0.85 };
    if (lw.y < ls.y - 0.05 && rw.y < rs.y - 0.05) return { name: 'BOTH_HANDS_UP', confidence: 0.8 };
    if (rw.y < nose.y - 0.15 || lw.y < nose.y - 0.15) return { name: 'HAND_RAISED', confidence: 0.75 };
    if (onEar) return { name: 'HAND_ON_EAR', confidence: 0.85 };
    if (onMouth) return { name: 'HAND_ON_MOUTH', confidence: 0.85 };
    if (onChest) return { name: 'HAND_ON_CHEST', confidence: 0.85 };
    if (onHead) return { name: 'HAND_ON_HEAD', confidence: 0.85 };
  }
  return null;
}

// ─── Face Sign Detection ───
export function detectFaceSign(blendshapes) {
  if (!blendshapes || !blendshapes.length) return null;
  const s = {}; blendshapes[0]?.categories?.forEach(c => { s[c.categoryName] = c.score; });
  const browUp = (s['browInnerUp'] || 0) > 0.4;
  const jaw = (s['jawOpen'] || 0) > 0.4;
  const smile = ((s['mouthSmileLeft'] || 0) + (s['mouthSmileRight'] || 0)) / 2 > 0.45;
  const browDown = ((s['browDownLeft'] || 0) + (s['browDownRight'] || 0)) / 2 > 0.4;
  if (browUp && jaw) return { name: 'FACE_SURPRISE', confidence: 0.8 };
  if (smile) return { name: 'FACE_SMILE', confidence: 0.8 };
  if (browDown) return { name: 'FACE_FROWN', confidence: 0.8 };
  return null;
}

// ─── Face NMM Detection ───
export function detectFaceNMM(blendshapes) {
  if (!blendshapes || !blendshapes.length) return null;
  const s = {}; blendshapes[0]?.categories?.forEach(c => { s[c.categoryName] = c.score; });
  return {
    browUp: (s['browInnerUp'] || 0) > 0.4,
    mouthOpen: (s['jawOpen'] || 0) > 0.3,
    smile: ((s['mouthSmileLeft'] || 0) + (s['mouthSmileRight'] || 0)) / 2 > 0.3,
  };
}

// ─── Sentence Patterns ───
const PATTERNS = [
  { p: ['Open_Palm'], s: 'Hello' },
  { p: ['ILoveYou'], s: 'I love you' },
  { p: ['Thumb_Up'], s: 'Yes' },
  { p: ['Thumb_Down'], s: 'No' },
  { p: ['Open_Palm', 'ILoveYou'], s: 'Hello, nice to meet you!' },
  { p: ['Open_Palm', 'Thumb_Up'], s: 'Hello, how are you?' },
  { p: ['ILoveYou', 'Thumb_Up'], s: 'Thank you so much!' },
  { p: ['Pointing_Up', 'Thumb_Down'], s: 'I am not feeling well' },
  { p: ['Pointing_Up', 'Closed_Fist'], s: 'I need help' },
  { p: ['Pointing_Up', 'Thumb_Up'], s: 'I am doing well' },
  { p: ['Closed_Fist', 'Open_Palm'], s: 'Please stop' },
  { p: ['Victory', 'Thumb_Up'], s: 'Great, sounds good!' },
  // 📅 Booking
  { p: ['WAVE_HELLO', 'ASL_DEAF', 'HAND_ON_MOUTH'], s: 'Hello, I am Deaf. I prefer text communication.' },
  { p: ['HAND_ON_CHEST', 'ASL_PLEASE', 'Thumb_Up'], s: 'I want to book an appointment.' },
  { p: ['ASL_PLEASE', 'HAND_ON_MOUTH', 'Thumb_Up'], s: 'Please confirm appointment by message.' },
  { p: ['WAVE_HELLO', 'ASL_DEAF', 'HAND_ON_MOUTH', 'ASL_THANK_YOU'], s: 'Hello, I am Deaf and communicate using text. Please confirm available time by message. Thank you.' },
  // 🏥 Clinic
  { p: ['WAVE_HELLO', 'HAND_ON_CHEST', 'Thumb_Up'], s: 'Hello, I have an appointment.' },
  { p: ['ASL_DEAF', 'ASL_PLEASE', 'HAND_ON_MOUTH'], s: 'I am Deaf. Please communicate by writing.' },
  { p: ['ARMS_CROSSED', 'Pointing_Up'], s: 'How long wait?' },
  { p: ['ASL_PLEASE', 'HAND_ON_MOUTH', 'ARMS_CROSSED'], s: 'Please message when ready.' },
  // 💬 Doctor
  { p: ['HAND_ON_CHEST', 'ASL_DEAF', 'HAND_ON_EAR'], s: 'I am Deaf. I do not hear speech.' },
  { p: ['ASL_PLEASE', 'HAND_ON_MOUTH', 'Pointing_Up'], s: 'Please write or type.' },
  { p: ['ASL_SICK', 'FACE_FROWN'], s: 'I feel pain here.' },
  { p: ['HAND_ON_CHEST', 'FACE_FROWN', 'Thumb_Down'], s: 'Pain level strong.' },
  { p: ['HAND_ON_CHEST', 'FACE_FROWN', 'Thumb_Up'], s: 'Pain level low.' },
  { p: ['HAND_ON_CHEST', 'Thumb_Down', 'ASL_SICK'], s: 'I have an allergy to medicine.' },
  // ❓ Questions
  { p: ['ASL_THINK', 'Thumb_Down'], s: 'What is the problem?' },
  { p: ['ASL_THINK', 'Thumb_Up'], s: 'What treatment is needed?' },
  { p: ['ASL_THINK', 'ARMS_CROSSED'], s: 'How long is the recovery?' },
  // 💊 Pharmacy
  { p: ['Pointing_Up', 'ARMS_CROSSED'], s: 'How many times per day?' },
  { p: ['ASL_SICK', 'Thumb_Down'], s: 'Are there any side effects?' },
  { p: ['ASL_PLEASE', 'HAND_ON_MOUTH', 'HAND_ON_CHEST'], s: 'Can you write the instructions?' },
  // 🩺 Real ASL compound sentences
  { p: ['HAND_ON_CHEST', 'ASL_WANT', 'ASL_SEE', 'ASL_DOCTOR'], s: 'I want to see a doctor.' },
  { p: ['HAND_ON_CHEST', 'ASL_WANT', 'ASL_DRINK'], s: 'I want a drink / I need water.' },
  { p: ['HAND_ON_CHEST', 'ASL_WANT', 'ASL_EAT'], s: 'I want to eat / I need food.' },
  { p: ['ASL_HELP', 'ASL_PLEASE'], s: 'Please help me!' },
  { p: ['ASL_DOCTOR', 'ARMS_CROSSED'], s: 'When is the doctor available?' },
  { p: ['ASL_NAME', 'HAND_ON_CHEST'], s: 'My name is...' },
  { p: ['HAND_ON_CHEST', 'ASL_GOOD'], s: 'I am good / I feel fine.' },
  { p: ['HAND_ON_CHEST', 'ASL_SEE', 'ASL_DOCTOR'], s: 'I need to see a doctor.' },
  { p: ['ASL_EAT', 'Thumb_Down'], s: 'I cannot eat / No appetite.' },
  { p: ['ASL_DRINK', 'ASL_PLEASE'], s: 'Water please / Can I have a drink?' },
  { p: ['ASL_SEE', 'Thumb_Down'], s: 'I cannot see well / Vision problem.' },
  { p: ['ASL_THANK_YOU', 'ASL_DOCTOR'], s: 'Thank you, doctor.' },
  { p: ['ASL_GOOD', 'ASL_THANK_YOU'], s: 'Good, thank you!' },
  { p: ['HAND_ON_CHEST', 'ASL_SORRY'], s: 'I am sorry.' },
  { p: ['ASL_HELP'], s: 'Help!' },
  { p: ['ASL_SEE'], s: 'I see / Look' },
  { p: ['ASL_EAT'], s: 'Eat / Food' },
  { p: ['ASL_DRINK'], s: 'Drink / Water' },
  { p: ['ASL_DOCTOR'], s: 'Doctor' },
  { p: ['ASL_GOOD'], s: 'Good' },
  { p: ['ASL_WANT'], s: 'Want / Need' },
  { p: ['ASL_NAME'], s: 'Name' },
  // Hand shape analyzer single words
  { p: ['ASL_WATER'], s: 'Water' },
  { p: ['ASL_FINE'], s: 'Fine / Okay' },
  { p: ['ASL_UNDERSTAND'], s: 'I understand' },
  { p: ['ASL_WHERE'], s: 'Where?' },
  { p: ['ASL_BATHROOM'], s: 'Bathroom' },
  { p: ['ASL_HOME'], s: 'Home' },
  { p: ['ASL_FAMILY'], s: 'Family' },
  { p: ['ASL_LIKE'], s: 'Like' },
  { p: ['ASL_MONEY'], s: 'Money / Pay' },
  { p: ['ASL_WORK'], s: 'Work' },
  { p: ['ASL_SCHOOL'], s: 'School' },
  { p: ['ASL_TIME'], s: 'Time / What time?' },
  { p: ['ASL_PHONE'], s: 'Phone / Call' },
  { p: ['ASL_HEAR'], s: 'Hear' },
  { p: ['ASL_SLEEP'], s: 'Sleep / Tired' },
  { p: ['ASL_MORE'], s: 'More' },
  { p: ['ASL_AGAIN'], s: 'Again / Repeat' },
  // Conversation sentences using new signs
  { p: ['HAND_ON_CHEST', 'ASL_WANT', 'ASL_WATER'], s: 'I want water.' },
  { p: ['HAND_ON_CHEST', 'ASL_WANT', 'ASL_HOME'], s: 'I want to go home.' },
  { p: ['ASL_WHERE', 'ASL_BATHROOM'], s: 'Where is the bathroom?' },
  { p: ['ASL_WHERE', 'ASL_DOCTOR'], s: 'Where is the doctor?' },
  { p: ['ASL_WHERE', 'ASL_HOME'], s: 'Where is home?' },
  { p: ['ASL_WHERE', 'ASL_PHONE'], s: 'Where is my phone?' },
  { p: ['HAND_ON_CHEST', 'ASL_FINE'], s: 'I am fine.' },
  { p: ['HAND_ON_CHEST', 'ASL_SLEEP'], s: 'I am tired / I need to sleep.' },
  { p: ['HAND_ON_CHEST', 'ASL_WORK'], s: 'I work / I am working.' },
  { p: ['ASL_WATER', 'ASL_PLEASE'], s: 'Water, please.' },
  { p: ['ASL_MORE', 'ASL_WATER'], s: 'More water, please.' },
  { p: ['ASL_MORE', 'ASL_TIME'], s: 'I need more time.' },
  { p: ['HAND_ON_CHEST', 'ASL_UNDERSTAND', 'Thumb_Down'], s: 'I do not understand.' },
  { p: ['ASL_AGAIN', 'ASL_PLEASE'], s: 'Please repeat / Say that again.' },
  { p: ['ASL_PHONE', 'ASL_FAMILY'], s: 'Call my family.' },
  { p: ['ASL_PHONE', 'ASL_PLEASE'], s: 'Can I use the phone?' },
  { p: ['HAND_ON_CHEST', 'ASL_LIKE', 'ASL_DOCTOR'], s: 'I like the doctor.' },
  { p: ['ASL_MONEY', 'ASL_WHERE'], s: 'Where do I pay?' },
  { p: ['ASL_TIME', 'ASL_DOCTOR'], s: 'What time is the doctor?' },
  { p: ['ASL_TIME', 'ASL_HOME'], s: 'What time do I go home?' },
  { p: ['ASL_NAME', 'ASL_DOCTOR'], s: 'What is the doctor\'s name?' },
  // Body defaults
  { p: ['HAND_RAISED'], s: 'I need attention!' },
  { p: ['BOTH_HANDS_UP'], s: 'Emergency! Help!' },
  { p: ['HAND_ON_CHEST'], s: 'Me / I am' },
  { p: ['HAND_ON_CHEST', 'Thumb_Up'], s: 'I am okay' },
  { p: ['HAND_ON_HEAD', 'Thumb_Up'], s: 'I understand clearly' },
  { p: ['HAND_ON_HEAD', 'Thumb_Down'], s: 'I do not understand' },
  { p: ['FACE_SMILE', 'Thumb_Up'], s: 'I am very happy' },
  { p: ['FACE_FROWN', 'Thumb_Down'], s: 'I am very unhappy' },
  { p: ['FACE_SURPRISE'], s: 'Wow!' },
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
    title: '💬 Real ASL Essentials',
    steps: [
      { gesture: 'Open_Palm ✋ + Chest', phrase: 'Please', instruction: 'Place an open palm flat on your chest' },
      { gesture: 'Closed_Fist ✊ + Chest', phrase: 'Sorry', instruction: 'Place a closed fist on your chest' },
      { gesture: 'Open_Palm ✋ + Mouth', phrase: 'Thank You', instruction: 'Place an open palm near your mouth/chin' },
      { gesture: 'Pointing_Up ☝️ + Head', phrase: 'I know / I think', instruction: 'Point your index finger at your forehead' },
      { gesture: 'Pointing_Up ☝️ + Ear', phrase: 'Deaf', instruction: 'Point your index finger near your ear' },
      { gesture: 'Closed_Fist ✊ + Arms Crossed', phrase: 'Love', instruction: 'Cross both arms over your chest with closed fists' },
      { gesture: 'Hand on Head + Hand on Chest', phrase: 'Sick', instruction: 'One hand on forehead, other on stomach' },
    ]
  },
  {
    title: '📅 Booking an Appointment',
    steps: [
      { gesture: '👋 → 🧏 → 🤫', phrase: 'Hello, I am Deaf. I prefer text communication.', instruction: 'Wave, point ear (Deaf), cover mouth (Text)' },
      { gesture: '🧑 → 🙏 → 👍', phrase: 'I want to book an appointment.', instruction: 'Chest (Me), open palm on chest (Please), thumbs up' },
      { gesture: '🙏 → 🤫 → 👍', phrase: 'Please confirm appointment by message.', instruction: 'Open palm on chest, cover mouth, thumbs up' },
    ]
  },
  {
    title: '🏥 At the Clinic',
    steps: [
      { gesture: '👋 → 🧑 → 👍', phrase: 'Hello, I have an appointment.', instruction: 'Wave, chest, thumbs up' },
      { gesture: '🧏 → 🙏 → 🤫', phrase: 'I am Deaf. Please communicate by writing.', instruction: 'Point ear, flat hand on chest, cover mouth' },
      { gesture: '🙅 → ☝️', phrase: 'How long wait?', instruction: 'Cross arms (wait), point up' },
    ],
  },
  {
    title: '💬 Doctor / Explaining Problem',
    steps: [
      { gesture: '🧑 → 🧏 → 👂', phrase: 'I am Deaf. I do not hear speech.', instruction: 'Chest, point ear, hand on ear' },
      { gesture: '🤒 → 😠', phrase: 'I feel pain here.', instruction: 'Hand on head & stomach (Sick), then frown' },
      { gesture: '🧑 → 😠 → 👎', phrase: 'Pain level strong.', instruction: 'Chest, frown, thumbs down' },
      { gesture: '🧠 → 👎', phrase: 'What is the problem?', instruction: 'Index on forehead (Think), thumbs down' },
      { gesture: '🧠 → 👍', phrase: 'What treatment is needed?', instruction: 'Index on forehead (Think), thumbs up' },
    ],
  },
  {
    title: '💊 Pharmacy / Instructions',
    steps: [
      { gesture: '☝️ → 🙅', phrase: 'How many times per day?', instruction: 'Point up, cross arms' },
      { gesture: '🤒 → 👎', phrase: 'Are there any side effects?', instruction: 'Sick sign, thumbs down' },
      { gesture: '🙏 → 🤫 → 🧑', phrase: 'Can you write the instructions?', instruction: 'Please, cover mouth, chest' },
    ],
  },
  {
    title: '🔤 Dynamic Letters',
    steps: [
      { gesture: 'J', phrase: 'Letter J', instruction: 'Pinky only, draw J shape downwards' },
      { gesture: 'Z', phrase: 'Letter Z', instruction: 'Index only, draw Z shape in air' },
      { gesture: 'WAVE_HELLO', phrase: 'Wave Hello', instruction: 'Open palm, wave left and right' },
    ],
  },
];

// ─── Dynamic Gesture Detector ───
export class DynamicGestureDetector {
  constructor() { this.history = []; this.customGestures = {}; }
  addCustomGesture(label, landmarks) { this.customGestures[label] = landmarks; }
  _distLms(a, b) { let d = 0; for (let i = 0; i < 21; i++) d += Math.hypot(b[i].x - a[i].x, b[i].y - a[i].y); return d / 21; }
  detect(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;
    for (const [label, cl] of Object.entries(this.customGestures)) { if (this._distLms(landmarks, cl) < 0.08) return { name: label, confidence: 0.95 }; }
    this.history.push(landmarks); if (this.history.length > 15) this.history.shift();
    if (this.history.length > 5) {
      const r = this.history;
      const wX = r.map(f => f[0].x);
      const isExt = (t, p) => landmarks[t].y < landmarks[p].y;
      const ext = [Math.abs(landmarks[4].x - landmarks[0].x) > Math.abs(landmarks[3].x - landmarks[0].x), isExt(8,6), isExt(12,10), isExt(16,14), isExt(20,18)];
      const cnt = ext.filter(Boolean).length;
      if (cnt === 5 && Math.max(...wX) - Math.min(...wX) > 0.08) return { name: 'WAVE_HELLO', confidence: 0.90 };
      if (!ext[0] && !ext[1] && !ext[2] && !ext[3] && ext[4]) {
        const pY = r.map(f => f[20].y), pX = r.map(f => f[20].x);
        if (pY[pY.length-1] - pY[0] > 0.05 && Math.abs(pX[pX.length-1] - pX[0]) > 0.02) return { name: 'J', confidence: 0.88 };
      }
      if (!ext[0] && ext[1] && !ext[2] && !ext[3] && !ext[4]) {
        const iX = r.map(f => f[8].x), iY = r.map(f => f[8].y);
        if (Math.max(...iX) - Math.min(...iX) > 0.06 && Math.max(...iY) - Math.min(...iY) > 0.06) return { name: 'Z', confidence: 0.88 };
      }
    }
    return null;
  }
}
