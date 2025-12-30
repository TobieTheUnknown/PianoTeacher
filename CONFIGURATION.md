# ⚙️ Configuration - Piano Teacher

## Configuration Vite Optimisée

La configuration Vite a été optimisée pour de meilleures performances en production.

### Build Analysis

Après optimisations, voici la taille des bundles:

```
dist/index.html                            0.73 kB │ gzip:  0.37 kB
dist/assets/css/index-DYA2Yi0Q.css         4.65 kB │ gzip:  1.46 kB
dist/assets/js/tauri-vendor-By7l7snj.js    2.16 kB │ gzip:  1.05 kB
dist/assets/js/react-vendor-23BElR75.js   11.84 kB │ gzip:  4.24 kB
dist/assets/js/music-vendor-CFINbWHN.js  269.52 kB │ gzip: 70.07 kB
dist/assets/js/index-BcyeA8sY.js         332.77 kB │ gzip: 94.38 kB
```

**Total compressé**: ~171 kB gzip

### Code Splitting

Les dépendances sont séparées en chunks pour meilleure mise en cache:

1. **tauri-vendor** (2.16 kB)
   - `@tauri-apps/api`
   - `@tauri-apps/plugin-dialog`
   - `@tauri-apps/plugin-fs`
   - Change rarement → cache long terme

2. **react-vendor** (11.84 kB)
   - `react`
   - `react-dom`
   - Change rarement → cache long terme

3. **music-vendor** (269.52 kB)
   - `tone` (audio engine)
   - `@tonejs/midi`
   - Plus gros chunk mais stable → cache long terme

4. **index** (332.77 kB)
   - Code de l'application
   - Change fréquemment → cache court

### Optimisations Build

#### Minification
- Utilise **esbuild** (plus rapide que terser)
- Minifie JS, CSS et HTML
- Remove dead code

#### Target
- `es2020` pour browsers modernes
- Meilleure optimisation du code
- Syntaxe moderne plus compacte

#### CSS
- **Code splitting activé**: CSS séparé par route/composant
- **Modules CSS**: Scoping automatique
- **PostCSS**: Préprocessing si besoin

#### Assets
- Assets < 4kB: Inlinés en base64
- Assets > 4kB: Fichiers séparés avec hash
- Organisation par type dans `assets/`

## Configuration Vite Complète

```javascript
// vite.config.js
export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'music-vendor': ['tone', '@tonejs/midi'],
          'tauri-vendor': ['@tauri-apps/api', '@tauri-apps/plugin-dialog', '@tauri-apps/plugin-fs']
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },

    sourcemap: false,
    cssCodeSplit: true,
    assetsInlineLimit: 4096
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'tone', '@tonejs/midi']
  },

  css: {
    modules: {
      localsConvention: 'camelCase',
      scopeBehaviour: 'local'
    }
  }
})
```

## Utilisation des Composants Optimisés

### SynthesiaViewOptimized

Exemple complet d'intégration:

```javascript
import { SynthesiaViewOptimized } from './components/SynthesiaViewOptimized';

function App() {
  const [song, setSong] = useState(null);

  return (
    <div>
      {song && <SynthesiaViewOptimized song={song} />}
    </div>
  );
}
```

### Composants individuels

Si vous voulez plus de contrôle:

```javascript
import SynthesiaCanvas from './components/SynthesiaCanvas';
import SynthesiaControls from './components/SynthesiaControls';
import SynthesiaStats from './components/SynthesiaStats';

function MyCustomView({ song }) {
  // ... votre logique ...

  return (
    <div>
      <SynthesiaStats {...statsProps} />
      <SynthesiaControls {...controlsProps} />
      <SynthesiaCanvas {...canvasProps} />
    </div>
  );
}
```

## Performance Monitoring

### En développement

```bash
npm run dev
```

Ouvrir Chrome DevTools:
- **Performance**: Profiler rendering
- **Memory**: Heap snapshots
- **React DevTools**: Profiler pour re-renders

### En production

```bash
npm run build
npm run preview
```

Tester avec:
- Lighthouse
- WebPageTest
- Chrome DevTools Performance

### Bundle Analysis

Pour analyser la taille des bundles:

```bash
npm install -D rollup-plugin-visualizer
```

Ajouter dans `vite.config.js`:

```javascript
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true
    })
  ]
});
```

Build puis ouvrir `dist/stats.html` pour voir la répartition.

## Optimisations Runtime

### React.memo usage

Tous les nouveaux composants utilisent `React.memo`:

```javascript
const SynthesiaCanvas = memo(({ props }) => {
  // ...
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.currentTime === nextProps.currentTime;
});
```

### CSS Modules

Remplace inline styles:

```javascript
// ❌ Avant (crée un nouvel objet à chaque render)
<div style={{ padding: '1rem', background: '#000' }}>

// ✅ Après (classe CSS réutilisable)
<div className={styles.container}>
```

### Canvas Layers

3 layers séparés pour rendering optimal:

```javascript
const {
  staticLayerRef,    // Grille, mesures
  dynamicLayerRef,   // Notes, keyboard
  overlayLayerRef    // Feedback, UI
} = useCanvasLayers(width, height);
```

## Variables d'Environnement

Créer `.env.local` pour config locale:

```env
# Development
VITE_DEBUG=true
VITE_API_URL=http://localhost:3000

# Tauri
TAURI_DEBUG=true
```

Accès dans le code:

```javascript
const isDebug = import.meta.env.VITE_DEBUG === 'true';
const apiUrl = import.meta.env.VITE_API_URL;
```

## Scripts NPM Disponibles

```bash
# Développement
npm run dev              # Dev server avec HMR
npm run lint             # ESLint

# Production
npm run build            # Build optimisé
npm run preview          # Preview du build

# Tauri Desktop
npm run tauri:dev        # Dev avec Tauri
npm run tauri:build      # Build desktop app
npm run build:win        # Build Windows
npm run build:mac        # Build macOS
npm run build:linux      # Build Linux

# Tauri Mobile
npm run android:dev      # Dev Android
npm run build:android    # Build APK
npm run ios:dev          # Dev iOS
npm run build:ios        # Build iOS
```

## Recommandations Production

### 1. Enable Compression

Server-side (nginx example):

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript;
```

### 2. Cache Headers

```nginx
location /assets/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location / {
  expires -1;
  add_header Cache-Control "no-store, no-cache, must-revalidate";
}
```

### 3. CDN

Considérer un CDN pour:
- Fichiers statiques (JS/CSS/assets)
- Audio samples (si nombreux)
- Fonts

### 4. Lazy Loading

Pour routes futures:

```javascript
const SongEditor = lazy(() => import('./components/SongEditor'));
const SynthesiaView = lazy(() => import('./components/SynthesiaViewOptimized'));

<Suspense fallback={<Loading />}>
  <Route path="/edit" element={<SongEditor />} />
  <Route path="/learn" element={<SynthesiaView />} />
</Suspense>
```

## Troubleshooting

### Build échoue

```bash
# Nettoyer et réinstaller
rm -rf node_modules dist .vite
npm install
npm run build
```

### Chunks trop gros

Analyser avec visualizer puis:

```javascript
manualChunks(id) {
  if (id.includes('heavy-library')) {
    return 'heavy-vendor';
  }
}
```

### CSS non appliqué

Vérifier import du module:

```javascript
import styles from './Component.module.css';
// Pas juste './Component.css'
```

### Performance toujours basse

1. Profiler avec React DevTools
2. Vérifier re-renders inutiles
3. Utiliser React.memo sur composants lourds
4. Implémenter virtualisation si listes longues

## Prochaines Étapes

### Phase 2 (Recommandé)

1. **Context API** - Éviter props drilling
2. **Lazy Loading** - Code splitting par route
3. **Web Workers** - Calculs lourds en background
4. **Service Workers** - Cache offline

### Phase 3 (Optionnel)

1. **TypeScript** - Type safety
2. **Testing** - Vitest + React Testing Library
3. **Storybook** - Component documentation
4. **E2E Tests** - Playwright

### Phase 4 (Avancé)

1. **PWA** - Progressive Web App
2. **Analytics** - Usage tracking
3. **Error Tracking** - Sentry/Rollbar
4. **A/B Testing** - Feature flags

## Support

Pour plus d'informations:
- `OPTIMIZATIONS.md` - Détails des optimisations
- `MIGRATION_GUIDE.md` - Guide de migration
- [Vite Documentation](https://vitejs.dev)
- [React Performance](https://react.dev/learn/render-and-commit)

---

Configuration optimisée le 2025-12-30
Branche: `optimisation`
