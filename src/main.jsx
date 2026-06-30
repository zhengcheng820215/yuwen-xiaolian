import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { StudyProvider } from './context/StudyContext.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <StudyProvider>
        <App />
      </StudyProvider>
    </HashRouter>
  </React.StrictMode>,
);
