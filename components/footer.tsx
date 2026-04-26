"use client";

import { usePathname } from "next/navigation";

const Footer = () => {
  const pathname = usePathname();

  if (pathname === "/maintenance" || pathname.startsWith("/product/checkout")) {
    return null;
  }

  return (
    <footer
      className="w-full bg-secondary text-gray-700 py-4 px-4 md:px-10 border-t fixed bottom-0"
    >
        <p className="leading-relaxed text-center text-sm">
            <span className="font-semibold text-gray-800 text-center">Legal Disclaimer</span>
          <span className="font-semibold">Intuit</span>, QuickBooks, QuickBooks ProAdvisor and logo are registered trademarks of Intuit Inc.
          Used here with permission under the QuickBooks ProAdvisor Agreement. Terms and conditions, features, support, pricing, and service options are subject to change without notice.
        </p>
    </footer>
  )
}

export default Footer
