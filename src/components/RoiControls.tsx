'use client';

import { BASIS_LABEL, HORIZON_LABEL, type RoiBasis, type RoiHorizon } from '@/lib/roiView';

interface RoiControlsProps {
  horizon: RoiHorizon;
  basis: RoiBasis;
  onHorizon: (h: RoiHorizon) => void;
  onBasis: (b: RoiBasis) => void;
  className?: string;
}

function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; text: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{label}</span>
      <div className="inline-flex rounded-md border border-gray-200 p-0.5 text-xs" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
            className={`rounded px-2 py-1 transition-colors ${
              value === o.key ? 'bg-text-primary text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Horizon [7 years | Career] × Basis [vs S&P 500 | Inflation only] for ROI figures. */
export default function RoiControls({ horizon, basis, onHorizon, onBasis, className = '' }: RoiControlsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <Segment
        label="ROI horizon"
        value={horizon}
        onChange={onHorizon}
        options={[
          { key: '7yr', text: '7 years' },
          { key: 'career', text: 'Career' },
        ]}
      />
      <Segment
        label="Basis"
        value={basis}
        onChange={onBasis}
        options={[
          { key: 'sp', text: BASIS_LABEL.sp },
          { key: 'inflation', text: BASIS_LABEL.inflation },
        ]}
      />
      <span className="text-[11px] text-text-secondary">
        {HORIZON_LABEL[horizon]}
        {horizon === 'career' ? ' · estimated from Census age profiles' : ''}
      </span>
    </div>
  );
}
