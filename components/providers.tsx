// ./components/providers.js
'use client'

import { Provider } from 'jotai'
import { PropsWithChildren } from 'react'
import QueryClientProvider from './querClientProvider'

const Providers = ({ children }: PropsWithChildren) => {
  return (
    <Provider>
      <QueryClientProvider>
        {children}
      </QueryClientProvider>
    </Provider>
  )
}

export default Providers;


