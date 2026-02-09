interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  detailColor?: string;
}

export default function StatCard({ label, value, detail, detailColor }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-100 bg-card px-4 py-3 shadow-sm">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
      {detail && (
        <p className={`mt-0.5 text-xs ${detailColor ?? 'text-text-secondary'}`}>
          {detail}
        </p>
      )}
    </div>
  );
}
