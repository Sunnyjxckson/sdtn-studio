import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/archivo-black/400.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/caveat/700.css';
import './styles.css';
import App from './App';
import { blockPageGestures } from './touch';
import { useStore } from './store';
import { feetOf } from './model/figure';

blockPageGestures();
// dev only: lets browser tests drive the store
if (import.meta.env.DEV) Object.assign(window, { __sdtn: useStore, __feet: feetOf });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
