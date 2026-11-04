import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// EDGE CASE: document.getElementById('root') may return null if container is missing or script runs before DOM mounts, throwing TypeError
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
