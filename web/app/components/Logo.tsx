type Props = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

export function Logo({ size = 28, showWordmark = true, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="m-grad" x1="0" y1="0" x2="40" y2="40">
            <stop offset="0%" stopColor="#00f293" />
            <stop offset="100%" stopColor="#00a35e" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#m-grad)" />
        {/* Stylized "P" */}
        <path
          d="M13 11h9.2c3.9 0 6.8 2.6 6.8 6.4 0 3.8-2.9 6.4-6.8 6.4H17V29h-4V11zm4 3.4v5.9h4.8c1.7 0 2.9-1.2 2.9-2.95s-1.2-2.95-2.9-2.95H17z"
          fill="#04130a"
        />
      </svg>
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight">Payphlo</span>
      )}
    </span>
  );
}
