'use client'

import React, { useState } from 'react'
import { AlertCircle, Send, CheckCircle } from 'lucide-react'
import { useCreateTransactionComplaint } from '../hooks/useCreateTransactionComplaint'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

const ComplaintForm = () => {
  const params = useSearchParams()
  const trustapUser = params.get('buyerId')
  const transactionId = params.get('tx_id')
  console.log(trustapUser, transactionId)
//   console.log(buyerId, state)
//   const transactionId = '27377'
//   const trustapUser = '1-43941cfa-f517-4059-a6f4-a2c7a41c253b'
  const [description, setDescription] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  const { mutateAsync, isPending } = useCreateTransactionComplaint()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!transactionId || !trustapUser) {
      alert('Missing required URL parameters')
      return
    }

    try {
      await mutateAsync({
        buyer_id: trustapUser,
        transactionId,
        description,
      })

      setShowSuccess(true)
    } catch (err:any) {
        toast.error(err.response.data.error.error)
        console.log(err)
    //   console.error('Complaint failed:', err)
    }
  }

  const isFormValid = description.trim().length > 0

  if (showSuccess) {
    return (
      <div className="p-6 mt-42 max-w-xl mx-auto mt-10 bg-green-50 border border-green-200 rounded-xl shadow">
        <div className="flex flex-col items-center justify-center space-y-4 text-green-800">
          <CheckCircle className="w-10 h-10" />
          <h2 className="text-2xl font-semibold">Complaint Submitted Successfully</h2>
          <p className="text-center text-sm text-green-700">
            Your complaint has been received. We will review it within 24–48 hours and contact you if needed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-34">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">File a Complaint</h1>
            <p className="text-gray-600">Report an issue with your transaction</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Complaint Description *
              </label>
              <textarea
                id="description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe the issue with your transaction (e.g., Item was fake, Product not as described, etc.)"
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-vertical"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Be as detailed as possible to help us resolve your issue quickly
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">What happens next?</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Your complaint will be reviewed within 24–48 hours</li>
                <li>• You'll receive email updates on the status</li>
                <li>• Our support team may contact you for additional information</li>
                <li>• We'll work to resolve the issue fairly for both parties</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || isPending}
              className={`w-full py-4 px-6 rounded-lg font-medium flex items-center justify-center gap-3 transition-all duration-200 ${isFormValid && !isPending
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
            >
              {isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting Complaint...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Complaint
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Need immediate help? Contact our support team at</p>
            <a href="mailto:support@trustap.com" className="text-blue-600 hover:text-blue-700 font-medium">
              support@trustap.com
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ComplaintForm
