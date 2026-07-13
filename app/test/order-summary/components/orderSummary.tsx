'use client'

import useParamPaymentDetails from "@/app/hooks/useParamPaymentDetails"
import { useSteps } from "@/app/hooks/useSteps"
import React from "react"
import { PhotoProvider, PhotoView } from 'react-photo-view'
import 'react-photo-view/dist/react-photo-view.css'
import Loader from "@/components/loader"

export default function OrderSummary() {
  const { step } = useSteps()
  const { paymentObj } = useParamPaymentDetails({
    enableToast: false,
    noLinkRedirection: true,
    noLoginRedir: true,
  })

  if (paymentObj == null) return <Loader/>

  const { edition, year, total, user, disc, isService, serviceName } = paymentObj

  if (isService) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Summary</h2>

        <div className="space-y-4">
          <div className="flex justify-center p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
            <img src="/quickbooks_logo.png" alt="Service Logo" className="max-h-16 object-contain" />
          </div>

          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium text-gray-900">
                {serviceName}
              </h3>
              <div className="text-sm text-blue-600 space-x-1 mt-1 font-medium">
                <span>Custom Service Development</span>
              </div>
            </div>

            <div className="text-right">
              <p className="font-semibold text-gray-900">${(total / 100) + disc}</p>
            </div>
          </div>

          {disc > 0 && (
            <div className="border border-dashed border-green-400 rounded-md bg-green-50 p-4 mt-4">
              <p className="text-sm text-green-700 font-medium">Discount Applied</p>
              <div className="mt-1 text-sm text-gray-800">
                <p>
                  💸 You saved <strong>${disc}</strong> today.
                </p>
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total due today</span>
              <span className="text-lg font-bold text-gray-900">${total / 100}</span>
            </div>
          </div>

        </div>
      </div>
    )
  }

  // Fallback for standard QuickBooks layout
  const displayEdition = edition && edition.toLowerCase() === 'fsp' ? 'FSP' : edition ? edition.charAt(0).toUpperCase() + edition.slice(1) : ''
  const imagePath = edition && year ? `/${edition.toLowerCase()}_${year}y.webp` : '/quickbooks_logo.png'

  return (
    <div className="bg-gray-50 rounded-lg p-6 shadow-md">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Summary</h2>

      <div className="space-y-4">
        <PhotoProvider>
          <PhotoView src={imagePath}>
            <img src={imagePath} alt="Product Image" />
          </PhotoView>
        </PhotoProvider>

        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-gray-900">
              QuickBooks Enterprise {displayEdition} Edition
            </h3>
            <div className="text-sm text-blue-600 space-x-1">
              <span>Edition: {displayEdition}</span>
              <span>|</span>
              <span>Users: {user}</span>
              <span>|</span>
              <span>Years: {year}</span>
            </div>
          </div>

          <div className="text-right">
            <p className="font-semibold text-gray-900">${(total / 100) + disc}</p>
          </div>
        </div>

        {disc > 0 && (
          <div className="border border-dashed border-green-400 rounded-md bg-green-50 p-4 mt-4">
            <p className="text-sm text-green-700 font-medium">Discount Applied</p>
            <div className="mt-1 text-sm text-gray-800">
              <p>
                💸 You saved <strong>${disc}</strong> today.
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total due today</span>
            <span className="text-lg font-bold text-gray-900">${total / 100}</span>
          </div>
        </div>

      </div>
    </div>
  )
}
