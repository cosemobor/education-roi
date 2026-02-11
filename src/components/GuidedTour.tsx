'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

interface TourStep {
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom';
}

const STEPS: TourStep[] = [
  {
    target: 'welcome',
    title: 'Welcome to HEO',
    content:
      'Explore earnings outcomes by college and major using U.S. Department of Education data. Compare outcomes across 4,000+ programs.',
    position: 'bottom',
  },
  {
    target: 'nav-tabs',
    title: 'Navigate Views',
    content:
      'Switch between major rankings and college rankings using these tabs.',
    position: 'bottom',
  },
  {
    target: 'scatter-chart',
    title: 'Interactive Chart',
    content:
      'Each dot represents a major or school. Click any dot to see details, or use filters to highlight specific groups.',
    position: 'top',
  },
  {
    target: 'about-link',
    title: 'Learn More',
    content:
      'Visit the About page to understand our methodology, data sources, and assumptions.',
    position: 'bottom',
  },
];

const STORAGE_KEY = 'eduroi_tour_completed';
const TOOLTIP_APPROX_H = 180;
const EDGE_PAD = 12;
const SPOTLIGHT_PAD = 8;
const GAP = 12;

function computeTooltipStyle(
  targetRect: DOMRect,
  preferredPosition: 'top' | 'bottom',
): React.CSSProperties {
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  const tooltipW = Math.min(340, viewW - EDGE_PAD * 2);

  // Auto-flip: check space above/below
  const spaceBelow = viewH - targetRect.bottom - SPOTLIGHT_PAD;
  const spaceAbove = targetRect.top - SPOTLIGHT_PAD;
  const isMobile = viewW < 640;

  let placement: 'top' | 'bottom' = isMobile ? 'bottom' : preferredPosition;
  if (placement === 'bottom' && spaceBelow < TOOLTIP_APPROX_H && spaceAbove > spaceBelow) {
    placement = 'top';
  } else if (placement === 'top' && spaceAbove < TOOLTIP_APPROX_H && spaceBelow > spaceAbove) {
    placement = 'bottom';
  }

  // Horizontal: center on target, clamp to viewport
  const targetCenterX = targetRect.left + targetRect.width / 2;
  let left = targetCenterX - tooltipW / 2;
  left = Math.max(EDGE_PAD, Math.min(left, viewW - tooltipW - EDGE_PAD));

  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10001,
    maxWidth: tooltipW,
    width: tooltipW,
    left,
  };

  if (placement === 'bottom') {
    style.top = Math.min(
      targetRect.bottom + SPOTLIGHT_PAD + GAP,
      viewH - TOOLTIP_APPROX_H - EDGE_PAD,
    );
  } else {
    style.bottom = Math.max(
      viewH - targetRect.top + SPOTLIGHT_PAD + GAP,
      EDGE_PAD,
    );
  }

  return style;
}

interface GuidedTourProps {
  restartKey?: number;
}

export default function GuidedTour({ restartKey = 0 }: GuidedTourProps) {
  const [step, setStep] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const prevRestartKey = useRef(restartKey);

  // Auto-start on first visit
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => setStep(0), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Restart when restartKey changes (from the info button)
  useEffect(() => {
    if (restartKey > 0 && restartKey !== prevRestartKey.current) {
      prevRestartKey.current = restartKey;
      setStep(0);
    }
  }, [restartKey]);

  // Scroll target into view and update position
  const updatePosition = useCallback(() => {
    if (step < 0 || step >= STEPS.length) return;
    const target = document.querySelector(`[data-tour="${STEPS[step].target}"]`);
    if (!target) return;

    // Scroll into view if needed
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Small delay to let scroll settle before measuring
    const raf = requestAnimationFrame(() => {
      setRect(target.getBoundingClientRect());
    });
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    if (step < 0) return;

    // Initial position after a brief delay for scroll
    const timer = setTimeout(updatePosition, 100);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [step, updatePosition]);

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setStep(-1);
    setRect(null);
  }, []);

  const handleNext = useCallback(() => {
    if (step >= STEPS.length - 1) {
      trackEvent('tour_complete');
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, finish]);

  const handleSkip = useCallback(() => {
    trackEvent('tour_skip', { step });
    finish();
  }, [step, finish]);

  // ESC key to skip
  useEffect(() => {
    if (step < 0) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleSkip();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [step, handleSkip]);

  if (step < 0 || step >= STEPS.length || !rect) return null;

  const current = STEPS[step];
  const tooltipStyle = computeTooltipStyle(rect, current.position);

  return (
    <>
      {/* Spotlight overlay */}
      <div
        style={{
          position: 'fixed',
          top: rect.top - SPOTLIGHT_PAD,
          left: rect.left - SPOTLIGHT_PAD,
          width: rect.width + SPOTLIGHT_PAD * 2,
          height: rect.height + SPOTLIGHT_PAD * 2,
          borderRadius: 8,
          boxShadow:
            '0 0 0 4px rgba(37, 99, 235, 0.4), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
          pointerEvents: 'none',
          transition: 'all 0.3s ease',
        }}
      />

      {/* Tooltip */}
      <div style={tooltipStyle} className="rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-text-primary">{current.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
          {current.content}
        </p>

        {/* Progress dots */}
        <div className="mt-3 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === step ? 'bg-accent' : i < step ? 'bg-accent/40' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            Skip tour
          </button>
          <button
            onClick={handleNext}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90"
          >
            {step >= STEPS.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}
