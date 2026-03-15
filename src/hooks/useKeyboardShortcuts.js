import { useEffect } from 'react';

/**
 * Keyboard shortcuts for Synthesia mode (desktop only).
 *
 * Space = Play/Pause, R = Reset, L = Loop, M = Metronome,
 * W = Wait mode, 1/2/3 = Hand mode, Arrow keys = Seek, Escape = Back
 */
export function useKeyboardShortcuts({
  onPlayPause,
  onReset,
  onLoopToggle,
  onMetronomeToggle,
  onSeekBackward,
  onSeekForward,
  onHandMode,
  onWaitModeToggle,
  onEscape,
  enabled = true,
}) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // Ignore when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          onPlayPause?.();
          break;
        case 'KeyR':
          onReset?.();
          break;
        case 'KeyL':
          onLoopToggle?.();
          break;
        case 'KeyM':
          onMetronomeToggle?.();
          break;
        case 'KeyW':
          onWaitModeToggle?.();
          break;
        case 'Digit1':
          onHandMode?.('both');
          break;
        case 'Digit2':
          onHandMode?.('right');
          break;
        case 'Digit3':
          onHandMode?.('left');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSeekBackward?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSeekForward?.();
          break;
        case 'Escape':
          onEscape?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onPlayPause, onReset, onLoopToggle, onMetronomeToggle, onSeekBackward, onSeekForward, onHandMode, onWaitModeToggle, onEscape]);
}
