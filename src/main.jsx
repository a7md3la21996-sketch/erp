import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// ── Clear legacy localStorage data (Supabase is now the only source of truth) ──
const DATA_VERSION = 'v3_supabase_only';
if (localStorage.getItem('platform_data_version') !== DATA_VERSION) {
  const keysToKeep = new Set([
    'platform_system_config', 'platform_data_version',
    'platform_theme_config', 'theme', 'i18nextLng',
    'platform_sync_queue', 'platform_queue_lock',
    'sidebar-collapsed', 'platform_push_dismissed',
    'platform_tour_completed', 'chunk_reload',
  ]);
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key.startsWith('platform_') && !keysToKeep.has(key)) {
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
