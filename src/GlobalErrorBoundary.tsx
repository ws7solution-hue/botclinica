import React from 'react';

// Error Boundary global — evita tela branca total em caso de erro não
// tratado em qualquer parte do app (ex: crash em algum componente por
// causa de uma API não suportada em determinado navegador/dispositivo).
// Sem isso, um erro em qualquer lugar (mesmo pequeno) derruba o app
// inteiro e o usuário fica com uma tela branca, sem entender o motivo.
export default class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state: { hasError: boolean } = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error('GlobalErrorBoundary capturou um erro:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#0B1120',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>
            Ops, algo deu errado
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: 0, maxWidth: 320 }}>
            Ocorreu um erro inesperado. Tenta recarregar a página — seus dados estão salvos e não serão perdidos.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              background: '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
