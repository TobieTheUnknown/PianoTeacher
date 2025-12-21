import React, { useState, useEffect } from 'react';
import { generatePartitionPDF } from '../services/PartitionGenerator';

export function Partition({ song, onUpdateMetadata }) {
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Convert base64 to blob URL on component mount
    useEffect(() => {
        if (song.partitionPdfUrl && song.partitionPdfUrl.startsWith('data:application/pdf')) {
            // If we have a base64 PDF, convert it to blob URL for display
            fetch(song.partitionPdfUrl)
                .then(res => res.blob())
                .then(blob => {
                    const url = URL.createObjectURL(blob);
                    setPdfUrl(url);
                })
                .catch(err => console.error('Error loading PDF:', err));
        }

        // Cleanup blob URLs on unmount
        return () => {
            if (pdfUrl && pdfUrl.startsWith('blob:')) {
                URL.revokeObjectURL(pdfUrl);
            }
        };
    }, [song.partitionPdfUrl]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Veuillez sélectionner un fichier PDF');
            return;
        }

        setPdfFile(file);

        // Convert PDF to base64 for persistence
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Pdf = event.target.result;

            // Store base64 in song metadata for persistence
            onUpdateMetadata({
                partitionPdfUrl: base64Pdf,
                partitionFileName: file.name
            });

            // Create blob URL for immediate display
            const blob = new Blob([file], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
        };
        reader.readAsDataURL(file);
    };

    const handleRemovePdf = () => {
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
        }
        setPdfUrl(null);
        setPdfFile(null);
        onUpdateMetadata({ partitionPdfUrl: null, partitionFileName: null });
    };

    const handleGeneratePDF = async () => {
        setIsGenerating(true);
        try {
            const result = await generatePartitionPDF(song);

            if (result.success) {
                // Store the generated PDF
                onUpdateMetadata({
                    partitionPdfUrl: result.pdfBase64,
                    partitionFileName: result.fileName
                });

                // Create blob URL for display
                fetch(result.pdfBase64)
                    .then(res => res.blob())
                    .then(blob => {
                        const url = URL.createObjectURL(blob);
                        setPdfUrl(url);
                    });
            } else {
                alert(`Erreur lors de la génération: ${result.error}`);
            }
        } catch (error) {
            console.error('Error generating partition:', error);
            alert('Une erreur est survenue lors de la génération de la partition');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="partition" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                textAlign: 'center',
                marginBottom: '3rem',
                padding: '2rem',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-color)'
            }}>
                <h2 style={{
                    fontSize: '2.5rem',
                    marginBottom: '0.5rem',
                    background: 'var(--gradient-primary)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                    📄 Partition
                </h2>
                <p style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    {song.title}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    Uploadez votre partition PDF ou générez-la automatiquement
                </p>
            </div>

            {/* Upload Section */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: pdfUrl ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {!pdfUrl ? (
                    <>
                        {/* Upload Card */}
                        <div className="card" style={{ padding: '2rem' }}>
                            <h3 style={{
                                color: 'var(--accent-primary)',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ fontSize: '1.5rem' }}>📤</span>
                                Uploader une partition PDF
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                                Importez votre propre partition en format PDF pour la consulter facilement pendant vos sessions de pratique.
                            </p>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileUpload}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        opacity: 0,
                                        cursor: 'pointer',
                                        zIndex: 10
                                    }}
                                />
                                <button style={{
                                    width: '100%',
                                    background: 'var(--gradient-primary)',
                                    color: 'white',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '1rem',
                                    boxShadow: 'var(--shadow-glow)'
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>📁</span>
                                    <span>Choisir un fichier PDF</span>
                                </button>
                            </div>
                        </div>

                        {/* Generate Card */}
                        <div className="card" style={{
                            padding: '2rem',
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
                            border: '2px dashed var(--border-color)'
                        }}>
                            <h3 style={{
                                color: 'var(--accent-primary)',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ fontSize: '1.5rem' }}>🎼</span>
                                Générer automatiquement
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                                Créez une partition à partir de votre fichier MIDI. La partition sera générée avec les bonnes notes et rythmes.
                            </p>
                            <button
                                onClick={handleGeneratePDF}
                                disabled={isGenerating || song.phrases.length === 0}
                                style={{
                                    width: '100%',
                                    background: isGenerating || song.phrases.length === 0
                                        ? 'var(--bg-elevated)'
                                        : 'var(--gradient-primary)',
                                    color: isGenerating || song.phrases.length === 0
                                        ? 'var(--text-secondary)'
                                        : 'white',
                                    border: isGenerating || song.phrases.length === 0
                                        ? '1px solid var(--border-color)'
                                        : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '1rem',
                                    cursor: isGenerating || song.phrases.length === 0
                                        ? 'not-allowed'
                                        : 'pointer',
                                    opacity: isGenerating || song.phrases.length === 0
                                        ? 0.6
                                        : 1,
                                    boxShadow: isGenerating || song.phrases.length === 0
                                        ? 'none'
                                        : 'var(--shadow-glow)'
                                }}
                            >
                                <span style={{ fontSize: '1.2rem' }}>
                                    {isGenerating ? '⏳' : '🎼'}
                                </span>
                                <span>
                                    {isGenerating ? 'Génération en cours...' : 'Générer la partition'}
                                </span>
                            </button>
                            {song.phrases.length === 0 && (
                                <p style={{
                                    marginTop: '1rem',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-tertiary)',
                                    fontStyle: 'italic',
                                    textAlign: 'center'
                                }}>
                                    Importez d'abord un fichier MIDI dans l'éditeur
                                </p>
                            )}
                        </div>
                    </>
                ) : (
                    /* PDF Viewer */
                    <div className="card" style={{ padding: '2rem' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1.5rem'
                        }}>
                            <h3 style={{
                                color: 'var(--accent-primary)',
                                margin: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ fontSize: '1.5rem' }}>📄</span>
                                {song.partitionFileName || 'Partition'}
                            </h3>
                            <button
                                onClick={handleRemovePdf}
                                style={{
                                    background: 'var(--gradient-danger)',
                                    color: 'white',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <span>🗑️</span>
                                <span>Supprimer</span>
                            </button>
                        </div>

                        {/* PDF Preview */}
                        <div style={{
                            width: '100%',
                            height: '800px',
                            border: '2px solid var(--border-color)',
                            borderRadius: 'var(--radius-lg)',
                            overflow: 'hidden',
                            background: 'var(--bg-primary)'
                        }}>
                            <iframe
                                src={pdfUrl}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                                title="Partition PDF"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Tips */}
            <div className="card" style={{
                padding: '2rem',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                border: '2px solid var(--accent-primary)'
            }}>
                <h3 style={{
                    color: 'var(--accent-primary)',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span style={{ fontSize: '1.5rem' }}>💡</span>
                    Conseils pour les partitions
                </h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1rem'
                }}>
                    <TipCard
                        icon="📱"
                        text="Utilisez un PDF clair et bien scanné pour une meilleure lisibilité"
                    />
                    <TipCard
                        icon="🎹"
                        text="Combinez la partition avec Live Learning pour une pratique optimale"
                    />
                    <TipCard
                        icon="💾"
                        text="N'oubliez pas de sauvegarder après avoir uploadé votre partition"
                    />
                    <TipCard
                        icon="🔄"
                        text="Vous pouvez remplacer la partition à tout moment"
                    />
                </div>
            </div>
        </div>
    );
}

// Helper component for tips
function TipCard({ icon, text }) {
    return (
        <div style={{
            display: 'flex',
            gap: '0.75rem',
            padding: '1rem',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)'
        }}>
            <span style={{ fontSize: '1.5rem' }}>{icon}</span>
            <span style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{text}</span>
        </div>
    );
}
