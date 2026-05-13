import React from 'react';

/**
 * PlaybackDock — shared playback control bar (mobile + desktop).
 *
 * Used at the bottom of any page that has playback: Apprentissage, LivePlay,
 * Editor preview. Mirrors the design's window.PlaybackDock — top row with
 * hand-mode pill + speed cluster, transport row, and optional loop strip.
 *
 * Controlled component — all state lives in the parent.
 */
export function PlaybackDock({
  playing = false,
  onPlayPause,

  // 100 = normal. Values in 5% steps.
  speed = 100,
  onSpeed,

  // 'left' | 'both' | 'right' | 'listen' (auto-play with sound)
  handMode = 'both',
  onHandMode,

  // Metronome on/off
  metronome = false,
  onMetronome,

  // Metronome subdivision: 'half' | 'quarter' | 'eighth'. The button
  // cycles half→quarter→eighth→off when metronome is on; clicking when
  // off turns it on at 'quarter'.
  metronomeSubdivision = 'quarter',
  onMetronomeSubdivisionChange,

  // Loop toggle + range
  loop = false,
  onLoop,
  loopRange = [1, 1],
  onLoopRange,
  loopEditorOpen = false,
  onToggleLoopEditor,
  totalMeasures = 1,

  onPrev,
  onNext,
}) {
  const onMiddleHand = () => {
    onHandMode?.(handMode === 'listen' ? 'both' : 'listen');
  };
  const middleLabel = handMode === 'listen' ? '🔊' : '2';
  const middleActive = handMode === 'both' || handMode === 'listen';

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--border)',
        background: 'color-mix(in oklab, var(--surface-1), transparent 4%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
      }}
    >
      {loopEditorOpen && (
        <LoopRangeEditor
          range={loopRange}
          onChange={onLoopRange}
          totalMeasures={totalMeasures}
          onClose={onToggleLoopEditor}
        />
      )}

      {/* Top row: hand mode pill + speed cluster */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: 2,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-pill)',
          }}
        >
          <button
            onClick={() => onHandMode?.('left')}
            style={pillStyle(handMode === 'left', 'var(--hand-left)')}
            aria-label="Main gauche"
          >
            G
          </button>
          <button
            onClick={onMiddleHand}
            style={{
              ...pillStyle(middleActive, 'var(--accent)'),
              fontSize: handMode === 'listen' ? 12 : 10,
            }}
            aria-label={handMode === 'listen' ? 'Mode écoute' : 'Deux mains'}
          >
            {middleLabel}
          </button>
          <button
            onClick={() => onHandMode?.('right')}
            style={pillStyle(handMode === 'right', 'var(--hand-right)')}
            aria-label="Main droite"
          >
            D
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SpeedIcon />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {speed}
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>%</span>
          </span>
          <div style={{ display: 'flex', gap: 2 }}>
            <PixelBtn onClick={() => onSpeed?.(Math.max(20, speed - 10))} disabled={speed <= 20}>
              −
            </PixelBtn>
            <PixelBtn onClick={() => onSpeed?.(Math.min(150, speed + 10))} disabled={speed >= 150}>
              +
            </PixelBtn>
          </div>
        </div>
      </div>

      {/* Transport row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <MetronomeButton
          active={metronome}
          subdivision={metronomeSubdivision}
          onToggle={onMetronome}
          onSubdivisionChange={onMetronomeSubdivisionChange}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TransportBtn onClick={onPrev} aria-label="Précédent">
            <RewindIcon />
          </TransportBtn>
          <button
            onClick={onPlayPause}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--accent)',
              color: 'var(--accent-text, #fff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 18px -4px var(--accent)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              minHeight: 0,
            }}
            aria-label={playing ? 'Pause' : 'Lecture'}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <TransportBtn onClick={onNext} aria-label="Suivant">
            <ForwardIcon />
          </TransportBtn>
        </div>

        <ToggleIconBtn active={loop} onClick={onLoop} aria-label="Boucle">
          <RepeatIcon />
        </ToggleIconBtn>
      </div>

      {/* Loop range strip */}
      {loop && (
        <button
          onClick={onToggleLoopEditor}
          style={{
            marginTop: 2,
            padding: '7px 12px',
            borderRadius: 'var(--r-md)',
            background: 'color-mix(in oklab, var(--accent), transparent 88%)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            width: '100%',
            cursor: 'pointer',
            minHeight: 0,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <RepeatIcon small />
            Boucle active
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>
            <span style={{ color: 'var(--text-primary)' }}>{loopRange[0]}</span>
            <span style={{ margin: '0 6px', color: 'var(--text-tertiary)' }}>→</span>
            <span style={{ color: 'var(--text-primary)' }}>{loopRange[1]}</span>
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            Modifier <ChevronDownIcon />
          </span>
        </button>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function pillStyle(active, activeColor) {
  return {
    width: 30,
    height: 24,
    borderRadius: 'var(--r-pill)',
    background: active ? activeColor : 'transparent',
    color: active ? '#fff' : 'var(--text-tertiary)',
    fontSize: 10,
    fontWeight: 800,
    transition: 'all var(--t-fast)',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    minHeight: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function TransportBtn({ children, onClick, ...rest }) {
  return (
    <button
      onClick={onClick}
      {...rest}
      style={{
        width: 40,
        height: 40,
        borderRadius: 'var(--r-pill)',
        background: 'var(--surface-2)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        minHeight: 0,
      }}
    >
      {children}
    </button>
  );
}

function PixelBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 24,
        height: 24,
        borderRadius: 'var(--r-sm)',
        background: 'var(--surface-2)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border)',
        fontSize: 12,
        fontWeight: 700,
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        minHeight: 0,
      }}
    >
      {children}
    </button>
  );
}

// Metronome button — composes ToggleIconBtn but adds a subdivision badge
// (♩/♪/𝅗𝅥) and cycles half→quarter→eighth→off on successive clicks when on.
const SUBDIV_ORDER = ['half', 'quarter', 'eighth'];
const SUBDIV_GLYPH = { half: '𝅗𝅥', quarter: '♩', eighth: '♪' };

function MetronomeButton({ active, subdivision, onToggle, onSubdivisionChange }) {
  const handleClick = () => {
    if (!active) {
      onToggle?.();
      return;
    }
    const idx = SUBDIV_ORDER.indexOf(subdivision);
    if (idx < SUBDIV_ORDER.length - 1) {
      onSubdivisionChange?.(SUBDIV_ORDER[idx + 1]);
    } else {
      onToggle?.(); // turn off after eighth
      onSubdivisionChange?.('quarter'); // reset for next ON
    }
  };
  return (
    <button
      onClick={handleClick}
      aria-label={active ? `Métronome ${subdivision}` : 'Métronome'}
      style={{
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: 'var(--r-pill)',
        background: active ? 'var(--accent-dim)' : 'var(--surface-2)',
        color: active ? 'var(--accent)' : 'var(--text-tertiary)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all var(--t-fast)',
        boxShadow: active ? '0 0 12px -2px var(--accent)' : 'none',
        cursor: 'pointer',
        padding: 0,
        minHeight: 0,
      }}
    >
      <MetronomeIcon />
      {active && (
        <span
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            background: 'var(--surface-1)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            fontFamily: 'serif',
            fontSize: 11,
            lineHeight: 1,
            padding: '2px 4px 1px',
            borderRadius: 'var(--r-sm)',
            minWidth: 14,
            textAlign: 'center',
          }}
        >
          {SUBDIV_GLYPH[subdivision] || '♩'}
        </span>
      )}
    </button>
  );
}

function ToggleIconBtn({ children, active, onClick, ...rest }) {
  return (
    <button
      onClick={onClick}
      {...rest}
      style={{
        width: 40,
        height: 40,
        borderRadius: 'var(--r-pill)',
        background: active ? 'var(--accent-dim)' : 'var(--surface-2)',
        color: active ? 'var(--accent)' : 'var(--text-tertiary)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all var(--t-fast)',
        boxShadow: active ? '0 0 12px -2px var(--accent)' : 'none',
        cursor: 'pointer',
        padding: 0,
        minHeight: 0,
      }}
    >
      {children}
    </button>
  );
}

function LoopRangeEditor({ range, onChange, totalMeasures, onClose }) {
  const [from, to] = range;
  const setFrom = (v) => onChange?.([Math.max(1, Math.min(v, to - 1)), to]);
  const setTo = (v) => onChange?.([from, Math.max(from + 1, Math.min(v, totalMeasures))]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 'calc(100% + 8px)',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 12,
        zIndex: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Plage de boucle
        </span>
        <button
          onClick={onClose}
          style={{
            width: 22, height: 22, borderRadius: 'var(--r-sm)',
            background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
            cursor: 'pointer', fontSize: 14, padding: 0, minHeight: 0,
          }}
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <RangeStepper label="De" value={from} max={to - 1} min={1} onChange={setFrom} />
        <span style={{ color: 'var(--text-tertiary)' }}>→</span>
        <RangeStepper label="À" value={to} min={from + 1} max={totalMeasures} onChange={setTo} />
      </div>
    </div>
  );
}

function RangeStepper({ label, value, min, max, onChange }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)',
          padding: '2px 6px',
        }}
      >
        <button
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          style={{
            width: 22, height: 22, borderRadius: 'var(--r-sm)',
            background: 'var(--surface-3)', color: 'var(--text-secondary)',
            fontSize: 12, fontWeight: 700, border: 'none',
            opacity: value <= min ? 0.3 : 1, cursor: value <= min ? 'not-allowed' : 'pointer',
            padding: 0, minHeight: 0,
          }}
        >−</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          style={{
            width: 22, height: 22, borderRadius: 'var(--r-sm)',
            background: 'var(--surface-3)', color: 'var(--text-secondary)',
            fontSize: 12, fontWeight: 700, border: 'none',
            opacity: value >= max ? 0.3 : 1, cursor: value >= max ? 'not-allowed' : 'pointer',
            padding: 0, minHeight: 0,
          }}
        >+</button>
      </div>
    </div>
  );
}

// ── Inline SVG icons (match design's stroke/weight) ────────────────────────

const SpeedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: 'var(--text-tertiary)' }}>
    <path d="M12 2 v3" /><path d="M12 19 v3" /><path d="M2 12 h3" /><path d="M19 12 h3" />
    <circle cx="12" cy="12" r="6" /><path d="M12 12 L15 9" />
  </svg>
);
const MetronomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 22 L10 4 L14 4 L18 22 Z" /><path d="M12 4 L18 18" />
  </svg>
);
const RewindIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <polygon points="11,5 11,19 4,12" /><polygon points="21,5 21,19 14,12" />
  </svg>
);
const ForwardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <polygon points="13,5 13,19 20,12" /><polygon points="3,5 3,19 10,12" />
  </svg>
);
const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <polygon points="6,3 20,12 6,21" />
  </svg>
);
const PauseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);
const RepeatIcon = ({ small = false }) => (
  <svg width={small ? 12 : 16} height={small ? 12 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={small ? 2.2 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);
const ChevronDownIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default PlaybackDock;
