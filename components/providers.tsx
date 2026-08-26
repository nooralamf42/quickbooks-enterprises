// ./components/providers.js
'use client'

import { Provider } from 'jotai'
import { PropsWithChildren } from 'react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import QueryClientProvider from './querClientProvider'

const Providers = ({ children }: PropsWithChildren) => {
  return (
    <NuqsAdapter>
      <Provider>
        <QueryClientProvider>
          {children}
        </QueryClientProvider>
      </Provider>
    </NuqsAdapter>
  )
}

export default Providers;


