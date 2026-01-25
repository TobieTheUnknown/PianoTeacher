import React from 'react';

/**
 * ErrorBoundary - Composant pour gérer les erreurs React
 * Empêche l'application de crasher complètement en cas d'erreur
 *
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  // eslint-disable-next-line no-unused-vars
  static getDerivedStateFromError(error) {
    // Met à jour le state pour afficher l'UI de fallback
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log l'erreur pour debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Mettre à jour le state avec les détails de l'erreur
    this.setState({
      error,
      errorInfo
    });

    // Vous pouvez aussi envoyer l'erreur à un service de monitoring
    // comme Sentry, LogRocket, etc.
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // Recharger la page si le reset simple ne fonctionne pas
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // UI de fallback personnalisée
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          padding: '2rem'
        }}>
          <div style={{
            maxWidth: '600px',
            width: '100%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>
              😢
            </div>

            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '1rem'
            }}>
              Oups ! Une erreur est survenue
            </h2>

            <p style={{
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem',
              lineHeight: '1.6'
            }}>
              Quelque chose s'est mal passé. L'application a rencontré une erreur inattendue.
            </p>

            {/* Détails de l'erreur en mode développement */}
            {import.meta.env.DEV && this.state.error && (
              <details style={{
                textAlign: 'left',
                marginBottom: '1.5rem',
                background: 'var(--bg-tertiary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  Détails de l'erreur (développement)
                </summary>

                <div style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  marginTop: '0.5rem'
                }}>
                  <strong>Erreur:</strong>
                  <br />
                  {this.state.error.toString()}
                  <br />
                  <br />
                  <strong>Stack trace:</strong>
                  <br />
                  {this.state.errorInfo?.componentStack}
                </div>
              </details>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all var(--transition-normal)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Réessayer
              </button>

              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all var(--transition-normal)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                }}
              >
                Recharger la page
              </button>
            </div>

            {this.props.showBackButton !== false && (
              <button
                onClick={() => window.history.back()}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: 'none',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                ← Retour
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Wrapper fonctionnel pour ErrorBoundary
 * Permet d'utiliser des hooks dans le parent
 */
export function withErrorBoundary(Component, errorBoundaryProps = {}) {
  return function WithErrorBoundaryComponent(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
