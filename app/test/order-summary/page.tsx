'use client';

import { useState } from 'react';
import CompanyInfo from '@/app/(payment)/order-summary/components/companyInfo';
import ContactInfo from '@/app/(payment)/order-summary/components/contactInfo';
import OrderSummary from './components/orderSummary';
import BusinessAddress from '@/app/(payment)/order-summary/components/businessAddress';
import { useUserDetails } from '@/app/hooks/useUserDetails';
import { useSteps } from '@/app/hooks/useSteps';
import useParamPaymentDetails from '@/app/hooks/useParamPaymentDetails';

import { useAuthorizeCheckout } from '@/app/hooks/useAuthorizeCheckout';
import toast from 'react-hot-toast';
import SignatureCanvas from 'react-signature-canvas';
import { useRef } from 'react';

export default function CheckoutForm() {
    const { paymentObj } = useParamPaymentDetails({ enableToast: false, noLinkRedirection: true, noLoginRedir: true });
    const { setStep, step } = useSteps();
    const { setUserDetails } = useUserDetails();
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const [clientSignatureBase64, setClientSignatureBase64] = useState<string>('');
    const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
    const [typedSignature, setTypedSignature] = useState('');
    const sigCanvas = useRef<SignatureCanvas>(null);

    const updateTypedSignature = (text: string) => {
        setTypedSignature(text);
        if (!text.trim()) {
            setClientSignatureBase64('');
            return;
        }
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            tempCtx.font = '56px "Caveat", cursive';
            const metrics = tempCtx.measureText(text);
            const textWidth = Math.max(metrics.width, 50);
            
            const canvas = document.createElement('canvas');
            canvas.width = textWidth + 20;
            canvas.height = 70;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Keep background transparent for cleaner PDF rendering
                ctx.font = '56px "Caveat", cursive';
                ctx.fillStyle = 'black';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, canvas.width / 2, canvas.height / 2);
                setClientSignatureBase64(canvas.toDataURL('image/png'));
            }
        }
    };

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
        ein:         '',
    });

    const getTrimmedDataURL = (sigCanvasRef: any) => {
        if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) return '';
        const canvas = sigCanvasRef.current.getCanvas();
        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) return canvas.toDataURL('image/png');
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const l = pixels.data.length;
            const bound = { top: null as number | null, left: null as number | null, right: null as number | null, bottom: null as number | null };
            
            for (let i = 0; i < l; i += 4) {
                if (pixels.data[i + 3] > 0) {
                    const x = (i / 4) % canvas.width;
                    const y = Math.floor((i / 4) / canvas.width);
                    if (bound.top === null) bound.top = y;
                    if (bound.left === null) bound.left = x;
                    else if (x < bound.left) bound.left = x;
                    if (bound.right === null) bound.right = x;
                    else if (bound.right < x) bound.right = x;
                    if (bound.bottom === null) bound.bottom = y;
                    else if (bound.bottom < y) bound.bottom = y;
                }
            }
            
            if (bound.top === null || bound.bottom === null || bound.left === null || bound.right === null) return canvas.toDataURL('image/png');
            
            const p = 6;
            const trimHeight = bound.bottom - bound.top + p * 2;
            const trimWidth = bound.right - bound.left + p * 2;
            const trimmed = document.createElement('canvas');
            trimmed.width = trimWidth;
            trimmed.height = trimHeight;
            const tCtx = trimmed.getContext('2d');
            if (tCtx) {
                const sx = Math.max(0, bound.left - p);
                const sy = Math.max(0, bound.top - p);
                const sw = Math.min(canvas.width - sx, trimWidth);
                const sh = Math.min(canvas.height - sy, trimHeight);
                tCtx.putImageData(ctx.getImageData(sx, sy, sw, sh), 0, 0);
            }
            return trimmed.toDataURL('image/png');
        } catch (e) {
            return canvas.toDataURL('image/png');
        }
    };

    const handleInputChange = (field: string, value: string): void => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const { checkout: authCheckout, isPending: authIsPending } = useAuthorizeCheckout();

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
                ein: formData.ein,
                phone: formData.phone,
                address: formData.address,
                city: formData.city,
                state: formData.state,
                zipCode: formData.zipCode,
                country: formData.country,
                agreedToTerms: agreedToTerms ? 'true' : 'false',
                clientSignatureBase64: clientSignatureBase64,
                planDetails: paymentObj?.isService 
                    ? paymentObj.serviceName 
                    : paymentObj?.edition
                    ? paymentObj.edition.toLowerCase() === 'fsp'
                        ? 'QuickBooks Enterprise FSP Edition'
                        : `QuickBooks Enterprise ${paymentObj.edition.charAt(0).toUpperCase() + paymentObj.edition.slice(1)} Edition`
                    : undefined,
            };

            if (paymentObj?.gateway === 'Authorize.net') {
                await authCheckout(payload);
            } else {
                throw new Error('No valid payment gateway selected.');
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
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Payment (Test Flow)</h1>
                    <p className="text-gray-600">Enter billing information to proceed.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <form onSubmit={handleSave} className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
                            <CompanyInfo
                                companyName={formData.companyName}
                                ein={formData.ein}
                                onChange={handleInputChange}
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

                            <div className="border-t border-gray-200 my-8" />
                            
                            {/* Signature Pad */}
                            <div className="mt-6 mb-8">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Please sign below to authorize this payment <span className="text-red-500">*</span>
                                </label>
                                
                                <div className="flex space-x-4 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSignatureMode('draw');
                                            if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
                                                setClientSignatureBase64(getTrimmedDataURL(sigCanvas));
                                            } else {
                                                setClientSignatureBase64('');
                                            }
                                        }}
                                        className={`px-4 py-2 text-sm font-medium rounded-md ${signatureMode === 'draw' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        Draw Signature
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSignatureMode('type');
                                            updateTypedSignature(typedSignature);
                                        }}
                                        className={`px-4 py-2 text-sm font-medium rounded-md ${signatureMode === 'type' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        Type Signature
                                    </button>
                                </div>

                                {signatureMode === 'draw' ? (
                                    <>
                                        <div className="border-2 border-gray-300 rounded-md bg-white" style={{ height: '150px' }}>
                                            <SignatureCanvas 
                                                ref={sigCanvas}
                                                penColor="black"
                                                canvasProps={{ className: 'w-full h-full' }}
                                                onEnd={() => {
                                                    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
                                                        setClientSignatureBase64(getTrimmedDataURL(sigCanvas));
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="flex justify-end mt-2">
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    sigCanvas.current?.clear();
                                                    setClientSignatureBase64('');
                                                }}
                                                className="text-sm text-gray-500 hover:text-gray-700"
                                            >
                                                Clear Signature
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="border border-gray-300 rounded-md bg-white p-6">
                                        <div className="mb-4">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                                Enter your full name
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. John Doe"
                                                value={typedSignature}
                                                onChange={(e) => updateTypedSignature(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2ca01c] focus:border-transparent text-gray-900"
                                            />
                                        </div>
                                        
                                        <div className="mt-4">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                                Preview
                                            </label>
                                            <div className="relative bg-gray-50 rounded-md border border-gray-200 h-32 flex items-center justify-center overflow-hidden">
                                                {/* Signature Line */}
                                                <div className="absolute bottom-8 left-8 right-8 border-b-2 border-gray-300"></div>
                                                
                                                {/* X Mark */}
                                                <div className="absolute bottom-9 left-8 text-gray-400 font-bold text-lg">X</div>
                                                
                                                {/* Signature Text */}
                                                {typedSignature ? (
                                                    <div 
                                                        className="text-5xl text-black z-10 select-none" 
                                                        style={{ fontFamily: '"Caveat", cursive' }}
                                                    >
                                                        {typedSignature}
                                                    </div>
                                                ) : (
                                                    <div 
                                                        className="text-2xl text-gray-300 z-10 select-none"
                                                        style={{ fontFamily: '"Caveat", cursive' }}
                                                    >
                                                        Your Signature
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

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
                                 disabled={authIsPending || !clientSignatureBase64}
                                 type="submit"
                                 className="mt-8 bg-[#2ca01c] hover:bg-[#248a18] text-white px-6 py-2 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                             >
                                {authIsPending ? 'Connecting...' : 'Proceed to Payment'}
                            </button>

                            {authIsPending && (
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
