import { RedocViewer } from '@/components/redoc-viewer';

export default function DocsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-12 pt-8 sm:px-6">
      <RedocViewer />
    </main>
  );
}
