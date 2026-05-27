import React from 'react';
import Link from 'next/link';

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-zinc-50/50 py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-zinc-200">
        
        {/* Header Section */}
        <div className="border-b border-zinc-200 pb-8 mb-8 text-center md:text-left flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
           <div>
             <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">Terms and Conditions</h1>
             <p className="text-zinc-500 mt-2 font-medium">Last Updated: May 27, 2026</p>
           </div>
           <div className="text-sm text-zinc-500 text-left md:text-right">
             <div className="font-semibold text-zinc-900">QB Enterprise</div>
             <div>28 CHURCH ST, STE 14 #5838, WINCHESTER, MA, 01890</div>
             <div>info@Qualitybusinesstech.us</div>
           </div>
        </div>

        {/* Content Section */}
        <div className="prose prose-zinc max-w-none text-zinc-700 space-y-8">
           
           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">1. Introduction</h2>
             <p className="leading-relaxed">
               Welcome to QB Enterprise ("Company," "we," "us," or "our"). We are a software development company providing custom software, licenses, subscriptions, and related development services ("Services"). By accessing or using our Services, you ("Customer," "you," or "your") agree to be bound by these Terms and Conditions ("Terms"). If you do not agree, do not use our Services.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">2. Services</h2>
             <p className="leading-relaxed mb-3">
               QB Enterprise develops, delivers, and supports software products including but not limited to:
             </p>
             <ul className="list-disc pl-6 space-y-1">
               <li>Custom software development</li>
               <li>Software as a Service (SaaS) subscriptions</li>
               <li>Perpetual software licenses</li>
               <li>Maintenance and support packages</li>
               <li>Consulting and integration services</li>
             </ul>
             <p className="leading-relaxed mt-3">
               Specific deliverables, timelines, and fees will be outlined in separate Statements of Work (SOW) or invoices.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-4">3. Payment Terms</h2>
             
             <div className="space-y-4">
               <div>
                 <h3 className="text-lg font-semibold text-zinc-800 mb-2">3.1 Fees</h3>
                 <p className="leading-relaxed">
                   All fees for Services are due in full as stated in the applicable invoice or SOW. We accept payments via credit card, bank transfer, ACH, and Wire.
                 </p>
               </div>

               <div className="bg-red-50 border border-red-100 p-5 rounded-xl">
                 <h3 className="text-lg font-bold text-red-800 mb-2">3.2 No Refunds</h3>
                 <p className="leading-relaxed font-semibold text-red-900 mb-3">
                   ALL SALES ARE FINAL. No refunds, credits, or exchanges will be issued for any reason, including but not limited to:
                 </p>
                 <ul className="list-disc pl-6 space-y-1 text-red-800">
                   <li>Change of mind or business needs</li>
                   <li>Underutilization of software</li>
                   <li>Compatibility issues not previously disclosed in writing</li>
                   <li>Delays in delivery caused by customer’s failure to provide required information or cooperation</li>
                   <li>Discontinuation of a product or feature</li>
                 </ul>
                 <p className="leading-relaxed font-semibold text-red-900 mt-4">
                   Once payment is made, the amount is non-refundable.
                 </p>
               </div>

               <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl mt-4">
                 <h3 className="text-lg font-bold text-amber-900 mb-2">3.3 No Chargebacks</h3>
                 <p className="leading-relaxed text-amber-900">
                   By accepting these Terms, you expressly agree <strong className="font-extrabold uppercase">NOT</strong> to initiate a chargeback with your bank or credit card issuer for any payment made to QB Enterprise. You acknowledge that a chargeback constitutes a material breach of these Terms.
                 </p>
               </div>
             </div>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">4. Chargeback Liability and Legal Consequences</h2>
             <p className="leading-relaxed mb-4">
               If you file a chargeback against any sale made by QB Enterprise:
             </p>
             <ol className="list-decimal pl-6 space-y-3">
               <li><strong className="text-zinc-900">Breach of Contract</strong> – The chargeback will be treated as a material breach of these Terms.</li>
               <li><strong className="text-zinc-900">Immediate Obligation</strong> – You will immediately owe QB Enterprise the full amount of the disputed charge, plus any fees imposed on us by our payment processors.</li>
               <li><strong className="text-zinc-900">Legal Consciousness</strong> – You acknowledge that filing a fraudulent or improper chargeback is a willful act with legal consequences.</li>
               <li>
                 <strong className="text-zinc-900">Legal and Collection Costs</strong> – You agree to pay all costs incurred by QB Enterprise to recover the charged-back amount, including but not limited to:
                 <ul className="list-disc pl-6 mt-2 space-y-1 text-zinc-600">
                   <li>Attorney fees (actual, not necessarily statutory)</li>
                   <li>Collection agency fees</li>
                   <li>Court costs</li>
                   <li>Arbitration fees</li>
                   <li>Any other costs related to enforcing this agreement</li>
                 </ul>
               </li>
               <li><strong className="text-zinc-900">Reporting</strong> – We reserve the right to report chargeback abuse to credit reporting agencies or law enforcement.</li>
             </ol>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">5. Delivery and Acceptance</h2>
             <p className="leading-relaxed">
               Software deliverables are deemed accepted upon delivery (electronic or physical). Any defects must be reported within 15 days of delivery, and our sole obligation shall be to attempt a fix at our discretion. Failure to report defects within this period constitutes final acceptance. Refunds remain prohibited even in the event of defects; our liability is limited to repair or replacement of the software at no additional cost.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">6. Intellectual Property</h2>
             <p className="leading-relaxed">
               All software, code, documentation, and related materials remain the intellectual property of QB Enterprise or its licensors. Customer receives only a non-exclusive, non-transferable license as described in the relevant SOW. No ownership rights are transferred.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">7. Limitation of Liability</h2>
             <p className="leading-relaxed mb-3">To the maximum extent permitted by law:</p>
             <ul className="list-disc pl-6 space-y-1">
               <li>QB Enterprise is not liable for any indirect, incidental, special, or consequential damages, including lost profits or data.</li>
               <li>Our total liability for any claim arising from these Terms or the Services shall not exceed the amount paid by you to us in the 12 months preceding the claim.</li>
             </ul>
             <p className="leading-relaxed mt-3">
               This limitation applies even if we have been advised of the possibility of such damages.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">8. Governing Law and Dispute Resolution</h2>
             <p className="leading-relaxed">
               These Terms shall be governed by the laws of Delaware, USA, without regard to conflict of laws principles.
             </p>
             <p className="leading-relaxed mt-3">
               Any dispute arising out of or relating to these Terms or the Services, including but not limited to chargeback disputes, shall be resolved exclusively through binding arbitration in accordance with the rules of the American Arbitration Association (AAA). The arbitration shall take place in Delaware, and judgment on the award may be entered in any court having jurisdiction. Notwithstanding the foregoing, QB Enterprise may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent or stop a chargeback or unauthorized use of its intellectual property.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">9. Indemnification</h2>
             <p className="leading-relaxed mb-3">
               You agree to indemnify, defend, and hold harmless QB Enterprise and its officers, employees, and agents from any claims, damages, losses, or expenses (including attorney fees) arising from:
             </p>
             <ul className="list-disc pl-6 space-y-1">
               <li>Your breach of these Terms (especially the no-chargeback provision)</li>
               <li>Your misuse of our software</li>
               <li>Any dispute between you and your payment provider regarding a chargeback</li>
             </ul>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">10. Severability</h2>
             <p className="leading-relaxed">
               If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">11. Amendments</h2>
             <p className="leading-relaxed">
               QB Enterprise reserves the right to modify these Terms at any time. Continued use of our Services after changes constitutes acceptance of the new Terms. For one-time software purchases, the Terms in effect at the time of purchase apply.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">12. Entire Agreement</h2>
             <p className="leading-relaxed">
               These Terms, together with any SOW or invoice, constitute the entire agreement between you and QB Enterprise concerning the Services and supersede all prior agreements.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">13. Contact Information</h2>
             <p className="leading-relaxed">
               For questions about these Terms or to report a violation, contact:
             </p>
             <address className="not-italic mt-4 bg-zinc-50 p-5 rounded-xl border border-zinc-100 shadow-xs">
               <strong className="block text-zinc-900 text-lg mb-2">QB Enterprise</strong>
               <div className="flex flex-col gap-1 text-zinc-700">
                 <div>Email: <a href="mailto:info@Qualitybusinesstech.us" className="text-[#2ca01c] font-medium hover:underline">info@Qualitybusinesstech.us</a></div>
                 <div>Phone: <a href="tel:+18888298848" className="text-zinc-700 hover:text-zinc-900">(888) 829 8848</a></div>
                 <div>Address: 28 CHURCH ST, STE 14 #5838, WINCHESTER, MA, 01890</div>
               </div>
             </address>
           </section>

        </div>

        {/* Footer acknowledgment */}
        <div className="mt-12 pt-10 border-t border-zinc-200">
          <div className="bg-zinc-950 text-zinc-50 p-6 sm:p-8 rounded-2xl shadow-lg text-center sm:text-left">
             <p className="font-bold uppercase tracking-wider text-sm leading-relaxed text-zinc-100">
               By making a payment to QB Enterprise, you acknowledge that you have read, understood, and agree to be bound by these Terms, including the no-refund and no-chargeback provisions and the liability for legal fees arising from a chargeback.
             </p>
          </div>
          
          <div className="mt-10 text-center">
            <Link href="/" className="inline-flex items-center justify-center px-8 py-3 border border-zinc-200 shadow-sm text-sm font-bold rounded-lg text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-colors">
              Return to Homepage
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
