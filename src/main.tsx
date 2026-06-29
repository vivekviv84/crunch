import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Global fetch interceptor to append CSRF tokens to state-changing requests
const { fetch: originalFetch } = window;
window.fetch = async (...args) => {
  let [resource, config] = args;
  config = config || {};
  const method = config.method ? config.method.toUpperCase() : "GET";
  
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    config.headers = config.headers || {};
    const match = document.cookie.match(/(^|;)\s*_csrf\s*=\s*([^;]+)/);
    const csrfToken = match ? match[2] : null;
    if (csrfToken) {
      if (config.headers instanceof Headers) {
        config.headers.set("X-CSRF-Token", csrfToken);
      } else if (Array.isArray(config.headers)) {
        config.headers.push(["X-CSRF-Token", csrfToken]);
      } else {
        (config.headers as any)["X-CSRF-Token"] = csrfToken;
      }
    }
  }
  return originalFetch(resource, config);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
