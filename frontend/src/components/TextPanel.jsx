import { useState, useRef, useEffect } from 'react';

/**
 * TextPanel — Shows accumulated sign sentences + text input for text-to-sign.
 * Signs build up into a running sentence line instead of individual cards.
 */
export default function TextPanel({ translations, liveSentence, onSendText, onFinalizeSentence, onClearSentence, mode }) {
  const [inputText, setInputText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const outputRef = useRef(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [translations, liveSentence]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText.trim());
    setInputText('');
  };

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
    : mode === 'atm'
    ? ['Hello', 'I need help', 'How much?', 'Thank you', 'Yes', 'No']
    : ['Hello', 'How are you?', 'What is your name?', 'Thank you', 'I love you'];

  const hasLive = liveSentence?.words?.length > 0;
  const hasHistory = translations.length > 0;

  return (
    <div className="glass-card panel" id="text-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="icon">💬</span>
          Translation Output
        </div>
        <span className="panel-badge badge-ai">AI Powered</span>
      </div>

      {/* Translation output */}
      <div className="text-output" ref={outputRef}>
        {!hasLive && !hasHistory && (
          <div className="empty-state">
            <span className="empty-icon">🤟</span>
            <span>Start signing or type text to translate</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Signs will build into sentences in real-time
            </span>
          </div>
        )}

        {/* Finalized sentences */}
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
                    {item.gloss.map((g, j) => (
                      <span className="gloss-token" key={j}>{g}</span>
                    ))}
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

        {/* LIVE sentence being built */}
        {hasLive && (
          <div style={{
            padding: '12px 16px', marginTop: 8,
            background: 'rgba(108, 92, 231, 0.1)',
            border: '1px solid rgba(108, 92, 231, 0.25)',
            borderRadius: 12, animation: 'scale-in 0.2s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.6rem', color: '#a29bfe', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00b894', animation: 'status-pulse 1.5s ease infinite' }} />
                Signing now...
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost" onClick={onFinalizeSentence}
                  style={{ padding: '3px 10px', fontSize: '0.65rem' }} title="Finalize sentence">
                  ✅ Done
                </button>
                <button className="btn btn-ghost" onClick={onClearSentence}
                  style={{ padding: '3px 10px', fontSize: '0.65rem' }} title="Clear">
                  ✕
                </button>
              </div>
            </div>
            <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
              {liveSentence.words.join(' ')}
              <span style={{ animation: 'rec-blink 1s ease infinite', marginLeft: 2, color: '#6c5ce7' }}>|</span>
            </p>
            <div className="gloss-tokens" style={{ marginTop: 8 }}>
              {liveSentence.gloss.map((g, j) => (
                <span className="gloss-token" key={j}>{g}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick phrase buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {quickPhrases.map((phrase) => (
          <button key={phrase} className="btn btn-ghost"
            style={{ padding: '6px 14px', fontSize: '0.75rem' }}
            onClick={() => onSendText(phrase)}>
            {phrase}
          </button>
        ))}
      </div>

      {/* Text input */}
      <form className="text-input-area" onSubmit={handleSubmit}>
        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
          placeholder="Type text to translate into sign language..." id="text-input" autoComplete="off" />
        <button className="btn btn-primary" type="submit" id="send-text-btn">
          <span>Sign It</span> <span>🤟</span>
        </button>
      </form>
    </div>
  );
}
