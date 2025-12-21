import React, { useState } from 'react';

export function Partition({ song, onUpdateMetadata }) {
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(song.partitionPdfUrl || null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Veuillez sélectionner un fichier PDF');
            return;
        }

        // Create object URL for preview
        const url = URL.createObjectURL(file);
        setPdfUrl(url);
        setPdfFile(file);

        // Store the file name in song metadata
        onUpdateMetadata({ partitionPdfUrl: url, partitionFileName: file.name });
    };

    const handleRemovePdf = () => {
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
        }
        setPdfUrl(null);
        setPdfFile(null);
        onUpdateMetadata({ partitionPdfUrl: null, partitionFileName: null });
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
                                disabled
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '1rem',
                                    cursor: 'not-allowed',
                                    opacity: 0.6
                                }}
                            >
                                <span style={{ fontSize: '1.2rem' }}>⚙️</span>
                                <span>Bientôt disponible</span>
                            </button>
                            <p style={{
                                marginTop: '1rem',
                                fontSize: '0.85rem',
                                color: 'var(--text-tertiary)',
                                fontStyle: 'italic',
                                textAlign: 'center'
                            }}>
                                Cette fonctionnalité sera ajoutée prochainement
                            </p>
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
