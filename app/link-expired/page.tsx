'use client'

import { Clock } from 'lucide-react'
import Link from 'next/link'

const ExpiredPage = () => {
  return (
    <main className="mt-42 flex flex-col items-center justify-center px-6 text-center bg-white">
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center gap-4">
          <Clock className="w-16 h-16 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-800">Link Expired</h1>
          <p className="text-gray-600">
            Oops! This link is no longer valid. It may have expired or already been used.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block px-6 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition"
          >
            Go Back Home
          </Link>
        </div>
      </div>
    </main>
  )
}

export default ExpiredPage
