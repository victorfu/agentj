import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Agentj Control Plane',
  description: 'Control plane and dashboard for Agentj tunnel gateway'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
