import toast from "react-hot-toast"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const LINK_EXPIRY_MINUTES = 30

const useParamPaymentDetails = ({ noLinkRedirection, enableToast, noLoginRedir }: { noLinkRedirection: boolean, enableToast: boolean, noLoginRedir?: boolean}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const paymentBase64 = searchParams.get('payment')
  const [paymentObj, setPaymentObj] = useState<any>(null)
  

  interface PaymentDetails {
    user: number,
    edition: string,
    year: number,
    disc: number,
    total: number,
    time: number
  }

  useEffect(() => {
    if (!paymentBase64) {
      if (enableToast) toast.error('No payment link found')
      setPaymentObj({ error: 'No payment link found' })
      if (!noLinkRedirection) router.push('/broken-link')
      return
    }

    try {
      const parsed = JSON.parse(atob(paymentBase64))
      console.log(parsed)
      setPaymentObj({...parsed, total: parsed.total*100})
      // ✅ Only push if needed — prevent redirect loop
      const timeDiff = Date.now() - parsed.time
      if(timeDiff > LINK_EXPIRY_MINUTES * 60 * 1000){
        if (enableToast) toast.error('Payment link expired')
        setPaymentObj({ error: 'Payment link expired' })
        if (!noLinkRedirection) router.push('/link-expired')
        return
      }
      if(!noLoginRedir) router.push('/login?payment=' + paymentBase64)

    } catch (error) {
      if (enableToast) toast.error('Invalid payment link')
      setPaymentObj({ error: 'Invalid payment link' })
      if (!noLinkRedirection) router.push('/broken-link')
    }
  }, [paymentBase64, router])

  return { paymentObj:paymentObj as PaymentDetails, paymentBase64 }
}

export default useParamPaymentDetails
