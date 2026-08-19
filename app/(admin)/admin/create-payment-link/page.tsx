"use client"

import { useAdmin } from '@/app/hooks/useAdmin'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { jsPDF } from 'jspdf'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { ShieldCheck, FileText, RefreshCw, Layers, Link as LinkIcon, AlertCircle, Copy, Check, CheckCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Filter, Eye, X, Search, Mail, MailWarning } from 'lucide-react'

export default function QuickBooksPaymentLinkCreator() {
  const [users, setUsers] = useState(1)
  const [totalPrice, setTotalPrice] = useState('')
  const [selectedEdition, setSelectedEdition] = useState('silver')
  const [selectedYears, setSelectedYears] = useState(1)
  const [discountAmount, setDiscountAmount] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [selectedGateway, setSelectedGateway] = useState<'authorize' | 'online' | 'stripe' | 'asiapay' | 'antom' | 'shopify'>('authorize')
  
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<'create' | 'logs' | 'email'>('create')
  
  // Consent Logs state
  const [logs, setLogs] = useState<any[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [filterMode, setFilterMode] = useState<'All' | 'Test'>('All')
  const [selectedLog, setSelectedLog] = useState<any>(null)
  
  // Advanced Filters
  const [advGateway, setAdvGateway] = useState('All')
  const [advStatus, setAdvStatus] = useState('All')
  const [advAmount, setAdvAmount] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const logsPerPage = 5

  // Send Email tab state
  const [emailType, setEmailType] = useState<'success' | 'failed'>('success')
  const [emailForm, setEmailForm] = useState({
    toEmail: '',
    customerName: '',
    companyName: '',
    orderId: '',
    planDetails: '',
    paymentMethodLabel: '',
    licenseNumber: '',
    productNumber: '',
    amountUSD: '',
    paidAt: new Date().toISOString().slice(0, 10),
    amountDueUSD: '',
    billingDate: new Date().toISOString().slice(0, 10),
    cancellationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  })
  const [isSendingCustomEmail, setIsSendingCustomEmail] = useState(false)
  const [reminderGateway, setReminderGateway] = useState<'' | 'authorize' | 'asiapay' | 'shopify'>('')
  const [planDetailsIsCustom, setPlanDetailsIsCustom] = useState(false)

  // Sent Emails history (emailLogs collection)
  const [emailLogsList, setEmailLogsList] = useState<any[]>([])
  const [isLoadingEmailLogs, setIsLoadingEmailLogs] = useState(false)
  const [selectedEmailLog, setSelectedEmailLog] = useState<any>(null)
  const [emailLogsPage, setEmailLogsPage] = useState(1)
  const emailLogsPerPage = 10

  const editions = [
    { name: 'Silver', value: 'silver' },
    { name: 'Gold', value: 'gold' },
    { name: 'Platinum', value: 'platinum' },
    { name: 'Diamond', value: 'diamond' },
    { name: 'FSP', value: 'fsp' }
  ]

  const customProducts = [
    { name: 'Strategic Mobile Consulting', value: 'a' },
    { name: 'Mobile Application Porting', value: 'b' },
    { name: 'Technology Outsourcing', value: 'c' },
    { name: 'UI/UX Design', value: 'd' },
    { name: 'Ecommerce App Development', value: 'e' },
    { name: 'Startup app development', value: 'f' },
    { name: 'Custom CRM Development', value: 'g' },
    { name: 'SaaS App Development', value: 'h' },
    { name: 'Offshore Development Center', value: 'i' },
    { name: 'Product Engineering Services', value: 'j' },
    { name: 'IT Staff Augmentation', value: 'k' },
    { name: 'Dedicated Development Team', value: 'l' },
    { name: 'PAYROLL', value: 'm' },
    { name: 'Outstanding Balance Payment', value: 'n' }
  ]

  // Unified product selection — drives both the "Plan / Product Details"
  // email text AND the "Update now" checkout link, exactly like the
  // Payment Links tab's selectedEdition/users/years combo.
  const [emailProductCode, setEmailProductCode] = useState('silver')
  const [emailUsers, setEmailUsers] = useState(1)
  const [emailYears, setEmailYears] = useState(1)
  const isEmailProductQbEdition = ['silver', 'gold', 'platinum', 'diamond', 'fsp'].includes(emailProductCode)

  const emailProductDisplayName = (() => {
    if (isEmailProductQbEdition) {
      const e = editions.find(ed => ed.value === emailProductCode)
      return `QuickBooks Enterprise ${e?.name || 'Silver'} Edition`
    }
    return customProducts.find(p => p.value === emailProductCode)?.name || ''
  })()

  const updateEmailForm = (field: string, value: string) => {
    setEmailForm(prev => ({ ...prev, [field]: value }))
  }

  // Keep the email's displayed "Plan / Product Details" text in sync with
  // the selected product, unless the admin has switched to custom text.
  useEffect(() => {
    if (!planDetailsIsCustom) {
      updateEmailForm('planDetails', emailProductDisplayName)
    }
  }, [emailProductCode, planDetailsIsCustom, emailProductDisplayName])

  // Builds the same encoded link the Payment Links tab produces — the QB
  // edition format (needs users/years) or the plain service-code format —
  // so "Update now" opens a real, working checkout for this exact amount,
  // product, and gateway.
  const buildUpdateLink = (amountUSD: number, gateway: 'authorize' | 'asiapay' | 'shopify') => {
    const gatewayFlag = gateway === 'authorize' ? 'GA' : gateway === 'shopify' ? 'GSH' : 'GAP'
    const tStr = Math.round(amountUSD * 100).toString(36)

    let paymentString: string
    if (isEmailProductQbEdition) {
      const editionMap: Record<string, string> = { silver: 'S', gold: 'G', platinum: 'P', diamond: 'D', fsp: 'F' }
      const shortEdition = editionMap[emailProductCode] || 'S'
      const uStr = emailUsers.toString(36)
      const yStr = emailYears.toString(36)
      paymentString = `${uStr}${shortEdition}${yStr}K0M${tStr}${gatewayFlag}`
    } else {
      paymentString = `S${emailProductCode}K0M${tStr}${gatewayFlag}`
    }

    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const base = isLocalhost ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || window.location.origin)
    return `${base}/invoice/${paymentString}`
  }

  const sendCustomEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSendingCustomEmail(true)
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const payload: any = {
        type: emailType,
        toEmail: emailForm.toEmail,
        customerName: emailForm.customerName,
        companyName: emailForm.companyName,
        orderId: emailForm.orderId,
        planDetails: emailForm.planDetails,
        paymentMethodLabel: emailForm.paymentMethodLabel,
      }

      if (isEmailProductQbEdition) {
        payload.numUsers = emailUsers
        payload.contractYears = emailYears
      }

      if (emailType === 'success') {
        payload.amountUSD = emailForm.amountUSD
        payload.paidAt = emailForm.paidAt
        payload.licenseNumber = emailForm.licenseNumber
        payload.productNumber = emailForm.productNumber
      } else {
        payload.amountDueUSD = emailForm.amountDueUSD
        payload.billingDate = emailForm.billingDate
        payload.cancellationDate = emailForm.cancellationDate
        if (reminderGateway && emailForm.amountDueUSD) {
          payload.updateUrl = buildUpdateLink(Number(emailForm.amountDueUSD), reminderGateway)
        }
      }

      const response = await fetch('/api/admin/send-custom-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Send failed')
      }

      toast.success(emailType === 'success' ? 'Receipt email sent!' : 'Payment reminder sent!')
      fetchEmailLogs()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to send email')
    } finally {
      setIsSendingCustomEmail(false)
    }
  }

  const router = useRouter()
  const { admin } = useAdmin()

  useEffect(() => {
    if (!admin) {
      router.push('/admin')
    }
  }, [router, admin])

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
      
      const response = await fetch('/api/admin/consent-logs?includeEvents=true', {
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
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

  const fetchEmailLogs = async () => {
    setIsLoadingEmailLogs(true)
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const response = await fetch('/api/admin/email-logs', {
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch email logs')
      }

      const data = await response.json()
      setEmailLogsList(data.logs || [])
      setEmailLogsPage(1)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to load sent emails')
    } finally {
      setIsLoadingEmailLogs(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'email') {
      fetchEmailLogs()
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
  const deleteTestLogs = async () => {
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const response = await fetch('/api/admin/delete-test-logs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Deletion failed')
      }

      toast.success('Test logs deleted successfully!')
      fetchLogs()
      setSelectedLog(null)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Deletion failed')
    }
  }

  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)

  const sendOrderEmail = async (id: string, type: 'success' | 'failed') => {
    setSendingEmailId(id + type)
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const response = await fetch('/api/admin/send-order-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, type })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Send failed')
      }

      toast.success(type === 'success' ? 'Receipt email sent!' : 'Payment reminder sent!')
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to send email')
    } finally {
      setSendingEmailId(null)
    }
  }

  const markLogAsPaid = async (id: string) => {
    try {
      const stored = localStorage.getItem('adminAuth')
      let passwordHash = ''
      if (stored) {
        passwordHash = JSON.parse(stored).passwordHash
      }

      const response = await fetch('/api/admin/mark-paid', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${passwordHash}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      })

      if (!response.ok) {
        throw new Error('Update failed')
      }

      toast.success('Transaction marked as paid!')
      fetchLogs()
      if (selectedLog && selectedLog._id === id) {
        setSelectedLog({ ...selectedLog, status: 'Completed', paidAt: new Date().toISOString() })
      }
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Update failed')
    }
  }

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

    const gatewayFlag = selectedGateway === 'authorize' ? 'GA' : selectedGateway === 'online' ? 'GO' : selectedGateway === 'asiapay' ? 'GAP' : selectedGateway === 'antom' ? 'GAN' : selectedGateway === 'shopify' ? 'GSH' : 'GT'
    let paymentString = '';

    if (['a','b','c','d','e','f','g','h','i','j','k','l','m'].includes(selectedEdition)) {
      const dVal = Math.round((Number(discountAmount) || 0) * 100)
      const dStr = dVal.toString(36)
      const tVal = Math.round(calculateTotal() * 100)
      const tStr = tVal.toString(36)
      paymentString = `S${selectedEdition}K${dStr}M${tStr}${gatewayFlag}`
    } else {
      const editionMap: Record<string, string> = { silver: 'S', gold: 'G', platinum: 'P', diamond: 'D', fsp: 'F', whop: 'W' }
      const shortEdition = editionMap[selectedEdition] || 'S'

      const uStr = users.toString(36)
      const yStr = selectedYears.toString(36)
      const dVal = Math.round((Number(discountAmount) || 0) * 100)
      const dStr = dVal.toString(36)
      const tVal = Math.round(calculateTotal() * 100)
      const tStr = tVal.toString(36)
      
      paymentString = `${uStr}${shortEdition}${yStr}K${dStr}M${tStr}${gatewayFlag}`
    }
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const base = isLocalhost ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || window.location.origin);
    if (paymentString) {
      setPaymentLink(`${base}/invoice/${paymentString}`)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink)
    setCopiedLink(true)
    toast.success('Payment link copied!')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const downloadPDF = async (log: any) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const primaryColor = [44, 160, 28] // #2ca01c
      const darkColor = [33, 37, 41]
      const grayColor = [108, 117, 125]

      // Extract initials for watermark
      const firstInitial = log.firstName ? log.firstName.charAt(0).toUpperCase() : '';
      const lastInitial = log.lastName ? log.lastName.charAt(0).toUpperCase() : '';
      const initials = `${firstInitial}${lastInitial}`;
      const watermarkText = `Initial: ${initials}`;

      const drawWatermark = () => {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(18);
        // Near black color for watermark
        doc.setTextColor(75, 75, 75);
        // Position at the very bottom right corner of the page (less padding)
        doc.text(watermarkText, 198, 288, { align: 'right' });
        
        // CRITICAL: Reset the text color back to dark so the terms text is visible
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

      // --- RENDER TERMS AND CONDITIONS (PAGINATED) ---
      
      // Draw QB ENTERPRISE Header on the First Page
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(22)
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.text('QB ENTERPRISE', 20, 25)

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

      // Set width to 160 to prevent bold text from spilling off the edge
      const lines = doc.splitTextToSize(termsText, 160); 
      
      // Start lower on the first page to make room for the header
      let cursorY = 40;
      const marginY = 280; // Bottom margin

      drawWatermark();

      for (let i = 0; i < lines.length; i++) {
        // Detect section headers roughly to make them bold
        const line = lines[i];
        if (
          line === 'TERMS AND CONDITIONS' || 
          /^[0-9]+\.\s[A-Z]/.test(line) || // matches "1. Introduction"
          /^[0-9]+\.[0-9]+\s[A-Z]/.test(line) // matches "3.1 Fees"
        ) {
          doc.setFont('Helvetica', 'bold');
          if (line === 'TERMS AND CONDITIONS') doc.setFontSize(14);
          else doc.setFontSize(10); // Keep size 10 to prevent wrapping issues
        } else {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(10);
        }

        doc.text(line, 20, cursorY);
        cursorY += 6; // Line height

        // If we are at the bottom of the page, add a new one
        if (cursorY >= marginY && i < lines.length - 1) {
          doc.addPage();
          drawWatermark();
          cursorY = 20; // reset cursor higher for subsequent pages since they don't have the big header
        }
      }

      // --- ADD FINAL PAGE FOR CERTIFICATE ---
      doc.addPage();

      const drawDivider = (y: number) => {
        doc.setDrawColor(220, 224, 230)
        doc.setLineWidth(0.5)
        doc.line(20, y, 190, y)
      }

      // --- CERTIFICATE HEADER ---
      doc.setFontSize(14)
      doc.setFont('Helvetica', 'bold')
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
      doc.text('CERTIFICATE OF CONSENT & PURCHASE AGREEMENT', 100, 35, { align: 'center' })
      
      drawDivider(42)

      // --- SIGNATURE METADATA ---
      doc.setFontSize(10)
      doc.setFont('Helvetica', 'bold')
      doc.text('ELECTRONIC SIGNATURE METADATA', 20, 50)

      doc.setFont('Helvetica', 'normal')
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
      
      // Shift metaY up since we removed the main header from this page
      const metaY = 57
      doc.text(`Consent Record ID:   ${log._id}`, 20, metaY)

      const timeString = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(log.agreedTimestamp)) + ' EST';

      doc.text(`Timestamp:          ${timeString}`, 20, metaY + 6)
      doc.text(`IP Address:         ${log.ipAddress}`, 20, metaY + 12)
      doc.text(`Device Type:        ${log.deviceType || 'Desktop'}`, 20, metaY + 18)
      doc.text(`Browser / Client:   ${log.browser || 'Unknown'}`, 20, metaY + 24)
      doc.text(`Consent Agreement:  AGREED (Terms & Privacy explicitly checked by client)`, 20, metaY + 30)
      
      drawDivider(metaY + 36)

      // --- CUSTOMER DETAILS ---
      doc.setFont('Helvetica', 'bold')
      doc.text('CUSTOMER BILLING DETAILS', 20, metaY + 46)

      doc.setFont('Helvetica', 'normal')
      const profileY = metaY + 53
      doc.text(`Full Name:          ${log.firstName} ${log.lastName}`, 20, profileY)
      doc.text(`Email Address:      ${log.email}`, 20, profileY + 6)
      doc.text(`Company Name:       ${log.companyName || 'N/A'}`, 20, profileY + 12)
      let formattedEin = log.ein || 'N/A';
      if (formattedEin !== 'N/A' && formattedEin.replace(/\D/g, '').length === 9) {
        const d = formattedEin.replace(/\D/g, '');
        formattedEin = `${d.slice(0, 2)}-${d.slice(2)}`;
      }
      doc.text(`EIN:                ${formattedEin}`, 20, profileY + 18)
      doc.text(`Phone Number:       ${log.phone || 'N/A'}`, 20, profileY + 24)
      doc.text(`Street Address:     ${log.address}`, 20, profileY + 30)
      doc.text(`City & State:       ${log.city}, ${log.state}`, 20, profileY + 36)
      doc.text(`ZIP Code & Country: ${log.zipCode}, ${log.country || 'US'}`, 20, profileY + 42)

      drawDivider(profileY + 48)

      // --- PLAN SUMMARY ---
      doc.setFont('Helvetica', 'bold')
      doc.text('ORDER & SUBSCRIPTION SUMMARY', 20, profileY + 58)

      doc.setFont('Helvetica', 'normal')
      const orderY = profileY + 65
      doc.text(`Product Name:       ${log.planDetails || 'QuickBooks Enterprise'}`, 20, orderY)
      doc.text(`Total Price:        $${log.amountUSD.toFixed(2)} USD`, 20, orderY + 6)
      doc.text(`Reconciliation:     ${log.status === 'Completed' ? 'Completed & Paid' : 'Pending Payment'}`, 20, orderY + 12)
      let orderLineOffset = 12
      if (log.paymentMethodLabel) {
        orderLineOffset += 6
        doc.text(`Payment Method:     ${log.paymentMethodLabel}`, 20, orderY + orderLineOffset)
      }
      if (log.whopSessionId) {
        orderLineOffset += 6
        doc.text(`Whop Session ID:    ${log.whopSessionId}`, 20, orderY + orderLineOffset)
      }

      if (log.clientSignatureBase64) {
        const sigY = orderY + orderLineOffset + 17;
        
        doc.setFont('Times', 'normal')
        doc.setFontSize(14)
        doc.setTextColor(0, 0, 0)
        doc.text('Customer Signature:', 20, sigY + 13)
        
        // Draw purplish-blue bracket with pseudo-curves
        doc.setDrawColor(68, 0, 230) // Purple-blue
        doc.setLineWidth(0.6)
        
        // Top curve
        doc.line(65, sigY + 2, 66, sigY + 1)
        doc.line(66, sigY + 1, 68, sigY + 1)
        // Vertical line
        doc.line(65, sigY + 2, 65, sigY + 21)
        // Bottom curve
        doc.line(65, sigY + 21, 66, sigY + 22)
        doc.line(66, sigY + 22, 68, sigY + 22)
        
        // Signed by text
        doc.setFontSize(8)
        doc.setFont('Helvetica', 'bold')
        doc.setTextColor(0, 0, 0)
        doc.text('Signed by:', 69, sigY + 2.5)
        
        // Signature Image
        try {
          const props = doc.getImageProperties(log.clientSignatureBase64);
          const imgRatio = props.width / props.height;
          let imgHeight = 14;
          let imgWidth = 14 * imgRatio;
          
          // Cap the width so it doesn't overflow the page
          if (imgWidth > 80) {
            imgWidth = 80;
            imgHeight = 80 / imgRatio;
          }
          
          const yOffset = (15 - imgHeight) / 2;
          doc.addImage(log.clientSignatureBase64, 'PNG', 69, sigY + 3 + yOffset, imgWidth, imgHeight);
        } catch (e) {
          doc.addImage(log.clientSignatureBase64, 'PNG', 69, sigY + 4, 50, 15);
        }
        
        // Transaction ID text
        doc.setFontSize(7)
        doc.setFont('Helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        const transId = log._id ? log._id.toString() : 'N/A'
        const shortId = transId.length > 15 ? transId.substring(0, 15) + '...' : transId
        doc.text(`Transaction ID: ${shortId}`, 69, sigY + 23.5)
        
        // Date on right
        doc.setFont('Times', 'normal')
        doc.setFontSize(14)
        doc.setTextColor(0, 0, 0)
        const dateStr = new Date(log.agreedTimestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) + ' EST'
        doc.text(`Date:  ${dateStr}`, 150, sigY + 13)
      }

      // --- Payment Proof (Online Payment only) ---
      // Skip jsPDF page generation if the proof is a PDF (we will merge pages directly using pdf-lib)
      if (log.paymentGateway === 'Online Payment' && log.paymentProofType !== 'pdf') {
        doc.addPage();
        drawWatermark();

        // Header
        doc.setFillColor(124, 58, 237);
        doc.rect(0, 0, 210, 16, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text('PAYMENT PROOF ATTACHMENT', 20, 10.5);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

        // Metadata block
        doc.setFillColor(248, 245, 255);
        doc.roundedRect(15, 22, 180, 38, 3, 3, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 80, 160);
        doc.text('TRANSACTION DETAILS', 20, 30);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text(`Gateway:`, 20, 38);
        doc.text(`Online Payment`, 60, 38);
        doc.text(`Submitted by:`, 20, 44);
        doc.text(`${log.firstName || ''} ${log.lastName || ''}`, 60, 44);
        doc.text(`Email:`, 20, 50);
        doc.text(`${log.email || 'N/A'}`, 60, 50);
        doc.text(`Reference ID:`, 20, 56);
        doc.setFont('Courier', 'normal');
        doc.text(`${log._id}`, 60, 56);
        doc.setFont('Helvetica', 'normal');
        doc.text(`Payment Type:`, 110, 38);
        doc.text(`${log.paymentType === 'wire_ach' ? 'Wire/ACH' : 'N/A'}`, 150, 38);
        doc.text(`Amount:`, 110, 44);
        doc.setTextColor(44, 160, 28);
        doc.setFont('Helvetica', 'bold');
        doc.text(`$${Number(log.amountUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`, 150, 44);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

        if (!log.paymentProofUrl) {
          // No proof uploaded yet
          doc.setFontSize(10);
          doc.setTextColor(180, 120, 0);
          doc.text('⚠  No payment proof file uploaded yet.', 20, 75);
        } else if (log.paymentProofType === 'image') {
          // Embed image proof
          try {
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            doc.text('Proof Image:', 20, 70);

            // Fetch the image via proxy and convert to base64 for cross-origin embedding
            const imgResponse = await fetch(`/api/proxy-fetch?url=${encodeURIComponent(log.paymentProofUrl)}`);
            const imgBlob = await imgResponse.blob();
            const imgBase64: string = await new Promise((res, rej) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result as string);
              reader.onerror = rej;
              reader.readAsDataURL(imgBlob);
            });

            const img = new Image();
            await new Promise<void>((res, rej) => {
              img.onload = () => res();
              img.onerror = rej;
              img.src = imgBase64;
            });

            const maxW = 170;
            const maxH = 190;
            const ratio = img.naturalWidth / img.naturalHeight;
            let pw = maxW;
            let ph = maxW / ratio;
            if (ph > maxH) { ph = maxH; pw = maxH * ratio; }
            const xCenter = (210 - pw) / 2;

            doc.addImage(imgBase64, 'JPEG', xCenter, 75, pw, ph);

            // URL below image
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 200);
            const wrappedUrl = doc.splitTextToSize(`Source: ${log.paymentProofUrl}`, 170);
            doc.text(wrappedUrl, 20, 75 + ph + 6);
          } catch (imgErr) {
            doc.setFontSize(9);
            doc.setTextColor(180, 0, 0);
            doc.text('Could not embed image. Access via URL below:', 20, 72);
            doc.setTextColor(0, 0, 200);
            const wrappedUrl = doc.splitTextToSize(log.paymentProofUrl, 170);
            doc.text(wrappedUrl, 20, 80);
          }
        } else {
          // PDF proof — show link with instructions
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 80);
          doc.text('Proof of payment was submitted as a PDF document.', 20, 72);
          doc.text('Open the link below to view the original file:', 20, 80);

          // Draw a button-style box around the URL
          doc.setDrawColor(124, 58, 237);
          doc.setLineWidth(0.5);
          doc.roundedRect(15, 86, 180, 14, 2, 2, 'S');
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(124, 58, 237);
          const wrappedUrl = doc.splitTextToSize(log.paymentProofUrl, 168);
          doc.text(wrappedUrl, 20, 95);

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(120, 120, 120);
          doc.text('Note: Copy and paste the URL above into a browser to view the proof PDF.', 20, 108);
          doc.text('The file is stored securely in Cloudinary and accessible to authorized parties only.', 20, 115);
        }
      }

      // --- FOOTER ---
      doc.setFontSize(8)
      doc.setFont('Helvetica', 'oblique')
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
      const footerText = 'This certificate serves as legally binding digital evidence that the customer designated above explicitly agreed to the Terms of Service when initiating their payment. The electronic signature was recorded with client billing metadata, network details, and browser fingerprints.'
      
      const splitText = doc.splitTextToSize(footerText, 170)
      doc.text(splitText, 20, 260)

      // ── Merge proof PDF pages if this is an Online Payment with a PDF proof ──
      if (log.paymentGateway === 'Online Payment' && log.paymentProofType === 'pdf' && log.paymentProofUrl) {
        try {
          toast.loading('Merging payment proof PDF...', { id: 'pdf-merge' });

          // 1. Export jsPDF output as ArrayBuffer
          const consentPdfBytes = doc.output('arraybuffer');

          // 2. Load the consent log PDF into pdf-lib
          const mergedDoc = await PDFDocument.load(consentPdfBytes, { ignoreEncryption: true });

          // 3. Fetch the proof PDF from Cloudinary via proxy
          let pdfFetchUrl = log.paymentProofUrl;
          if (!pdfFetchUrl.toLowerCase().endsWith('.pdf') && !pdfFetchUrl.toLowerCase().endsWith('.txt')) {
            pdfFetchUrl = pdfFetchUrl + '.txt'; // Default to txt fallback just in case
          }
          
          const proofResponse = await fetch(`/api/proxy-fetch?url=${encodeURIComponent(pdfFetchUrl)}`);
          if (!proofResponse.ok) throw new Error('Could not fetch proof PDF from Cloudinary.');
          const proofPdfBytes = await proofResponse.arrayBuffer();

          // 4. Load the proof PDF and copy all its pages into the merged doc
          const proofDoc = await PDFDocument.load(proofPdfBytes, { ignoreEncryption: true });
          const proofPageCount = proofDoc.getPageCount();
          const copiedPages = await mergedDoc.copyPages(proofDoc, Array.from({ length: proofPageCount }, (_, i) => i));

          // Draw "Payment Proof" title at the top of the first merged page
          if (copiedPages.length > 0) {
            const firstPage = copiedPages[0];
            const helveticaBold = await mergedDoc.embedFont(StandardFonts.HelveticaBold);
            firstPage.drawText('Payment Proof', {
              x: 20,
              y: firstPage.getHeight() - 25,
              size: 11,
              font: helveticaBold,
              color: rgb(0.48, 0.22, 0.92), // Violet
            });
          }

          copiedPages.forEach(page => mergedDoc.addPage(page));

          // 5. Save and download the merged PDF
          const mergedPdfBytes = await mergedDoc.save();
          const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Consent_Certificate_${log.lastName}_${log.firstName}.pdf`;
          a.click();
          URL.revokeObjectURL(url);

          toast.dismiss('pdf-merge');
          toast.success('PDF Certificate downloaded (with proof attached)!');
        } catch (mergeErr: any) {
          toast.dismiss('pdf-merge');
          console.error('[PDF Merge Error]', mergeErr);
          // Fallback: download consent log only
          doc.save(`Consent_Certificate_${log.lastName}_${log.firstName}.pdf`);
          toast.success('PDF downloaded (proof merge failed — downloading consent log only).');
        }
      } else {
        // No proof to merge — standard download
        doc.save(`Consent_Certificate_${log.lastName}_${log.firstName}.pdf`)
        toast.success('PDF Certificate downloaded!')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    }
  }

  const TEST_EMAILS = ['info@qualitybusinesstech.us', 'nick.powerjobs@gmail.com', 'contact@qbenterprise.us'].map(e => e.toLowerCase())
  
  const displayedLogs = logs.filter(log => {
    // 1. Basic Mode
    const isTestRecord = (
      (log.email && TEST_EMAILS.includes(log.email.toLowerCase())) ||
      (log.fsOrderReference && log.fsOrderReference.includes('MOCK')) ||
      (log.fsOrderId && log.fsOrderId.includes('MOCK'))
    );

    if (filterMode === 'Test') {
      if (!isTestRecord) return false;
    } else {
      if (isTestRecord) return false;
    }
    
    // 2. Gateway Filter
    if (advGateway === 'Whop') {
      if (log.paymentGateway !== 'Whop' && log.gateway !== 'Whop' && !log.whopSessionId) return false;
    } else if (advGateway === 'Authorize.net') {
      if (log.paymentGateway !== 'Authorize.net' && log.gateway !== 'Authorize.net' && !log.fsOrderReference) return false;
    } else if (advGateway === 'AsiaPay') {
      if (log.paymentGateway !== 'AsiaPay' && log.gateway !== 'AsiaPay') return false;
    } else if (advGateway === 'Online Payment') {
      if (log.paymentGateway !== 'Online Payment') return false;
    } else if (advGateway === 'Stripe') {
      if (log.paymentGateway !== 'Stripe' && !log.stripeSessionId) return false;
    } else if (advGateway === 'Shopify') {
      if (log.paymentGateway !== 'Shopify' && log.gateway !== 'Shopify') return false;
    }
    
    // 3. Status Filter
    if (advStatus !== 'All' && log.status !== advStatus) return false;
    
    // 4. Amount Filter
    if (advAmount !== 'All' && log.amountUSD) {
      if (advAmount === '<50' && log.amountUSD >= 50) return false;
      if (advAmount === '50-500' && (log.amountUSD < 50 || log.amountUSD > 500)) return false;
      if (advAmount === '>500' && log.amountUSD <= 500) return false;
    }
    
    // 5. Search Query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchableString = `
        ${log.firstName || ''} ${log.lastName || ''} 
        ${log.email || ''} 
        ${log.planDetails || ''} 
        ${log.ipAddress || ''}
        ${log.agreedTimestamp ? new Date(log.agreedTimestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) : ''}
      `.toLowerCase();
      
      const queryParts = query.split(/\s+/).filter(Boolean);
      if (!queryParts.every(part => searchableString.includes(part))) return false;
    }
    
    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(displayedLogs.length / logsPerPage)
  const indexOfLastLog = currentPage * logsPerPage
  const indexOfFirstLog = indexOfLastLog - logsPerPage
  const currentLogs = displayedLogs.slice(indexOfFirstLog, indexOfLastLog)

  return (
    <div className="min-h-screen bg-zinc-50/50 py-6 md:py-10 text-zinc-950 font-sans antialiased">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Shadcn style Title Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              Admin Dashboard
            </h1>
            <p className="text-sm text-zinc-500 mt-1 font-normal">Generate invoice payment links and view electronic signature audits.</p>
          </div>
          
          {/* Shadcn Segmented Tab Controller */}
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
            <button
              onClick={() => setActiveTab('email')}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-1.5 text-xs md:text-sm font-semibold transition-all cursor-pointer select-none ${activeTab === 'email' ? 'bg-white text-zinc-950 shadow-sm' : 'hover:text-zinc-900 text-zinc-500'}`}
            >
              <Mail size={14} className="text-[#2ca01c]" />
              Send Email
            </button>
          </div>
        </div>

        {/* Tab 1: Configure & Create Payment Link */}
        {activeTab === 'create' && (
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Form Configuration Card */}
            <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl shadow-xs p-6 md:p-8 space-y-6">
              
              {/* Payment Gateway Toggle */}
              <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
                <label className="block mb-2 font-medium text-xs text-zinc-500 uppercase tracking-wider">Payment Gateway</label>
                <div className="flex bg-white rounded-md border border-zinc-200 p-1">

                  <button
                    onClick={() => {
                      setSelectedGateway('authorize')
                      setPaymentLink('')
                    }}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors ${selectedGateway === 'authorize' ? 'bg-[#0075ff] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Authorize.net
                  </button>
                  <button
                    onClick={() => {
                      setSelectedGateway('online')
                      setPaymentLink('')
                    }}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors ${selectedGateway === 'online' ? 'bg-[#7c3aed] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Online Payment
                  </button>
                  {/* STRIPE CURRENTLY DISABLED
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      setSelectedGateway('stripe')
                    }}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors ${selectedGateway === 'stripe' ? 'bg-[#635bff] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Stripe
                  </button>
                  */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGateway('asiapay')
                      setPaymentLink('')
                    }}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors ${selectedGateway === 'asiapay' ? 'bg-[#F36E17] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    AsiaPay
                  </button>
                  {/* ANTOM CURRENTLY DISABLED — merchant account not yet cleared for card processing
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGateway('antom')
                      setPaymentLink('')
                    }}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors ${selectedGateway === 'antom' ? 'bg-[#1a73e8] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Antom
                  </button>
                  */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGateway('shopify')
                      setPaymentLink('')
                    }}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors ${selectedGateway === 'shopify' ? 'bg-[#95BF47] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Shopify
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                  <Layers size={16} className="text-zinc-400" />
                  Configure Invoice Tiers
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">Define user counts, editions, and pricing rules.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t pt-5 border-zinc-100">
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">QuickBooks Edition</label>
                  <select
                    value={selectedEdition}
                    onChange={(e) => {
                      setSelectedEdition(e.target.value)
                      setPaymentLink('')
                    }}
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c] cursor-pointer"
                  >
                    <optgroup label="QuickBooks Enterprise">
                      {editions.map((e) => (
                        <option key={e.value} value={e.value}>
                          {e.value === 'whop' ? 'QuickBooks Enterprise 24.0 Whop' : `QuickBooks Enterprise 24.0 ${e.name}`}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Custom Products">
                      {customProducts.map((e) => (
                        <option key={e.value} value={e.value}>
                          {e.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {['silver', 'gold', 'platinum', 'diamond', 'fsp', 'whop'].includes(selectedEdition) && (
                  <div>
                    <label className="block mb-1.5 font-medium text-xs text-zinc-500">Number of Users</label>
                    <input
                      type="number"
                      min="1"
                      value={users}
                      onChange={(e) => {
                         setUsers(Math.max(1, parseInt(e.target.value) || 1))
                         setPaymentLink('')
                       }}
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                    />
                  </div>
                )}
              </div>

              {['silver', 'gold', 'platinum', 'diamond', 'fsp', 'whop'].includes(selectedEdition) && (
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">Contract Period</label>
                  <select
                    value={selectedYears}
                    onChange={(e) => {
                      setSelectedYears(parseInt(e.target.value))
                      setPaymentLink('')
                    }}
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c] cursor-pointer"
                  >
                    {yearOptions.map((y) => (
                      <option key={y.value} value={y.value}>{y.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block mb-1.5 font-semibold text-xs text-zinc-900">Price ($)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 3500"
                  value={totalPrice}
                  onChange={(e) => {
                    setTotalPrice(e.target.value)
                    setPaymentLink('')
                  }}
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
                    setPaymentLink('')
                  }}
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm text-zinc-500 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:border-zinc-300"
                />
              </div>
            </div>

            {/* Right Column: Dynamic Preview + Shadcn Button Card */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Order Invoice Card */}
              <div className="bg-white border border-zinc-200 rounded-xl shadow-xs p-6 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Summary Preview</h3>
                
                <div className="space-y-3 text-xs border-t pt-3 border-zinc-100 font-medium">
                  <div className="flex justify-between text-zinc-500">
                    <span>Edition:</span>
                    <span className="text-zinc-900 font-semibold">
                      {['a','b','c','d','e','f','g','h','i','j','k','l','m'].includes(selectedEdition) 
                        ? customProducts.find(c => c.value === selectedEdition)?.name 
                        : `24.0 ${selectedEdition === 'whop' ? 'Whop' : selectedEdition.charAt(0).toUpperCase() + selectedEdition.slice(1)}`
                      }
                    </span>
                  </div>
                  {['silver', 'gold', 'platinum', 'diamond', 'fsp', 'whop'].includes(selectedEdition) && (
                    <>
                      <div className="flex justify-between text-zinc-500">
                        <span>User Count:</span>
                        <span className="text-zinc-900 font-semibold">{users} {users === 1 ? 'User' : 'Users'}</span>
                      </div>
                      <div className="flex justify-between text-zinc-500">
                        <span>Subscription Term:</span>
                        <span className="text-zinc-900 font-semibold">{selectedYears} {selectedYears === 1 ? 'Year' : 'Years'}</span>
                      </div>
                    </>
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

              {/* Action Button Card */}
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

        {/* Tab 2: Compliance T&C Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white border border-zinc-200 rounded-xl shadow-xs p-4 md:p-6 space-y-6">
            
            {/* Header controls bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg text-zinc-900">Signed Consent Certificates</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Compliance records of B2B terms signatures logged in MongoDB.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto font-medium">
                <button
                  onClick={() => setFilterMode('All')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border font-semibold rounded-lg text-xs cursor-pointer transition-colors shadow-xs ${filterMode === 'All' ? 'bg-[#2ca01c] text-white border-[#2ca01c]' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}
                >
                  <Filter size={12} />
                  All Transactions
                </button>
                <button
                  onClick={() => setFilterMode('Test')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border font-semibold rounded-lg text-xs cursor-pointer transition-colors shadow-xs ${filterMode === 'Test' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}
                >
                  <Filter size={12} />
                  Test Transactions
                </button>
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
            
            {/* Advanced Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-zinc-50/80 border border-zinc-100 rounded-lg text-xs">
              <span className="font-semibold text-zinc-500 mr-2 uppercase tracking-wider text-[10px]">Filters:</span>
              
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={14} className="text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search name, email, plan, date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 w-full border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 font-medium placeholder:text-zinc-400 placeholder:font-normal"
                />
              </div>

              <select 
                value={advGateway}
                onChange={(e) => setAdvGateway(e.target.value)}
                className="px-3 py-1.5 border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 font-medium cursor-pointer"
              >
                <option value="All">All Gateways</option>
                <option value="Whop">Whop Only</option>
                <option value="Authorize.net">Authorize.net Only</option>
                <option value="AsiaPay">AsiaPay Only</option>
                <option value="Online Payment">Online Payment Only</option>
                <option value="Stripe">Stripe Only</option>
                <option value="Shopify">Shopify Only</option>
              </select>
              
              <select 
                value={advStatus}
                onChange={(e) => setAdvStatus(e.target.value)}
                className="px-3 py-1.5 border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 font-medium cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Completed">Completed Only</option>
                <option value="Pending">Pending Only</option>
              </select>
              
              <select 
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                className="px-3 py-1.5 border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 font-medium cursor-pointer"
              >
                <option value="All">All Amounts</option>
                <option value="<50">Under $50</option>
                <option value="50-500">$50 to $500</option>
                <option value=">500">Over $500</option>
              </select>
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
                {/* Desktop and Tablet View (Classic Clean Shadcn Table) */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider bg-zinc-50/50">
                        <th className="py-3.5 px-4 font-bold">Date & Time</th>
                        <th className="py-3.5 px-4 font-bold">Client Profile</th>
                        <th className="py-3.5 px-4 font-bold">Product & Amount</th>
                        <th className="py-3.5 px-4 font-bold">Status</th>
                        <th className="py-3.5 px-4 text-center font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-800">
                      {currentLogs.map((log) => {
                        if (log.logType === 'user_session') {
                          return (
                            <tr key={log._id} className="hover:bg-blue-50/50 transition-colors bg-blue-50/20">
                              <td className="py-4 px-4 align-top whitespace-nowrap">
                                <span className="font-bold text-zinc-900 block">
                                  {new Date(log.agreedTimestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}
                                </span>
                                <span className="text-zinc-500 block text-[10px] mt-0.5">
                                  {new Date(log.agreedTimestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' })} EST
                                </span>
                              </td>
                              <td className="py-4 px-4 align-top">
                                <div className="font-semibold text-blue-700 text-sm flex items-center gap-1.5">
                                  <Eye size={14} /> Activity Session
                                </div>
                                {log.email && <div className="text-zinc-900 font-medium mt-2">{log.email}</div>}
                                <div className="text-[10px] text-zinc-400 mt-1 font-medium">IP: {log.ipAddress}</div>
                                {log.paymentId && <div className="text-[10px] text-zinc-400 mt-0.5 font-medium mb-1">ID: {log.paymentId}</div>}
                                
                                {log.paymentGateway === 'Authorize.net' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-50 text-blue-700 border border-blue-200 mt-1">
                                    AUTH.NET
                                  </span>
                                )}
                                {log.paymentGateway === 'Stripe' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mt-1">
                                    STRIPE
                                  </span>
                                )}
                                {log.paymentGateway === 'AsiaPay' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-200 mt-1">
                                    ASIAPAY
                                  </span>
                                )}
                                {log.paymentGateway === 'Online Payment' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-50 text-violet-700 border border-violet-200 mt-1">
                                    MANUAL
                                  </span>
                                )}
                                {log.paymentGateway === 'Shopify' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-50 text-green-700 border border-green-200 mt-1">
                                    SHOPIFY
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 align-top">
                                {log.amount ? (
                                  <div className="font-extrabold text-zinc-600 text-sm">${Number(log.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                ) : (
                                  <div className="font-extrabold text-zinc-400 text-sm">--</div>
                                )}
                                {log.planDetails && <div className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed max-w-xs font-medium bg-white p-1.5 rounded-lg border border-zinc-100">{log.planDetails}</div>}
                              </td>
                              <td className="py-4 px-4 align-top">
                                <div className="flex flex-col gap-1.5 bg-zinc-50/50 p-2 rounded-lg border border-zinc-100">
                                  <span className="text-[11px] font-bold text-zinc-700">
                                    {log.events?.length || 0} Interaction{(log.events?.length !== 1) && 's'}
                                  </span>
                                  <span className="text-[10px] text-zinc-500">
                                    Latest:{' '}
                                    <span className="font-bold text-blue-700 uppercase tracking-wider">
                                      {log.events && log.events.length > 0 
                                        ? log.events[log.events.length - 1].event.replace('_', ' ') 
                                        : 'N/A'}
                                    </span>
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 align-top text-center whitespace-nowrap space-y-2">
                                <button
                                  onClick={() => setSelectedLog(log)}
                                  className="w-full inline-flex justify-center items-center gap-1.5 px-3 py-1.5 border border-blue-200 font-bold rounded-lg text-[10px] transition-colors shadow-xs bg-white hover:bg-blue-50 text-blue-700 cursor-pointer"
                                >
                                  <Eye size={12} className="text-blue-500" />
                                  Session Timeline
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return (
                        <tr key={log._id} className="hover:bg-zinc-50/40 transition-colors">
                          
                          {/* Timestamp */}
                          <td className="py-4 px-4 align-top whitespace-nowrap">
                            <span className="font-bold text-zinc-900 block">
                              {new Date(log.agreedTimestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}
                            </span>
                            <span className="text-zinc-500 block text-[10px] mt-0.5">
                              {new Date(log.agreedTimestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' })} EST
                            </span>
                          </td>
                          
                          {/* Client details */}
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
                          
                          {/* Plan & Amount */}
                          <td className="py-4 px-4 align-top">
                            <div className="font-extrabold text-[#2ca01c] text-sm">${log.amountUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed max-w-xs font-medium bg-zinc-50 p-1.5 rounded-lg border border-zinc-100">{log.planDetails}</div>
                            {log.paymentMethodLabel && (
                              <div className="text-[10px] font-semibold text-zinc-600 mt-1.5 inline-flex items-center gap-1">
                                💳 {log.paymentMethodLabel}
                              </div>
                            )}
                          </td>
                          
                          {/* Compliance Status */}
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
                            
                            {log.fsOrderReference && (
                              <div className="text-[9px] font-semibold text-zinc-500 mt-2 font-mono bg-zinc-50 p-1 border border-zinc-100 rounded inline-block">
                                Ref: {log.fsOrderReference}
                              </div>
                            )}
                            
                            {log.stripeSessionId && (
                              <div className="text-[9px] font-semibold text-zinc-500 mt-2 font-mono bg-zinc-50 p-1 border border-zinc-100 rounded inline-block">
                                Ref: {log.stripeSessionId.substring(0, 18)}...
                              </div>
                            )}
                            
                            {log.gateway === 'Authorize.net' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  AUTH.NET
                                </span>
                              </div>
                            )}

                            {log.paymentGateway === 'Stripe' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  STRIPE
                                </span>
                              </div>
                            )}

                            {log.paymentGateway === 'AsiaPay' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  ASIAPAY
                                </span>
                              </div>
                            )}

                            {log.paymentGateway === 'Online Payment' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                                  MANUAL
                                </span>
                              </div>
                            )}

                            {log.paymentGateway === 'Shopify' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-50 text-green-700 border border-green-200">
                                  SHOPIFY
                                </span>
                              </div>
                            )}

                          </td>

                          {/* Action Button */}
                          <td className="py-4 px-4 align-top text-center whitespace-nowrap space-y-2">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="w-full inline-flex justify-center items-center gap-1.5 px-3 py-1.5 border border-zinc-200 font-bold rounded-lg text-[10px] transition-colors shadow-xs bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer"
                            >
                              <Eye size={12} className="text-zinc-500" />
                              View Details
                            </button>
                            <br />
                            <button
                              onClick={() => downloadPDF(log)}
                              disabled={log.status !== 'Completed'}
                              title={log.status !== 'Completed' ? "Payment pending. PDF unavailable." : ""}
                              className={`w-full inline-flex justify-center items-center gap-1.5 px-3 py-1.5 border border-zinc-200 font-bold rounded-lg text-[10px] transition-colors shadow-xs ${log.status === 'Completed' ? 'bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer' : 'bg-zinc-50 text-zinc-400 cursor-not-allowed opacity-60'}`}
                            >
                              <FileText size={12} className={log.status === 'Completed' ? 'text-zinc-500' : 'text-zinc-400'} />
                              PDF Consent
                            </button>
                            {log.status !== 'Completed' && (
                              <>
                                <br />
                                <button
                                  onClick={() => sendOrderEmail(log._id, 'failed')}
                                  disabled={sendingEmailId === log._id + 'failed'}
                                  className="w-full inline-flex justify-center items-center gap-1.5 px-3 py-1.5 border border-amber-200 font-bold rounded-lg text-[10px] transition-colors shadow-xs bg-white hover:bg-amber-50 text-amber-700 cursor-pointer disabled:opacity-50"
                                >
                                  <MailWarning size={12} className="text-amber-500" />
                                  {sendingEmailId === log._id + 'failed' ? 'Sending...' : 'Send Reminder'}
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile and Small Screen View (Sleek Minimalist Cards) */}
                <div className="block lg:hidden space-y-4">
                  {currentLogs.map((log) => (
                    <MobileLogCard key={log._id} log={log} downloadPDF={downloadPDF} />
                  ))}
                </div>
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-zinc-200 pt-5 mt-6">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 shadow-xs transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <span className="text-xs text-zinc-500 font-semibold bg-zinc-50 px-3 py-1.5 rounded-md border border-zinc-200/50">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 shadow-xs transition-colors cursor-pointer"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                )}
                
                {/* Modal for Details */}
                {selectedLog && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl relative flex flex-col" style={{ maxHeight: '90vh' }}>
                      {/* Sticky close button — always visible */}
                      <button
                        onClick={() => setSelectedLog(null)}
                        className="absolute top-4 right-4 z-10 text-zinc-400 hover:text-zinc-800 transition-colors p-1 bg-white/90 backdrop-blur-sm rounded-full shadow-sm border border-zinc-200"
                      >
                        <X size={20} />
                      </button>

                      {/* Scrollable content */}
                      <div className="overflow-y-auto flex-1 p-6 md:p-8">
                      
                      {selectedLog.logType === 'user_session' ? (
                        <>
                          <div className="flex items-center justify-between mb-6 border-b border-zinc-100 pb-4">
                            <div className="flex items-center gap-4">
                              <h2 className="text-xl font-bold text-zinc-900">Activity Session Timeline</h2>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Tracked Session
                            </span>
                          </div>

                          <div className="space-y-6 text-sm">
                            <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                              <div>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">User Identifier</p>
                                <p className="font-semibold text-zinc-900">{selectedLog.email || 'Unknown'}</p>
                                <p className="text-zinc-500 text-xs mt-0.5">IP: {selectedLog.ipAddress}</p>
                                {selectedLog.paymentId && <p className="text-zinc-500 text-xs mt-0.5 font-mono">ID: {selectedLog.paymentId}</p>}
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Targeted Product</p>
                                <p className="font-semibold text-zinc-900">{selectedLog.planDetails || 'N/A'}</p>
                                <p className="text-[#2ca01c] font-bold mt-0.5">${selectedLog.amount ? Number(selectedLog.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</p>
                              </div>
                            </div>

                            <div>
                              <h3 className="font-bold text-zinc-900 mb-4 border-b border-zinc-100 pb-2">Event Timeline</h3>
                              <div className="space-y-4 border-l-2 border-blue-200 ml-3 pb-2 overflow-y-auto" style={{ maxHeight: '380px' }}>
                                {selectedLog.events && selectedLog.events.map((evt: any, i: number) => (
                                  <div key={i} className="relative pl-6">
                                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-4 border-2 border-white shadow-sm"></div>
                                    <div className="bg-white border border-zinc-100 p-3 rounded-lg shadow-xs">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <span className="font-bold text-blue-800 text-xs uppercase tracking-wide bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                            {evt.event.replace('_', ' ')}
                                          </span>
                                          {evt.email && <p className="text-xs text-zinc-600 mt-2 font-medium">Entered Email: <span className="text-zinc-900">{evt.email}</span></p>}
                                        </div>
                                        <div className="text-right">
                                          <span className="block text-xs font-semibold text-zinc-700">{new Date(evt.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} EST</span>
                                          <span className="block text-[10px] text-zinc-400">{new Date(evt.timestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-6 border-b border-zinc-100 pb-4">
                        <div className="flex items-center gap-4">
                          <h2 className="text-xl font-bold text-zinc-900">Transaction Record</h2>
                          {selectedLog.email && TEST_EMAILS.includes(selectedLog.email.toLowerCase()) && (
                            <span className="bg-rose-100 text-rose-700 border border-rose-200 font-black px-3 py-1 rounded-md text-[11px] uppercase tracking-[0.2em] shadow-sm">
                              TEST
                            </span>
                          )}
                        </div>
                        {selectedLog.status === 'Completed' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            Pending
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Customer</p>
                            <p className="font-semibold text-zinc-900 text-base">{selectedLog.firstName} {selectedLog.lastName}</p>
                            <p className="text-zinc-500">{selectedLog.email}</p>
                            {selectedLog.phone && <p className="text-zinc-500 mt-1">📞 {selectedLog.phone}</p>}
                          </div>
                          
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Company</p>
                            {selectedLog.companyName ? (
                              <p className="font-semibold text-zinc-800">{selectedLog.companyName}</p>
                            ) : (
                              <p className="text-zinc-400 italic">Not provided</p>
                            )}
                          </div>
                          
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Billing Address</p>
                            {selectedLog.address ? (
                              <div className="text-zinc-700">
                                <p>{selectedLog.address}</p>
                                <p>{selectedLog.city}, {selectedLog.state} {selectedLog.zipCode}</p>
                                <p>{selectedLog.country || 'US'}</p>
                              </div>
                            ) : (
                              <p className="text-zinc-400 italic">Not provided</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Payment Amount</p>
                            <p className="font-extrabold text-[#2ca01c] text-xl">${selectedLog.amountUSD?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p>
                          </div>
                          
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Product Details</p>
                            <p className="font-medium text-zinc-800">{selectedLog.planDetails}</p>
                          </div>

                          {selectedLog.paymentMethodLabel && (
                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Payment Method</p>
                              <p className="font-medium text-zinc-800">{selectedLog.paymentMethodLabel}</p>
                            </div>
                          )}

                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Transaction Data</p>
                            <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100 space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Date:</span>
                                <span className="font-semibold text-zinc-900">{selectedLog.agreedTimestamp ? new Date(selectedLog.agreedTimestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) : 'N/A'}</span>
                              </div>
                              <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                                <span className="text-zinc-500 text-sm">Time</span>
                                <span className="font-semibold text-zinc-900">{selectedLog.agreedTimestamp ? new Date(selectedLog.agreedTimestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York' }) + ' EST' : 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Gateway:</span>
                                <span className="font-semibold text-zinc-900">{selectedLog.paymentGateway || selectedLog.gateway || 'Whop'}</span>
                              </div>
                              <div className="flex justify-between border-t border-zinc-200/60 pt-2 mt-2">
                                <span className="text-zinc-500">Reference:</span>
                                <span className="font-mono font-semibold text-zinc-900">{selectedLog.whopSessionId || selectedLog.fsOrderReference || selectedLog.stripeSessionId || selectedLog._id}</span>
                              </div>
                              <div className="flex justify-between border-t border-zinc-200/60 pt-2 mt-2">
                                <span className="text-zinc-500">IP Address:</span>
                                <span className="font-mono font-semibold text-zinc-900">{selectedLog.ipAddress || 'Unknown'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Device/Browser:</span>
                                <span className="font-semibold text-zinc-900">{selectedLog.deviceType || 'Unknown'} / {selectedLog.browser || 'Unknown'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Online Payment: Proof of Payment section */}
                      {selectedLog.paymentGateway === 'Online Payment' && (
                        <div className="mt-6 p-4 bg-violet-50 border border-violet-200 rounded-xl">
                          <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-3">Payment Proof</p>
                          {selectedLog.paymentProofUrl ? (
                            selectedLog.paymentProofType === 'image' ? (
                              <div className="space-y-2">
                                <img
                                  src={selectedLog.paymentProofUrl}
                                  alt="Payment Proof"
                                  className="max-h-64 rounded-lg border border-violet-200 object-contain w-full bg-white"
                                />
                                <a
                                  href={selectedLog.paymentProofUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:underline"
                                >
                                  <FileText size={12} /> Open full image
                                </a>
                              </div>
                            ) : (
                              <a
                                href={`/api/proxy-fetch?url=${encodeURIComponent(selectedLog.paymentProofUrl)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-700 text-white text-xs font-semibold rounded-lg hover:bg-violet-800 transition-colors"
                              >
                                <FileText size={14} /> Open Payment Proof PDF
                              </a>
                            )
                          ) : (
                            <p className="text-xs text-violet-400 italic">Proof file not yet uploaded.</p>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-8 pt-4 border-t border-zinc-100 flex flex-wrap justify-between items-center gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {process.env.NODE_ENV === 'development' && selectedLog.status !== 'Completed' && (
                            <button
                              onClick={() => {
                                if (window.confirm('Mark this transaction as paid manually? This will unlock the PDF consent log.')) {
                                  markLogAsPaid(selectedLog._id);
                                }
                              }}
                              className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm cursor-pointer"
                            >
                              Mark as Paid
                            </button>
                          )}
                          {selectedLog.status !== 'Completed' && (
                            <button
                              onClick={() => sendOrderEmail(selectedLog._id, 'failed')}
                              disabled={sendingEmailId === selectedLog._id + 'failed'}
                              className="inline-flex items-center gap-1.5 px-4 py-2 border border-amber-200 bg-white hover:bg-amber-50 text-amber-700 font-semibold rounded-lg text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                            >
                              <MailWarning size={14} />
                              {sendingEmailId === selectedLog._id + 'failed' ? 'Sending...' : 'Send Payment Reminder'}
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => setSelectedLog(null)}
                          className="px-6 py-2 bg-zinc-900 text-white font-semibold rounded-lg hover:bg-zinc-800 transition-colors shadow-sm text-sm cursor-pointer"
                        >
                          Close Details
                        </button>
                      </div>
                      </>
                      )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 3: Send a standalone email (not tied to an existing order) */}
        {activeTab === 'email' && (
          <div className="space-y-8">
          <div className="max-w-2xl">
            <form onSubmit={sendCustomEmail} className="bg-white border border-zinc-200 rounded-xl shadow-xs p-6 md:p-8 space-y-6">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                  <Mail size={16} className="text-zinc-400" />
                  Send Transactional Email
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">Fill in the fields and send a receipt or payment reminder directly — no existing order required.</p>
              </div>

              {/* Email type toggle */}
              <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
                <label className="block mb-2 font-medium text-xs text-zinc-500 uppercase tracking-wider">Email Type</label>
                <div className="flex bg-white rounded-md border border-zinc-200 p-1">
                  <button
                    type="button"
                    onClick={() => setEmailType('success')}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors cursor-pointer ${emailType === 'success' ? 'bg-[#2ca01c] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Payment Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailType('failed')}
                    className={`flex-1 text-xs font-semibold py-2 rounded transition-colors cursor-pointer ${emailType === 'failed' ? 'bg-amber-500 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                  >
                    Payment Reminder
                  </button>
                </div>
              </div>

              {/* Common fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t pt-5 border-zinc-100">
                <div>
                  <label className="block mb-1.5 font-semibold text-xs text-zinc-900">Recipient Email *</label>
                  <input
                    type="email"
                    required
                    value={emailForm.toEmail}
                    onChange={(e) => updateEmailForm('toEmail', e.target.value)}
                    placeholder="customer@example.com"
                    className="flex h-10 w-full rounded-md border border-[#2ca01c] bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">Customer Name</label>
                  <input
                    type="text"
                    value={emailForm.customerName}
                    onChange={(e) => updateEmailForm('customerName', e.target.value)}
                    placeholder="Jane Doe"
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">Company Name</label>
                  <input
                    type="text"
                    value={emailForm.companyName}
                    onChange={(e) => updateEmailForm('companyName', e.target.value)}
                    placeholder="Acme Corp"
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">Order ID <span className="text-[10px] text-zinc-400 italic font-normal">(optional, auto-generated if blank)</span></label>
                  <input
                    type="text"
                    value={emailForm.orderId}
                    onChange={(e) => updateEmailForm('orderId', e.target.value)}
                    placeholder="e.g. Mongo _id or invoice #"
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">Product</label>
                  <select
                    value={emailProductCode}
                    onChange={(e) => setEmailProductCode(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c] cursor-pointer"
                  >
                    <optgroup label="QuickBooks Enterprise">
                      {editions.map((e) => (
                        <option key={e.value} value={e.value}>{`QuickBooks Enterprise ${e.name} Edition`}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Custom Products">
                      {customProducts.map((p) => (
                        <option key={p.value} value={p.value}>{p.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {isEmailProductQbEdition && (
                  <>
                    <div>
                      <label className="block mb-1.5 font-medium text-xs text-zinc-500">Number of Users</label>
                      <input
                        type="number"
                        min="1"
                        value={emailUsers}
                        onChange={(e) => setEmailUsers(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5 font-medium text-xs text-zinc-500">Contract Period</label>
                      <select
                        value={emailYears}
                        onChange={(e) => setEmailYears(parseInt(e.target.value))}
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c] cursor-pointer"
                      >
                        <option value={1}>1 Year</option>
                        <option value={2}>2 Years</option>
                        <option value={3}>3 Years</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">Plan / Product Details <span className="text-[10px] text-zinc-400 italic font-normal">(shown in the email — auto-filled from Product above)</span></label>
                  {!planDetailsIsCustom ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={emailForm.planDetails}
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 shadow-xs cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => setPlanDetailsIsCustom(true)}
                        className="shrink-0 px-3 rounded-md border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                      >
                        Edit text
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={emailForm.planDetails}
                        onChange={(e) => updateEmailForm('planDetails', e.target.value)}
                        placeholder="Type a custom plan/product name"
                        className="flex h-10 w-full rounded-md border border-[#2ca01c] bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30"
                      />
                      <button
                        type="button"
                        onClick={() => setPlanDetailsIsCustom(false)}
                        className="shrink-0 px-3 rounded-md border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                      >
                        Back to auto
                      </button>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-1.5 font-medium text-xs text-zinc-500">Payment Method Label</label>
                  <input
                    type="text"
                    value={emailForm.paymentMethodLabel}
                    onChange={(e) => updateEmailForm('paymentMethodLabel', e.target.value)}
                    placeholder={emailType === 'success' ? 'e.g. VISA ending in 1234' : 'e.g. AMEX ending in 6043'}
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                  />
                </div>
                {emailType === 'success' && (
                  <>
                    <div>
                      <label className="block mb-1.5 font-medium text-xs text-zinc-500">License Number <span className="text-[10px] text-zinc-400 italic font-normal">(optional)</span></label>
                      <input
                        type="text"
                        value={emailForm.licenseNumber}
                        onChange={(e) => updateEmailForm('licenseNumber', e.target.value)}
                        placeholder="e.g. 1234-5678-9012-345"
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5 font-medium text-xs text-zinc-500">Product Number <span className="text-[10px] text-zinc-400 italic font-normal">(optional)</span></label>
                      <input
                        type="text"
                        value={emailForm.productNumber}
                        onChange={(e) => updateEmailForm('productNumber', e.target.value)}
                        placeholder="e.g. 962-891"
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Type-specific fields */}
              {emailType === 'success' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t pt-5 border-zinc-100">
                  <div>
                    <label className="block mb-1.5 font-semibold text-xs text-zinc-900">Amount Paid ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={emailForm.amountUSD}
                      onChange={(e) => updateEmailForm('amountUSD', e.target.value)}
                      placeholder="22.05"
                      className="flex h-10 w-full rounded-md border border-[#2ca01c] bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-medium text-xs text-zinc-500">Payment Date</label>
                    <input
                      type="date"
                      value={emailForm.paidAt}
                      onChange={(e) => updateEmailForm('paidAt', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2ca01c]/30 focus:border-[#2ca01c]"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t pt-5 border-zinc-100">
                  <div>
                    <label className="block mb-1.5 font-semibold text-xs text-zinc-900">Amount Due ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={emailForm.amountDueUSD}
                      onChange={(e) => updateEmailForm('amountDueUSD', e.target.value)}
                      placeholder="22.05"
                      className="flex h-10 w-full rounded-md border border-amber-500 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-medium text-xs text-zinc-500">Billing Date *</label>
                    <input
                      type="date"
                      required
                      value={emailForm.billingDate}
                      onChange={(e) => updateEmailForm('billingDate', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-medium text-xs text-zinc-500">Cancellation Date *</label>
                    <input
                      type="date"
                      required
                      value={emailForm.cancellationDate}
                      onChange={(e) => updateEmailForm('cancellationDate', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                  </div>

                  <div className="md:col-span-3 bg-amber-50/60 rounded-lg p-4 border border-amber-200">
                    <label className="block mb-2 font-medium text-xs text-amber-700 uppercase tracking-wider">"Update now" button link</label>
                    <div className="flex bg-white rounded-md border border-zinc-200 p-1">
                      <button
                        type="button"
                        onClick={() => setReminderGateway('')}
                        className={`flex-1 text-xs font-semibold py-2 rounded transition-colors cursor-pointer ${reminderGateway === '' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      >
                        Contact support (default)
                      </button>
                      <button
                        type="button"
                        onClick={() => setReminderGateway('authorize')}
                        className={`flex-1 text-xs font-semibold py-2 rounded transition-colors cursor-pointer ${reminderGateway === 'authorize' ? 'bg-[#0075ff] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      >
                        Authorize.net
                      </button>
                      <button
                        type="button"
                        onClick={() => setReminderGateway('asiapay')}
                        className={`flex-1 text-xs font-semibold py-2 rounded transition-colors cursor-pointer ${reminderGateway === 'asiapay' ? 'bg-[#F36E17] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      >
                        AsiaPay
                      </button>
                      <button
                        type="button"
                        onClick={() => setReminderGateway('shopify')}
                        className={`flex-1 text-xs font-semibold py-2 rounded transition-colors cursor-pointer ${reminderGateway === 'shopify' ? 'bg-[#95BF47] text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'}`}
                      >
                        Shopify
                      </button>
                    </div>

                    <p className="text-[10px] text-amber-700/80 mt-2 leading-relaxed">
                      {reminderGateway
                        ? `"Update now" will open a real ${reminderGateway === 'authorize' ? 'Authorize.net' : reminderGateway === 'shopify' ? 'Shopify' : 'AsiaPay'} checkout for $${emailForm.amountDueUSD || '0.00'} — labeled "${emailProductDisplayName}"${isEmailProductQbEdition ? ` (${emailUsers} user${emailUsers === 1 ? '' : 's'}, ${emailYears} year${emailYears === 1 ? '' : 's'})` : ''} — the customer logs in and pays like any other invoice link.`
                        : 'No gateway selected — "Update now" will just open a support email instead of a live checkout.'}
                    </p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSendingCustomEmail}
                className={`w-full py-2.5 disabled:bg-zinc-100 text-white disabled:text-zinc-400 font-semibold rounded-lg text-xs transition-all cursor-pointer shadow-sm disabled:cursor-not-allowed border border-zinc-950/10 ${emailType === 'success' ? 'bg-[#2ca01c] hover:bg-[#248a18]' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                {isSendingCustomEmail ? 'Sending...' : emailType === 'success' ? 'Send Payment Receipt' : 'Send Payment Reminder'}
              </button>
            </form>
          </div>

          {/* Sent Emails history */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-xs">
            <div className="p-6 md:p-8 pb-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                  <Mail size={16} className="text-zinc-400" />
                  Sent Emails
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">Every receipt and reminder ever sent, automatic or manual, with the data used to build it.</p>
              </div>
              <button
                type="button"
                onClick={fetchEmailLogs}
                disabled={isLoadingEmailLogs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 font-semibold rounded-lg text-[11px] transition-colors shadow-xs bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} className={isLoadingEmailLogs ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {isLoadingEmailLogs ? (
              <p className="text-xs text-zinc-400 px-6 md:px-8 pb-8">Loading sent emails...</p>
            ) : emailLogsList.length === 0 ? (
              <p className="text-xs text-zinc-400 px-6 md:px-8 pb-8">No emails have been sent yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-t border-zinc-100 bg-zinc-50/60 text-left text-[10px] uppercase tracking-wider text-zinc-500">
                      <th className="py-2.5 px-4 font-semibold">Sent</th>
                      <th className="py-2.5 px-4 font-semibold">Type</th>
                      <th className="py-2.5 px-4 font-semibold">Recipient</th>
                      <th className="py-2.5 px-4 font-semibold">Plan</th>
                      <th className="py-2.5 px-4 font-semibold">Amount</th>
                      <th className="py-2.5 px-4 font-semibold">Trigger</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {emailLogsList.slice((emailLogsPage - 1) * emailLogsPerPage, emailLogsPage * emailLogsPerPage).map((entry) => (
                      <tr key={entry._id} className="hover:bg-zinc-50/40 transition-colors">
                        <td className="py-3 px-4 align-top whitespace-nowrap text-zinc-500">
                          {entry.sentAt ? new Date(entry.sentAt).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) : 'N/A'}
                          <div className="text-[10px] text-zinc-400">{entry.sentAt ? new Date(entry.sentAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' }) + ' EST' : ''}</div>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${entry.type === 'reminder' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                            {entry.type === 'reminder' ? 'REMINDER' : 'RECEIPT'}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-zinc-900">{entry.customerName || '—'}</div>
                          <div className="text-zinc-500">{entry.toEmail}</div>
                        </td>
                        <td className="py-3 px-4 align-top text-zinc-600 max-w-[220px] truncate" title={entry.planDetails}>{entry.planDetails || '—'}</td>
                        <td className="py-3 px-4 align-top font-semibold text-zinc-800">{entry.amountUSD !== undefined && entry.amountUSD !== null ? `$${Number(entry.amountUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                        <td className="py-3 px-4 align-top">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                            {entry.trigger || 'unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedEmailLog(entry)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-blue-200 font-semibold rounded-md text-[10px] transition-colors shadow-xs bg-white hover:bg-blue-50 text-blue-700 cursor-pointer"
                          >
                            <Eye size={11} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoadingEmailLogs && emailLogsList.length > emailLogsPerPage && (
              <div className="flex items-center justify-between border-t border-zinc-100 px-6 md:px-8 py-4">
                <button
                  type="button"
                  onClick={() => setEmailLogsPage(prev => Math.max(prev - 1, 1))}
                  disabled={emailLogsPage === 1}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 shadow-xs transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs text-zinc-500 font-semibold bg-zinc-50 px-3 py-1.5 rounded-md border border-zinc-200/50">
                  Page {emailLogsPage} of {Math.ceil(emailLogsList.length / emailLogsPerPage)}
                </span>
                <button
                  type="button"
                  onClick={() => setEmailLogsPage(prev => Math.min(prev + 1, Math.ceil(emailLogsList.length / emailLogsPerPage)))}
                  disabled={emailLogsPage === Math.ceil(emailLogsList.length / emailLogsPerPage)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 shadow-xs transition-colors cursor-pointer"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
          </div>
        )}

        {selectedEmailLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative flex flex-col" style={{ maxHeight: '90vh' }}>
              <button
                onClick={() => setSelectedEmailLog(null)}
                className="absolute top-4 right-4 z-10 text-zinc-400 hover:text-zinc-800 transition-colors p-1 bg-white/90 backdrop-blur-sm rounded-full shadow-sm border border-zinc-200"
              >
                <X size={20} />
              </button>

              <div className="overflow-y-auto flex-1 p-6 md:p-8">
                <div className="flex items-center justify-between mb-6 border-b border-zinc-100 pb-4">
                  <h2 className="text-lg font-bold text-zinc-900">Email Data Used</h2>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${selectedEmailLog.type === 'reminder' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                    {selectedEmailLog.type === 'reminder' ? 'REMINDER' : 'RECEIPT'}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  {[
                    ['Sent at', selectedEmailLog.sentAt ? new Date(selectedEmailLog.sentAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' EST' : 'N/A'],
                    ['Subject', selectedEmailLog.subject],
                    ['Recipient email', selectedEmailLog.toEmail],
                    ['Customer name', selectedEmailLog.customerName],
                    ['Order ID', selectedEmailLog.orderId],
                    ['Plan details', selectedEmailLog.planDetails],
                    ['Amount (USD)', selectedEmailLog.amountUSD !== undefined && selectedEmailLog.amountUSD !== null ? `$${Number(selectedEmailLog.amountUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined],
                    ['Trigger', selectedEmailLog.trigger],
                    ['Record ID', selectedEmailLog._id],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-zinc-50 pb-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 pt-0.5">{label}</span>
                      <span className="font-medium text-zinc-800 text-right break-words">{value || <span className="text-zinc-300 italic">Not provided</span>}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-zinc-100 flex justify-end">
                <button
                  onClick={() => setSelectedEmailLog(null)}
                  className="px-5 py-2 bg-zinc-900 text-white font-semibold rounded-lg hover:bg-zinc-800 transition-colors shadow-sm text-sm cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const MobileLogCard = ({ log, downloadPDF }: { log: any, downloadPDF: (log: any) => void }) => {
  const [expanded, setExpanded] = useState(false);

  if (log.logType === 'user_session') {
    return (
      <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-xs hover:border-blue-300 transition-colors">
        <div className="flex justify-between items-start cursor-pointer group" onClick={() => setExpanded(!expanded)}>
          <div>
            <span className="text-[9px] uppercase font-bold text-blue-400 block tracking-wider">
              {new Date(log.agreedTimestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York' })} at {new Date(log.agreedTimestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })} EST
            </span>
            <h4 className="font-semibold text-blue-900 text-base mt-0.5">Activity Session</h4>
            <p className="text-xs text-zinc-500 font-medium">{log.email || log.ipAddress}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-1">
              Tracked
            </span>
            {log.paymentGateway === 'Authorize.net' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                AUTH.NET
              </span>
            )}
            {log.paymentGateway === 'Stripe' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                STRIPE
              </span>
            )}
            {log.paymentGateway === 'AsiaPay' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                ASIAPAY
              </span>
            )}
            {log.paymentGateway === 'Online Payment' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                MANUAL
              </span>
            )}
            {log.paymentGateway === 'Shopify' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-50 text-green-700 border border-green-200">
                SHOPIFY
              </span>
            )}
            {log.amount ? (
              <div className="text-sm font-extrabold text-blue-700">
                ${Number(log.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            ) : null}
          </div>
        </div>
        {expanded && (
           <div className="mt-4 border-t border-blue-100 pt-4 space-y-3 animate-in fade-in duration-200">
              {log.events && log.events.map((evt: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase text-[9px]">{evt.event.replace('_', ' ')}</span>
                  <div className="flex items-center justify-between mt-1">
                  <span className="text-zinc-500">{new Date(evt.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} EST</span>
                </div>
                </div>
              ))}
           </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs hover:border-zinc-300 transition-colors">
      {/* Header block (Always Visible) */}
      <div 
        className="flex justify-between items-start cursor-pointer group" 
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="font-semibold text-emerald-800 flex items-center gap-2 mt-0.5">
            <CheckCircle size={14} className="text-emerald-600" />
            {new Date(log.agreedTimestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York' })} at {new Date(log.agreedTimestamp).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })} EST
          </div>
          <h4 className="font-semibold text-zinc-900 text-base mt-0.5 group-hover:text-[#2ca01c] transition-colors">{log.firstName} {log.lastName}</h4>
          <p className="text-xs text-zinc-500 font-medium">{log.email}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {log.status === 'Completed' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Pending
            </span>
          )}
          <div className="text-sm font-extrabold text-[#2ca01c]">
            ${log.amountUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="mt-4 border-t border-zinc-100 pt-4 space-y-4 animate-in fade-in duration-200">
          {/* Plan Summary */}
          <div className="text-[11px] text-zinc-600 bg-zinc-50 p-2.5 border border-zinc-200/50 rounded-lg leading-relaxed">
            <span className="font-bold text-zinc-700 block text-[9px] uppercase tracking-wider mb-1">Plan Details</span>
            {log.planDetails}
            <div className="mt-2 pt-2 border-t border-zinc-200/50 flex justify-between items-center">
              <div>
                <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Gateway</span>
                <div className="text-[11px] font-semibold text-zinc-800 mt-0.5">{log.paymentGateway || log.gateway || 'Whop'}</div>
              </div>
              {log.companyName && (
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Company</span>
                  <div className="text-[11px] font-semibold text-purple-700 mt-0.5">{log.companyName}</div>
                </div>
              )}
            </div>
            {log.paymentMethodLabel && (
              <div className="mt-2 pt-2 border-t border-zinc-200/50">
                <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Payment Method</span>
                <div className="text-[11px] font-semibold text-zinc-800 mt-0.5 inline-flex items-center gap-1">
                  💳 {log.paymentMethodLabel}
                </div>
              </div>
            )}
          </div>

          {/* Billing Address */}
          {log.address && (
            <div className="bg-zinc-50/50 p-3 rounded-lg border border-zinc-200/50 leading-relaxed">
              <span className="font-bold text-zinc-700 block text-[9px] uppercase tracking-wider mb-1">Billing Address</span>
              <p className="text-xs text-zinc-600">
                {log.address}, {log.city}, {log.state} {log.zipCode}, {log.country}
              </p>
            </div>
          )}

          {/* Device fingerprint */}
          <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
            <div>
              <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">Network IP</span>
              <span className="font-bold text-zinc-900 font-mono bg-zinc-100 px-1.5 py-0.5 rounded inline-block mt-0.5">IP: {log.ipAddress}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">Device / Browser</span>
              <span className="text-zinc-900 font-semibold block mt-1">{log.deviceType || 'Desktop'} / {log.browser || 'Unknown'}</span>
            </div>
          </div>
          


          {/* Action */}
          <div className="pt-2">
            <button
              onClick={(e) => { e.stopPropagation(); downloadPDF(log); }}
              disabled={log.status !== 'Completed'}
              className={`w-full flex items-center justify-center gap-2 py-2.5 font-bold rounded-lg text-xs transition-colors border border-zinc-950/10 shadow-sm ${log.status === 'Completed' ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-50 cursor-pointer' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}
            >
              <FileText size={14} />
              {log.status === 'Completed' ? 'Download PDF Receipt' : 'Awaiting Payment'}
            </button>
          </div>
        </div>
      )}

      {/* Toggle Indicator */}
      <div 
        className="mt-3 flex items-center justify-center gap-1.5 border-t border-zinc-50 pt-3 cursor-pointer text-[10px] font-bold text-zinc-400 hover:text-zinc-600 uppercase tracking-wider transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
           <><ChevronUp size={12} /> View Less</>
        ) : (
           <><ChevronDown size={12} /> View Details</>
        )}
      </div>
    </div>
  );
};
