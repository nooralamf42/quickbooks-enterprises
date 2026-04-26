import Stepper from "@/components/stepper";
export const metadata = {
  title: "Secure Payment Portal",
  description: "Secure Payment Gateway",
};

// app/auth/layout.tsx
export default function PaymentLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="pb-40">
          <Stepper/>
          {children}
        </main>

    );
  }
  