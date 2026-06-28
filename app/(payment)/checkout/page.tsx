'use client';

import { useState } from 'react';
import CompanyInfo from './components/companyInfo';
import ContactInfo from './components/contactInfo';
import OrderSummary from './components/orderSummary';
import BusinessAddress from './components/businessAddress';
import StaxPaymentModal from './components/StaxPaymentModal';
import { useUserDetails } from '@/app/hooks/useUserDetails';
import { useSteps } from '@/app/hooks/useSteps';
import useParamPaymentDetails from '@/app/hooks/useParamPaymentDetails';
import { useAuthorizeCheckout } from '@/app/hooks/useAuthorizeCheckout';
import toast from 'react-hot-toast';

export default function CheckoutForm() {
    const { paymentObj } = useParamPaymentDetails({ enableToast: false, noLinkRedirection: true, noLoginRedir: true });
    const { setStep } = useSteps();
    const { setUserDetails } = useUserDetails();
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [isStaxModalOpen, setIsStaxModalOpen] = useState(false);

    const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const [formData, setFormData] = useState({
        companyName: isLocalhost ? 'Acme Corp (Test)'  : '',
        email:       isLocalhost ? 'test@example.com'  : '',
        phone:       isLocalhost ? '555-867-5309'      : '',
        firstName:   isLocalhost ? 'John'              : '',
        lastName:    isLocalhost ? 'Doe'               : '',
        country:     isLocalhost ? 'US'                : '',
        address:     isLocalhost ? '123 Main St'       : '',
        zipCode:     isLocalhost ? '40502'             : '',
        city:        isLocalhost ? 'Lexington'         : '',
        state:       isLocalhost ? 'KY'                : '',
        ein:         '',
    });

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const { checkout: authCheckout, isPending: authIsPending } = useAuthorizeCheckout();

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setUserDetails({ ...formData });

        try {
            if (paymentObj?.gateway === 'Authorize.net') {
                const amountUSD = paymentObj?.total ? paymentObj.total / 100 : undefined;
                await authCheckout({
                    productPath: 'quickbooks-enterprise',
                    quantity: 1,
                    amountUSD,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    companyName: formData.companyName,
                    ein: formData.ein,
                    phone: formData.phone,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    zipCode: formData.zipCode,
                    country: formData.country,
                    agreedToTerms: agreedToTerms ? 'true' : 'false',
                    planDetails: paymentObj?.isService 
                        ? paymentObj.serviceName 
                        : paymentObj?.edition
                        ? paymentObj.edition.toLowerCase() === 'fsp'
                            ? 'QuickBooks Enterprise FSP Edition'
                            : `QuickBooks Enterprise ${paymentObj.edition.charAt(0).toUpperCase() + paymentObj.edition.slice(1)} Edition`
                        : undefined,
                });
            } else {
                // Stax — open the embedded card form modal
                setIsStaxModalOpen(true);
            }
        } catch (err: any) {
            toast.error(err?.message || 'Failed to start checkout. Please try again.');
            setStep(1);
        }
    };

    const amountUSD = paymentObj?.total ? paymentObj.total / 100 : 0;

    return (
        <div className="min-h-screen py-8 px-5">
            <div className="max-w-7xl mx-auto">
                <img className='max-w-[200px] mb-10 mt-5' src="/quickbooks_logo.png" alt="Logo" />
                <div className="mb-8 mt-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Payment</h1>
                    <p className="text-gray-600">Enter billing information to proceed.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <form onSubmit={handleSave} className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
                            <CompanyInfo
                                companyName={formData.companyName}
                                ein={formData.ein}
                                onChange={handleInputChange}
                            />

                            <div className="border-t border-gray-200 my-8" />

                            <ContactInfo
                                email={formData.email}
                                phone={formData.phone}
                                firstName={formData.firstName}
                                lastName={formData.lastName}
                                onChange={handleInputChange}
                            />

                            <div className="border-t border-gray-200 my-8" />

                            <BusinessAddress
                                country={formData.country}
                                address={formData.address}
                                zipCode={formData.zipCode}
                                city={formData.city}
                                state={formData.state}
                                onChange={handleInputChange}
                            />

                            <div className="mt-6 flex items-start">
                                <input
                                    id="terms"
                                    type="checkbox"
                                    required
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    className="focus:ring-[#2ca01c] h-4 w-4 text-[#2ca01c] border-gray-300 rounded cursor-pointer mt-0.5"
                                />
                                <label htmlFor="terms" className="ml-3 text-sm font-medium text-gray-700 cursor-pointer select-none">
                                    I agree to the{' '}
                                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#2ca01c] underline hover:text-[#248a18]">
                                        Terms of Service
                                    </a>.
                                </label>
                            </div>

                            <button
                                disabled={authIsPending}
                                type="submit"
                                className="mt-8 bg-[#2ca01c] hover:bg-[#248a18] text-white px-6 py-2 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {authIsPending ? 'Connecting...' : 'Proceed to Payment'}
                            </button>
                        </div>
                    </form>

                    <div className="lg:col-span-1">
                        <OrderSummary />
                    </div>
                </div>
            </div>

            <StaxPaymentModal
                isOpen={isStaxModalOpen}
                onClose={() => setIsStaxModalOpen(false)}
                amountUSD={amountUSD}
                firstName={formData.firstName}
                lastName={formData.lastName}
                email={formData.email}
                phone={formData.phone}
                planDetails={paymentObj?.isService
                    ? paymentObj.serviceName
                    : paymentObj?.edition
                    ? paymentObj.edition.toLowerCase() === 'fsp'
                        ? 'QuickBooks Enterprise FSP Edition'
                        : `QuickBooks Enterprise ${paymentObj.edition.charAt(0).toUpperCase() + paymentObj.edition.slice(1)} Edition`
                    : undefined
                }
                address={formData.address}
                city={formData.city}
                state={formData.state}
                zipCode={formData.zipCode}
                country={formData.country}
            />
        </div>
    );
}
