import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StorageService } from '../services/StorageService';
import { getFrenchKeyName } from '../models/song';
import { Cover } from './ui';
import styles from './SongLibrary.module.css';

const FILTERS = [
    { id: 'all', label: 'Tous' },
    { id: 'major', label: 'Majeur' },
    { id: 'minor', label: 'Mineur' },
];

const SORTS = [
    { id: 'recent', label: 'Récemment modifiés' },
    { id: 'title', label: 'Titre A–Z' },
    { id: 'tempo', label: 'Tempo' },
];

function useDialogFocus() {
    const dialogRef = useRef(null);
    useEffect(() => {
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialogRef.current?.focus({ preventScroll: true });

        const trapFocus = (event) => {
            if (event.key !== 'Tab') return;
            const focusable = [...(dialogRef.current?.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
            ) || [])].filter((element) => element.offsetParent !== null);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
                event.preventDefault();
                first.focus();
            }
        };

        window.addEventListener('keydown', trapFocus);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', trapFocus);
            if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
        };
    }, []);
    return dialogRef;
}

export function SongLibrary({
    onLoadSong,
    onLearnSong,
    onEditSong,
    onViewSheet,
    onNewSong,
    onLoadSongToLivePlay,
    isMobile = false,
}) {
    const [songs, setSongs] = useState([]);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [sort, setSort] = useState('recent');
    const [showLibraryModal, setShowLibraryModal] = useState(false);
    const [mergeOnImport, setMergeOnImport] = useState(true);
    const [detailSong, setDetailSong] = useState(null);
    const [midiImportStatus, setMidiImportStatus] = useState(null);
    const searchInputRef = useRef(null);

    const loadSongs = useCallback(() => setSongs(StorageService.getSongs()), []);
    useEffect(() => { loadSongs(); }, [loadSongs]);

    useEffect(() => {
        if (!showLibraryModal && !detailSong) return undefined;
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setShowLibraryModal(false);
                setDetailSong(null);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [showLibraryModal, detailSong]);

    useEffect(() => {
        const focusSearch = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', focusSearch);
        return () => window.removeEventListener('keydown', focusSearch);
    }, []);

    const enrichedSongs = useMemo(() => songs.map((song) => {
        const phraseCount = song.phrases?.length || 0;
        const noteCount = (song.phrases || []).reduce((total, phrase) => (
            total + (phrase.tracks?.melody?.length || 0) + (phrase.tracks?.chords?.length || 0)
        ), 0);
        const keyMode = typeof song.key === 'object' ? song.key?.mode : null;
        return { song, phraseCount, noteCount, keyMode };
    }), [songs]);

    const filteredSongs = useMemo(() => {
        const normalizedQuery = normalizeText(query);
        const list = enrichedSongs.filter((item) => {
            const haystack = normalizeText([
                item.song.title,
                item.song.artist,
                getFrenchKeyName(item.song.key),
                ...(item.song.phrases || []).map((phrase) => phrase.name),
            ].filter(Boolean).join(' '));
            const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
            const matchesFilter = filter === 'all'
                || (filter === 'major' && item.keyMode === 'major')
                || (filter === 'minor' && item.keyMode === 'minor');
            return matchesQuery && matchesFilter;
        });

        return [...list].sort((a, b) => {
            if (sort === 'title') return (a.song.title || '').localeCompare(b.song.title || '', 'fr');
            if (sort === 'tempo') return (a.song.tempo || 0) - (b.song.tempo || 0);
            return getTimestamp(b.song) - getTimestamp(a.song);
        });
    }, [enrichedSongs, query, filter, sort]);

    const resumeItem = useMemo(() => (
        [...enrichedSongs]
            .sort((a, b) => getTimestamp(b.song) - getTimestamp(a.song))[0]
    ), [enrichedSongs]);

    const learnSong = onLearnSong || onLoadSong;

    const handleDelete = (song) => {
        if (!window.confirm(`Supprimer « ${song.title || 'Sans titre'} » de la bibliothèque ?`)) return;
        StorageService.deleteSong(song.id);
        setDetailSong(null);
        loadSongs();
    };

    const handleImportMidi = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setMidiImportStatus('loading');
        try {
            const { parseMidiFile } = await import('../services/MidiService');
            const song = await parseMidiFile(file);
            StorageService.saveSong(song);
            loadSongs();
            setMidiImportStatus('success');
        } catch (error) {
            console.error('MIDI import error:', error);
            setMidiImportStatus('error');
        } finally {
            event.target.value = '';
        }
    };

    const handleExportMidi = async (song) => {
        try {
            const result = await StorageService.exportSongAsMidi(song);
            if (result.success && !result.cancelled && result.path) alert(`MIDI exporté !\n${result.path}`);
        } catch (error) {
            console.error('MIDI export error:', error);
            alert('Impossible d’exporter ce fichier MIDI.');
        }
    };

    const handleImportLibrary = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ({ target }) => {
            try {
                StorageService.importLibrary(JSON.parse(target.result), mergeOnImport);
                loadSongs();
                setShowLibraryModal(false);
            } catch {
                alert('Ce fichier ne contient pas une bibliothèque Piano Teacher valide.');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const openSong = (item) => {
        if (isMobile) setDetailSong(item.song);
        else onViewSheet?.(item.song.id);
    };

    return (
        <div className={styles.page}>
            <header className={styles.pageHeader}>
                <div>
                    <p className={styles.eyebrow}>Mon studio</p>
                    <h1>Bibliothèque</h1>
                    <p className={styles.subtitle}>Votre répertoire de travail</p>
                </div>
                <div className={styles.headerActions}>
                    <button aria-label="Importer ou exporter" className={styles.secondaryButton} onClick={() => setShowLibraryModal(true)}>
                        <Icon kind="transfer" />
                        <span>Importer</span>
                    </button>
                    {onNewSong && (
                        <button aria-label="Créer un nouveau morceau" className={styles.primaryButton} onClick={onNewSong}>
                            <Icon kind="plus" />
                            <span>Nouveau morceau</span>
                        </button>
                    )}
                </div>
            </header>

            {songs.length > 0 && resumeItem && (
                <section className={styles.dashboard} aria-label="Morceau récent">
                    <div className={styles.resumeCard}>
                        <div className={styles.resumeGlow} aria-hidden="true" />
                        <div className={styles.resumeCopy}>
                            <p className={styles.cardEyebrow}>Dernier morceau</p>
                            <h2>{resumeItem.song.title || 'Sans titre'}</h2>
                            <p>{resumeItem.song.artist || `${getFrenchKeyName(resumeItem.song.key)} · ${resumeItem.song.tempo || 120} BPM`}</p>
                            <div className={styles.resumeMeta}>
                                <span>{resumeItem.phraseCount} {resumeItem.phraseCount === 1 ? 'phrase' : 'phrases'}</span>
                                <i />
                                <span>{resumeItem.noteCount} notes</span>
                                <i />
                                <span>{formatRelativeDate(resumeItem.song.updatedAt || resumeItem.song.createdAt)}</span>
                            </div>
                            <div className={styles.resumeActions}>
                                <button className={styles.primaryButton} onClick={() => onViewSheet?.(resumeItem.song.id)}><Icon kind="score" /> Ouvrir la partition</button>
                                <button className={styles.glassButton} onClick={() => learnSong?.(resumeItem.song.id)}><Icon kind="learn" /> Coach</button>
                                <button className={styles.glassButton} onClick={() => onLoadSongToLivePlay?.(resumeItem.song.id)}><Icon kind="live" /> Live</button>
                            </div>
                        </div>
                        <div className={styles.resumeArtwork}>
                            <Cover id={resumeItem.song.id} title={resumeItem.song.title} size={90} />
                        </div>
                    </div>
                </section>
            )}

            <section className={styles.collection} aria-labelledby="collection-title">
                <div className={styles.collectionTitle}>
                    <div>
                        <h2 id="collection-title">Vos morceaux</h2>
                        <span>{filteredSongs.length} résultat{filteredSongs.length !== 1 ? 's' : ''}</span>
                    </div>
                    <label className={styles.searchField}>
                        <span className="sr-only">Rechercher un morceau</span>
                        <Icon kind="search" />
                        <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Titre, artiste, tonalité, phrase…" type="search" />
                        {query && <button onClick={() => setQuery('')} aria-label="Effacer la recherche"><Icon kind="close" /></button>}
                        <kbd>⌘ K</kbd>
                    </label>
                </div>

                <div className={styles.filtersRow}>
                    <div className={styles.filterChips} role="group" aria-label="Filtrer la bibliothèque">
                        {FILTERS.map((item) => (
                            <button key={item.id} className={filter === item.id ? styles.filterActive : ''} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <label className={styles.sortSelect}>
                        <Icon kind="sort" />
                        <span className="sr-only">Trier les morceaux</span>
                        <select value={sort} onChange={(event) => setSort(event.target.value)}>
                            {SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                        </select>
                    </label>
                </div>

                {songs.length === 0 ? (
                    <EmptyLibrary onNewSong={onNewSong} onImport={() => setShowLibraryModal(true)} />
                ) : filteredSongs.length === 0 ? (
                    <div className={styles.noResults}>
                        <span><Icon kind="search" /></span>
                        <h3>Aucun morceau ne correspond</h3>
                        <p>Essayez un autre terme ou affichez toute la bibliothèque.</p>
                        <button onClick={() => { setQuery(''); setFilter('all'); }}>Réinitialiser les filtres</button>
                    </div>
                ) : (
                    <div className={styles.songGrid}>
                        {filteredSongs.map((item) => (
                            <SongCard
                                key={item.song.id}
                                item={item}
                                isMobile={isMobile}
                                onOpen={() => openSong(item)}
                                onLearn={() => learnSong?.(item.song.id)}
                                onLive={() => onLoadSongToLivePlay?.(item.song.id)}
                                onEdit={() => onEditSong?.(item.song.id)}
                                onSheet={() => onViewSheet?.(item.song.id)}
                                onMore={() => setDetailSong(item.song)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {detailSong && (
                <SongDetailDialog
                    song={detailSong}
                    data={enrichedSongs.find((item) => item.song.id === detailSong.id)}
                    onClose={() => setDetailSong(null)}
                    onLearn={() => { learnSong?.(detailSong.id); setDetailSong(null); }}
                    onLive={() => { onLoadSongToLivePlay?.(detailSong.id); setDetailSong(null); }}
                    onEdit={onEditSong ? () => { onEditSong(detailSong.id); setDetailSong(null); } : null}
                    onSheet={onViewSheet ? () => { onViewSheet(detailSong.id); setDetailSong(null); } : null}
                    onExport={() => handleExportMidi(detailSong)}
                    onDelete={() => handleDelete(detailSong)}
                />
            )}

            {showLibraryModal && (
                <LibraryTransferDialog
                    merge={mergeOnImport}
                    setMerge={setMergeOnImport}
                    midiStatus={midiImportStatus}
                    onClose={() => setShowLibraryModal(false)}
                    onImportMidi={handleImportMidi}
                    onImportLibrary={handleImportLibrary}
                    onExportLibrary={async () => {
                        const result = await StorageService.exportLibrary();
                        if (result.success && !result.cancelled && result.path) alert(`Bibliothèque exportée !\n${result.path}`);
                    }}
                />
            )}
        </div>
    );
}

function SongCard({ item, isMobile, onOpen, onLearn, onLive, onEdit, onSheet, onMore }) {
    const { song, phraseCount, noteCount } = item;
    return (
        <article className={styles.songCard}>
            <button className={styles.songMain} onClick={onOpen} aria-label={`${isMobile ? 'Ouvrir les détails de' : 'Ouvrir la partition de'} ${song.title}`}>
                <Cover id={song.id} title={song.title} size={64} />
                <span className={styles.songCopy}>
                    <span className={styles.songTitleRow}>
                        <strong>{song.title || 'Sans titre'}</strong>
                    </span>
                    <small className={styles.artist}>{song.artist || 'Artiste inconnu'}</small>
                    <span className={styles.metadata}>
                        <em>{getFrenchKeyName(song.key)}</em>
                        <i>{song.tempo || 120} BPM</i>
                        <i>{song.timeSignature?.numerator || 4}/{song.timeSignature?.denominator || 4}</i>
                    </span>
                </span>
            </button>

            <div className={styles.songDetails}>
                <span><Icon kind="phrases" /> {phraseCount} phrase{phraseCount !== 1 ? 's' : ''}</span>
                <span><Icon kind="notes" /> {noteCount} notes</span>
                <span className={styles.updated}>{formatRelativeDate(song.updatedAt || song.createdAt)}</span>
            </div>

            <div className={styles.songActions}>
                {onSheet && <button className={styles.learnButton} onClick={onSheet}><Icon kind="score" /> Partition</button>}
                <button onClick={onLearn} aria-label={`Ouvrir le coach pour ${song.title}`} title="Coach"><Icon kind="learn" /></button>
                <button onClick={onLive} aria-label={`Jouer ${song.title} en Live`} title="Live"><Icon kind="live" /></button>
                {onEdit && <button onClick={onEdit} aria-label={`Éditer ${song.title}`} title="Éditeur"><Icon kind="edit" /></button>}
                <button onClick={onMore} aria-label={`Plus d’actions pour ${song.title}`} title="Plus d’actions"><Icon kind="more" /></button>
            </div>
        </article>
    );
}

function EmptyLibrary({ onNewSong, onImport }) {
    return (
        <div className={styles.emptyLibrary}>
            <div className={styles.emptyKeys} aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <p className={styles.cardEyebrow}>Premier morceau</p>
            <h2>Construisez votre répertoire</h2>
            <p>Importez un fichier MIDI ou créez un morceau pour commencer à travailler phrase par phrase.</p>
            <div>
                <button className={styles.primaryButton} onClick={onImport}><Icon kind="transfer" /> Importer un MIDI</button>
                {onNewSong && <button className={styles.secondaryButton} onClick={onNewSong}><Icon kind="plus" /> Créer un morceau</button>}
            </div>
        </div>
    );
}

function SongDetailDialog({ song, data, onClose, onLearn, onLive, onEdit, onSheet, onExport, onDelete }) {
    const dialogRef = useDialogFocus();
    return (
        <div className={styles.dialogOverlay} onMouseDown={onClose}>
            <section ref={dialogRef} tabIndex="-1" className={styles.detailDialog} role="dialog" aria-modal="true" aria-labelledby="song-detail-title" onMouseDown={(event) => event.stopPropagation()}>
                <div className={styles.sheetHandle} aria-hidden="true" />
                <button className={styles.dialogClose} onClick={onClose} aria-label="Fermer"><Icon kind="close" /></button>
                <div className={styles.detailHero}>
                    <Cover id={song.id} title={song.title} size={78} />
                    <div><h2 id="song-detail-title">{song.title || 'Sans titre'}</h2><p>{song.artist || 'Artiste inconnu'}</p></div>
                </div>
                <div className={styles.detailMetadata}><span>{getFrenchKeyName(song.key)}</span><span>{song.tempo || 120} BPM</span><span>{song.timeSignature?.numerator || 4}/{song.timeSignature?.denominator || 4}</span><span>{data?.phraseCount || 0} phrases</span><span>{data?.noteCount || 0} notes</span></div>
                <div className={styles.detailActions}>
                    {onSheet && <button className={styles.primaryButton} onClick={onSheet}><Icon kind="score" /> Partition</button>}
                    <button onClick={onLearn}><Icon kind="learn" /> Coach</button>
                    <button onClick={onLive}><Icon kind="live" /> Live</button>
                    {onEdit && <button onClick={onEdit}><Icon kind="edit" /> Éditer</button>}
                </div>
                <div className={styles.detailUtilities}>
                    <button onClick={onExport}><Icon kind="download" /> Exporter en MIDI</button>
                    <button className={styles.deleteButton} onClick={onDelete}><Icon kind="trash" /> Supprimer</button>
                </div>
            </section>
        </div>
    );
}

function LibraryTransferDialog({ merge, setMerge, midiStatus, onClose, onImportMidi, onImportLibrary, onExportLibrary }) {
    const dialogRef = useDialogFocus();
    return (
        <div className={styles.dialogOverlay} onMouseDown={onClose}>
            <section ref={dialogRef} tabIndex="-1" className={styles.transferDialog} role="dialog" aria-modal="true" aria-labelledby="transfer-title" onMouseDown={(event) => event.stopPropagation()}>
                <header>
                    <div><p className={styles.cardEyebrow}>Votre répertoire</p><h2 id="transfer-title">Importer et sauvegarder</h2><p>Les formats MIDI créent un morceau. Le format JSON conserve toute votre bibliothèque.</p></div>
                    <button className={styles.dialogClose} onClick={onClose} aria-label="Fermer"><Icon kind="close" /></button>
                </header>
                <div className={styles.transferGrid}>
                    <div className={styles.transferCard}>
                        <span className={styles.transferIcon}><Icon kind="notes" /></span>
                        <div><h3>Ajouter un morceau MIDI</h3><p>Analyse automatiquement les notes, le tempo, la mesure et les pistes.</p></div>
                        <label className={styles.fileButton}>
                            <input type="file" accept=".mid,.midi" onChange={onImportMidi} disabled={midiStatus === 'loading'} />
                            <Icon kind="transfer" /> {midiStatus === 'loading' ? 'Analyse…' : 'Choisir un MIDI'}
                        </label>
                        {midiStatus && midiStatus !== 'loading' && <p className={`${styles.importStatus} ${midiStatus === 'error' ? styles.importError : ''}`} role="status">{midiStatus === 'success' ? 'Morceau ajouté à la bibliothèque.' : 'Le fichier MIDI n’a pas pu être importé.'}</p>}
                    </div>
                    <div className={styles.transferCard}>
                        <span className={styles.transferIcon}><Icon kind="library" /></span>
                        <div><h3>Bibliothèque Piano Teacher</h3><p>Restaurez une sauvegarde JSON ou conservez-en une copie locale.</p></div>
                        <label className={styles.mergeOption}><input type="checkbox" checked={merge} onChange={(event) => setMerge(event.target.checked)} /><span><strong>Fusionner à l’import</strong><small>Conserve les morceaux déjà présents</small></span></label>
                        <div className={styles.transferActions}>
                            <label className={styles.fileButton}><input type="file" accept=".json" onChange={onImportLibrary} /><Icon kind="upload" /> Importer JSON</label>
                            <button onClick={onExportLibrary}><Icon kind="download" /> Exporter JSON</button>
                        </div>
                    </div>
                </div>
                <div className={styles.localNotice}><Icon kind="shield" /><p><strong>Stockage local</strong><span>Vos morceaux ne quittent pas cet appareil, sauf si vous exportez volontairement un fichier.</span></p></div>
            </section>
        </div>
    );
}

function Icon({ kind }) {
    const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
    if (kind === 'search') return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
    if (kind === 'close') return <svg {...props}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    if (kind === 'plus') return <svg {...props}><path d="M12 5v14M5 12h14" /></svg>;
    if (kind === 'transfer') return <svg {...props}><path d="M12 3v12M8 7l4-4 4 4M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2" /></svg>;
    if (kind === 'sort') return <svg {...props}><path d="M4 7h12M4 12h9M4 17h6M18 14v7M15 18l3 3 3-3" /></svg>;
    if (kind === 'learn') return <svg {...props}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><path d="m10 8 5 3-5 3z" /></svg>;
    if (kind === 'live') return <svg {...props}><path d="M3 12h3l2-6 4 12 2-6h7" /></svg>;
    if (kind === 'edit') return <svg {...props}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" /></svg>;
    if (kind === 'score') return <svg {...props}><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" /><path d="M11 6v4" /></svg>;
    if (kind === 'more') return <svg {...props}><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></svg>;
    if (kind === 'phrases') return <svg {...props}><path d="M4 5h16M4 12h11M4 19h7" /></svg>;
    if (kind === 'notes') return <svg {...props}><path d="M9 18V5l10-2v13M9 8l10-2" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>;
    if (kind === 'download') return <svg {...props}><path d="M12 3v12M8 11l4 4 4-4M5 21h14" /></svg>;
    if (kind === 'upload') return <svg {...props}><path d="M12 16V4M8 8l4-4 4 4M5 20h14" /></svg>;
    if (kind === 'trash') return <svg {...props}><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></svg>;
    if (kind === 'library') return <svg {...props}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22zM4 4.5v15M9 7h7M9 11h5" /></svg>;
    if (kind === 'shield') return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-5" /></svg>;
    return null;
}

function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function getTimestamp(song) {
    const date = new Date(song.updatedAt || song.createdAt || 0).getTime();
    return Number.isNaN(date) ? 0 : date;
}

function formatRelativeDate(value) {
    if (!value) return 'Date inconnue';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date inconnue';
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days <= 0) return 'Aujourd’hui';
    if (days === 1) return 'Hier';
    if (days < 7) return `Il y a ${days} jours`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
