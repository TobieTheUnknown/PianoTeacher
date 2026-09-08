import { useMemo } from 'react';
import { createScaleContext } from '../utils/scaleContext.js';

export function useScaleContext(keySignature) {
    return useMemo(() => createScaleContext(keySignature), [keySignature]);
}
