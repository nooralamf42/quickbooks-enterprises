import toast from "react-hot-toast"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"


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
      let decodedString = paymentBase64;
      
      const customFormatRegex = /^([0-9a-z]+)([SGPDF])([0-9a-z]+)K([0-9a-z]+)M([0-9a-z]+)$/i;
      const match = decodedString.match(customFormatRegex);

      // If it doesn't contain a dash and doesn't match the new custom format, it must be base64 encoded
      if (!match && !paymentBase64.includes('-')) {
        try {
          decodedString = atob(paymentBase64);
        } catch (e) {
          // fallback
        }
      }

      let parsed: any;
      if (match) {
        const reverseMap: Record<string, string> = { S: 'silver', G: 'gold', P: 'platinum', D: 'diamond', F: 'fsp' };
        parsed = {
          user: parseInt(match[1], 36),
          edition: reverseMap[match[2].toUpperCase()] || 'silver',
          year: parseInt(match[3], 36),
          disc: parseInt(match[4], 36) / 100,
          total: parseInt(match[5], 36) / 100,
          time: Date.now()
        };
      } else if (decodedString.startsWith('{')) {
        parsed = JSON.parse(decodedString)
      } else {
        const parts = decodedString.split('-')
        if (parts.length >= 5) {
          const reverseMap: Record<string, string> = { s: 'silver', g: 'gold', p: 'platinum', d: 'diamond', f: 'fsp' };
          parsed = {
            user: parseInt(parts[0]),
            edition: reverseMap[parts[1]] || parts[1],
            year: parseInt(parts[2]),
            disc: parseFloat(parts[3]),
            total: parseFloat(parts[4]),
            time: parts.length >= 6 ? parseInt(parts[5]) : Date.now()
          }
        } else {
          throw new Error('Invalid format')
        }
      }
      
      console.log(parsed)
      setPaymentObj({...parsed, total: parsed.total*100})
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
