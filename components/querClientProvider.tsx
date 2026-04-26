'use client';

import { QueryClient, QueryClientProvider as Provider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryClientProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <Provider client={queryClient}>
      {children}
    </Provider>
  );
}