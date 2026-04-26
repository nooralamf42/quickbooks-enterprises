// components/Stepper.js
'use client';

import { useSteps } from "@/app/hooks/useSteps";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function Stepper() {
  const {step}  = useSteps()
  const currentStep = step
  const steps = [
    "Login",
    "Review", 
    "Payment",
  ];

  // const nextStep = () => {
  //   if (currentStep < steps.length) {
  //     const newStep = currentStep + 1;
  //     setCurrentStep(newStep);
  //     if (onStepChange) {
  //       onStepChange(newStep);
  //     }
  //   }
  // };

  // const prevStep = () => {
  //   if (currentStep > 1) {
  //     const newStep = currentStep - 1;
  //     setCurrentStep(newStep);
  //     if (onStepChange) {
  //       onStepChange(newStep);
  //     }
  //   }
  // };

  const getStepStatus = (stepNumber:number) => {
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'current';
    return 'pending';
  };

  const router = useRouter()
  const pathName = usePathname()
  const searchParams = useSearchParams()
  useEffect(()=>{
    const paymentID = searchParams.get('payment')
    if(step===0){
      router.push('/login?payment=' + paymentID)
    }
    if(step===2){
      if(paymentID) router.push('/checkout?payment=' + paymentID)
      else router.push('/broken-link')
    }
  },[pathName])

  return (
    <div className="w-full bg-secondary px-5 py-10">
      <ol className="flex max-w-[700px] mx-auto items-center  justify-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const status = getStepStatus(stepNumber);
          const isLast = index === steps.length - 1;

          return (
            <li 
              key={stepNumber}
              className={`flex items-center ${
                !isLast 
                  ? `after:content-[''] w-full after:w-full after:h-1 after:border-b after:border-4 after:inline-block ${
                      status === 'completed' 
                        ? 'after:border-[#2ca01c]' 
                        : 'after:border-gray-400'
                    }`
                  : 'w-fit'
              }`}
            >
              <button
                // onClick={() => handleStepClick(stepNumber)}
                disabled={stepNumber > currentStep + 1}
                className={`flex relative items-center justify-center w-10 h-10 lg:h-12 lg:w-12 rounded-full shrink-0 transition-all duration-200 ring-4 ${
                  status === 'completed'
                    ? 'bg-[#2ca01c] text-white hover:[#2ca01c] ring-green-500 cursor-pointer'
                    : status === 'current'
                    ? ' text-[#2ca01c]  ring-4 ring-[#2ca01c]'
                    : 'bg-gray-100 text-gray-500 ring-gray-400 cursor-not-allowed'
                } ${
                  stepNumber <= currentStep + 1 && status !== 'pending'
                    ? 'hover:scale-105 '
                    : ''
                }`}
                title={step}
              >
                {status === 'completed' ? (
                  <svg 
                    className="w-3.5 h-3.5 lg:w-4 lg:h-4" 
                    aria-hidden="true" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 16 12"
                  >
                    <path 
                      stroke="currentColor" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M1 5.917 5.724 10.5 15 1.5"
                    />
                  </svg>
                ) : (
                  <span className="text-sm lg:text-base font-semibold">
                    {stepNumber}
                  </span>
                )}
                <span className="text-sm lg:text-base text-black font-semibold absolute top-14 text-center">
                {step}
              </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Navigation Buttons */}
      {/* <div className="flex justify-between mt-8">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            currentStep === 1
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Previous
        </button>

        <button
          onClick={nextStep}
          disabled={currentStep === steps.length}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            currentStep === steps.length
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-[#2ca01c] text-white hover:[#2ca01c] dark:bg-blue-800 dark:hover:[#2ca01c]'
          }`}
        >
          {currentStep === steps.length ? 'Complete' : 'Next'}
        </button>
      </div> */}
    </div>
  );
}
