import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import DoctorPortalApp from './components/DoctorPortalApp.tsx';
import GlobalErrorBoundary from './GlobalErrorBoundary.tsx';
import './index.css';

// A mesma pasta "app/" serve dois pontos de entrada diferentes:
// /app (painel da clínica/secretária) e /prontuario (portal do médico).
// Como ambos usam o mesmo bundle JS, decidimos qual renderizar aqui,
// olhando o caminho da URL — sem precisar de um segundo build separado.
const isDoctorPortal = window.location.pathname.startsWith('/prontuario');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      {isDoctorPortal ? <DoctorPortalApp /> : <App />}
    </GlobalErrorBoundary>
  </StrictMode>,
);
