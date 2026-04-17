import { useState, useRef, useEffect } from 'react';
import { PRACTICE_SCENARIOS } from '../gestureClassifier.js';

export default function TextPanel({ translations, liveSentence, onSendText, onFinalizeSentence, onClearSentence, mode }) {
  const [inputText, setInputText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [tab, setTab] = useState('output'); // 'output' | 'practice'
  const outputRef = useRef(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [translations, liveSentence]);

  const handleSubmit = (e) => { e.preventDefault(); if (!inputText.trim()) return; onSendText(inputText.trim()); setInputText(''); };

  const handleTTS = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.onstart = () => setIsSpeaking(true);
      u.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(u);
    }
  };

  const quickPhrases = mode === 'hospital'
    ? ['I need help', 'I am in pain', 'Where is the doctor?', 'I need water', 'Thank you']
    : ['Hello', 'How are you?', 'Thank you', 'I love you', 'Yes', 'No'];

  const hasLive = liveSentence?.words?.length > 0;
  const hasHistory = translations.length > 0;

  return (
    <div className="glass-card panel" id="text-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="icon">💬</span>
          Translation
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn btn-ghost${tab === 'output' ? ' active' : ''}`}
            onClick={() => setTab('output')} style={{ padding: '4px 12px', fontSize: '0.7rem',
              background: tab === 'output' ? 'rgba(108,92,231,0.2)' : 'transparent',
              borderColor: tab === 'output' ? 'rgba(108,92,231,0.4)' : 'transparent' }}>
            Output
          </button>
          <button className={`btn btn-ghost${tab === 'practice' ? ' active' : ''}`}
            onClick={() => setTab('practice')} style={{ padding: '4px 12px', fontSize: '0.7rem',
              background: tab === 'practice' ? 'rgba(0,184,148,0.2)' : 'transparent',
              borderColor: tab === 'practice' ? 'rgba(0,184,148,0.4)' : 'transparent' }}>
            🏥 Practice
          </button>
        </div>
      </div>

      {/* ── OUTPUT TAB ── */}
      {tab === 'output' && (
        <>
          <div className="text-output" ref={outputRef}>
            {!hasLive && !hasHistory && (
              <div className="empty-state">
                <span className="empty-icon">🤟</span>
                <span>Start signing or type text to translate</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Signs build into sentences in real-time
                </span>
              </div>
            )}

            {translations.map((item, i) => (
              <div className="translation-item" key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {item.direction === 'sign-to-text' ? '🤟 Sign → Text' : '✏️ Text → Sign'}
                    </span>
                    <p style={{ margin: '4px 0', fontWeight: 500, fontSize: '1.05rem' }}>{item.text}</p>
                    {item.gloss?.length > 0 && (
                      <div className="gloss-tokens">
                        {item.gloss.map((g, j) => (<span className="gloss-token" key={j}>{g}</span>))}
                      </div>
                    )}
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => handleTTS(item.text)}
                    title="Speak" style={{ flexShrink: 0, fontSize: '1rem', width: 36, height: 36 }}>
                    {isSpeaking ? '🔊' : '🔈'}
                  </button>
                </div>
              </div>
            ))}

            {hasLive && (
              <div style={{ padding: '12px 16px', marginTop: 8, background: 'rgba(108, 92, 231, 0.1)', border: '1px solid rgba(108, 92, 231, 0.25)', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.6rem', color: '#a29bfe', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00b894', animation: 'status-pulse 1.5s ease infinite' }} />
                    Signing now...
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" onClick={onFinalizeSentence} style={{ padding: '3px 10px', fontSize: '0.65rem' }}>✅ Done</button>
                    <button className="btn btn-ghost" onClick={onClearSentence} style={{ padding: '3px 10px', fontSize: '0.65rem' }}>✕</button>
                  </div>
                </div>
                <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                  {liveSentence.words.join(' ')}
                  <span style={{ animation: 'rec-blink 1s ease infinite', marginLeft: 2, color: '#6c5ce7' }}>|</span>
                </p>
                <div className="gloss-tokens" style={{ marginTop: 8 }}>
                  {liveSentence.gloss.map((g, j) => (<span className="gloss-token" key={j}>{g}</span>))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {quickPhrases.map((phrase) => (
              <button key={phrase} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: '0.75rem' }} onClick={() => onSendText(phrase)}>
                {phrase}
              </button>
            ))}
          </div>

          <form className="text-input-area" onSubmit={handleSubmit}>
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type text to translate into sign language..." id="text-input" autoComplete="off" />
            <button className="btn btn-primary" type="submit" id="send-text-btn"><span>Sign It</span> <span>🤟</span></button>
          </form>
        </>
      )}

      {/* ── PRACTICE TAB ── */}
      {tab === 'practice' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Practice these gesture sequences. Hold each gesture until it's confirmed, then switch to the next.
          </p>
          {PRACTICE_SCENARIOS.map((scenario, si) => (
            <div key={si} style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                {scenario.title}
              </h4>
              {scenario.steps.map((step, i) => (
                <div key={i} style={{
                  padding: '10px 14px', marginBottom: 6,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10, cursor: 'pointer',
                }} onClick={() => handleTTS(step.phrase)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>"{step.phrase}"</span>
                    <span style={{ fontSize: '0.65rem', color: '#a29bfe' }}>🔈 tap to hear</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#00b894', marginTop: 4 }}>
                    👋 {step.gesture}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {step.instruction}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
