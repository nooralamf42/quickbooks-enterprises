'use client';

import { useState } from 'react';
import CompanyInfo from './components/companyInfo';
import ContactInfo from './components/contactInfo';
import OrderSummary from './components/orderSummary';
import BusinessAddress from './components/businessAddress';
import { useUserDetails } from '@/app/hooks/useUserDetails';
import { useSteps } from '@/app/hooks/useSteps';
import useParamPaymentDetails from '@/app/hooks/useParamPaymentDetails';
import { useFastspringCheckout } from '@/app/hooks/useFastspringCheckout';
import { useAuthorizeCheckout } from '@/app/hooks/useAuthorizeCheckout';
import toast from 'react-hot-toast';

/**
 * Checkout page — collects billing info then redirects to payment.
 *
 * Payment flow:
 *  1. User fills in company / contact / address
 *  2. On submit, checks gateway flag in URL token.
 *  3. Routes to FastSpring or Authorize.net hook.
 */
export default function CheckoutForm() {
    const { paymentObj } = useParamPaymentDetails({ enableToast: false, noLinkRedirection: true, noLoginRedir: true });
    const { setStep, step } = useSteps();
    const { setUserDetails } = useUserDetails();
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const [formData, setFormData] = useState({
        companyName: isLocalhost ? 'Acme Corp (Test)'      : '',
        email:       isLocalhost ? 'test@example.com'       : '',
        phone:       isLocalhost ? '555-867-5309'           : '',
        firstName:   isLocalhost ? 'John'                   : '',
        lastName:    isLocalhost ? 'Doe'                    : '',
        country:     isLocalhost ? 'US'                     : '',
        address:     isLocalhost ? '123 Main St'            : '',
        zipCode:     isLocalhost ? '40502'                  : '',
        city:        isLocalhost ? 'Lexington'              : '',
        state:       isLocalhost ? 'KY'                     : '',
    });

    const handleInputChange = (field: string, value: string): void => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const { checkout, isPending } = useFastspringCheckout();
    const { checkout: authCheckout, isPending: authIsPending } = useAuthorizeCheckout();
    
    const isProcessing = isPending || authIsPending;

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setUserDetails({ ...formData });

        const amountUSD = paymentObj?.total ? paymentObj.total / 100 : undefined;

        try {
            const payload = {
                productPath: 'quickbooks-enterprise',
                quantity: 1,
                amountUSD,
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                companyName: formData.companyName,
                phone: formData.phone,
                address: formData.address,
                city: formData.city,
                state: formData.state,
                zipCode: formData.zipCode,
                country: formData.country,
                agreedToTerms: agreedToTerms ? 'true' : 'false',
            };

            if (paymentObj?.gateway === 'Authorize.net') {
                await authCheckout(payload);
            } else {
                await checkout(payload);
            }
        } catch (err: any) {
            toast.error(err?.message || 'Failed to start checkout. Please try again.');
            setStep(1); 
        }
    };

    return (
        <div className="min-h-screen py-8 px-5">
            <div className="max-w-7xl mx-auto">
                <img className='max-w-[200px] mb-10 mt-5' src="/quickbooks_logo.png" alt="Logo" />
                <div className="mb-8 mt-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Payment</h1>
                    <p className="text-gray-600">Enter billing information to proceed.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <form onSubmit={handleSave} className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
                            <CompanyInfo
                                companyName={formData.companyName}
                                onChange={(value: string) => handleInputChange('companyName', value)}
                            />

                            <div className="border-t border-gray-200 my-8"></div>

                            <ContactInfo
                                email={formData.email}
                                phone={formData.phone}
                                firstName={formData.firstName}
                                lastName={formData.lastName}
                                onChange={handleInputChange}
                            />

                            <div className="border-t border-gray-200 my-8"></div>

                            <BusinessAddress
                                country={formData.country}
                                address={formData.address}
                                zipCode={formData.zipCode}
                                city={formData.city}
                                state={formData.state}
                                onChange={handleInputChange}
                            />

                             <div className="mt-6 flex items-start">
                                 <div className="flex items-center h-5">
                                     <input
                                         id="terms"
                                         name="terms"
                                         type="checkbox"
                                         required
                                         checked={agreedToTerms}
                                         onChange={(e) => setAgreedToTerms(e.target.checked)}
                                         className="focus:ring-[#2ca01c] h-4 w-4 text-[#2ca01c] border-gray-300 rounded cursor-pointer"
                                     />
                                 </div>
                                 <div className="ml-3 text-sm">
                                     <label htmlFor="terms" className="font-medium text-gray-700 cursor-pointer select-none">
                                         I agree to the{' '}
                                         <a
                                             href="/terms"
                                             target="_blank"
                                             rel="noopener noreferrer"
                                             className="text-[#2ca01c] underline hover:text-[#248a18]"
                                         >
                                             Terms of Service
                                         </a>
                                         .
                                     </label>
                                 </div>
                             </div>

                             <button
                                 disabled={isProcessing}
                                 type="submit"
                                 className="mt-8 bg-[#2ca01c] hover:bg-[#248a18] text-white px-6 py-2 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                             >
                                {isProcessing ? 'Connecting...' : 'Proceed to Payment'}
                            </button>

                            {isProcessing && (
                                <p className="mt-3 text-sm text-gray-500">
                                    Connecting to secure checkout — please wait…
                                </p>
                            )}
                        </div>
                    </form>

                    {/* Order Summary Section */}
                    <div className="lg:col-span-1">
                        <OrderSummary />
                    </div>
                </div>
            </div>
        </div>
    );
}
