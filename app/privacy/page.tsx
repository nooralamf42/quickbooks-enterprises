import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-zinc-50/50 py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-zinc-200">

        {/* Header Section */}
        <div className="border-b border-zinc-200 pb-8 mb-8 text-center md:text-left flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
           <div>
             <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">Privacy Policy</h1>
             <p className="text-zinc-500 mt-2 font-medium">Last Updated: October 8, 2026</p>
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
               QB Enterprise ("Company," "we," "us," or "our") provides custom software, licenses, subscriptions, and related development services ("Services"). This Privacy Policy explains what personal information we collect when you purchase or use our Services, how we use and share it, and the choices available to you. By using our Services, you agree to the collection and use of information as described here.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">2. Information We Collect</h2>
             <p className="leading-relaxed mb-3">When you make a purchase, request support, or otherwise interact with us, we may collect:</p>
             <ul className="list-disc pl-6 space-y-1">
               <li><strong className="text-zinc-900">Identity and contact details:</strong> name, email address, phone number, company name, and business identifiers (such as an EIN) provided on an order.</li>
               <li><strong className="text-zinc-900">Billing information:</strong> billing address and the plan, edition, or service purchased. We do not collect or store full card numbers ourselves — card details are entered directly with our payment processor (see Section 4).</li>
               <li><strong className="text-zinc-900">Signed consent records:</strong> an electronic signature (drawn or typed) and a timestamp, captured when you authorize a payment, kept as a compliance record of that authorization.</li>
               <li><strong className="text-zinc-900">Technical and usage data:</strong> IP address, device type, and browser, recorded automatically when you open a payment link or submit an order, used for fraud prevention and to maintain an accurate record of each transaction.</li>
               <li><strong className="text-zinc-900">Correspondence:</strong> the content of support, billing, and account emails we send to or receive from you, retained as part of our customer records.</li>
             </ul>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">3. How We Use Information</h2>
             <ul className="list-disc pl-6 space-y-1">
               <li>To process orders, payments, and refunds, and to deliver purchased software, licenses, and services.</li>
               <li>To send transactional emails: payment receipts, payment reminders, order confirmations, and account notifications related to your purchase.</li>
               <li>To verify identity and prevent fraudulent transactions.</li>
               <li>To maintain compliance and consent records required for billing disputes and chargebacks.</li>
               <li>To provide customer support and respond to inquiries.</li>
               <li>To comply with legal, tax, and accounting obligations.</li>
             </ul>
             <p className="leading-relaxed mt-3">
               We do not use your information for unrelated advertising, and we do not sell personal information to third parties.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">4. How We Share Information</h2>
             <p className="leading-relaxed mb-3">We share information only with service providers who help us operate our business, including:</p>
             <ul className="list-disc pl-6 space-y-1">
               <li><strong className="text-zinc-900">Payment processors</strong> (such as Authorize.net, Stripe, Shopify, and other card and online-payment gateways), who handle card data directly and are subject to their own security standards (e.g., PCI DSS). We do not receive or store full card numbers.</li>
               <li><strong className="text-zinc-900">Email delivery providers</strong>, used solely to send the transactional emails described above.</li>
               <li><strong className="text-zinc-900">Service providers</strong> who host our infrastructure and database.</li>
               <li><strong className="text-zinc-900">Legal or regulatory authorities</strong>, when required by law, to enforce our Terms, or to investigate fraud or a chargeback.</li>
             </ul>
             <p className="leading-relaxed mt-3">
               We do not share your information with third parties for their own marketing purposes.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">5. Email Communications</h2>
             <p className="leading-relaxed">
               We send transactional messages related to your account and purchase — receipts, payment reminders, and support correspondence. These are not bulk marketing or newsletter mail. If an email includes an unsubscribe or opt-out link, honoring that request stops future messages of that type; it does not affect communications we are required to send regarding an active order, such as a payment reminder for an outstanding balance.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">6. Data Retention</h2>
             <p className="leading-relaxed">
               We retain order, billing, and consent records for as long as needed to provide the Services, resolve disputes or chargebacks, and meet our legal, tax, and accounting obligations. We retain this information even after an account becomes inactive, where required for these purposes.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">7. Data Security</h2>
             <p className="leading-relaxed">
               We use reasonable administrative and technical safeguards to protect the information we hold. Card payment details are handled directly by our payment processors and are never transmitted to or stored on our own servers. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">8. Your Choices and Rights</h2>
             <p className="leading-relaxed">
               You may contact us at any time to request access to, correction of, or deletion of your personal information, subject to our need to retain records required for legal, tax, billing, or dispute purposes as described in Section 6. To make a request, contact us using the details in Section 10.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">9. Children's Privacy</h2>
             <p className="leading-relaxed">
               Our Services are intended for business customers and are not directed to children. We do not knowingly collect personal information from anyone under 18.
             </p>
           </section>

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">10. Contact Information</h2>
             <p className="leading-relaxed">
               For questions about this Privacy Policy or to make a request regarding your information, contact:
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

           <section>
             <h2 className="text-xl font-bold text-zinc-900 mb-3">11. Changes to This Policy</h2>
             <p className="leading-relaxed">
               We may update this Privacy Policy from time to time. The "Last Updated" date above reflects the most recent revision. Continued use of our Services after a change constitutes acceptance of the updated policy.
             </p>
           </section>

        </div>

        {/* Footer */}
        <div className="mt-12 pt-10 border-t border-zinc-200">
          <div className="mt-2 text-center">
            <Link href="/" className="inline-flex items-center justify-center px-8 py-3 border border-zinc-200 shadow-sm text-sm font-bold rounded-lg text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-colors">
              Return to Homepage
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
