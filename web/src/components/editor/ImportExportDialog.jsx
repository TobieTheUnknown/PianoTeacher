import { StorageService } from '../../services/StorageService';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import styles from './ImportExportDialog.module.css';

export function ImportExportDialog({ open, song, isImporting, onClose, onImportMidi, onImportJson }) {
    const dialogRef = useDialogFocus({ active: open, onEscape: onClose });
    if (!open) return null;

    const exportJson = async () => {
        const result = await StorageService.exportSong(song);
        if (!result.success || result.cancelled) return;
        const message = result.path
            ? `Fichier JSON exporté !\n${result.path}`
            : 'Fichier JSON téléchargé !';
        alert(message);
    };

    return (
        <div className={styles.overlay} onMouseDown={onClose} role="presentation">
            <section
                ref={dialogRef}
                tabIndex="-1"
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-export-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <h2 id="import-export-title">Import / Export</h2>

                <div className={styles.card}>
                    <h3>Import MIDI</h3>
                    <p>Importer un fichier MIDI pour créer un nouveau morceau</p>
                    <label className={`${styles.fileButton} btn-primary`}>
                        <input type="file" accept=".mid,.midi" onChange={onImportMidi} disabled={isImporting} />
                        {isImporting ? 'Importation…' : 'Choisir un fichier MIDI'}
                    </label>
                </div>

                <div className={styles.card}>
                    <h3>Export / Import JSON</h3>
                    <p>Format JSON pour sauvegarder ou partager</p>
                    <div className={styles.actions}>
                        <button className={styles.exportButton} onClick={exportJson}>Exporter JSON</button>
                        <label className={styles.fileButton}>
                            <input type="file" accept=".json" onChange={onImportJson} />
                            Importer JSON
                        </label>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button onClick={onClose}>Fermer</button>
                </div>
            </section>
        </div>
    );
}
