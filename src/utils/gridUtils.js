/**
 * Grid utility functions for piano roll calculations
 */

/**
 * Snap a beat value to the nearest grid position
 * @param {number} beat - The beat value to snap
 * @param {number} gridSize - The grid size (e.g., 0.25 for quarter notes)
 * @param {boolean} enabled - Whether snapping is enabled
 * @returns {number} The snapped beat value
 */
export const snapToGrid = (beat, gridSize, enabled = true) => {
    if (!enabled || gridSize <= 0) return beat;
    return Math.round(beat / gridSize) * gridSize;
};

/**
 * Calculate beats per measure based on time signature
 * @param {Object} timeSignature - Time signature object { numerator, denominator }
 * @returns {number} Beats per measure in quarter notes
 */
export const getBeatsPerMeasure = (timeSignature) => {
    if (!timeSignature?.numerator || !timeSignature?.denominator) {
        return 4; // Default to 4/4
    }
    return (timeSignature.numerator / timeSignature.denominator) * 4;
};

/**
 * Check if time signature is compound (ternary)
 * @param {Object} timeSignature - Time signature object
 * @returns {boolean} True if compound time
 */
export const isCompoundTime = (timeSignature) => {
    if (!timeSignature?.numerator || !timeSignature?.denominator) {
        return false;
    }
    return timeSignature.denominator === 8 && timeSignature.numerator % 3 === 0;
};

/**
 * Convert beat position to measure and beat
 * @param {number} beat - Global beat position
 * @param {number} beatsPerMeasure - Beats per measure
 * @returns {Object} { measure, beatInMeasure }
 */
export const beatToMeasure = (beat, beatsPerMeasure) => {
    const measure = Math.floor(beat / beatsPerMeasure) + 1;
    const beatInMeasure = (beat % beatsPerMeasure) + 1;
    return { measure, beatInMeasure };
};

/**
 * Convert measure and beat to global beat
 * @param {number} measure - Measure number (1-indexed)
 * @param {number} beatInMeasure - Beat within measure (1-indexed)
 * @param {number} beatsPerMeasure - Beats per measure
 * @returns {number} Global beat position
 */
export const measureToBeat = (measure, beatInMeasure, beatsPerMeasure) => {
    return (measure - 1) * beatsPerMeasure + (beatInMeasure - 1);
};

/**
 * Format beat position for display
 * @param {number} beat - Beat position
 * @param {number} beatsPerMeasure - Beats per measure
 * @returns {string} Formatted position (e.g., "2:3" for measure 2, beat 3)
 */
export const formatBeatPosition = (beat, beatsPerMeasure) => {
    const { measure, beatInMeasure } = beatToMeasure(beat, beatsPerMeasure);
    const tick = Math.round((beat % 1) * 480); // Standard MIDI ticks per beat

    if (tick === 0) {
        return `${measure}:${Math.floor(beatInMeasure)}`;
    }
    return `${measure}:${Math.floor(beatInMeasure)}:${tick}`;
};

/**
 * Format beat position as time (mm:ss.ms)
 * @param {number} beat - Beat position
 * @param {number} tempo - Tempo in BPM
 * @returns {string} Formatted time
 */
export const formatBeatAsTime = (beat, tempo) => {
    const secondsPerBeat = 60 / tempo;
    const totalSeconds = beat * secondsPerBeat;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 100);

    if (ms === 0) {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

/**
 * Format duration for display
 * @param {number} duration - Duration in beats
 * @returns {string} Human-readable duration
 */
export const formatDuration = (duration) => {
    if (duration >= 4) return `${duration / 4} mesure${duration >= 8 ? 's' : ''}`;
    if (duration >= 1) return `${duration} temps`;
    if (duration >= 0.5) return `${Math.round(duration * 2)}/2`;
    if (duration >= 0.25) return `${Math.round(duration * 4)}/4`;
    if (duration >= 0.125) return `${Math.round(duration * 8)}/8`;
    return `${Math.round(duration * 16)}/16`;
};

/**
 * Get grid line type for a given beat position
 * @param {number} beat - Beat position
 * @param {number} beatsPerMeasure - Beats per measure
 * @param {number} gridSize - Current grid size
 * @param {boolean} isCompound - Is compound time signature
 * @returns {string} 'measure' | 'beat' | 'subdivision' | 'grid'
 */
export const getGridLineType = (beat, beatsPerMeasure, gridSize, isCompound = false) => {
    const epsilon = 0.001;

    // Check if it's a measure line
    if (Math.abs(beat % beatsPerMeasure) < epsilon) {
        return 'measure';
    }

    // For compound time, check strong beats (every dotted quarter)
    if (isCompound) {
        const strongBeatInterval = 1.5; // 3 eighth notes = 1.5 quarter notes
        if (Math.abs(beat % strongBeatInterval) < epsilon) {
            return 'strongBeat';
        }
    }

    // Check if it's a main beat (whole number)
    if (Math.abs(beat - Math.round(beat)) < epsilon) {
        return 'beat';
    }

    // Check if it's a half beat
    if (Math.abs((beat * 2) - Math.round(beat * 2)) < epsilon) {
        return 'subdivision';
    }

    return 'grid';
};

/**
 * Calculate total width in pixels for a given number of beats
 * @param {number} beats - Number of beats
 * @param {number} cellWidth - Width per beat in pixels
 * @returns {number} Total width in pixels
 */
export const beatsToPixels = (beats, cellWidth) => {
    return beats * cellWidth;
};

/**
 * Calculate number of beats from pixel width
 * @param {number} pixels - Width in pixels
 * @param {number} cellWidth - Width per beat in pixels
 * @returns {number} Number of beats
 */
export const pixelsToBeats = (pixels, cellWidth) => {
    return pixels / cellWidth;
};

/**
 * Calculate visible beat range based on scroll and viewport
 * @param {number} scrollX - Horizontal scroll position
 * @param {number} viewportWidth - Viewport width
 * @param {number} cellWidth - Width per beat
 * @param {number} totalBeats - Total beats in the timeline
 * @returns {Object} { startBeat, endBeat }
 */
export const getVisibleBeatRange = (scrollX, viewportWidth, cellWidth, totalBeats) => {
    const startBeat = Math.max(0, Math.floor(scrollX / cellWidth) - 1);
    const endBeat = Math.min(totalBeats, Math.ceil((scrollX + viewportWidth) / cellWidth) + 1);
    return { startBeat, endBeat };
};

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export const clamp = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};

/**
 * Linear interpolation between two values
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export const lerp = (start, end, t) => {
    return start + (end - start) * clamp(t, 0, 1);
};
