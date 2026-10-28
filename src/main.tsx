import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA (Install to Android Homescreen)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.info('[PWA] ServiceWorker registration skipped:', err?.message);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
