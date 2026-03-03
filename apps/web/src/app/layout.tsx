import type { Metadata, Viewport } from 'next';
import './styles.css';

export const viewport: Viewport = {
  themeColor: '#000000'
};

export const metadata: Metadata = {
  title: 'Agentj Control Plane',
  description: 'Control plane and dashboard for Agentj tunnel gateway',
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Agentj',
    statusBarStyle: 'default'
  },
  icons: {
    icon: [
      {
        url: '/icons/agentj-mark.svg',
        sizes: 'any'
      },
      {
        url: '/icons/favicon-16.png',
        sizes: '16x16',
        type: 'image/png'
      },
      {
        url: '/icons/favicon-32.png',
        sizes: '32x32',
        type: 'image/png'
      }
    ],
    apple: {
      url: '/icons/apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png'
    }
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
