# Piano Teacher - Project Documentation

## Project Overview

Piano Teacher is a web-based music education application that helps users learn piano pieces through phrase-based practice. The application allows users to build songs from individual musical phrases, import MIDI files, and practice with visual and audio feedback.

**Tagline**: "Maîtrisez vos morceaux, phrase par phrase" (Master your pieces, phrase by phrase)

## Tech Stack

- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.2.2
- **Audio Engine**: Tone.js 15.1.22
- **MIDI Processing**: @tonejs/midi 2.0.28
- **Styling**: CSS with CSS Custom Properties (CSS Variables)
- **Storage**: Browser LocalStorage
- **Language**: JavaScript (ES Modules)

## Project Structure

```
Piano/
├── src/
│   ├── components/          # React components
│   │   ├── Layout.jsx       # Main layout wrapper with header/footer
│   │   ├── PhraseBuilder.jsx # Component for building musical phrases
│   │   ├── PianoRoll.jsx    # Visual piano roll interface
│   │   ├── SongEditor.jsx   # Song composition and editing interface
│   │   ├── SongLibrary.jsx  # Song management and library view
│   │   └── SongViewer.jsx   # Practice/learning mode interface
│   ├── models/
│   │   └── song.js          # Song data model and schema
│   ├── services/
│   │   ├── AudioEngine.js   # Tone.js audio playback service
│   │   ├── MidiService.js   # MIDI file import/export service
│   │   └── StorageService.js # LocalStorage persistence layer
│   ├── App.jsx              # Main application component
│   ├── App.css              # Application styles
│   ├── index.css            # Global styles and CSS variables
│   ├── main.jsx             # Application entry point
│   └── useSong.js           # Custom hook for song state management
├── public/                  # Static assets
├── index.html               # HTML entry point
├── vite.config.js           # Vite configuration
├── eslint.config.js         # ESLint configuration
└── package.json             # Dependencies and scripts

```

## Application Architecture

### Three Main Modes

1. **Bibliothèque (Library)**: Browse and manage saved songs
2. **Éditeur (Editor)**: Create and edit songs with phrase-based composition
3. **Apprentissage (Learning)**: Practice mode for learning songs

### State Management

- Primary state management through `useSong` custom hook (src/useSong.js)
- Handles song CRUD operations, phrase management, and note manipulation
- Persistence layer through `StorageService` (LocalStorage)

### Data Flow

```
User Input → App Component → useSong Hook → Song Model → StorageService → LocalStorage
                    ↓
          Child Components (Editor/Viewer/Library)
                    ↓
          Services (Audio/MIDI)
```

## Key Features

- **Phrase-Based Composition**: Build songs from individual musical phrases
- **MIDI Import**: Import existing MIDI files
- **Visual Piano Roll**: Visual representation of notes and timing
- **Audio Playback**: Play songs and phrases with Tone.js
- **LocalStorage Persistence**: Save and load songs locally
- **Responsive UI**: Modern, gradient-based design with French localization

## Development

### Installation

```bash
npm install
```

### Available Scripts

- `npm run dev` - Start development server (Vite)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Development Server

The dev server runs on Vite's default port (usually http://localhost:5173) with Hot Module Replacement (HMR).

## Styling Conventions

The application uses CSS custom properties for theming. Key variables include:
- `--accent-primary` - Primary accent color
- `--accent-secondary` - Secondary accent color
- `--bg-tertiary` - Tertiary background color
- `--border-color` - Border color
- `--text-secondary` - Secondary text color

Styles are primarily inline in components, with global styles in `index.css` and component-specific styles in `App.css`.

## Code Patterns

### Component Structure
- Functional components with hooks
- Props destructuring in function parameters
- Inline styles for component-specific styling
- French UI text and labels

### State Management
- Custom hooks for complex state logic (see `useSong.js`)
- useState for component-local state
- Props drilling for state sharing (no global state management library)

### Naming Conventions
- Components: PascalCase (e.g., `SongEditor`)
- Hooks: camelCase with 'use' prefix (e.g., `useSong`)
- Services: PascalCase with 'Service' suffix (e.g., `StorageService`)
- Event handlers: 'handle' prefix (e.g., `handleLoadSong`)

## Services

### AudioEngine.js
Manages audio playback using Tone.js:
- Synth initialization
- Note playback
- Phrase and song playback with timing

### MidiService.js
Handles MIDI file operations:
- Import MIDI files and convert to internal format
- Parse MIDI data structure
- Map MIDI notes to application data model

### StorageService.js
Manages LocalStorage persistence:
- Save/load songs
- List all saved songs
- Delete songs
- Data serialization/deserialization

## Data Models

### Song Structure (src/models/song.js)
```javascript
{
  id: string,           // Unique identifier
  title: string,        // Song title
  artist: string,       // Artist name
  tempo: number,        // BPM
  phrases: [            // Array of phrases
    {
      id: string,       // Unique phrase identifier
      name: string,     // Phrase name/label
      notes: [          // Array of notes in phrase
        {
          pitch: string,    // Note name (e.g., "C4")
          duration: number, // Note duration
          time: number      // Start time
        }
      ]
    }
  ]
}
```

## Testing

Currently no automated testing is configured. Consider adding:
- Vitest for unit testing
- React Testing Library for component testing
- Playwright or Cypress for E2E testing

## Future Considerations

- TypeScript migration (devDependencies already include @types/react)
- React Compiler (see README.md note)
- Backend integration for cloud storage
- User authentication
- Sharing capabilities
- Mobile responsive improvements
- Accessibility (ARIA labels, keyboard navigation)

## Language and Localization

The UI is currently in French:
- "Bibliothèque" (Library)
- "Éditeur" (Editor)
- "Apprentissage" (Learning)

Consider adding i18n if internationalization is needed.

## Browser Compatibility

Requires modern browser with:
- ES Module support
- LocalStorage
- Web Audio API (for Tone.js)
- CSS Custom Properties

## Performance Notes

- No code splitting currently implemented
- Vite provides optimized production builds
- Consider lazy loading components for larger applications
- Audio engine initialization may have startup latency

## Additional Files

- `test_midi.js` - MIDI testing script in project root
- `LaputaTwitch(2).mid` - Sample MIDI file for testing

---

**Last Updated**: 2025-12-20
**Project Version**: 0.0.0
**React Version**: 19.2.0
**Vite Version**: 7.2.2
