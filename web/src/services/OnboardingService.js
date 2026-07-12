const ONBOARDING_KEY = 'piano-teacher-onboarding-v1';

const DEFAULT_PREFERENCES = {
    goal: 'read',
    level: 'beginner',
    instrument: 'midi',
    accent: 'blue',
};

function readState() {
    try {
        const value = localStorage.getItem(ONBOARDING_KEY);
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
}

export const OnboardingService = {
    isComplete: () => Boolean(readState()?.completedAt),

    getPreferences: () => ({
        ...DEFAULT_PREFERENCES,
        ...(readState()?.preferences || {}),
    }),

    complete: (preferences, skipped = false) => {
        try {
            localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
                version: 1,
                completedAt: new Date().toISOString(),
                skipped,
                preferences: {
                    ...DEFAULT_PREFERENCES,
                    ...preferences,
                },
            }));
            return true;
        } catch {
            return false;
        }
    },

    reset: () => {
        try {
            localStorage.removeItem(ONBOARDING_KEY);
        } catch {
            // localStorage can be unavailable in hardened browser contexts.
        }
    },
};
