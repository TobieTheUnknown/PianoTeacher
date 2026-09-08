# Index des sources web

Généré par `python3 scripts/update-source-index.py`. Imports locaux littéraux seulement ; absence de chemin ne prouve pas que le code peut être supprimé.

## web/src/AppDesktop.jsx

189 lignes ; accessible depuis main.jsx
Dépendances locales : components/Layout.jsx, components/SongLibrary.jsx, components/Settings.jsx, components/TopNavBar.jsx, components/BottomTabBar.jsx, components/AudioLoadingIndicator.jsx, components/LoadingFallback.jsx, components/Onboarding.jsx, services/OnboardingService.js, services/StorageService.js, hooks/useDeviceContext.js, useSong.js, hooks/useMidiAudio.js, components/SongEditor.jsx, components/LiveLearning.jsx, components/SheetMusicLearning.jsx, components/LivePlayViewOptimized.jsx
Symboles : App

## web/src/components/AudioLoadingIndicator.jsx

65 lignes ; accessible depuis main.jsx
Dépendances locales : services/AudioEngine.js
Symboles : AudioLoadingIndicator

## web/src/components/BottomTabBar.jsx

53 lignes ; accessible depuis main.jsx
Dépendances locales : components/icons/LibraryIcon.jsx, components/icons/PartitionIcon.jsx, components/icons/LearnIcon.jsx, components/icons/LivePlayIcon.jsx, components/icons/SettingsIcon.jsx, components/BottomTabBar.module.css
Symboles : BottomTabBar

## web/src/components/BottomTabBar.module.css

91 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/DesignAppearance.jsx

217 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : readPref, writePref, applyAttr, DesignAppearance, SectionTitle, PickerRow, SquareSwatch, CircleSwatch, HandSwatch

## web/src/components/ErrorBoundary.jsx

234 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : ErrorBoundary, withErrorBoundary

## web/src/components/LatencyWizard.jsx

401 lignes ; accessible depuis main.jsx
Dépendances locales : services/AudioEngine.js
Symboles : median, LatencyWizard

## web/src/components/Layout.jsx

12 lignes ; accessible depuis main.jsx
Dépendances locales : components/Layout.module.css
Symboles : Layout

## web/src/components/Layout.module.css

62 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/LiveLearning.jsx

1164 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js, utils/analyzeSong.js, utils/timing.js, services/AudioEngine.js, hooks/useDeviceContext.js, components/learn/CoordinationTimeline.jsx, components/PlaybackDock.jsx, components/MobileHeader.jsx, components/learn/LearnSidebar.jsx
Symboles : handTokens, OstinatoGlyph, PedalGlyph, RepeatedMotifRows, MotifRows, HandRoleBadge, ArpeggioNotePills, SmallToggleBtn, LiveLearning

## web/src/components/LivePlayCanvas.jsx

896 lignes ; accessible depuis main.jsx
Dépendances locales : hooks/useCanvasLayers.js, models/song.js, services/ThemeService.js, components/LivePlayView.module.css
Symboles : 

## web/src/components/LivePlayMobileOverlay.jsx

142 lignes ; accessible depuis main.jsx
Dépendances locales : components/LivePlayMobileOverlay.module.css, components/PlaybackDock.jsx
Symboles : formatTime, LivePlayMobileOverlay

## web/src/components/LivePlayMobileOverlay.module.css

130 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/LivePlayView.module.css

501 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/LivePlayViewOptimized.jsx

1068 lignes ; accessible depuis main.jsx
Dépendances locales : components/LivePlayCanvas.jsx, models/song.js, services/AudioEngine.js, services/MidiInputService.js, components/TimelineNavigator.jsx, components/LivePlayMobileOverlay.jsx, components/PlaybackDock.jsx, components/RotatePrompt.jsx, hooks/useDeviceContext.js, hooks/useWakeLock.js, hooks/useFullscreen.js, components/LivePlayView.module.css
Symboles : LivePlayViewOptimized, zoomBtnStyle

## web/src/components/LoadingFallback.jsx

204 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : LoadingSpinner, PageLoadingFallback, ComponentLoadingFallback, SkeletonLoader, CardSkeleton, ListSkeleton, ProgressLoadingFallback

## web/src/components/MidiLatencyCalibration.jsx

725 lignes ; accessible depuis main.jsx
Dépendances locales : services/MidiInputService.js, services/AudioEngine.js
Symboles : VisualScrollingTrack, MidiLatencyCalibration

## web/src/components/MidiVisualizer.jsx

277 lignes ; accessible depuis main.jsx
Dépendances locales : services/MidiInputService.js, models/song.js
Symboles : MidiVisualizer, isBlackKey

## web/src/components/MobileHeader.jsx

64 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : MobileHeader

## web/src/components/Onboarding.jsx

406 lignes ; accessible depuis main.jsx
Dépendances locales : services/OnboardingService.js, components/Onboarding.module.css
Symboles : Onboarding, StepContent, ChoiceCard, Promise, BrandLockup, StepVisual, HeroKeyboard, LibraryVisual, LearningVisual, MidiVisual, FeatureIcon, CheckIcon, ArrowIcon

## web/src/components/Onboarding.module.css

275 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/PianoRoll.jsx

757 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js, services/AudioEngine.js, hooks/usePlaybackPosition.js, services/ThemeService.js, components/editor/PianoRollEditor.jsx
Symboles : PianoRoll

## web/src/components/PlaybackDock.jsx

639 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : PlaybackDock, pillStyle, TransportBtn, PixelBtn, MetronomeButton, ToggleIconBtn, LoopRangeEditor, RangeStepper

## web/src/components/RotatePrompt.jsx

27 lignes ; accessible depuis main.jsx
Dépendances locales : hooks/useDeviceContext.js, components/RotatePrompt.module.css
Symboles : RotatePrompt

## web/src/components/RotatePrompt.module.css

62 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/Settings.jsx

986 lignes ; accessible depuis main.jsx
Dépendances locales : services/StorageService.js, services/MidiInputService.js, services/AudioEngine.js, components/MidiVisualizer.jsx, components/MidiLatencyCalibration.jsx, components/LatencyWizard.jsx, components/DesignAppearance.jsx, services/OnboardingService.js, hooks/useDeviceContext.js, components/Settings.module.css
Symboles : Settings, TabButton

## web/src/components/Settings.module.css

69 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/SheetMusicLearning.jsx

842 lignes ; accessible depuis main.jsx
Dépendances locales : utils/timing.js, utils/sheetMusic.js, components/PlaybackDock.jsx, services/AudioEngine.js, components/SheetMusicLearning.module.css
Symboles : useSheetTheme, SheetMusicLearning, SheetSystem, SystemMeasure, ToggleHandPill, HandIcon, EmptyState

## web/src/components/SheetMusicLearning.module.css

139 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/SongEditor.jsx

1297 lignes ; accessible depuis main.jsx
Dépendances locales : utils/timing.js, components/PianoRoll.jsx, services/AudioEngine.js, services/MidiService.js, services/StorageService.js, models/song.js, components/MobileHeader.jsx, components/PlaybackDock.jsx
Symboles : SongEditor, EditorBottomBar

## web/src/components/SongLibrary.jsx

490 lignes ; accessible depuis main.jsx
Dépendances locales : services/StorageService.js, models/song.js, components/ui/index.js, components/SongLibrary.module.css, services/MidiService.js
Symboles : useDialogFocus, SongLibrary, SongCard, EmptyLibrary, SongDetailDialog, LibraryTransferDialog, Icon, normalizeText, getTimestamp, formatRelativeDate

## web/src/components/SongLibrary.module.css

318 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/TimelineNavigator.jsx

273 lignes ; accessible depuis main.jsx
Dépendances locales : hooks/useTimelineInteraction.js
Symboles : TimelineNavigator

## web/src/components/TopNavBar.jsx

44 lignes ; accessible depuis main.jsx
Dépendances locales : components/icons/LibraryIcon.jsx, components/icons/PartitionIcon.jsx, components/icons/LearnIcon.jsx, components/icons/LivePlayIcon.jsx, components/icons/SettingsIcon.jsx, components/TopNavBar.module.css
Symboles : TopNavBar

## web/src/components/TopNavBar.module.css

197 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/editor/MidiRecorder.jsx

254 lignes ; accessible depuis main.jsx
Dépendances locales : hooks/useMidiRecording.js
Symboles : MidiRecorder

## web/src/components/editor/PianoRollEditor.jsx

1001 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js, services/AudioEngine.js, hooks/useNoteSelection.js, hooks/useScaleContext.js, hooks/usePlaybackPosition.js, components/editor/canvas/PianoRollCanvas.jsx, components/editor/controls/Toolbar.jsx, components/editor/controls/ContextMenu.jsx, components/editor/controls/Minimap.jsx, components/editor/controls/ShortcutsHint.jsx, components/editor/MidiRecorder.jsx, components/editor/PianoRollEditor.module.css
Symboles : PianoRollEditor

## web/src/components/editor/PianoRollEditor.module.css

380 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/editor/canvas/PianoRollCanvas.jsx

1129 lignes ; accessible depuis main.jsx
Dépendances locales : hooks/useCanvasLayers.js, services/ThemeService.js, components/editor/canvas/drawFunctions.js, components/editor/canvas/canvasUtils.js
Symboles : 

## web/src/components/editor/canvas/canvasUtils.js

367 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/components/editor/canvas/drawFunctions.js

757 lignes ; accessible depuis main.jsx
Dépendances locales : services/ThemeService.js
Symboles : 

## web/src/components/editor/controls/ContextMenu.jsx

116 lignes ; accessible depuis main.jsx
Dépendances locales : components/editor/PianoRollEditor.module.css
Symboles : ContextMenu

## web/src/components/editor/controls/GridControls.jsx

51 lignes ; accessible depuis main.jsx
Dépendances locales : components/editor/PianoRollEditor.module.css
Symboles : GridControls

## web/src/components/editor/controls/LoopControls.jsx

30 lignes ; accessible depuis main.jsx
Dépendances locales : components/editor/PianoRollEditor.module.css
Symboles : LoopControls

## web/src/components/editor/controls/MeasureControls.jsx

49 lignes ; accessible depuis main.jsx
Dépendances locales : components/editor/PianoRollEditor.module.css
Symboles : MeasureControls

## web/src/components/editor/controls/MetronomeControls.jsx

40 lignes ; accessible depuis main.jsx
Dépendances locales : components/editor/PianoRollEditor.module.css
Symboles : MetronomeControls

## web/src/components/editor/controls/Minimap.jsx

108 lignes ; accessible depuis main.jsx
Dépendances locales : services/ThemeService.js, components/editor/PianoRollEditor.module.css
Symboles : Minimap

## web/src/components/editor/controls/PlaybackControls.jsx

65 lignes ; accessible depuis main.jsx
Dépendances locales : components/editor/PianoRollEditor.module.css
Symboles : PlaybackControls

## web/src/components/editor/controls/SelectionActions.jsx

92 lignes ; accessible depuis main.jsx
Dépendances locales : components/editor/PianoRollEditor.module.css
Symboles : SelectionActions

## web/src/components/editor/controls/ShortcutsHint.jsx

55 lignes ; accessible depuis main.jsx
Dépendances locales : components/editor/PianoRollEditor.module.css
Symboles : ShortcutsHint

## web/src/components/editor/controls/Toolbar.jsx

252 lignes ; accessible depuis main.jsx
Dépendances locales : components/editor/controls/ZoomControls.jsx, components/editor/controls/GridControls.jsx, components/editor/controls/PlaybackControls.jsx, components/editor/controls/MetronomeControls.jsx, components/editor/controls/LoopControls.jsx, components/editor/controls/MeasureControls.jsx, components/editor/controls/SelectionActions.jsx, components/editor/PianoRollEditor.module.css
Symboles : 

## web/src/components/editor/controls/ZoomControls.jsx

56 lignes ; accessible depuis main.jsx
Dépendances locales : components/editor/PianoRollEditor.module.css
Symboles : ZoomControls

## web/src/components/icons/LearnIcon.jsx

16 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : LearnIcon

## web/src/components/icons/LibraryIcon.jsx

12 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : LibraryIcon

## web/src/components/icons/LivePlayIcon.jsx

19 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : LivePlayIcon

## web/src/components/icons/PartitionIcon.jsx

17 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : PartitionIcon

## web/src/components/icons/SettingsIcon.jsx

10 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : SettingsIcon

## web/src/components/learn/CoordinationTimeline.jsx

196 lignes ; accessible depuis main.jsx
Dépendances locales : services/ThemeService.js
Symboles : 

## web/src/components/learn/LearnSidebar.jsx

549 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js
Symboles : LearnSidebar, fixedKeyboardRange, uniquePitchLabels, HandGuide, HandIcon, MiniKeyboard

## web/src/components/ui/Cover.jsx

69 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : gradientForId, Cover

## web/src/components/ui/HandBadge.jsx

78 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : HandRightIcon, HandLeftIcon, HandBadge

## web/src/components/ui/LevelPill.jsx

30 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : LevelPill

## web/src/components/ui/MonoStat.jsx

41 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : MonoStat

## web/src/components/ui/Pill.jsx

25 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : Pill

## web/src/components/ui/index.js

9 lignes ; accessible depuis main.jsx
Dépendances locales : components/ui/Cover.jsx, components/ui/LevelPill.jsx, components/ui/Pill.jsx, components/ui/HandBadge.jsx, components/ui/MonoStat.jsx
Symboles : 

## web/src/hooks/useCanvasLayers.js

148 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/hooks/useDeviceContext.js

69 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : useDeviceContext

## web/src/hooks/useFullscreen.js

49 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : useFullscreen

## web/src/hooks/useMidiAudio.js

190 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js, services/MidiInputService.js, services/AudioEngine.js
Symboles : useMidiAudio

## web/src/hooks/useMidiRecording.js

280 lignes ; accessible depuis main.jsx
Dépendances locales : utils/timing.js, services/MidiInputService.js, models/song.js
Symboles : useMidiRecording

## web/src/hooks/useNoteSelection.js

251 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js
Symboles : useNoteSelection, useNoteClipboard

## web/src/hooks/usePlaybackPosition.js

91 lignes ; accessible depuis main.jsx
Dépendances locales : services/AudioEngine.js
Symboles : usePlaybackPosition

## web/src/hooks/useScaleContext.js

6 lignes ; accessible depuis main.jsx
Dépendances locales : utils/scaleContext.js
Symboles : useScaleContext

## web/src/hooks/useTimelineInteraction.js

139 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : useTimelineInteraction

## web/src/hooks/useWakeLock.js

54 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : useWakeLock

## web/src/index.css

367 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/main.jsx

69 lignes ; accessible depuis main.jsx
Dépendances locales : index.css, styles/tokens.css, components/ErrorBoundary.jsx, AppDesktop.jsx, services/DemoSongs.js
Symboles : removeSplash

## web/src/models/song.js

304 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/services/AudioEngine.js

549 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js
Symboles : loadTone, AudioEngine

## web/src/services/DemoSongs.js

59 lignes ; accessible depuis main.jsx
Dépendances locales : services/StorageService.js, services/MidiService.js
Symboles : preloadDemoSongsIfEmpty

## web/src/services/MidiInputService.js

534 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : loadTauriAPIs, MidiInputService

## web/src/services/MidiService.js

174 lignes ; accessible depuis main.jsx
Dépendances locales : utils/timing.js, models/song.js
Symboles : 

## web/src/services/OnboardingService.js

51 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : readState

## web/src/services/StorageService.js

351 lignes ; accessible depuis main.jsx
Dépendances locales : utils/timing.js, models/song.js
Symboles : 

## web/src/services/ThemeService.js

457 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : ThemeService

## web/src/styles/tokens.css

198 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : 

## web/src/useSong.js

217 lignes ; accessible depuis main.jsx
Dépendances locales : utils/timing.js, models/song.js, services/StorageService.js, utils/phraseEditing.js
Symboles : useSong

## web/src/utils/analyzeSong.js

219 lignes ; accessible depuis main.jsx
Dépendances locales : utils/repeatedMotifs.js, models/song.js, utils/chordDetection.js, utils/measureUtils.js
Symboles : analyzeSong

## web/src/utils/chordDetection.js

753 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js
Symboles : getChordDegree, identifyChord, intervalsMatch, getRootName, arpeggioToChord, capitalizeNote, formatChordDisplayName, detectArpeggioMotifs, formatArpeggioBadge, identifyChordWithTolerance, noteLabelForPitchClass, getMeasureHarmony, qualifyOstinatoMeasure, qualifyPedalMeasure, qualifyArpeggioMeasure

## web/src/utils/measureUtils.js

76 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js, utils/timing.js
Symboles : getMeasuresFromPhrase, groupNotesByTime

## web/src/utils/phraseEditing.js

58 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js
Symboles : separatorAt, splitPhraseAtMeasure, mergePhrases

## web/src/utils/repeatedMotifs.js

47 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js
Symboles : segmentRepeatedMotifs

## web/src/utils/scaleContext.js

30 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js
Symboles : createScaleContext

## web/src/utils/sheetMusic.js

1209 lignes ; accessible depuis main.jsx
Dépendances locales : models/song.js
Symboles : resolveSheetTheme, classifyDuration, midiToDiatonic, isBlackKey, normalizePitch, selectClef, keySignatureAccidentalCount, toKotlinKeySig, spellMidiForStaff, createAccidentalState, suggestUpperOctaveShift, suggestLowerOctaveShift, medianOctaveShift, octaveShiftLabel, slicePhraseIntoMeasures, flattenSongMeasures, computeBeamGroups, accStepPx, keySigBlockWidth, clefGlyphZoneWidth, timeSigZoneWidth, computeHeaderWidth, computeLineSpacing, renderMeasure

## web/src/utils/timing.js

7 lignes ; accessible depuis main.jsx
Dépendances locales : 
Symboles : quarterNotesPerMeasure
