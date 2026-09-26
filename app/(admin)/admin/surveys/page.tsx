'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { jsPDF } from 'jspdf'
import { ChevronLeft, MessageSquare, RefreshCw, Download } from 'lucide-react'

/** Was previously a server component that queried MongoDB directly with zero auth —
 *  anyone who navigated here could read every customer's email and feedback. Rewritten
 *  as a client page that follows the same auth pattern as every other admin page
 *  (localStorage adminAuth checked on mount, data fetched via a Bearer-gated API route)
 *  and matches the Admin Dashboard's visual shell instead of a bare unstyled table. */

interface Survey {
  id: string
  submittedAt: string
  customerName: string
  customerEmail: string
  companyName: string
  ipAddress: string
  userAgent: string
  score: number
  reason: string
}

/** Site-wide date convention (matches formatDateMMDDYYYY in the main admin page): a
 *  zero-padded MM/DD/YYYY, shown alongside a separate EST time rather than one combined
 *  locale string, so every timestamp on the admin side reads the same way. */
function formatDateMMDDYYYY(input: string | Date, timeZone?: string): string {
  const date = input instanceof Date ? input : new Date(input)
  if (isNaN(date.getTime())) return String(input)
  return date.toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  })
}

function formatTimeEST(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) + ' EST'
}

/** Short "Browser · OS" label for the table (a raw User-Agent string is unreadable at a
 *  glance) — the full string is still what's stored and what goes in each survey's PDF. */
function parseBrowser(ua: string): string {
  if (!ua || ua === 'unknown') return 'Unknown'
  let browser = 'Unknown browser'
  if (/edg\//i.test(ua)) browser = 'Edge'
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera'
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = 'Chrome'
  else if (/firefox\//i.test(ua)) browser = 'Firefox'
  else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = 'Safari'

  let os = ''
  if (/windows/i.test(ua)) os = 'Windows'
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/iphone|ipad|ios/i.test(ua)) os = 'iOS'
  else if (/linux/i.test(ua)) os = 'Linux'

  return os ? `${browser} · ${os}` : browser
}

export default function SurveysPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('adminAuth')
    const encoded = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD
    if (stored && encoded) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.expires > Date.now() && parsed.passwordHash && atob(parsed.passwordHash) === atob(encoded)) {
          setAuthorized(true)
          setCheckingAuth(false)
          return
        }
      } catch {
        // fall through to redirect
      }
    }
    router.push('/admin')
  }, [router])

  const fetchSurveys = async () => {
    setLoading(true)
    setError('')
    try {
      const stored = localStorage.getItem('adminAuth')
      const passwordHash = stored ? JSON.parse(stored).passwordHash : ''
      const res = await fetch('/api/admin/surveys', {
        headers: { Authorization: `Bearer ${passwordHash}` },
      })
      if (!res.ok) throw new Error('Failed to load surveys')
      const data = await res.json()
      setSurveys(data.surveys)
    } catch (e: any) {
      setError(e.message || 'Failed to load surveys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authorized) fetchSurveys()
  }, [authorized])

  /** Formal letterhead PDF for a single response — same visual language as
   *  downloadEmailLogPDF() in the main admin page (real logo, business address block,
   *  bordered detail rows), since these go out to a bank. One PDF per response, not one
   *  combined export — each download is a standalone record for that customer. */
  const downloadSurveyPDF = async (survey: Survey) => {
    setDownloadingId(survey.id)
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const darkColor = [33, 37, 41]
      const grayColor = [108, 117, 125]
      const ruleColor = [210, 214, 220]
      const lightRowColor = [247, 248, 250]

      try {
        const logoRes = await fetch('/quickbooks_logo.png')
        const logoBlob = await logoRes.blob()
        const logoImg = new Image()
        const objectUrl = URL.createObjectURL(logoBlob)
        await new Promise<void>((res, rej) => {
          logoImg.onload = () => res()
          logoImg.onerror = rej
          logoImg.src = objectUrl
        })
        const targetWidthPx = 600
        const targetHeightPx = Math.round(targetWidthPx * (logoImg.naturalHeight / logoImg.naturalWidth))
        const canvas = document.createElement('canvas')
        canvas.width = targetWidthPx
        canvas.height = targetHeightPx
        canvas.getContext('2d')!.drawImage(logoImg, 0, 0, targetWidthPx, targetHeightPx)
        const logoBase64 = canvas.toDataURL('image/png')
        URL.revokeObjectURL(objectUrl)
        const logoWidth = 46
        const logoHeight = logoWidth * (logoImg.naturalHeight / logoImg.naturalWidth)
        doc.addImage(logoBase64, 'PNG', 20, 13, logoWidth, logoHeight)
      } catch {
        doc.setFont('Helvetica', 'bold')
        doc.setFontSize(18)
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
        doc.text('QB ENTERPRISE', 20, 22)
      }

      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
      doc.text('QB Enterprise', 190, 15, { align: 'right' })
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
      doc.text('4650 S Hampton Rd, Suite 102, Dallas, TX 75232', 190, 19.5, { align: 'right' })
      doc.text('contact@qbenterprise.us  ·  (888) 829-8848', 190, 23.5, { align: 'right' })

      doc.setDrawColor(ruleColor[0], ruleColor[1], ruleColor[2])
      doc.setLineWidth(0.5)
      doc.line(20, 32, 190, 32)

      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
      doc.text('CUSTOMER FEEDBACK SURVEY', 20, 41)

      const scoreColor = survey.score >= 9 ? [22, 163, 74] : survey.score >= 7 ? [217, 119, 6] : [220, 38, 38]
      doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2])
      doc.roundedRect(163, 35.5, 27, 7, 1.5, 1.5, 'F')
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(255, 255, 255)
      doc.text(`SCORE ${survey.score}/10`, 176.5, 40.2, { align: 'center' })

      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
      const introLines = doc.splitTextToSize(
        'This is a system-generated record of a customer feedback survey response submitted through QB Enterprise.',
        170
      )
      doc.text(introLines, 20, 47)

      const rows: [string, string][] = [
        ['Submitted at', `${formatDateMMDDYYYY(survey.submittedAt)}, ${formatTimeEST(survey.submittedAt)}`],
        ['Name', survey.customerName || 'Not provided'],
        ['Email', survey.customerEmail],
        ['Company', survey.companyName || 'Not provided'],
        ['IP address', survey.ipAddress || 'Unknown'],
        ['Browser', survey.userAgent || 'Unknown'],
        ['Score', `${survey.score} / 10`],
        ['Reason', survey.reason || 'No reason provided'],
      ]

      let y = 58
      const labelX = 22
      const valueX = 65
      const valueWidth = 123

      for (const [label, value] of rows) {
        const valueLines = doc.splitTextToSize(value, valueWidth)
        const rowHeight = Math.max(8, valueLines.length * 4.2 + 3.5)

        doc.setFillColor(lightRowColor[0], lightRowColor[1], lightRowColor[2])
        doc.rect(20, y, 170, rowHeight, 'F')

        doc.setFont('Helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
        doc.text(label.toUpperCase(), labelX, y + 5.5)

        doc.setFont('Helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
        doc.text(valueLines, valueX, y + 5.5)

        y += rowHeight + 1.5
      }

      doc.setDrawColor(ruleColor[0], ruleColor[1], ruleColor[2])
      doc.line(20, y + 4, 190, y + 4)
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
      doc.text(`Generated ${formatDateMMDDYYYY(new Date())} ${formatTimeEST(new Date())}`, 20, y + 10)

      doc.save(`survey-feedback-${survey.id}.pdf`)
    } finally {
      setDownloadingId(null)
    }
  }

  if (checkingAuth || !authorized) {
    return (
      <div className="min-h-screen bg-zinc-50/50 flex items-center justify-center">
        <p className="text-sm text-zinc-400">Checking access…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 py-6 md:py-10 text-zinc-950 font-sans antialiased">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* Shadcn style Title Header — matches Admin Dashboard */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-zinc-200">
          <div>
            <Link href="/admin/create-payment-link" className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-2">
              <ChevronLeft size={14} />
              Admin Dashboard
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <MessageSquare size={22} className="text-[#2ca01c]" />
              Customer Feedback Surveys
            </h1>
            <p className="text-sm text-zinc-500 mt-1 font-normal">Feedback submitted through the survey link included in feedback emails.</p>
          </div>
          <button
            type="button"
            onClick={fetchSurveys}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 font-semibold rounded-lg text-[11px] whitespace-nowrap transition-colors shadow-xs bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer disabled:opacity-50 self-start md:self-auto"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-6 md:p-8 pb-4">
            <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              <MessageSquare size={16} className="text-zinc-400" />
              Responses
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">{surveys.length} response{surveys.length === 1 ? '' : 's'} recorded. Download each response as its own PDF.</p>
          </div>

          {loading ? (
            <p className="text-xs text-zinc-400 px-6 md:px-8 pb-8">Loading surveys...</p>
          ) : error ? (
            <p className="text-xs text-red-500 px-6 md:px-8 pb-8">{error}</p>
          ) : surveys.length === 0 ? (
            <p className="text-xs text-zinc-400 px-6 md:px-8 pb-8">No survey responses yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-600">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase font-semibold text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">IP address</th>
                    <th className="px-4 py-3">Browser</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {surveys.map((survey) => (
                    <tr key={survey.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        {formatDateMMDDYYYY(survey.submittedAt)}
                        <div className="text-[11px] text-zinc-400 mt-0.5">{formatTimeEST(survey.submittedAt)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs">
                        {survey.customerName || <span className="text-zinc-400 italic">Not provided</span>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs">{survey.customerEmail}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs">
                        {survey.companyName || <span className="text-zinc-400 italic">Not provided</span>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-mono text-xs text-zinc-500">{survey.ipAddress || '—'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs" title={survey.userAgent}>
                        {parseBrowser(survey.userAgent)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white text-xs ${
                          survey.score >= 9 ? 'bg-green-600' : survey.score >= 7 ? 'bg-amber-500' : 'bg-red-600'
                        }`}>
                          {survey.score}
                        </span>
                      </td>
                      <td className="px-4 py-4 max-w-xs break-words text-xs">
                        {survey.reason || <span className="text-zinc-400 italic">No reason provided</span>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => downloadSurveyPDF(survey)}
                          disabled={downloadingId === survey.id}
                          title="Download this response as a PDF"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-blue-200 font-semibold rounded-lg text-[11px] whitespace-nowrap transition-colors shadow-xs bg-white hover:bg-blue-50 text-blue-700 cursor-pointer disabled:opacity-50"
                        >
                          <Download size={12} />
                          {downloadingId === survey.id ? 'Preparing…' : 'PDF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
