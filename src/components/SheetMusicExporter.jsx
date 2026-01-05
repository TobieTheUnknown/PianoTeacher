import { useState, useRef } from 'react';
import { sheetMusicExportService } from '../services/SheetMusicExportService';

/**
 * Composant pour exporter des partitions musicales en SVG ou PNG
 * avec options d'annotations en français
 */
export const SheetMusicExporter = ({ song }) => {
    const [withAnnotations, setWithAnnotations] = useState(true);
    const [track, setTrack] = useState('both');
    const [phraseIndex, setPhraseIndex] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [preview, setPreview] = useState(null);
    const previewContainerRef = useRef(null);

    const handlePreview = () => {
        try {
            setIsExporting(true);

            // Effacer le preview précédent
            if (previewContainerRef.current) {
                previewContainerRef.current.innerHTML = '';
            }

            const options = {
                withAnnotations,
                track,
                phraseIndex: phraseIndex === 'all' ? null : parseInt(phraseIndex)
            };

            const svgContainer = sheetMusicExportService.exportToSheetMusic(song, options);

            // Afficher le preview
            if (previewContainerRef.current && svgContainer) {
                previewContainerRef.current.appendChild(svgContainer);
                setPreview(true);
            }
        } catch (error) {
            console.error('Erreur lors de la génération du preview:', error);
            alert('Erreur lors de la génération du preview: ' + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportSVG = async () => {
        try {
            setIsExporting(true);

            const options = {
                withAnnotations,
                track,
                phraseIndex: phraseIndex === 'all' ? null : parseInt(phraseIndex)
            };

            const blob = sheetMusicExportService.exportToSVG(song, options);

            // Télécharger le fichier
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${song.title || 'partition'}.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert('Partition exportée en SVG avec succès !');
        } catch (error) {
            console.error('Erreur lors de l\'export SVG:', error);
            alert('Erreur lors de l\'export: ' + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPNG = async () => {
        try {
            setIsExporting(true);

            const options = {
                withAnnotations,
                track,
                phraseIndex: phraseIndex === 'all' ? null : parseInt(phraseIndex)
            };

            const blob = await sheetMusicExportService.exportToPNG(song, options);

            // Télécharger le fichier
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${song.title || 'partition'}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert('Partition exportée en PNG avec succès !');
        } catch (error) {
            console.error('Erreur lors de l\'export PNG:', error);
            alert('Erreur lors de l\'export: ' + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    if (!song) {
        return (
            <div style={styles.container}>
                <p>Aucun morceau sélectionné</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>📝 Exporter la partition</h2>

            <div style={styles.optionsPanel}>
                <div style={styles.optionGroup}>
                    <label style={styles.label}>
                        <input
                            type="checkbox"
                            checked={withAnnotations}
                            onChange={(e) => setWithAnnotations(e.target.checked)}
                            style={styles.checkbox}
                        />
                        Ajouter les noms de notes en français
                    </label>
                </div>

                <div style={styles.optionGroup}>
                    <label style={styles.label}>
                        Portées à exporter :
                    </label>
                    <select
                        value={track}
                        onChange={(e) => setTrack(e.target.value)}
                        style={styles.select}
                    >
                        <option value="both">Les deux mains (Clé de Sol + Fa)</option>
                        <option value="melody">Main droite uniquement (Clé de Sol)</option>
                        <option value="chords">Main gauche uniquement (Clé de Fa)</option>
                    </select>
                </div>

                <div style={styles.optionGroup}>
                    <label style={styles.label}>
                        Phrase à exporter :
                    </label>
                    <select
                        value={phraseIndex || 'all'}
                        onChange={(e) => setPhraseIndex(e.target.value === 'all' ? null : e.target.value)}
                        style={styles.select}
                    >
                        <option value="all">Toutes les phrases</option>
                        {song.phrases.map((phrase, idx) => (
                            <option key={idx} value={idx}>
                                {phrase.name || `Phrase ${idx + 1}`}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={styles.buttonGroup}>
                <button
                    onClick={handlePreview}
                    disabled={isExporting}
                    style={styles.buttonPreview}
                >
                    {isExporting ? '⏳ Génération...' : '👁️ Prévisualiser'}
                </button>

                <button
                    onClick={handleExportSVG}
                    disabled={isExporting}
                    style={styles.button}
                >
                    {isExporting ? '⏳ Export...' : '💾 Exporter en SVG'}
                </button>

                <button
                    onClick={handleExportPNG}
                    disabled={isExporting}
                    style={styles.button}
                >
                    {isExporting ? '⏳ Export...' : '🖼️ Exporter en PNG'}
                </button>
            </div>

            {preview && (
                <div style={styles.previewSection}>
                    <h3 style={styles.previewTitle}>Prévisualisation</h3>
                    <div
                        ref={previewContainerRef}
                        style={styles.previewContainer}
                    />
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        padding: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: 'Arial, sans-serif',
    },
    title: {
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '20px',
        color: '#333',
    },
    optionsPanel: {
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
    },
    optionGroup: {
        marginBottom: '15px',
    },
    label: {
        display: 'block',
        fontWeight: '500',
        marginBottom: '5px',
        color: '#555',
    },
    checkbox: {
        marginRight: '8px',
    },
    select: {
        width: '100%',
        padding: '8px',
        fontSize: '14px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        backgroundColor: 'white',
        marginTop: '5px',
    },
    buttonGroup: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        marginBottom: '30px',
    },
    button: {
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: '500',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    buttonPreview: {
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: '500',
        backgroundColor: '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    previewSection: {
        marginTop: '30px',
        borderTop: '2px solid #ddd',
        paddingTop: '20px',
    },
    previewTitle: {
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '15px',
        color: '#333',
    },
    previewContainer: {
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '10px',
        backgroundColor: 'white',
        overflowX: 'auto',
    },
};

export default SheetMusicExporter;
