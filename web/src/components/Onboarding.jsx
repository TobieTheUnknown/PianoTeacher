import React, { useCallback, useEffect, useRef, useState } from 'react';
import { OnboardingService } from '../services/OnboardingService';
import styles from './Onboarding.module.css';

const STEPS = [
    { label: 'Bienvenue', eyebrow: 'Votre nouveau studio' },
    { label: 'Organiser', eyebrow: 'Un répertoire qui vous ressemble' },
    { label: 'Apprendre', eyebrow: 'Chaque morceau devient accessible' },
    { label: 'Connecter', eyebrow: 'Prêt pour votre instrument' },
];

const GOALS = [
    {
        id: 'read',
        title: 'Lire avec fluidité',
        description: 'Déchiffrer, isoler les mains et avancer phrase par phrase.',
        icon: 'score',
    },
    {
        id: 'technique',
        title: 'Renforcer ma technique',
        description: 'Travailler la précision, le tempo et la régularité.',
        icon: 'pulse',
    },
    {
        id: 'create',
        title: 'Créer et arranger',
        description: 'Importer un MIDI, structurer les phrases et éditer les notes.',
        icon: 'edit',
    },
];

const LEVELS = [
    { id: 'beginner', label: 'Je débute', detail: 'Des repères guidés et un tempo confortable' },
    { id: 'intermediate', label: 'Je progresse', detail: 'Des boucles ciblées pour gagner en fluidité' },
    { id: 'advanced', label: 'Je me perfectionne', detail: 'Précision, nuances et vitesse de jeu' },
];

const INSTRUMENTS = [
    { id: 'midi', label: 'Piano MIDI', detail: 'Retour instantané et suivi des notes', icon: 'midi' },
    { id: 'acoustic', label: 'Piano acoustique', detail: 'Partitions, boucles et métronome', icon: 'piano' },
    { id: 'none', label: 'Sans instrument', detail: 'Explorer d’abord les démos', icon: 'headphones' },
];

const ACCENTS = [
    { id: 'blue', label: 'Bleu', color: '#3b82f6' },
    { id: 'violet', label: 'Violet', color: '#8b5cf6' },
    { id: 'emerald', label: 'Émeraude', color: '#10b981' },
    { id: 'amber', label: 'Ambre', color: '#f59e0b' },
];

export function Onboarding({ onComplete }) {
    const saved = OnboardingService.getPreferences();
    const [step, setStep] = useState(0);
    const [preferences, setPreferences] = useState(saved);
    const preferencesRef = useRef(saved);
    const titleRef = useRef(null);
    const panelRef = useRef(null);
    const overlayRef = useRef(null);

    const finish = useCallback((skipped = false) => {
        OnboardingService.complete(preferencesRef.current, skipped);
        onComplete?.(preferencesRef.current);
    }, [onComplete]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        if (overlayRef.current) overlayRef.current.scrollTop = 0;
        titleRef.current?.focus({ preventScroll: true });

        const onKeyDown = (event) => {
            if (event.key === 'Escape') finish(true);
            if (event.key === 'ArrowRight' && step < STEPS.length - 1) setStep((value) => value + 1);
            if (event.key === 'ArrowLeft' && step > 0) setStep((value) => value - 1);
            if (event.key === 'Tab') {
                const focusable = [...(panelRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]') || [])];
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [finish, step]);

    const updatePreference = (key, value) => {
        setPreferences((current) => {
            const next = { ...current, [key]: value };
            preferencesRef.current = next;
            return next;
        });
        if (key === 'accent') {
            document.documentElement.setAttribute('data-accent', value);
            try {
                localStorage.setItem('piano-teacher-design-accent', value);
            } catch {
                // The visual choice still applies for the current session.
            }
        }
    };

    const goNext = () => {
        if (step === STEPS.length - 1) {
            finish(false);
            return;
        }
        setStep((value) => value + 1);
    };

    return (
        <div ref={overlayRef} className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
            <div className={styles.ambientOne} aria-hidden="true" />
            <div className={styles.ambientTwo} aria-hidden="true" />

            <section className={styles.panel} ref={panelRef}>
                <header className={styles.topbar}>
                    <BrandLockup />
                    <button className={styles.skipButton} onClick={() => finish(true)}>
                        Plus tard
                    </button>
                </header>

                <div className={styles.progressRegion} aria-label={`Étape ${step + 1} sur ${STEPS.length}`}>
                    {STEPS.map((item, index) => (
                        <button
                            key={item.label}
                            className={`${styles.progressStep} ${index === step ? styles.progressStepActive : ''} ${index < step ? styles.progressStepDone : ''}`}
                            onClick={() => setStep(index)}
                            aria-current={index === step ? 'step' : undefined}
                            aria-label={`Aller à l’étape ${item.label}`}
                        >
                            <span>{index < step ? <CheckIcon /> : index + 1}</span>
                            <small>{item.label}</small>
                        </button>
                    ))}
                </div>

                <main className={styles.content} key={step}>
                    <div className={styles.copy}>
                        <p className={styles.eyebrow}>{STEPS[step].eyebrow}</p>
                        <StepContent
                            step={step}
                            preferences={preferences}
                            updatePreference={updatePreference}
                            titleRef={titleRef}
                        />
                    </div>
                    <div className={styles.visual} aria-hidden="true">
                        <StepVisual step={step} />
                    </div>
                </main>

                <footer className={styles.footer}>
                    <p className={styles.keyboardHint}>← → pour naviguer</p>
                    <div className={styles.footerActions}>
                        {step > 0 && (
                            <button className={styles.backButton} onClick={() => setStep((value) => value - 1)}>
                                Retour
                            </button>
                        )}
                        <button className={styles.nextButton} onClick={goNext}>
                            {step === STEPS.length - 1 ? 'Entrer dans mon studio' : 'Continuer'}
                            <ArrowIcon />
                        </button>
                    </div>
                </footer>
            </section>
        </div>
    );
}

function StepContent({ step, preferences, updatePreference, titleRef }) {
    if (step === 0) {
        return (
            <>
                <h1 id="onboarding-title" ref={titleRef} tabIndex="-1">
                    Votre studio de piano,<br /><span>à votre rythme.</span>
                </h1>
                <p className={styles.lead}>
                    Transformez chaque morceau en parcours clair : écoutez, découpez, répétez et jouez avec un retour précis.
                </p>
                <div className={styles.promiseList}>
                    <Promise icon="library" label="Votre répertoire, bien organisé" />
                    <Promise icon="hands" label="Main gauche et main droite lisibles" />
                    <Promise icon="offline" label="Vos morceaux restent sur cet appareil" />
                </div>
            </>
        );
    }

    if (step === 1) {
        return (
            <>
                <h1 id="onboarding-title" ref={titleRef} tabIndex="-1">Quel est votre <span>cap musical ?</span></h1>
                <p className={styles.lead}>Enregistrez votre intention de pratique pour garder un cap clair. Vous pourrez la modifier plus tard.</p>
                <div className={styles.optionGrid} role="radiogroup" aria-label="Objectif musical">
                    {GOALS.map((goal) => (
                        <ChoiceCard
                            key={goal.id}
                            selected={preferences.goal === goal.id}
                            onClick={() => updatePreference('goal', goal.id)}
                            title={goal.title}
                            description={goal.description}
                            icon={goal.icon}
                        />
                    ))}
                </div>
            </>
        );
    }

    if (step === 2) {
        return (
            <>
                <h1 id="onboarding-title" ref={titleRef} tabIndex="-1">Une méthode qui suit <span>votre rythme.</span></h1>
                <p className={styles.lead}>Apprenez par phrases, ralentissez sans changer la hauteur et passez au jeu libre quand vous êtes prêt.</p>
                <div className={styles.levelList} role="radiogroup" aria-label="Niveau de piano">
                    {LEVELS.map((level) => (
                        <button
                            key={level.id}
                            role="radio"
                            aria-checked={preferences.level === level.id}
                            className={`${styles.levelButton} ${preferences.level === level.id ? styles.levelButtonSelected : ''}`}
                            onClick={() => updatePreference('level', level.id)}
                        >
                            <span className={styles.radioDot} />
                            <span><strong>{level.label}</strong><small>{level.detail}</small></span>
                        </button>
                    ))}
                </div>
            </>
        );
    }

    return (
        <>
            <h1 id="onboarding-title" ref={titleRef} tabIndex="-1">Faites entrer votre <span>piano dans le studio.</span></h1>
            <p className={styles.lead}>Choisissez votre configuration. Un piano MIDI pourra être sélectionné et calibré depuis les réglages.</p>
            <div className={styles.instrumentGrid} role="radiogroup" aria-label="Type d’instrument">
                {INSTRUMENTS.map((instrument) => (
                    <ChoiceCard
                        key={instrument.id}
                        compact
                        selected={preferences.instrument === instrument.id}
                        onClick={() => updatePreference('instrument', instrument.id)}
                        title={instrument.label}
                        description={instrument.detail}
                        icon={instrument.icon}
                    />
                ))}
            </div>
            <div className={styles.accentPicker}>
                <span>Votre couleur d’accent</span>
                <div role="radiogroup" aria-label="Couleur d’accent">
                    {ACCENTS.map((accent) => (
                        <button
                            key={accent.id}
                            className={preferences.accent === accent.id ? styles.swatchSelected : ''}
                            style={{ '--swatch': accent.color }}
                            onClick={() => updatePreference('accent', accent.id)}
                            role="radio"
                            aria-checked={preferences.accent === accent.id}
                            aria-label={accent.label}
                            title={accent.label}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}

function ChoiceCard({ selected, onClick, title, description, icon, compact = false }) {
    return (
        <button
            className={`${styles.choiceCard} ${selected ? styles.choiceCardSelected : ''} ${compact ? styles.choiceCardCompact : ''}`}
            onClick={onClick}
            role="radio"
            aria-checked={selected}
        >
            <span className={styles.choiceIcon}><FeatureIcon kind={icon} /></span>
            <span className={styles.choiceText}><strong>{title}</strong><small>{description}</small></span>
            <span className={styles.choiceCheck}>{selected && <CheckIcon />}</span>
        </button>
    );
}

function Promise({ icon, label }) {
    return <div><span><FeatureIcon kind={icon} /></span><p>{label}</p></div>;
}

function BrandLockup() {
    return (
        <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true"><i /><i /><i /><i /></span>
            <span><strong>Piano</strong> Teacher</span>
        </div>
    );
}

function StepVisual({ step }) {
    if (step === 0) return <HeroKeyboard />;
    if (step === 1) return <LibraryVisual />;
    if (step === 2) return <LearningVisual />;
    return <MidiVisual />;
}

function HeroKeyboard() {
    return (
        <div className={styles.heroKeyboard}>
            <div className={styles.heroGlow} />
            <div className={styles.floatingNoteOne}>♪</div>
            <div className={styles.floatingNoteTwo}>♫</div>
            <div className={styles.pianoKeys}>
                {[0, 1, 2, 3, 4, 5, 6].map((key) => <span key={key} className={key === 2 ? styles.leftKey : key === 4 ? styles.rightKey : ''} />)}
                <i className={styles.blackOne} /><i className={styles.blackTwo} /><i className={styles.blackThree} /><i className={styles.blackFour} /><i className={styles.blackFive} />
            </div>
            <div className={styles.noteTrail}><i /><i /><i /><i /><i /></div>
        </div>
    );
}

function LibraryVisual() {
    const cards = [
        { initials: 'CL', title: 'Clair de lune', meta: 'Réb majeur · 72 BPM', color: 'violet' },
        { initials: 'NP', title: 'Nocturne op. 9', meta: 'Mib majeur · 68 BPM', color: 'pink' },
        { initials: 'RD', title: 'Rêverie', meta: 'Fa majeur · 80 BPM', color: 'cyan' },
    ];
    return (
        <div className={styles.libraryMockup}>
            <div className={styles.mockTop}><span>Bibliothèque</span><i /><i /></div>
            <div className={styles.mockSearch}>Rechercher un morceau…</div>
            <div className={styles.mockFilters}><span>Tous</span><span>Majeur</span><span>Mineur</span></div>
            {cards.map((card, index) => (
                <div className={styles.mockSong} key={card.title} style={{ '--delay': `${index * 90}ms` }}>
                    <b className={styles[card.color]}>{card.initials}</b>
                    <p><strong>{card.title}</strong><small>{card.meta}</small></p>
                    <em>{index === 0 ? '9/8' : index === 1 ? '12/8' : '4/4'}</em>
                </div>
            ))}
        </div>
    );
}

function LearningVisual() {
    return (
        <div className={styles.learningMockup}>
            <div className={styles.learningTop}><span>Phrase B</span><strong>72 BPM</strong></div>
            <div className={styles.rollGrid}>
                <i className={styles.rollPinkOne} /><i className={styles.rollPinkTwo} />
                <i className={styles.rollCyanOne} /><i className={styles.rollCyanTwo} /><i className={styles.rollCyanThree} />
                <b />
            </div>
            <div className={styles.learningHands}><span>MG</span><p>Écouter · Ralentir · Boucler</p><span>MD</span></div>
            <div className={styles.learningRange}><span>Mesures</span><strong>05–08</strong></div>
        </div>
    );
}

function MidiVisual() {
    return (
        <div className={styles.midiMockup}>
            <div className={styles.midiHalo}><span><FeatureIcon kind="midi" /></span></div>
            <div className={styles.midiSignal}><i /><i /><i /><i /><i /></div>
            <div className={styles.midiCard}>
                <span className={styles.statusDot} />
                <p><strong>Piano MIDI</strong><small>Prêt à être configuré</small></p>
                <b>USB</b>
            </div>
            <div className={styles.privacyPill}><FeatureIcon kind="offline" /> Vos données restent ici</div>
        </div>
    );
}

function FeatureIcon({ kind }) {
    const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
    if (kind === 'library') return <svg {...common}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 4.5v15M9 7h7M9 11h5" /></svg>;
    if (kind === 'hands') return <svg {...common}><path d="M7 13V5a1.5 1.5 0 0 1 3 0v6-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v5c0 4-3 7-7 7h-1c-3 0-5-2-7-5l-2-3a1.6 1.6 0 0 1 2.5-2z" /></svg>;
    if (kind === 'offline') return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-5" /></svg>;
    if (kind === 'score') return <svg {...common}><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5" /><path d="M10 6v4" /></svg>;
    if (kind === 'pulse') return <svg {...common}><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>;
    if (kind === 'edit') return <svg {...common}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" /></svg>;
    if (kind === 'midi') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9v6M10 9v6M14 9v6M17 9v6M8.5 9v3M15.5 9v3" /></svg>;
    if (kind === 'piano') return <svg {...common}><path d="M3 6h18v12H3zM3 13h18M8 6v7M12 6v7M16 6v7" /></svg>;
    return <svg {...common}><path d="M4 14v-4a8 8 0 0 1 16 0v4" /><path d="M4 14h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2zM20 14h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2z" /></svg>;
}

function CheckIcon() {
    return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m3 7 2.5 2.5L11 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ArrowIcon() {
    return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
