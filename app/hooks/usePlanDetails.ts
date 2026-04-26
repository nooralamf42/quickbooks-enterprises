import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"

export const PLANS = {
  foundation: {
    name: "Foundation",
    price: 2499,
    description: "Perfect for landing pages and personal portfolios",
    features: [
      "Lightning-fast performance",
      "Fully responsive design",
      "SEO optimized",
      "One-time setup",
      "Hosting support included"
    ]
  },
  growth: {
    name: "Growth",
    price: 2499,
    popular: true,
    description: "Ideal for blogs and dynamic business websites",
    features: [
      "All features of Static Website",
      "Dynamic CMS integration",
      "Admin dashboard for content",
      "Scalable structure",
      "SEO + performance tuned"
    ]
  },
  enterprise: {
    name: "Enterprise",
    price: 6999,
    description: "Tailored for complex, scalable, or branded projects",
    features: [
      "Everything in CMS Plan",
      "Custom animations and effects",
      "API & 3rd-party integrations",
      "Brand identity design",
      "Priority support"
    ]
  }
}

export type PlanData = {
    name: string;
    price: number;
    description: string;
    features: string[];
    popular?: boolean;
}

const usePlanDetails = ({ noLinkRedirection, enableToast, noLoginRedir }: { noLinkRedirection?: boolean, enableToast?: boolean, noLoginRedir?: boolean} = {}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const planParam = searchParams.get('plan')
  const [planObj, setPlanObj] = useState<PlanData | null>(null)

  useEffect(() => {
    if (!planParam) {
      if (enableToast) toast.error('No plan selected')
      if (!noLinkRedirection) router.push('/broken-link')
      return
    }

    const planKey = planParam.toLowerCase() as keyof typeof PLANS;
    if (PLANS[planKey]) {
      setPlanObj(PLANS[planKey]);
      if(!noLoginRedir) router.push('/login?plan=' + planParam)
    } else {
      if (enableToast) toast.error('Invalid plan selected')
      if (!noLinkRedirection) router.push('/broken-link')
    }
  }, [planParam, router, enableToast, noLinkRedirection, noLoginRedir])

  return { planObj, planParam }
}

export default usePlanDetails
