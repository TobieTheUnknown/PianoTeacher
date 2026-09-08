/** All stored note times and the audio clock are measured in quarter notes. */
export function quarterNotesPerMeasure(timeSignature) {
    const numerator = Number(timeSignature?.numerator ?? 4);
    const denominator = Number(timeSignature?.denominator ?? 4);
    return Number.isFinite(numerator) && numerator > 0 && Number.isFinite(denominator) && denominator > 0
        ? numerator * 4 / denominator : 4;
}
