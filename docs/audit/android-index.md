# Index Android natif

Généré par `python3 scripts/update-source-index.py`. Les symboles indiquent les points de lecture ; cet inventaire ne constitue pas une validation.

## android/app/src/main/cpp/audio_engine.cpp

439 lignes.
Symboles : AudioEngine

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/MainActivity.kt

95 lignes.
Symboles : MainActivity, onCreate, onNewIntent, onResume, onStop

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/audio/AudioEngine.kt

384 lignes.
Symboles : AudioEngine, getInstance, start, awaitReady, onForeground, onBackground, beginPlayback, isPlaybackActive, endPlayback, scheduleIdleRelease, playVoice, stopVoice, noteOn, noteOff, stop, setSustainPedal, setEnabled, release, loadOboe, PcmData, decodeMp3Asset, setRelease, playClick

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/audio/AudioSessionController.kt

70 lignes.
Symboles : AudioSessionController, setForeground, beginPlayback, isActive, endPlayback, prepareOutput, interrupt, releaseIfIdle

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/audio/MetronomeEngine.kt

71 lignes.
Symboles : MetronomeEngine, generateClick, createStaticTrack, rebuildTracks, playClick, setVolume, release

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/audio/PlaybackTimeline.kt

250 lignes.
Symboles : TimelineNote, songTimeline, phraseTimeline, TimelineEvent, timelineEvents, MonotonicBeatClock, advance, seek, TimelineCursor, peek, pop, drainThrough, TransportSettings, PlaybackAudio, awaitReady, beginPlayback, isPlaybackActive, endPlayback, playVoice, stopVoice, playClick, TimelineTransport, run, silence, resumeHeld, expectedAt, crossedNotes, scrubAuditionNotes

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/audio/SamplerEngine.kt

145 lignes.
Symboles : SamplerEngine, loadAsync, finishLoadingIfReady, playVoice, stopVoice, stopAll, findNearestSample, release, Float.pow

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/data/model/Song.kt

116 lignes.
Symboles : NoteEvent, Tracks, Phrase, HandSeparator, KeySignature, TimeSignature, Song, SongEntity, Song.toEntity, SongEntity.toDomain

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/data/parser/MidiParser.kt

324 lignes.
Symboles : MidiParser, parse, events, splitIntoPhrases, detectKey, emptySong, RawNote, RawTrack, RawMidi, MidiReader, read, expect, readInt32, readInt16, readVarLen

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/data/parser/SongJsonParser.kt

84 lignes.
Symboles : SongJsonParser, parse, parseLibrary, pitch, decode

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/data/repository/SongDatabase.kt

64 lignes.
Symboles : SongDao, getAllSongs, getSongById, insertSong, saveScore, saveScores, deleteSong, updateLastPlayed, updateMasteredPhrases, updateTitle, SongDatabase, songDao, getInstance

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/data/repository/SongRepository.kt

137 lignes.
Symboles : SongRepository, getSong, saveSong, deleteSong, markPlayed, getMasteredPhrases, updateMasteredPhrases, updateSong, updateSongTitle, importFromAssets, ImportResult, Success, MultiSuccess, Error, importFromUri

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/midi/MidiByteParser.kt

52 lignes.
Symboles : MidiByteParser

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/midi/MidiManager.kt

184 lignes.
Symboles : MidiEvent, NoteOn, NoteOff, SustainPedal, Reset, MidiManager, publish, onDeviceAdded, onDeviceRemoved, configure, startUsbScanning, connectToDevice, acceptDevice, onSend, disconnect, onScanResult, onScanFailed, startBleScanning, stopBleScanning, stop, getInstance

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/reminders/PracticeReminderSchedule.kt

40 lignes.
Symboles : PracticeReminderSettings, nextPracticeReminder

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/reminders/PracticeReminders.kt

152 lignes.
Symboles : PracticeReminders, preferences, load, save, notificationsAllowed, reschedule, alarmIntent, deliver, createChannel, PracticeReminderReceiver, onReceive, PracticeReminderRestoreReceiver, onReceive

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/AppNavHost.kt

243 lignes.
Symboles : Screen, Onboarding, route, Library, LivePlay, route, Learning, route, Editor, route, LiveLearning, route, Settings, AppNavHost, requireSong, navigateTopLevel

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/common/BottomTabBar.kt

204 lignes.
Symboles : TabItem, tabs, AdaptiveNavigationFrame, BottomTabBar, StudioNavigationRail, NavigationItem

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/common/MiniKeyboard.kt

420 lignes.
Symboles : noteNameFr, KeyboardRangeResult, fixedKeyboardRange, MiniKeyboard, FoldEntry, collectFolds, octaveLabel, KeySource, resolveColors

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/common/MobileHeader.kt

57 lignes.
Symboles : MobileHeader

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/common/Pill.kt

74 lignes.
Symboles : Pill, OutlineButton

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/common/PlaybackDock.kt

529 lignes.
Symboles : PhraseRange, PlaybackDock, HandPill, HandSegment, SpeedCluster, PixelBtn, TransportBtn, PlayPauseButton, ToggleIconBtn, LoopActiveStrip, LoopRangeEditor, PhrasePicker, RangeStepper

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/common/PlaybackHand.kt

3 lignes.
Symboles : aucun

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/common/PracticeReminderControls.kt

146 lignes.
Symboles : PracticeReminderControls, persist, requestEnabled

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/common/SongCover.kt

100 lignes.
Symboles : SongCover, coverInitials, coverGradient

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/editor/EditorScreen.kt

433 lignes.
Symboles : EditorScreen, EditorOverview, EditorStat, PhraseCard, PhrasePreview, StepperBtn

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/editor/EditorViewModel.kt

80 lignes.
Symboles : EditorViewModel, splitPhrase, mergePhraseWithPrevious, Factory

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/learning/LearningScreen.kt

2142 lignes.
Symboles : midiToDiatonic, NoteDuration, classifyDuration, Base, StaffClefConfig, selectClef, LearningScreen, MeasureCard, TimelineBeatRow, MiniMeasureCard, GrandStaffCanvas, drawHead, StaffNote, ChordRender, androidx.compose.ui.graphics.drawscope.DrawScope.drawStemsAndBeams, attachY, stemX, nominalTip, resolveDirection, drawPlainStem, drawFlags, preferredDirection, beamYAt, NoteLabelsStrip, LearningPianoKeyboard, OctaveKeys, ChordChip, CycleNoteRows, ArpeggioChordBadge, NoteChip

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/learning/LearningViewModel.kt

582 lignes.
Symboles : MeasureData, PhraseSectionData, LearningViewModel, toggleMetronome, toggleWaitMode, toggleListenMode, cycleClefMode, toggleMastered, setHand, adjustTempo, toggleLoop, setLoopRange, toggleDetails, toggleOctaves, focusMeasure, focusPreviousMeasure, focusNextMeasure, play, pause, stop, playMeasureSingle, playMeasureHandSingle, playPhrase, startTimeline, cancelPlayback, renameSong, renamePhrase, deletePhrase, splitPhraseAtMeasure, onCleared, buildSections, Factory

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/library/LibraryScreen.kt

831 lignes.
Symboles : Song.noteCount, Song.difficulty, Song.keyLabel, LibraryScreen, SongDetailSheet, SheetStat, SheetDivider, RenameDialog, ActionBtn, LibraryOverview, OverviewStat, LibrarySearchAndFilters, EmptySearch, SongCard, MetaChip, ImportBanner, EmptyLibrary

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/library/LibraryViewModel.kt

61 lignes.
Symboles : ImportState, Idle, Loading, Success, Error, LibraryViewModel, importFile, deleteSong, renameSong, clearImportState, Factory

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/livelearning/LiveLearningScreen.kt

900 lignes.
Symboles : noteName, LiveLearningScreen, MeasureCardCompact, chordCycleLen, handSideColor, DetailToggle, HandRoleBadge, RoleChip, OstinatoRoleBadge, PedalRoleBadge, OstinatoGlyph, wave, PedalGlyph, MotifRows, NoteChip, NotesRow, BeatStrip, RepeatedMotifRows

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/liveplay/LivePlayScreen.kt

951 lignes.
Symboles : HitEffect, LivePlayScreen, controlsBlock, LivePlayCanvas, PianoKeyboard, isBlackKey, LivePlayTopBar, SpeedBadge, LivePlayControls, LivePlayHandButton

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/liveplay/LivePlayViewModel.kt

551 lignes.
Symboles : NoteWithHand, LivePlayUiState, LivePlayViewModel, handleMidiNoteOn, handleMidiNoteOff, togglePlayPause, timelineNotes, shouldAutoPlay, play, pause, restart, seekToBeat, setSpeed, beginScrub, scrubToBeat, endScrub, toggleLoop, setLoopRange, toggleWaitMode, toggleAudio, toggleMetronome, toggleListenMode, setVisibleBeats, setHand, nextPhrase, prevPhrase, goToPhrase, updateVisibleNotes, addVisibleNotes, updateExpectedKeys, onCleared, Factory

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/onboarding/OnboardingPreferences.kt

46 lignes.
Symboles : LearnerProfile, OnboardingPreferences, isComplete, profile, complete, OnboardingState, init, complete

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/onboarding/OnboardingScreen.kt

484 lignes.
Symboles : OnboardingScreen, finish, OnboardingPanel, StepHeading, WelcomeStep, TransportStep, PhraseStep, ConnectStep, ReminderStep, ThemeChoices, AccentChoices, FeatureLine, InfoPill, OnboardingVisual

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/settings/SettingsScreen.kt

431 lignes.
Symboles : SettingsScreen, StudioProfileCard, SettingsSection, ThemeCard, ToggleSetting

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/settings/SettingsViewModel.kt

64 lignes.
Symboles : AppPrefs, Keys, SettingsViewModel, setAudioEnabled, setBleMidiEnabled, setUsbMidiEnabled, setShowExpectedKeys, setShowEditorTab, set, Factory

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/theme/DesignAppearance.kt

266 lignes.
Symboles : DesignAppearanceSection, handLabel, PickerRow, ThemeSwatch, AccentDot, HandSwatch

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/theme/Theme.kt

198 lignes.
Symboles : Tokens, ActiveTheme, apply, ThemeAware, PianoTeacherTheme

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/ui/theme/ThemePreferences.kt

229 lignes.
Symboles : ThemeColors, getThemeColors, AccentPreset, accentByKey, HandPreset, handsByKey, composeThemeColors, ThemePrefs, getTheme, setTheme, getAccent, setAccent, getHands, setHands, getMetronomeVolume, setMetronomeVolume, getReleaseLevel, setReleaseLevel, ThemeState, init, setTheme, setAccent, setHands, set

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/utils/ArpeggioDetection.kt

721 lignes.
Symboles : chordDegree, toRoman, ArpeggioMeasureQualification, ArpeggioBadge, arpeggioRootName, formatArpeggioBadge, capitalizeNote, noteLabelForPitchClass, ToleratedChord, identifyChordWithTolerance, makeChord, MeasureHarmony, getMeasureHarmony, OstinatoQualification, qualifyOstinatoMeasure, PedalQualification, qualifyPedalMeasure, qualifyArpeggioMeasure, exactCycleReps, displayCycleLen, computeArpeggioBadges, HandRole, Ostinato, Pedal, MeasureRoles, computeMeasureRoles, applyRunRule

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/utils/MusicUtils.kt

571 lignes.
Symboles : getEnharmonicNote, midiToFrench, getNoteNameForKey, KeySignature, musicKeySignatureFromStored, detectKeySignature, pearsonCorrelation, ChordTemplate, intervalsMatch, ChordDetectionResult, identifyChord, formatChordDisplayName, ChordInfo, detectChord, firstArpeggioCycle, detectChordOrArpeggio, ChordWithReps, ArpeggioMotifResult, detectArpeggioMotifs, chordDetectionToWithReps, groupConsecutiveChords

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/utils/OrderedSongSaver.kt

25 lignes.
Symboles : OrderedSongSaver, enqueue

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/utils/PhraseEditing.kt

52 lignes.
Symboles : splitPhraseAtMeasure, partition, mergePhrases

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/utils/RepeatedMotifs.kt

47 lignes.
Symboles : RepeatedMotif, segmentRepeatedMotifs, Choice

## android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/utils/StaffNotation.kt

186 lignes.
Symboles : keySignatureAccidentalCount, SpelledPitch, spellMidiForStaff, offset, AccidentalState, next, BeamItem, StaffDisplayNote, StaffChord, StaffRest, StaffVoice, NotatedStaffRest, splitStaffRests, buildStaffVoices, VoiceBuilder, averagePitch, sliceNotesForStaff, computeBeamGroups
