import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import './studio.css';

const isStudioRoute = window.location.pathname === '/studio' || window.location.pathname.startsWith('/studio/');
const Experience = isStudioRoute
  ? lazy(() => import('./StudioRoot'))
  : lazy(() => import('./Butterfly3D'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0815' }} />}>
      <Experience />
    </Suspense>
  </React.StrictMode>,
);
