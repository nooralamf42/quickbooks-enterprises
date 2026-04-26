'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import usePlanDetails from '@/app/hooks/usePlanDetails';
import Loader from '@/components/loader';
import toast from 'react-hot-toast';
import CompanyInfo from '@/app/(payment)/checkout/components/companyInfo';
import ContactInfo from '@/app/(payment)/checkout/components/contactInfo';
import BusinessAddress from '@/app/(payment)/checkout/components/businessAddress';
import { useCreateGuestUser } from '@/app/hooks/useCreateGuestUser';
import { useUserDetails } from '@/app/hooks/useUserDetails';

export default function QualityBusinessCheckout() {
    const searchParams = useSearchParams();
    const planParam = searchParams.get('plan');
    const { planObj } = usePlanDetails({ enableToast: false, noLinkRedirection: true, noLoginRedir: true });
    
    // We maintain steps internally: 'login' -> 'password' -> 'review'
    const [step, setStep] = useState<'login' | 'password' | 'review'>('login');
    const [subStep, setSubStep] = useState(0); // 0 means form not submitted, 3 means ready to pay
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const {setUserDetails, userDetails} = useUserDetails()
    const {mutateAsync, isPending} = useCreateGuestUser()
    const [formData, setFormData] = useState({
        companyName: '',
        email: '',
        phone: '',
        firstName: '',
        lastName: '',
        country: '',
        address: '',
        zipCode: '',
        city: '',
        state: ''
    });

    if (!planParam) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <p className="text-xl font-medium text-gray-700">Invalid or missing plan parameter.</p>
            </div>
        )
    }

    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) {
            setFormData(prev => ({ ...prev, email }));
            setStep('password');
        }
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password) {
            toast.success('Login successful');
            setStep('review');
        }
    };

    const handleInputChange = (field: any, value: string): void => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        mutateAsync({firstName: formData.firstName, lastName: formData.lastName, email: formData.email}).then((res) => {
            setUserDetails({...formData, guestUserId: res.id})
            setSubStep(3)
            toast.success('Saved Details')
        }).catch(()=>{
            toast.error('Internal Server Error! Try again')
        })
    };



    const isEnterprise = planObj?.name.toLowerCase() === 'enterprise';

    return (
        <div className="min-h-screen font-sans flex items-center justify-center p-4">
            
            {/* Login Step */}
            {step === 'login' && (
                <div className="bg-[#f8f9fa] w-full min-h-screen flex items-center justify-center">
                    <form onSubmit={handleLoginSubmit} className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
                        <div className="mb-5 flex justify-center">
                            <img src="https://i.ibb.co/hxSPxyVG/69b41eb99fc693b2ed54dd3f-unnamed-10-removebg-preview-1.png" alt="Quality Business Logo" className="h-[60px] object-contain mx-auto" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800 text-center mb-8 font-normal">
                            Sign in to Quality Business
                        </h2>
                        <div className="mb-6">
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                required
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-black rounded focus:outline-none focus:border-gray-500 text-gray-700 font-sans"
                            />
                        </div>
                        <button
                            type='submit'  
                            className="w-full bg-black hover:bg-gray-800 text-white py-3 px-4 rounded font-medium transition-colors duration-200 flex items-center justify-center font-sans tracking-wide"
                        >
                            Continue
                        </button>
                    </form>
                </div>
            )}

            {/* Password Step */}
            {step === 'password' && (
                <div className="bg-[#f8f9fa] w-full min-h-screen flex items-center justify-center">
                    <form onSubmit={handlePasswordSubmit} className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
                        <div className="mb-5 flex justify-center">
                            <img src="https://i.ibb.co/hxSPxyVG/69b41eb99fc693b2ed54dd3f-unnamed-10-removebg-preview-1.png" alt="Quality Business Logo" className="h-[60px] object-contain mx-auto" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800 text-center mb-2 font-normal">
                            Enter your password
                        </h2>
                        <div className="text-center mb-2">
                            <span className="text-gray-700">{email}</span>
                        </div>
                        <div className="text-center mb-6">
                            <button
                                onClick={() => setStep('login')}
                                type="button"
                                className="text-gray-600 hover:text-black text-sm underline"
                            >
                                Use a different account
                            </button>
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm mb-2 font-medium">Password</label>
                            <div className="relative">
                                <input
                                    required
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-black rounded focus:outline-none focus:border-gray-500 text-gray-700 pr-12 font-sans"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 hover:text-gray-800"
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <button
                            type='submit'
                            className="w-full bg-black hover:bg-gray-800 text-white py-3 px-4 rounded font-medium transition-colors duration-200 mb-6 font-sans tracking-wide"
                        >
                            Sign in
                        </button>
                    </form>
                </div>
            )}

            {/* Review / Order Summary Step */}
            {step === 'review' && (
                <div className="w-full min-h-screen py-8 pt-0">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex justify-between items-center mb-10 mt-5">
                            <img className='max-w-[200px]' src="https://i.ibb.co/hxSPxyVG/69b41eb99fc693b2ed54dd3f-unnamed-10-removebg-preview-1.png" alt="Quality Business Logo" />
                            <Link href="/" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md text-sm font-medium transition-colors">
                                Home
                            </Link>
                        </div>
                        <div className="mb-8 mt-10">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Purchase</h1>
                            <p className="text-gray-600">Enter billing information to proceed with your Quality Business plan.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Form Section */}
                            <form onSubmit={handleSave} className="lg:col-span-2">
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
                                    <CompanyInfo companyName={formData.companyName} onChange={(value: string) => handleInputChange('companyName', value)} />
                                    <div className="border-t border-gray-200 my-8"></div>
                                    <ContactInfo email={formData.email} phone={formData.phone} firstName={formData.firstName} lastName={formData.lastName} onChange={handleInputChange} />
                                    <div className="border-t border-gray-200 my-8"></div>
                                    <BusinessAddress country={formData.country} address={formData.address} zipCode={formData.zipCode} city={formData.city} state={formData.state} onChange={handleInputChange} />
                                    {subStep !== 3 && (
                                        <button
                                            disabled={isPending}
                                            type="submit"
                                            className="mt-8 bg-black hover:bg-gray-800 text-white px-8 py-3 rounded-md font-medium transition-colors cursor-pointer w-full md:w-auto"
                                        >
                                            {isPending ? 'Saving...' : 'Save and Continue'}
                                        </button>
                                    )}
                                </div>
                            </form>

                            {/* Order Summary Section */}
                            <div className="lg:col-span-1">
                                {!planObj ? <Loader/> : (
                                    <div className={`rounded-lg p-6 shadow-md border ${isEnterprise ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-900 border-gray-100'} font-sans`}>
                                        <h2 className={`text-xl font-semibold mb-6 ${isEnterprise ? 'text-white' : 'text-gray-900'}`}>Order Summary</h2>
                                        
                                        <div className="flex flex-col space-y-6">
                                            <div>
                                                <h3 className={`font-medium text-lg ${isEnterprise ? 'text-white' : 'text-gray-900'}`}>
                                                    {planObj.name}
                                                </h3>
                                                {planObj.popular && (
                                                    <span className="inline-block mt-2 bg-black text-white text-xs font-bold px-2 py-1 rounded border border-white">Most Popular</span>
                                                )}
                                            </div>

                                            <div className="mb-2">
                                                <span className="text-3xl font-bold tracking-tight">${planObj.price}</span>
                                                <span className={`text-sm ${isEnterprise ? 'text-gray-400' : 'text-gray-500'} ml-1`}>per year</span>
                                            </div>

                                            <p className={`text-sm ${isEnterprise ? 'text-gray-300' : 'text-gray-600'} h-auto pb-4`}>
                                                {planObj.description}
                                            </p>

                                            <div className="space-y-3 pb-4">
                                                <p className={`font-semibold text-sm ${isEnterprise ? 'text-white' : 'text-gray-900'} mb-2`}>What's included?</p>
                                                {planObj.features.map((feature: string, idx: number) => (
                                                    <div key={idx} className="flex items-start">
                                                        <span className={`mr-2 ${isEnterprise ? 'text-gray-400' : 'text-gray-400'}`}>•</span>
                                                        <span className={`text-sm ${isEnterprise ? 'text-gray-300' : 'text-gray-600'}`}>{feature}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="border-t border-gray-200 pt-4 mt-4">
                                                <div className="flex justify-between items-center">
                                                    <span className={`text-lg font-semibold ${isEnterprise ? 'text-white' : 'text-gray-900'}`}>Total due today</span>
                                                    <span className={`text-xl font-bold ${isEnterprise ? 'text-white' : 'text-gray-900'}`}>${planObj.price}</span>
                                                </div>
                                            </div>

                                            {subStep === 3 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        alert('this feature is not available for now');
                                                    }}
                                                    className={`mt-6 w-full px-6 py-3 border border-transparent rounded-md font-medium transition-colors cursor-pointer text-center text-md ${isEnterprise ? 'bg-white text-black hover:bg-gray-100' : 'bg-black text-white hover:bg-gray-800'}`}
                                                >
                                                    Pay Now
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
