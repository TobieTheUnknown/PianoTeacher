# Piano Teacher v3.0.0

## What's New

### Android Support
- Piano Teacher is now available as an Android APK
- MIDI device commands gracefully return empty results on Android (native MIDI via `midir` is desktop-only)

### Multi-Platform Release
This release ships 3 installer formats:
- **Windows** — `.exe` (NSIS installer) and `.msi`
- **macOS** — `.dmg` (Universal binary: Intel + Apple Silicon)
- **Android** — `.apk`

### Build Infrastructure
- Unified GitHub Actions workflow builds all platforms in parallel
- Removed duplicate `build-windows.yml` workflow
- Conditional compilation keeps the codebase clean: `midir`/`parking_lot` only compile on desktop targets

## Installation

| Platform | File | Notes |
|----------|------|-------|
| Windows  | `Piano Teacher_3.0.0_x64-setup.exe` | NSIS installer |
| macOS    | `Piano Teacher_3.0.0_universal.dmg` | Drag to Applications |
| Android  | `app-universal-release.apk` | Enable "Install from unknown sources" |

## Breaking Changes
- None — all existing features work identically on desktop
- Android builds exclude native MIDI input (planned for future via Android MIDI API)
