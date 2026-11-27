import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import './studio.css';

const isButterflyRoute = window.location.pathname === '/butterfly' || window.location.pathname === '/butterfly/';
const Experience = isButterflyRoute
  ? lazy(() => import('./Butterfly3D'))
  : lazy(() => import('./StudioRoot'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0815' }} />}>
      <Experience />
    </Suspense>
  </React.StrictMode>,
);
