'use client'
import { useAdmin } from '@/app/hooks/useAdmin';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

const AdminLogin = () => {
    // Base64 encoded admin password
    const ENCODED_ADMIN_PASS = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;
    
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const admin = useAdmin();
    const router = useRouter(); 

    useEffect(() => {
        checkExistingAuth();
    }, []);

    const checkExistingAuth = () => {
        const stored = localStorage.getItem('adminAuth');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                const now = new Date().getTime();

                if (parsed.expires > now && parsed.passwordHash && ENCODED_ADMIN_PASS) {
                    // Verify stored hash against current encoded password
                    const currentPassword = atob(ENCODED_ADMIN_PASS);
                    const storedPassword = atob(parsed.passwordHash);
                    
                    if (storedPassword === currentPassword) {
                        admin.setAdmin(true);
                        router.push('/admin/create-payment-link');
                        return;
                    }
                }
            } catch (error) {
                console.error('Auth verification failed:', error);
            }
            
            // Remove invalid auth data
            localStorage.removeItem('adminAuth');
        }
    };

    const handleSignIn = (e: React.FormEvent) => {
        e.preventDefault();

        if (!password.trim()) {
            toast.error('Please enter a password');
            return;
        }

        setIsLoading(true);

        try {
            if (!ENCODED_ADMIN_PASS) {
                console.log()
                toast.error('Admin configuration missing');
                setIsLoading(false);
                return;
            }

            const correctPassword = atob(ENCODED_ADMIN_PASS);
            
            if (password.trim() === correctPassword) {
                admin.setAdmin(true);
                toast.success('Login successful!');
                router.push('/admin/create-payment-link');

                if (rememberMe) {
                    const expires = new Date().getTime() + 7 * 24 * 60 * 60 * 1000; // 7 days
                    const passwordHash = btoa(password.trim());
                    localStorage.setItem('adminAuth', JSON.stringify({ 
                        passwordHash, 
                        expires,
                        timestamp: Date.now()
                    }));
                }
            } else {
                toast.error('Invalid password');
            }
        } catch (error) {
            console.error('Login error:', error);
            toast.error('Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Remove any dollar signs and sanitize input
        const sanitizedValue = e.target.value.replace(/[$]/g, '');
        setPassword(sanitizedValue);
    };

    return (
        <div className="mt-20 flex items-center justify-center p-4">
            <form onSubmit={handleSignIn} className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
                <div className="mb-5">
                    <Image src="/logo.svg" className='mx-auto' alt="Intuit Logo" width={100} height={100} />
                </div>

                <h2 className="text-xl font-semibold text-gray-800 text-center mb-8 font-normal">
                    Let's get you in to QuickBooks
                </h2>

                {/* Password Input */}
                <div className="mb-6 relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter Admin Password"
                        value={password}
                        onChange={handlePasswordChange}
                        className="w-full px-4 py-3 border-2 border-[#2ca01c] rounded focus:outline-none focus:border-blue-500 text-gray-700 pr-12"
                        disabled={isLoading}
                        autoComplete="current-password"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        disabled={isLoading}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>

                {/* Remember Me */}
                <div className="flex items-center mb-6">
                    <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        id="rememberMe"
                        className="mr-2"
                        disabled={isLoading}
                    />
                    <label htmlFor="rememberMe" className="text-sm text-gray-700">
                        Remember me for 7 days
                    </label>
                </div>

                {/* Sign In Button */}
                <button
                    type='submit'
                    disabled={isLoading}
                    className="w-full bg-[#2ca01c] hover:bg-[#2CA01C] disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded font-medium transition-colors duration-200 flex items-center justify-center"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Signing in...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            Sign in
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};

export default AdminLogin;