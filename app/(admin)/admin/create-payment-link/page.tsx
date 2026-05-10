"use client"

import { useAdmin } from '@/app/hooks/useAdmin'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export default function QuickBooksPaymentLinkCreator() {
  const [users, setUsers] = useState(1)
  const [totalPrice, setTotalPrice] = useState('')
  const [selectedEdition, setSelectedEdition] = useState('silver')
  const [selectedYears, setSelectedYears] = useState(1)
  const [discountAmount, setDiscountAmount] = useState('')
  const [paymentLink, setPaymentLink] = useState('')

  const router = useRouter()
  const { admin } = useAdmin()

  useEffect(() => {
    if (!admin) {
      router.push('/admin')
    }
  }, [router, admin])

  useEffect(() => {
    setPaymentLink('')
  }, [users, totalPrice, selectedEdition, selectedYears, discountAmount])

  const editions = [
    { name: 'Silver', value: 'silver' },
    { name: 'Gold', value: 'gold' },
    { name: 'Platinum', value: 'platinum' },
    { name: 'Diamond', value: 'diamond' },
    { name: 'FSP', value: 'fsp' }
  ]

  const yearOptions = [
    { value: 1, label: '1 Year' },
    { value: 2, label: '2 Years' },
    { value: 3, label: '3 Years' }
  ]

  const calculateTotal = () => {
    const price = parseFloat(totalPrice) || 0
    const discount = parseFloat(discountAmount) || 0
    return Math.max(price - discount, 0)
  }

  const generatePaymentLink = () => {
    const price = parseFloat(totalPrice) || 0
    const discount = parseFloat(discountAmount) || 0

    if (discount > price) {
      toast.error('Discount cannot be greater than total price!')
      return
    }

    const paymentObj = {
      user: users,
      edition: selectedEdition,
      year: selectedYears,
      disc: Number(discountAmount) || 0,
      total: calculateTotal(),
      time: Date.now()
    }

    console.log(paymentObj)

    const base = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
    setPaymentLink(`${base}/checkout?payment=` + btoa(JSON.stringify(paymentObj)))
  }

  return (
    <div className="py-8">
      <div className="max-w-4xl mx-auto px-4 ">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Payment Link</h1>
          <p className="text-gray-600">Generate a custom payment link for QuickBooks Enterprise</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Config Form */}
          <div className="bg-white border p-6 rounded-lg shadow-[5px_5px_0px_0px_rgba(109,40,217)] space-y-6">
            <div>
              <label className="block mb-2 font-medium text-sm text-gray-700">Edition</label>
              <select
                value={selectedEdition}
                onChange={(e) => setSelectedEdition(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {editions.map((e) => (
                  <option key={e.value} value={e.value}>
                    QuickBooks Enterprise 24.0 {e.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 font-medium text-sm text-gray-700">Number of Users</label>
              <input
                type="number"
                min="1"
                value={users}
                onChange={(e) => setUsers(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium text-sm text-gray-700">Subscription Duration</label>
              <select
                value={selectedYears}
                onChange={(e) => setSelectedYears(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {yearOptions.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 font-medium text-sm text-gray-700">Total Price ($)</label>
              <input
                type="number"
                min="0"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium text-sm text-gray-700">Discount Amount ($)</label>
              <input
                type="number"
                min="0"
                value={discountAmount}
                onChange={(e) => {
                  const value = e.target.value
                  const discount = parseFloat(value) || 0
                  const price = parseFloat(totalPrice) || 0

                  if (discount > price) {
                    toast.error('Discount cannot be greater than total price!')
                    return
                  }

                  setDiscountAmount(value)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Summary + Actions */}
          <div className="space-y-6">
            <div className="bg-white p-6 border rounded-lg shadow-[5px_5px_0px_0px_rgba(109,40,217)]">
              <h3 className="font-semibold text-lg mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Edition:</span>
                  <span>QuickBooks 24.0 {selectedEdition === 'fsp' ? 'FSP' : selectedEdition.charAt(0).toUpperCase() + selectedEdition.slice(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Users:</span>
                  <span>{users}</span>
                </div>
                <div className="flex justify-between">
                  <span>Years:</span>
                  <span>{selectedYears}</span>
                </div>
                <div className="flex justify-between">
                  <span>Price:</span>
                  
                  <span>${(parseFloat(totalPrice) - parseFloat(discountAmount)) || '0.00'}</span>
                </div>
                {discountAmount && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span className="text-red-500">-${discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Total Price:</span>
                  <span>${totalPrice || '0.00'}</span>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="bg-white p-6 border rounded-lg shadow-[5px_5px_0px_0px_rgba(109,40,217)]">
              <h3 className="font-semibold text-lg mb-4">Actions</h3>
              {paymentLink ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={paymentLink}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(paymentLink)
                      toast.success('Copied!')
                    }}
                    className="px-4 py-2 bg-blue-600 cursor-pointer text-white rounded-md hover:bg-green-700 bg-green-500"
                  >
                    Copy
                  </button>
                </div>
              ) : (
                <button
                  onClick={generatePaymentLink}
                  disabled={!totalPrice || parseFloat(discountAmount) > parseFloat(totalPrice)}
                  className="w-full py-2 bg-green-500 cursor-pointer text-white rounded-md hover:bg-green-600 disabled:bg-gray-800 disabled:cursor-not-allowed"
                >
                  Generate Payment Link
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
