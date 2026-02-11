'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

const LS_SUBMITTED = 'heo_newsletter_submitted';
const LS_DISMISSED = 'heo_newsletter_dismissed';
const SS_BANNER_SHOWN = 'heo_newsletter_banner_shown';

const POPUP_DELAY_MS = 30_000;
const SUPPRESS_DAYS = 7;

export default function NewsletterSignup() {
  const [showPopup, setShowPopup] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Never show if already submitted
    if (localStorage.getItem(LS_SUBMITTED)) return;

    // Check if dismissed recently
    const dismissed = localStorage.getItem(LS_DISMISSED);
    if (dismissed) {
      const daysSince = (Date.now() - new Date(dismissed).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < SUPPRESS_DAYS) {
        // Show banner once per session instead
        if (!sessionStorage.getItem(SS_BANNER_SHOWN)) {
          const t = setTimeout(() => setShowBanner(true), 5000);
          return () => clearTimeout(t);
        }
        return;
      }
    }

    // Timer trigger
    const timer = setTimeout(() => {
      if (!hasTriggered.current) {
        hasTriggered.current = true;
        setShowPopup(true);
      }
    }, POPUP_DELAY_MS);

    // Navigation trigger (3 route changes)
    let navCount = 0;
    const onNav = () => {
      navCount++;
      if (navCount >= 3 && !hasTriggered.current) {
        hasTriggered.current = true;
        setShowPopup(true);
      }
    };

    window.addEventListener('popstate', onNav);
    const origPush = history.pushState.bind(history);
    history.pushState = function (...args) {
      origPush(...args);
      onNav();
    };

    return () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', onNav);
      history.pushState = origPush;
    };
  }, []);

  // ESC to dismiss popup
  useEffect(() => {
    if (!showPopup) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismissPopup();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) return;

      setStatus('loading');
      setErrorMsg('');

      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), source: showBanner ? 'banner' : 'popup' }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to subscribe');
        }

        setStatus('success');
        localStorage.setItem(LS_SUBMITTED, new Date().toISOString());
        trackEvent('newsletter_signup', { source: showBanner ? 'banner' : 'popup' });

        setTimeout(() => {
          setShowPopup(false);
          setShowBanner(false);
        }, 2000);
      } catch (err) {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      }
    },
    [email, showBanner],
  );

  const handleDismissPopup = useCallback(() => {
    setShowPopup(false);
    localStorage.setItem(LS_DISMISSED, new Date().toISOString());
    trackEvent('newsletter_dismiss');

    if (!sessionStorage.getItem(SS_BANNER_SHOWN)) {
      setTimeout(() => setShowBanner(true), 3000);
    }
  }, []);

  const handleBannerClick = useCallback(() => {
    setShowBanner(false);
    sessionStorage.setItem(SS_BANNER_SHOWN, 'true');
    trackEvent('newsletter_banner_click');
    setShowPopup(true);
  }, []);

  const handleBannerDismiss = useCallback(() => {
    setShowBanner(false);
    sessionStorage.setItem(SS_BANNER_SHOWN, 'true');
  }, []);

  return (
    <>
      {/* Popup modal */}
      {showPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <button
              onClick={handleDismissPopup}
              className="absolute right-3 top-3 text-lg text-text-secondary hover:text-text-primary"
            >
              &times;
            </button>
            <h2 className="text-lg font-semibold text-text-primary">Stay Updated</h2>
            <p className="mt-1.5 text-sm text-text-secondary">
              Get notified when we add new data, features, and insights about education outcomes.
            </p>
            {status === 'success' ? (
              <p className="mt-4 text-sm font-medium text-earn-above">Thanks for subscribing!</p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                  >
                    {status === 'loading' ? 'Sending...' : 'Subscribe'}
                  </button>
                </div>
                {status === 'error' && (
                  <p className="mt-2 text-xs text-red-500">{errorMsg}</p>
                )}
                <p className="mt-2 text-[10px] text-text-secondary">
                  No spam, unsubscribe anytime. We only store your email.
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Reminder banner */}
      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="text-sm text-text-secondary">
              Want updates on new education data and features?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBannerClick}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
              >
                Subscribe
              </button>
              <button
                onClick={handleBannerDismiss}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
