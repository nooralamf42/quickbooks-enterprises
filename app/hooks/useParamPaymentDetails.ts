import toast from "react-hot-toast"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"


export interface PaymentDetails {
  user?: number,
  edition?: string,
  year?: number,
  disc: number,
  total: number,
  gateway?: string,
  time: number,
  isService?: boolean,
  serviceName?: string
}

export const SERVICES = [
  { code: 'a', name: 'Strategic Mobile Consulting' },
  { code: 'b', name: 'Mobile Application Porting' },
  { code: 'c', name: 'Technology Outsourcing' },
  { code: 'd', name: 'UI/UX Design' },
  { code: 'e', name: 'Ecommerce App Development' },
  { code: 'f', name: 'Startup app development' },
  { code: 'g', name: 'Custom CRM Development' },
  { code: 'h', name: 'SaaS App Development' },
  { code: 'i', name: 'Offshore Development Center' },
  { code: 'j', name: 'Product Engineering Services' },
  { code: 'k', name: 'IT Staff Augmentation' },
  { code: 'l', name: 'Dedicated Development Team' },
  { code: 'm', name: 'PAYROLL' },
  { code: 'n', name: 'Outstanding Balance Payment' },
];

const useParamPaymentDetails = ({ noLinkRedirection, enableToast, noLoginRedir }: { noLinkRedirection: boolean, enableToast: boolean, noLoginRedir?: boolean}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const paymentBase64 = searchParams.get('token')
  const [paymentObj, setPaymentObj] = useState<any>(null)

  useEffect(() => {
    if (!paymentBase64) {
      if (enableToast) toast.error('No payment link found')
      setPaymentObj({ error: 'No payment link found' })
      if (!noLinkRedirection) router.push('/broken-link')
      return
    }

    try {
      let decodedString = paymentBase64;
      
      const customFormatRegex = /^([0-9a-z]+)([SGPDFX])([0-9a-z]+)K([0-9a-z]+)M([0-9a-z]+)(GA|GF|GS|GO|GT|GAP)?$/;
      const serviceFormatRegex = /^S([a-n])K([0-9a-z]+)M([0-9a-z]+)(GA|GF|GS|GO|GT|GAP)?$/;
      
      const match = decodedString.match(customFormatRegex);
      const matchService = decodedString.match(serviceFormatRegex);

      // If it doesn't contain a dash and doesn't match the custom formats, it must be base64 encoded
      if (!match && !matchService && !paymentBase64.includes('-')) {
        try {
          decodedString = atob(paymentBase64);
        } catch (e) {
          // fallback
        }
      }

      let parsed: any;
      if (matchService) {
        const serviceCode = matchService[1].toLowerCase();
        const serviceItem = SERVICES.find(s => s.code === serviceCode);
        parsed = {
          edition: serviceItem ? serviceItem.name : 'Unknown Service',
          isService: true,
          serviceName: serviceItem ? serviceItem.name : 'Unknown Service',
          disc: parseInt(matchService[2], 36) / 100,
          total: parseInt(matchService[3], 36) / 100,
          gateway: matchService[4] === 'GA' ? 'Authorize.net' : matchService[4] === 'GO' ? 'Online Payment' : matchService[4] === 'GAP' ? 'AsiaPay' : matchService[4] === 'GT' || matchService[4] === 'GS' ? 'Stripe' : 'FastSpring',
          time: Date.now()
        };
      } else if (match) {
        const reverseMap: Record<string, string> = { S: 'silver', G: 'gold', P: 'platinum', D: 'diamond', F: 'fsp', W: 'whop' };
        parsed = {
          user: parseInt(match[1], 36),
          edition: reverseMap[match[2].toUpperCase()] || 'silver',
          year: parseInt(match[3], 36),
          disc: parseInt(match[4], 36) / 100,
          total: parseInt(match[5], 36) / 100,
          gateway: match[6] === 'GA' ? 'Authorize.net' : match[6] === 'GO' ? 'Online Payment' : match[6] === 'GAP' ? 'AsiaPay' : match[6] === 'GT' || match[6] === 'GS' ? 'Stripe' : 'FastSpring',
          time: Date.now()
        };
      } else if (decodedString.startsWith('{')) {
        parsed = JSON.parse(decodedString)
      } else {
        const parts = decodedString.split('-')
        if (parts.length >= 5) {
          const reverseMap: Record<string, string> = { s: 'silver', g: 'gold', p: 'platinum', d: 'diamond', f: 'fsp', w: 'whop' };
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
      
      if (!noLoginRedir) {
        const isTestRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/test');
        const loginPath = isTestRoute ? '/test/login' : '/auth';
        router.push(loginPath + '?token=' + paymentBase64)
      }

    } catch (error) {
      if (enableToast) toast.error('Invalid payment link')
      setPaymentObj({ error: 'Invalid payment link' })
      if (!noLinkRedirection) router.push('/broken-link')
    }
  }, [paymentBase64, router])

  return { paymentObj:paymentObj as PaymentDetails, paymentBase64 }
}

export default useParamPaymentDetails

