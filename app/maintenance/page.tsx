import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-red-200 rounded-xl shadow-lg p-8 text-center space-y-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 ">
          Not Available!
        </h1>
      </div>
    </div>
  );
}
