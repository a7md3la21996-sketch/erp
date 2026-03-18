import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// ── Clear old mock data (one-time migration) ──────────────────────
const DATA_VERSION = 'v2_clean';
if (localStorage.getItem('platform_data_version') !== DATA_VERSION) {
  const keysToKeep = ['platform_system_config', 'platform_data_version', 'theme', 'i18nextLng'];
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key.startsWith('platform_') && !keysToKeep.includes(key)) {
      localStorage.removeItem(key);
    }
  });
  localStorage.setItem('platform_data_version', DATA_VERSION);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
