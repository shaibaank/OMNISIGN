import { useState } from 'react';

/**
 * ModeSelector — Switches between ATM, Hospital, and Video Call deployment contexts.
 * One codebase, three CSS themes. Installable on any screen as a PWA.
 */
const MODES = [
  { id: 'default', label: 'Desktop', icon: '🖥️', description: 'Standard desktop view' },
  { id: 'atm', label: 'ATM', icon: '🏧', description: 'Large buttons, high contrast' },
  { id: 'hospital', label: 'Hospital', icon: '🏥', description: 'Calm colors, simplified vocabulary' },
  { id: 'videocall', label: 'Video Call', icon: '📹', description: 'Picture-in-picture overlay' },
];

export default function ModeSelector({ currentMode, onModeChange }) {
  const [showTooltip, setShowTooltip] = useState(null);

  return (
    <div className="mode-selector" role="tablist" aria-label="Deployment Mode">
      {MODES.map((mode) => (
        <button
          key={mode.id}
          className={`mode-btn ${currentMode === mode.id ? 'active' : ''}`}
          onClick={() => onModeChange(mode.id)}
          onMouseEnter={() => setShowTooltip(mode.id)}
          onMouseLeave={() => setShowTooltip(null)}
          role="tab"
          aria-selected={currentMode === mode.id}
          aria-label={mode.description}
          title={mode.description}
          id={`mode-btn-${mode.id}`}
        >
          <span className="mode-icon">{mode.icon}</span>
          <span>{mode.label}</span>
        </button>
      ))}
    </div>
  );
}
