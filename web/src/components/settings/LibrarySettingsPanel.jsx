import { StorageService } from '../../services/StorageService';
import styles from './LibrarySettingsPanel.module.css';

export function LibrarySettingsPanel() {
    const exportLibrary = async () => {
        try {
            const result = await StorageService.exportLibrary();
            if (!result.success || result.cancelled) return;
            const message = result.path
                ? `Bibliothèque exportée avec succès !\n${result.path}`
                : 'Bibliothèque exportée avec succès !';
            alert(message);
        } catch (error) {
            alert(`Erreur lors de l'export : ${error.message}`);
        }
    };

    const importLibrary = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ({ target }) => {
            try {
                const data = JSON.parse(target.result);
                const merge = window.confirm('Voulez-vous fusionner avec votre bibliothèque existante ?\n\nOK = Fusionner\nAnnuler = Remplacer complètement');
                StorageService.importLibrary(data, merge);
                alert('Bibliothèque importée avec succès !');
                window.location.reload();
            } catch (error) {
                alert(`Erreur lors de l'import : ${error.message}`);
            }
        };
        reader.readAsText(file);
    };

    return (
        <section className={styles.panel} aria-labelledby="library-settings-title">
            <div>
                <h3 id="library-settings-title">Gestion de la bibliothèque</h3>
                <p>Sauvegardez et restaurez votre collection de morceaux</p>
            </div>

            <div className={styles.actions}>
                <button className={styles.exportButton} onClick={exportLibrary}>
                    Exporter la bibliothèque
                </button>
                <label className={styles.importButton}>
                    <input type="file" accept=".json" onChange={importLibrary} />
                    Importer une bibliothèque
                </label>
            </div>

            <p className={styles.tip}>
                <strong>Astuce :</strong> Exportez régulièrement votre bibliothèque pour sauvegarder vos morceaux. L'import permet de restaurer ou fusionner vos données.
            </p>
        </section>
    );
}
