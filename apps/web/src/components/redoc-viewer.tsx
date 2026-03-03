'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Redoc?: {
      init: (specUrl: string, options?: Record<string, unknown>, element?: HTMLElement | null) => void;
    };
  }
}

export function RedocViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const mount = () => {
      if (cancelled || !window.Redoc || !containerRef.current) {
        return;
      }
      window.Redoc.init('/api/v1/openapi', {}, containerRef.current);
    };

    if (window.Redoc) {
      mount();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js';
    script.async = true;
    script.onload = mount;
    script.onerror = () => {
      if (!cancelled) {
        setError('Failed to load Redoc script. Check network access to cdn.redoc.ly.');
      }
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  return (
    <>
      {error ? <p className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <div ref={containerRef} className="min-h-[80vh]" />
    </>
  );
}
