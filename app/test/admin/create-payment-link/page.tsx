"use client"

import { useAdmin } from '@/app/hooks/useAdmin'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { jsPDF } from 'jspdf'
import { ShieldCheck, FileText, RefreshCw, Layers, Link as LinkIcon, AlertCircle, Copy, Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { SERVICES } from '@/app/hooks/useParamPaymentDetails'

export default function TestPaymentLinkCreator() {
  const [users, setUsers] = useState(1)
  const [totalPrice, setTotalPrice] = useState('')
  const [selectedEdition, setSelectedEdition] = useState('silver')
  const [selectedYears, setSelectedYears] = useState(1)
  const [discountAmount, setDiscountAmount] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [selectedGateway, setSelectedGateway] = useState<'stax' | 'authorize'>('stax')
  
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<'create' | 'logs'>('create')
  
  // Consent Logs state
  const [logs, setLogs] = useState<any[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const logsPerPage = 5

  const router = useRouter()
  const { admin, setAdmin } = useAdmin()

  useEffect(() => {
    // Check if there is a valid session in localStorage to restore Jotai state on direct URL loads
    const stored = localStorage.getItem('adminAuth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const now = new Date().getTime();
        const ENCODED_ADMIN_PASS = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;

        if (parsed.expires > now && parsed.passwordHash && ENCODED_ADMIN_PASS) {
          const currentPassword = atob(ENCODED_ADMIN_PASS);
          const storedPassword = atob(parsed.passwordHash);
          
          if (storedPassword === currentPassword) {
            setAdmin(true);
            return;
          }
        }
      } catch (error) {
        console.error('Test auth verification failed:', error);
      }
    }

    if (!admin) {
      router.push('/admin')
    }
  }, [router, admin, setAdmin])

  useEffect(() => {
    setPaymentLink('')
    setCopiedLink(false)
  }, [users, totalPrice, selectedEdition, selectedYears, discountAmount])

  const fetchLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }
      
      const response = await fetch('/api/admin/consent-logs', {
        headers: {
          'Authorization': `Bearer ${passwordHash}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch consent logs')
      }
      
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to load logs')
    } finally {
      setIsLoadingLogs(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs()
    }
  }, [activeTab])

  const handleSimulatePayment = async () => {
    setIsSimulating(true)
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const response = await fetch('/api/admin/simulate-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Simulation failed')
      }

      toast.success('Simulated successful B2B payment!')
      fetchLogs()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Simulation failed')
    } finally {
      setIsSimulating(false)
    }
  }

  const productsAndServices = [
    { name: 'QuickBooks Enterprise 24.0 Silver', value: 'silver', type: 'qb' },
    { name: 'QuickBooks Enterprise 24.0 Gold', value: 'gold', type: 'qb' },
    { name: 'QuickBooks Enterprise 24.0 Platinum', value: 'platinum', type: 'qb' },
    { name: 'QuickBooks Enterprise 24.0 Diamond', value: 'diamond', type: 'qb' },
    { name: 'QuickBooks Enterprise 24.0 Stax', value: 'stax', type: 'qb' },
    ...SERVICES.map(s => ({ name: s.name, value: `service_${s.code}`, type: 'service' }))
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

    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const base = isLocalhost ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || window.location.origin);

    if (selectedEdition.startsWith('service_')) {
      const serviceCode = selectedEdition.replace('service_', '')
      const dVal = Math.round((Number(discountAmount) || 0) * 100)
      const dStr = dVal.toString(36)
      const tVal = Math.round(calculateTotal() * 100)
      const tStr = tVal.toString(36)
      
      const gatewayFlag = selectedGateway === 'authorize' ? 'GA' : 'GS'
      const paymentString = `S${serviceCode}K${dStr}M${tStr}${gatewayFlag}`
      setPaymentLink(`${base}/testpay/${paymentString}`)
    } else {
      const editionMap: Record<string, string> = { silver: 'S', gold: 'G', platinum: 'P', diamond: 'D', stax: 'X' }
      const shortEdition = editionMap[selectedEdition] || 'S'

      const uStr = users.toString(36)
      const yStr = selectedYears.toString(36)
      const dVal = Math.round((Number(discountAmount) || 0) * 100)
      const dStr = dVal.toString(36)
      const tVal = Math.round(calculateTotal() * 100)
      const tStr = tVal.toString(36)

      const gatewayFlag = selectedGateway === 'authorize' ? 'GA' : 'GS'
      const paymentString = `${uStr}${shortEdition}${yStr}K${dStr}M${tStr}${gatewayFlag}`
      setPaymentLink(`${base}/testpay/${paymentString}`)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink)
    setCopiedLink(true)
    toast.success('Payment link copied!')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const downloadPDF = (log: any) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const primaryColor = [44, 160, 28] // #2ca01c
      const darkColor = [33, 37, 41]
      const grayColor = [108, 117, 125]

      const firstInitial = log.firstName ? log.firstName.charAt(0).toUpperCase() : '';
      const lastInitial = log.lastName ? log.lastName.charAt(0).toUpperCase() : '';
      const initials = `${firstInitial}${lastInitial}`;
      const watermarkText = `Initial: ${initials}`;

      const drawWatermark = () => {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(75, 75, 75);
        doc.text(watermarkText, 198, 288, { align: 'right' });
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      };

      const termsText = `TERMS AND CONDITIONS
Last Updated: May 27, 2026

1. Introduction
Welcome to QB Enterprise ("Company," "we," "us," or "our"). We are a software development company providing custom software, licenses, subscriptions, and related development services ("Services"). By accessing or using our Services, you ("Customer," "you," or "your") agree to be bound by these Terms and Conditions ("Terms"). If you do not agree, do not use our Services.

2. Services
QB Enterprise develops, delivers, and supports software products including but not limited to:
- Custom software development
- Software as a Service (SaaS) subscriptions
- Perpetual software licenses
- Maintenance and support packages
- Consulting and integration services
Specific deliverables, timelines, and fees will be outlined in separate Statements of Work (SOW) or invoices.

3. Payment Terms
3.1 Fees
All fees for Services are due in full as stated in the applicable invoice or SOW. We accept payments via credit card, bank transfer, ACH, and Wire.

3.2 No Refunds
ALL SALES ARE FINAL. No refunds, credits, or exchanges will be issued for any reason, including but not limited to:
- Change of mind or business needs
- Underutilization of software
- Compatibility issues not previously disclosed in writing
- Delays in delivery caused by customer's failure to provide required information or cooperation
- Discontinuation of a product or feature
Once payment is made, the amount is non-refundable.

3.3 No Chargebacks
By accepting these Terms, you expressly agree NOT to initiate a chargeback with your bank or credit card issuer for any payment made to QB Enterprise. You acknowledge that a chargeback constitutes a material breach of these Terms.

4. Chargeback Liability and Legal Consequences
If you file a chargeback against any sale made by QB Enterprise:
1. Breach of Contract - The chargeback will be treated as a material breach of these Terms.
2. Immediate Obligation - You will immediately owe QB Enterprise the full amount of the disputed charge, plus any fees imposed on us by our payment processors.
3. Legal Consciousness - You acknowledge that filing a fraudulent or improper chargeback is a willful act with legal consequences.
4. Legal and Collection Costs - You agree to pay all costs incurred by QB Enterprise to recover the charged-back amount, including but not limited to:
   - Attorney fees (actual, not necessarily statutory)
   - Collection agency fees
   - Court costs
   - Arbitration fees
   - Any other costs related to enforcing this agreement
5. Reporting - We reserve the right to report chargeback abuse to credit reporting agencies or law enforcement.

5. Delivery and Acceptance
Software deliverables are deemed accepted upon delivery (electronic or physical). Any defects must be reported within 15 days of delivery, and our sole obligation shall be to attempt a fix at our discretion. Failure to report defects within this period constitutes final acceptance. Refunds remain prohibited even in the event of defects; our liability is limited to repair or replacement of the software at no additional cost.

6. Intellectual Property
All software, code, documentation, and related materials remain the intellectual property of QB Enterprise or its licensors. Customer receives only a non-exclusive, non-transferable license as described in the relevant SOW. No ownership rights are transferred.

7. Limitation of Liability
To the maximum extent permitted by law:
- QB Enterprise is not liable for any indirect, incidental, special, or consequential damages, including lost profits or data.
- Our total liability for any claim arising from these Terms or the Services shall not exceed the amount paid by you to us in the 12 months preceding the claim.
This limitation applies even if we have been advised of the possibility of such damages.

8. Governing Law and Dispute Resolution
These Terms shall be governed by the laws of Delaware, USA, without regard to conflict of laws principles.
Any dispute arising out of or relating to these Terms or the Services, including but not limited to chargeback disputes, shall be resolved exclusively through binding arbitration in accordance with the rules of the American Arbitration Association (AAA). The arbitration shall take place in Delaware, and judgment on the award may be entered in any court having jurisdiction. Notwithstanding the foregoing, QB Enterprise may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent or stop a chargeback or unauthorized use of its intellectual property.

9. Indemnification
You agree to indemnify, defend, and hold harmless QB Enterprise and its officers, employees, and agents from any claims, damages, losses, or expenses (including attorney fees) arising from:
- Your breach of these Terms (especially the no-chargeback provision)
- Your misuse of our software
- Any dispute between you and your payment provider regarding a chargeback

10. Severability
If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.

11. Amendments
QB Enterprise reserves the right to modify these Terms at any time. Continued use of our Services after changes constitutes acceptance of the new Terms. For one-time software purchases, the Terms in effect at the time of purchase apply.

12. Entire Agreement
These Terms, together with any SOW or invoice, constitute the entire agreement between you and QB Enterprise concerning the Services and supersede all prior agreements.

13. Contact Information
For questions about these Terms or to report a violation, contact:
QB Enterprise
Email: info@Qualitybusinesstech.us
Phone: (888) 829 8848
Address: 28 CHURCH ST, STE 14 #5838, WINCHESTER, MA, 01890

By making a payment to QB Enterprise, you acknowledge that you have read, understood, and agree to be bound by these Terms, including the no-refund and no-chargeback provisions and the liability for legal fees arising from a chargeback.`;

      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(22)
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.text('QB ENTERPRISE', 20, 25)

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

      const lines = doc.splitTextToSize(termsText, 160); 
      
      let cursorY = 40;
      const marginY = 280;

      drawWatermark();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line === 'TERMS AND CONDITIONS' || 
          /^[0-9]+\.\s[A-Z]/.test(line) || 
          /^[0-9]+\.[0-9]+\s[A-Z]/.test(line)
        ) {
          doc.setFont('Helvetica', 'bold');
          if (line === 'TERMS AND CONDITIONS') doc.setFontSize(14);
          else doc.setFontSize(10);
        } else {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(10);
        }

        doc.text(line, 20, cursorY);
        cursorY += 6;

        if (cursorY >= marginY && i < lines.length - 1) {
          doc.addPage();
          drawWatermark();
          cursorY = 20;
        }
      }

      doc.addPage();

      const drawDivider = (y: number) => {
        doc.setDrawColor(220, 224, 230)
        doc.setLineWidth(0.5)
        doc.line(20, y, 190, y)
      }

      doc.setFontSize(14)
      doc.setFont('Helvetica', 'bold')
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
      doc.text('CERTIFICATE OF CONSENT & PURCHASE AGREEMENT', 100, 35, { align: 'center' })
      
      drawDivider(42)

      doc.setFontSize(10)
      doc.setFont('Helvetica', 'bold')
      doc.text('ELECTRONIC SIGNATURE METADATA', 20, 50)

      doc.setFont('Helvetica', 'normal')
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
      
      const metaY = 57
      doc.text(`Consent Record ID:   ${log._id}`, 20, metaY)

      const guessTimeZone = (country: string, state: string) => {
        if (!state) return undefined;
        const c = (country || '').toUpperCase();
        if (c !== 'US' && c !== 'USA' && c !== 'UNITED STATES') return undefined;
        
        const st = state.toUpperCase().trim();
        const est = ['CT', 'DE', 'FL', 'GA', 'ME', 'MD', 'MA', 'MI', 'NH', 'NJ', 'NY', 'NC', 'OH', 'PA', 'RI', 'SC', 'VT', 'VA', 'WV', 'DC'];
        const cst = ['AL', 'AR', 'IL', 'IA', 'KS', 'KY', 'LA', 'MN', 'MS', 'MO', 'NE', 'ND', 'OK', 'SD', 'TN', 'TX', 'WI'];
        const mst = ['AZ', 'CO', 'ID', 'MT', 'NM', 'UT', 'WY'];
        const pst = ['CA', 'NV', 'OR', 'WA'];
        
        if (est.includes(st)) return 'America/New_York';
        if (cst.includes(st)) return 'America/Chicago';
        if (mst.includes(st)) return 'America/Denver';
        if (pst.includes(st)) return 'America/Los_Angeles';
        
        return undefined;
      };

      const tz = guessTimeZone(log.country, log.state);
      let timeString = '';
      if (tz) {
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
          });
          const locStr = log.city ? `${log.city}, ${log.state}` : log.state;
          timeString = `${formatter.format(new Date(log.agreedTimestamp))} (Local to ${locStr})`;
        } catch (e) {
          timeString = new Date(log.agreedTimestamp).toUTCString() + ' (UTC)';
        }
      } else {
        timeString = new Date(log.agreedTimestamp).toUTCString() + ' (UTC)';
      }

      doc.text(`Timestamp:          ${timeString}`, 20, metaY + 6)
      doc.text(`IP Address:         ${log.ipAddress}`, 20, metaY + 12)
      doc.text(`Device Type:        ${log.deviceType || 'Desktop'}`, 20, metaY + 18)
      doc.text(`Browser / Client:   ${log.browser || 'Unknown'}`, 20, metaY + 24)
      doc.text(`Consent Agreement:  AGREED (Terms & Privacy explicitly checked by client)`, 20, metaY + 30)
      
      drawDivider(metaY + 36)

      doc.setFont('Helvetica', 'bold')
      doc.text('CUSTOMER BILLING DETAILS', 20, metaY + 46)

      doc.setFont('Helvetica', 'normal')
      const profileY = metaY + 53
      doc.text(`Full Name:          ${log.firstName} ${log.lastName}`, 20, profileY)
      doc.text(`Email Address:      ${log.email}`, 20, profileY + 6)
      doc.text(`Company Name:       ${log.companyName || 'N/A'}`, 20, profileY + 12)
      doc.text(`Phone Number:       ${log.phone || 'N/A'}`, 20, profileY + 18)
      doc.text(`Street Address:     ${log.address}`, 20, profileY + 24)
      doc.text(`City & State:       ${log.city}, ${log.state}`, 20, profileY + 30)
      doc.text(`ZIP Code & Country: ${log.zipCode}, ${log.country || 'US'}`, 20, profileY + 36)

      drawDivider(profileY + 42)

      doc.setFont('Helvetica', 'bold')
      doc.text('ORDER & SUBSCRIPTION SUMMARY', 20, profileY + 52)

      doc.setFont('Helvetica', 'normal')
      const orderY = profileY + 59
      doc.text(`Product Name:       ${log.planDetails || 'QuickBooks Enterprise'}`, 20, orderY)
      doc.text(`Total Price:        $${log.amountUSD.toFixed(2)} USD`, 20, orderY + 6)
      doc.text(`Reconciliation:     ${log.status === 'Completed' ? 'Completed & Paid' : 'Pending Payment'}`, 20, orderY + 12)
      if (log.staxInvoiceId) {
        doc.text(`Stax Invoice ID:    ${log.staxInvoiceId}`, 20, orderY + 18)
      }

      doc.setFontSize(8)
      doc.setFont('Helvetica', 'oblique')
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
      const footerText = 'This certificate serves as legally binding digital evidence that the customer designated above explicitly agreed to the Terms of Service when initiating their payment. The electronic signature was recorded with client billing metadata, network details, and browser fingerprints.'
      
      const splitText = doc.splitTextToSize(footerText, 170)
      doc.text(splitText, 20, 260)

      doc.save(`Consent_Certificate_${log.lastName}_${log.firstName}.pdf`)
      toast.success('PDF Certificate downloaded!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    }
  }

  const totalPages = Math.ceil(logs.length / logsPerPage)
  const indexOfLastLog = currentPage * logsPerPage
  const indexOfFirstLog = indexOfLastLog - logsPerPage
  const currentLogs = logs.slice(indexOfFirstLog, indexOfLastLog)

  return (
    <div className="min-h-screen bg-zinc-50/50 py-6 md:py-10 text-zinc-950 font-sans antialiased">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              Test Admin Dashboard
            </h1>
            <p className="text-sm text-zinc-500 mt-1 font-normal">Generate custom services and QuickBooks invoice payment links for testing.</p>
          </div>
          
          <div className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-100 p-1 text-zinc-500 border border-zinc-200/50 w-full md:w-auto self-start md:self-auto font-medium">
            <button
              onClick={() => setActiveTab('create')}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-1.5 text-xs md:text-sm font-semibold transition-all cursor-pointer select-none ${activeTab === 'create' ? 'bg-white text-zinc-950 shadow-sm' : 'hover:text-zinc-900 text-zinc-500'}`}
            >
              <LinkIcon size={14} />
              Payment Links
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-1.5 text-xs md:text-sm font-semibold transition-all cursor-pointer select-none ${activeTab === 'logs' ? 'bg-white text-zinc-950 shadow-sm' : 'hover:text-zinc-900 text-zinc-500'}`}
            >
              <ShieldCheck size={14} className="text-[#2ca01c]" />
              Consent Logs
            </button>
          </div>
        </div>

        {activeTab === 'create' && (
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl shadow-xs p-6 md:p-8 space-y-6">
              
              <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
                <label className="block mb-2 font-medium text-xs text-zinc-500 uppercase tracking-wider">Payment Gateway</label>
                <div className="flex bg-white rounded-md border border-zinc-200 p-1">
                  <button
                    onClick={() => setSelectedGateway('stax')}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors ${selectedGateway === 'stax' ? 'bg-[#2ca01c] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Stax Payments
                  </button>
                  <button
                    onClick={() => setSelectedGateway('authorize')}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors ${selectedGateway === 'authorize' ? 'bg-[#0075ff] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Authorize.net
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                  <Layers size={16} className="text-zinc-400" />
                  Configure Invoice Tiers
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">Define custom services, user counts, editions, and pricing rules.</p>
              </div>
              
              <div className="border-t pt-5 border-zinc-100 space-y-5">
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">QuickBooks Edition / Service</label>
                  <select
                    value={selectedEdition}
                    onChange={(e) => {
                      setSelectedEdition(e.target.value)
                      if (e.target.value.startsWith('service_')) {
                        setSelectedGateway('stax')
                      }
                    }}
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c] cursor-pointer"
                  >
                    {productsAndServices.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!selectedEdition.startsWith('service_') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in duration-200">
                    <div>
                      <label className="block mb-1.5 font-medium text-xs text-zinc-500">Number of Users</label>
                      <input
                        type="number"
                        min="1"
                        value={users}
                        onChange={(e) => setUsers(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5 font-medium text-xs text-zinc-500">Contract Period</label>
                      <select
                        value={selectedYears}
                        onChange={(e) => setSelectedYears(parseInt(e.target.value))}
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c] cursor-pointer"
                      >
                        {yearOptions.map((y) => (
                          <option key={y.value} value={y.value}>{y.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block mb-1.5 font-semibold text-xs text-zinc-900">Price ($)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 3500"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[#2ca01c] bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 font-semibold"
                />
              </div>

              <div className="border-t border-zinc-100 pt-5">
                <label className="block mb-1.5 font-medium text-xs text-zinc-400">Discount ($) <span className="text-[10px] text-zinc-400 italic font-normal">(Optional secondary override)</span></label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 500"
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
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm text-zinc-500 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:border-zinc-300"
                />
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              
              <div className="bg-white border border-zinc-200 rounded-xl shadow-xs p-6 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Summary Preview</h3>
                
                <div className="space-y-3 text-xs border-t pt-3 border-zinc-100 font-medium">
                  {selectedEdition.startsWith('service_') ? (
                    <div className="flex justify-between text-zinc-500 animate-in fade-in duration-200">
                      <span>Service:</span>
                      <span className="text-zinc-900 font-semibold text-right max-w-[200px]">
                        {productsAndServices.find(p => p.value === selectedEdition)?.name}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div className="flex justify-between text-zinc-500">
                        <span>Edition:</span>
                        <span className="text-zinc-900 font-semibold">24.0 {selectedEdition === 'stax' ? 'Stax' : selectedEdition.charAt(0).toUpperCase() + selectedEdition.slice(1)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-500">
                        <span>User Count:</span>
                        <span className="text-zinc-900 font-semibold">{users} {users === 1 ? 'User' : 'Users'}</span>
                      </div>
                      <div className="flex justify-between text-zinc-500">
                        <span>Subscription Term:</span>
                        <span className="text-zinc-900 font-semibold">{selectedYears} {selectedYears === 1 ? 'Year' : 'Years'}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-500">
                    <span>Base Amount:</span>
                    <span className="text-zinc-900 font-semibold">${parseFloat(totalPrice || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {parseFloat(discountAmount) > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>Discount Override:</span>
                      <span className="text-red-500 font-semibold">-${parseFloat(discountAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center font-bold text-sm text-zinc-900 mt-4 pt-4 border-t border-zinc-100">
                    <span>Total Price:</span>
                    <span className="text-[#2ca01c] text-lg font-extrabold">${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl shadow-xs p-6 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Generate Link</h3>
                
                {paymentLink ? (
                  <div className="space-y-4">
                    <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-lg text-xs font-mono font-medium text-zinc-700 break-all select-all select-none">
                      {paymentLink}
                    </div>
                    
                    <button
                      onClick={handleCopyLink}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 font-bold rounded-lg text-xs transition-all cursor-pointer shadow-sm shadow-zinc-950/10"
                    >
                      {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      {copiedLink ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={generatePaymentLink}
                    disabled={!totalPrice || parseFloat(discountAmount) > parseFloat(totalPrice)}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-100 text-white disabled:text-zinc-400 font-semibold rounded-lg text-xs transition-all cursor-pointer shadow-sm disabled:cursor-not-allowed border border-zinc-950/10"
                  >
                    Generate Payment Link
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white border border-zinc-200 rounded-xl shadow-xs p-4 md:p-6 space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg text-zinc-900">Signed Consent Certificates</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Compliance records of B2B terms signatures logged in MongoDB.</p>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto font-medium">
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleSimulatePayment}
                    disabled={isSimulating}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50 shadow-xs border border-zinc-950/10"
                  >
                    <RefreshCw size={12} className={isSimulating ? 'animate-spin' : ''} />
                    {isSimulating ? 'Simulating...' : 'Simulate Payment'}
                  </button>
                )}
                <button
                  onClick={fetchLogs}
                  disabled={isLoadingLogs}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isLoadingLogs ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            {isLoadingLogs ? (
              <div className="py-24 flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-xs text-zinc-500 font-medium tracking-wide">Retrieving logs from database...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                <AlertCircle className="mx-auto text-zinc-400 mb-3" size={32} />
                <h4 className="font-semibold text-zinc-800 text-sm">No Logs Registered</h4>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1.5 px-4">Once B2B invoices are paid and customer signatures are verified, compliance logs will appear here.</p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider bg-zinc-50/50">
                        <th className="py-3.5 px-4 font-bold">Date & Time</th>
                        <th className="py-3.5 px-4 font-bold">Client Profile</th>
                        <th className="py-3.5 px-4 font-bold">Product & Amount</th>
                        <th className="py-3.5 px-4 font-bold">Network Signature</th>
                        <th className="py-3.5 px-4 font-bold">Status</th>
                        <th className="py-3.5 px-4 text-center font-bold">Certificate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-800">
                      {currentLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-zinc-50/40 transition-colors">
                          <td className="py-4 px-4 align-top whitespace-nowrap">
                            <span className="font-bold text-zinc-900 block">
                              {new Date(log.agreedTimestamp).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-medium block mt-0.5">
                              {new Date(log.agreedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </td>
                          <td className="py-4 px-4 align-top">
                            <div className="font-semibold text-zinc-950 text-sm">{log.firstName} {log.lastName}</div>
                            <div className="text-zinc-500 font-medium mt-0.5">{log.email}</div>
                            {log.companyName && <div className="text-[10px] font-semibold text-purple-700 mt-1 bg-purple-50 px-2 py-0.5 rounded-md inline-block">{log.companyName}</div>}
                            {log.phone && <div className="text-[10px] text-zinc-400 mt-1 font-medium">📞 {log.phone}</div>}
                            {log.address && (
                              <div className="text-[10px] text-zinc-500 mt-2 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200/60 leading-relaxed max-w-xs">
                                <span className="font-semibold text-zinc-700 block text-[9px] uppercase tracking-wider mb-0.5">Billing Address:</span>
                                {log.address}, {log.city}, {log.state} {log.zipCode}, {log.country}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 align-top">
                            <div className="font-extrabold text-[#2ca01c] text-sm">${log.amountUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed max-w-xs font-medium bg-zinc-50 p-1.5 rounded-lg border border-zinc-100">{log.planDetails}</div>
                          </td>
                          <td className="py-4 px-4 align-top">
                            <div className="font-mono text-[10px] text-zinc-950 font-bold bg-zinc-100 px-1.5 py-0.5 rounded inline-block">IP: {log.ipAddress}</div>
                            <div className="text-[10px] text-zinc-400 mt-2 flex flex-wrap gap-1.5 items-center font-medium">
                              <span className="px-1.5 py-0.5 bg-zinc-100 rounded text-[9px] font-semibold uppercase text-zinc-500 border border-zinc-200/50">{log.deviceType || 'Desktop'}</span>
                              <span className="truncate max-w-[120px]" title={log.browser}>{log.browser || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 align-top whitespace-nowrap">
                            {log.status === 'Completed' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                                <span className="w-1 h-1 rounded-full bg-green-600"></span>
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                                Pending
                              </span>
                            )}
                            {log.staxInvoiceId && (
                              <div className="text-[9px] font-semibold text-zinc-500 mt-2 font-mono bg-zinc-50 p-1 border border-zinc-100 rounded inline-block">
                                Stax: {log.staxInvoiceId}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 align-top text-center whitespace-nowrap">
                            <button
                              onClick={() => downloadPDF(log)}
                              disabled={log.status !== 'Completed'}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 font-bold rounded-lg text-[10px] transition-colors shadow-xs ${log.status === 'Completed' ? 'bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer' : 'bg-zinc-50 text-zinc-400 cursor-not-allowed opacity-60'}`}
                            >
                              <FileText size={12} className={log.status === 'Completed' ? 'text-zinc-500' : 'text-zinc-400'} />
                              PDF Consent
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
