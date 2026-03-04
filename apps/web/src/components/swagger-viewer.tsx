'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => void;
  }
}

export function SwaggerViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const mount = () => {
      if (cancelled || !window.SwaggerUIBundle || !containerRef.current) {
        return;
      }
      window.SwaggerUIBundle({
        url: '/api/v1/openapi',
        domNode: containerRef.current,
        deepLinking: true
      });
    };

    // Load CSS
    if (!document.querySelector('link[href*="swagger-ui"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/swagger-ui-dist/swagger-ui.css';
      document.head.appendChild(link);
    }

    // Load JS
    if (window.SwaggerUIBundle) {
      mount();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js';
    script.async = true;
    script.onload = mount;
    script.onerror = () => {
      if (!cancelled) {
        setError('Failed to load Swagger UI script. Check network access to unpkg.com.');
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
      <div ref={containerRef} className="min-h-[100vh] bg-white text-[#3b4151]" />
    </>
  );
}
