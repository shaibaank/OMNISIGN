import { useState, useCallback, useEffect, useRef } from 'react';
import GestureCapture from './components/GestureCapture.jsx';
import AvatarRenderer from './components/AvatarRenderer.jsx';
import TextPanel from './components/TextPanel.jsx';
import ModeSelector from './components/ModeSelector.jsx';
import useWebSocket from './hooks/useWebSocket.js';
import { matchSentence } from './gestureClassifier.js';

// MediaPipe Holistic → readable word (hand gestures + body signs)
const GLOSS_WORD = {
  'Closed_Fist':    'Stop',
  'Open_Palm':      'Hello',
  'Pointing_Up':    'I / You',
  'Thumb_Down':     'No',
  'Thumb_Up':       'Yes',
  'Victory':        'Peace',
  'ILoveYou':       'I Love You',
  'HAND_RAISED':    'Help!',
  'BOTH_HANDS_UP':  'Emergency!',
  'HAND_ON_CHEST':  'Me / Sorry',
  'None': '', 'UNKNOWN': '',
};

const SENTENCE_TIMEOUT_MS = 4000;

function textToGloss(text) {
  const stop = new Set(['a','an','the','is','are','am','was','were','to','of','it','its']);
  const words = text.toLowerCase().replace(/[?.!,]/g, '').split(/\s+/);
  return words.filter(w => !stop.has(w)).map(w => w.toUpperCase());
}

const GLOSS_CLIPS = {
  'Open_Palm':      { clip_id: 'hello_wave',   duration_ms: 900,  nmm: { brow_raise: 0.4, smile: 0.6 } },
  'Thumb_Up':       { clip_id: 'yes_nod',      duration_ms: 700,  nmm: { nod: 1.0, smile: 0.3 } },
  'Thumb_Down':     { clip_id: 'no_shake',     duration_ms: 700,  nmm: { head_shake: 1.0 } },
  'Pointing_Up':    { clip_id: 'you_point',    duration_ms: 400,  nmm: {} },
  'ILoveYou':       { clip_id: 'love',         duration_ms: 1000, nmm: { smile: 0.9 } },
  'Closed_Fist':    { clip_id: 'stop',         duration_ms: 600,  nmm: { brow_furrow: 0.4 } },
  'Victory':        { clip_id: 'victory',      duration_ms: 700,  nmm: { smile: 0.6 } },
  'HAND_RAISED':    { clip_id: 'help',         duration_ms: 900,  nmm: { brow_furrow: 0.5 } },
  'BOTH_HANDS_UP':  { clip_id: 'emergency',    duration_ms: 1000, nmm: { brow_furrow: 0.8 } },
  'HAND_ON_CHEST':  { clip_id: 'sorry',        duration_ms: 800,  nmm: { nod: 0.3 } },
};

const FALLBACK_CLIP = { clip_id: 'generic', duration_ms: 600, nmm: {} };

export default function App() {
  const [mode, setMode] = useState('default');
  const [translations, setTranslations] = useState([]); // finalized sentences
  const [liveSentence, setLiveSentence] = useState({ gloss: [], words: [] }); // current accumulating sentence
  const [isCapturing, setIsCapturing] = useState(true);
  const [clipQueue, setClipQueue] = useState([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [agentStatus, setAgentStatus] = useState({
    orchestrator: 'checking', agent1: 'checking', agent2: 'checking', agent3: 'checking',
  });
  const sentenceTimer = useRef(null);

  const sessionId = useRef(`session_${Date.now()}`);
  const signToText = useWebSocket('/ws/sign-to-text');
  const textToSign = useWebSocket('/ws/text-to-sign');

  // Try connecting to backend (optional — works without it)
  useEffect(() => {
    signToText.connect();
    textToSign.connect();
    checkAgentHealth();
    const interval = setInterval(checkAgentHealth, 15000);
    return () => {
      clearInterval(interval);
      signToText.disconnect();
      textToSign.disconnect();
    };
  }, []);

  // Handle backend sign-to-text responses (if backend is running)
  useEffect(() => {
    if (!signToText.lastMessage) return;
    const msg = signToText.lastMessage;
    if (msg.type === 'translation') {
      addTranslation('sign-to-text', msg.text, msg.gloss, msg.confidence || 0);
    }
  }, [signToText.lastMessage]);

  // Handle backend text-to-sign responses
  useEffect(() => {
    if (!textToSign.lastMessage) return;
    const msg = textToSign.lastMessage;
    if (msg.type === 'animation') {
      setClipQueue(msg.clips || []);
      addTranslation('text-to-sign', msg.original_text || '', msg.gloss || [], 1.0);
    }
  }, [textToSign.lastMessage]);

  function addTranslation(direction, text, gloss, confidence) {
    setTranslations(prev => [...prev.slice(-49), {
      direction, text, gloss, confidence, timestamp: Date.now(),
    }]);
  }

  // Finalize current sentence and move it to translations list
  const finalizeSentence = useCallback(() => {
    setLiveSentence(prev => {
      if (prev.words.length > 0) {
        const text = prev.words.join(' ');
        setTranslations(t => [...t.slice(-49), {
          direction: 'sign-to-text', text, gloss: prev.gloss,
          confidence: 0.85, timestamp: Date.now(),
        }]);
      }
      return { gloss: [], words: [] };
    });
  }, []);

  // CLIENT-SIDE gesture detection — accumulate + sentence matching
  const handleGestureDetected = useCallback((result) => {
    const { gloss, confidence, meaning } = result;
    if (gloss === 'UNKNOWN') return;
    const word = GLOSS_WORD[gloss] || meaning || gloss;

    setLiveSentence(prev => {
      const newGloss = [...prev.gloss, gloss];
      const newWords = [...prev.words, word];

      // Try to match a sentence pattern
      const match = matchSentence(newGloss);
      if (match) {
        // Replace the matched words with the natural sentence
        const kept = newWords.slice(0, newWords.length - match.matchLength);
        return {
          gloss: newGloss,
          words: [...kept, match.sentence],
          matched: match.sentence,
        };
      }

      return { gloss: newGloss, words: newWords };
    });

    // Reset the auto-finalize timer
    clearTimeout(sentenceTimer.current);
    sentenceTimer.current = setTimeout(finalizeSentence, SENTENCE_TIMEOUT_MS);
  }, [finalizeSentence]);

  // Send raw landmarks to backend if connected
  const handleLandmarks = useCallback((data) => {
    if (backendOnline) signToText.send(data);
  }, [backendOnline, signToText]);

  // Text → Sign (client-side or backend)
  const handleSendText = useCallback((text) => {
    if (backendOnline) {
      textToSign.send({ text });
    } else {
      // Client-side text → gloss → clips
      const gloss = textToGloss(text);
      const clips = [];
      gloss.forEach((g, i) => {
        clips.push({ ...GLOSS_CLIPS[g] || FALLBACK_CLIP, gloss: g });
        if (i < gloss.length - 1) {
          clips.push({ clip_id: 'transition', duration_ms: 150, nmm: {}, gloss: '_' });
        }
      });
      setClipQueue(clips);
      addTranslation('text-to-sign', text, gloss, 1.0);
    }
  }, [backendOnline, textToSign]);

  async function checkAgentHealth() {
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/health/all');
      if (res.ok) {
        const data = await res.json();
        setBackendOnline(true);
        setAgentStatus({
          orchestrator: data.services?.orchestrator || 'unknown',
          agent1: data.services?.agent1_gesture || 'unknown',
          agent2: data.services?.agent2_syntax || 'unknown',
          agent3: data.services?.agent3_signer || 'unknown',
        });
        return;
      }
    } catch {}
    setBackendOnline(false);
    setAgentStatus({ orchestrator: 'offline', agent1: 'offline', agent2: 'offline', agent3: 'offline' });
  }

  const modeClass = mode !== 'default' ? `mode-${mode}` : '';

  return (
    <div className={`app-container fade-in ${modeClass}`}>
      {/* Header */}
      <header className="app-header" id="app-header">
        <div className="logo-section">
          <div className="logo-icon">🤟</div>
          <div className="logo-text">
            <h1>OmniSign</h1>
            <span>Bidirectional Sign Language Translator</span>
          </div>
        </div>
        <ModeSelector currentMode={mode} onModeChange={setMode} />
        <div className="status-badge">
          <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
          <span>{backendOnline ? 'Backend Online' : 'Client-Side Mode'}</span>
        </div>
      </header>

      {/* Pipeline */}
      <div className="pipeline-flow" id="pipeline-indicator">
        <div className="pipeline-node active">📷 Camera</div>
        <span className="pipeline-arrow">→</span>
        <div className="pipeline-node active">🖐️ MediaPipe</div>
        <span className="pipeline-arrow">→</span>
        <div className="pipeline-node active">🧠 Classifier</div>
        <span className="pipeline-arrow">→</span>
        <div className="pipeline-node active">🔤 Text</div>
        <span className="pipeline-arrow">⇄</span>
        <div className="pipeline-node active">🧍 Avatar</div>
      </div>

      {/* Main Grid */}
      <main className="main-grid" id="main-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Camera */}
          <div className="glass-card panel">
            <div className="panel-header">
              <div className="panel-title">
                <span className="icon">📷</span> Sign Language Input
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="panel-badge badge-live">Live</span>
                <button className="btn btn-ghost btn-icon" onClick={() => setIsCapturing(!isCapturing)}
                  id="toggle-capture-btn" style={{ width: 36, height: 36, fontSize: '1rem' }}>
                  {isCapturing ? '⏸️' : '▶️'}
                </button>
              </div>
            </div>
            <GestureCapture
              onLandmarks={handleLandmarks}
              onGestureDetected={handleGestureDetected}
              sessionId={sessionId.current}
              isActive={isCapturing}
            />
          </div>

          {/* Avatar */}
          <div className="glass-card panel">
            <div className="panel-header">
              <div className="panel-title"><span className="icon">🧍</span> 3D Sign Avatar</div>
              <span className="panel-badge badge-3d">WebGL</span>
            </div>
            <AvatarRenderer clipQueue={clipQueue} isPlaying={clipQueue.length > 0} />
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <TextPanel
            translations={translations}
            liveSentence={liveSentence}
            onSendText={handleSendText}
            onFinalizeSentence={finalizeSentence}
            onClearSentence={() => setLiveSentence({ gloss: [], words: [] })}
            mode={mode}
          />

          {/* Agent Status */}
          <div className="glass-card panel">
            <div className="panel-header">
              <div className="panel-title"><span className="icon">⚡</span> Agent Status</div>
              {!backendOnline && (
                <span className="panel-badge badge-ai" style={{ background: 'rgba(253,203,110,0.15)', color: '#fdcb6e', borderColor: 'rgba(253,203,110,0.3)' }}>
                  Running Locally
                </span>
              )}
            </div>
            <div className="agent-grid" id="agent-status-grid">
              {[
                { key: 'orchestrator', icon: '🎛️', name: 'Orchestrator', port: '8000' },
                { key: 'agent1', icon: '🖐️', name: 'Gesture AI', port: '8001' },
                { key: 'agent2', icon: '🔤', name: 'Syntax Bridge', port: '8002' },
                { key: 'agent3', icon: '🧍', name: 'Neural Signer', port: '8003' },
              ].map((agent) => (
                <div className={`agent-card ${agentStatus[agent.key] === 'ok' ? 'online' : backendOnline ? 'offline' : ''}`}
                  key={agent.key} id={`agent-${agent.key}`}>
                  <div className="agent-icon">{agent.icon}</div>
                  <div className="agent-name">{agent.name}</div>
                  <div className="agent-status">
                    {agentStatus[agent.key] === 'ok' ? `✅ Online :${agent.port}`
                      : backendOnline ? `❌ Offline :${agent.port}` : '🟡 Client-Side'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="app-footer" id="app-footer">
        <span>OmniSign v1.0 — Multi-Agent Sign Language Ecosystem</span>
        <span>
          Mode: <strong>{mode.charAt(0).toUpperCase() + mode.slice(1)}</strong> ·
          Pipeline: {backendOnline ? 'Full Backend' : 'Client-Side'} ·
          Rendering: WebGL
        </span>
      </footer>
    </div>
  );
}
