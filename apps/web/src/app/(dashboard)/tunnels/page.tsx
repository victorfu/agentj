import { Suspense } from 'react';
import { TunnelsPage } from '@/components/tunnels-page';

export default function TunnelsRoute() {
  return (
    <Suspense>
      <TunnelsPage />
    </Suspense>
  );
}
