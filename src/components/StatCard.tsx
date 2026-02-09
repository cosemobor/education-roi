interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  detailColor?: string;
}

export default function StatCard({ label, value, detail, detailColor }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-100 bg-card px-3 py-2 shadow-sm sm:px-4 sm:py-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 text-xl font-bold text-text-primary sm:text-2xl">{value}</p>
      {detail && (
        <p className={`mt-0.5 truncate text-xs ${detailColor ?? 'text-text-secondary'}`}>
          {detail}
        </p>
      )}
    </div>
  );
}
