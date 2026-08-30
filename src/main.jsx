import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { StudyProvider } from './context/StudyContext.jsx';
import { PracticeSessionProvider } from './context/PracticeSessionContext.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <StudyProvider>
        <PracticeSessionProvider>
          <App />
        </PracticeSessionProvider>
      </StudyProvider>
    </HashRouter>
  </React.StrictMode>,
);
