'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

/** Best-effort decode for the optional name/company params — unlike the email param,
 *  these aren't required for the link to be valid, so a bad value just falls back to
 *  blank instead of marking the whole link broken. */
function decodeOptionalParam(raw: string | null): string {
  if (!raw) return '';
  try {
    return atob(raw);
  } catch {
    return '';
  }
}

function SurveyContent() {
  const searchParams = useSearchParams();
  const initialScore = searchParams.get('score');
  const encodedEmail = searchParams.get('u');
  const encodedName = searchParams.get('n');
  const encodedCompany = searchParams.get('co');

  const [score, setScore] = useState<number | null>(initialScore ? parseInt(initialScore, 10) : null);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [decodedEmail, setDecodedEmail] = useState<string | null>(null);
  const [isBrokenLink, setIsBrokenLink] = useState(false);

  const decodedName = decodeOptionalParam(encodedName);
  const decodedCompany = decodeOptionalParam(encodedCompany);

  useEffect(() => {
    if (encodedEmail) {
      try {
        const email = atob(encodedEmail);
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setDecodedEmail(email);
        } else {
          setIsBrokenLink(true);
        }
      } catch (e) {
        setIsBrokenLink(true);
      }
    } else {
      // If there's no email param, we can either allow anonymous surveys or mark as broken.
      // The prompt said: "and if its broken we show broken page", implies we expect the parameter.
      // Let's make it mandatory for a strict link.
      setIsBrokenLink(true);
    }
  }, [encodedEmail]);

  if (isBrokenLink) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-zinc-200 max-w-lg w-full text-center">
          <h2 className="text-2xl font-semibold text-red-600 mb-4">Invalid or Broken Link</h2>
          <p className="text-zinc-600">This survey link appears to be broken or malformed. Please use the original link provided in your email.</p>
        </div>
      </div>
    );
  }

  const submitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score === null) {
      setError('Please select a score.');
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/survey/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score, reason, customerEmail: decodedEmail,
          customerName: decodedName || undefined,
          companyName: decodedCompany || undefined,
          // The browser's own report of itself — server-side User-Agent is the
          // authoritative copy stored, this is just what's shown back to the customer.
          browser: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit survey');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-zinc-200 max-w-lg w-full text-center">
          <h2 className="text-2xl font-semibold text-zinc-900 mb-4">Thank you!</h2>
          <p className="text-zinc-600">Your feedback has been successfully submitted and helps us improve our services.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8 flex justify-center">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-zinc-200 max-w-3xl w-full">
        <p className="text-sm text-zinc-500 mb-6 flex items-center gap-2">
          <span className="text-lg leading-none">→</span> Required
        </p>
        
        <h1 className="text-2xl font-normal text-zinc-900 mb-2 leading-snug">
          Based on your recent interaction, how likely would you be to recommend QuickBooks to a friend or family member?
        </h1>
        {(decodedName || decodedCompany) && (
          <p className="text-sm text-zinc-500 mb-8">
            {decodedName || 'Customer'}{decodedCompany ? ` · ${decodedCompany}` : ''}
          </p>
        )}
        {!decodedName && !decodedCompany && <div className="mb-8" />}

        <form onSubmit={submitSurvey}>
          <div className="mb-12">
            <div className="flex justify-between text-sm text-zinc-600 mb-3 px-2">
              <span>Not at all likely</span>
              <span>Extremely likely</span>
            </div>
            
            <div className="flex border-y border-l border-zinc-300 w-full">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setScore(num)}
                  className={`flex-1 aspect-square md:aspect-auto md:h-16 flex items-center justify-center text-lg border-r border-zinc-300 transition-colors ${
                    score === num ? 'bg-black text-white font-medium' : 'bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          </div>

          <div className="mb-8">
            <label className="block text-xl font-normal text-zinc-900 mb-4">
              Please tell us the main reasons for your score:
            </label>
            <textarea
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-zinc-300 p-4 rounded-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-black text-white px-8 py-3 font-medium disabled:opacity-50 hover:bg-zinc-800 transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SurveyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-zinc-500">Loading survey...</p>
      </div>
    }>
      <SurveyContent />
    </Suspense>
  );
}
