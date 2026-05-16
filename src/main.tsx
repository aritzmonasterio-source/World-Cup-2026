import {Component, StrictMode, type ErrorInfo, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Mundial 2026 render error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#07131a] text-white flex items-center justify-center px-6 text-center">
        <div className="max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#0f8f74] mb-3">Mundial 2026</p>
          <h1 className="text-2xl font-black uppercase leading-none mb-4">Vamos a recargar</h1>
          <p className="text-sm text-white/70 leading-relaxed mb-6">
            La app ha recibido una actualización. Pulsa recargar para limpiar la versión antigua del navegador.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-lg bg-[#0f8f74] px-5 py-4 text-xs font-black uppercase tracking-widest text-white"
          >
            Recargar app
          </button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.update())
      .catch(() => undefined);
  });
}
