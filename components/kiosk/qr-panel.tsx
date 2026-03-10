export function QRPanel() {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col items-center gap-4 h-full">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground self-start">
        Book from Your Phone
      </p>

      {/* QR code placeholder */}
      <div
        className="rounded-xl bg-secondary flex items-center justify-center w-36 h-36 shrink-0"
        aria-label="QR code placeholder"
        role="img"
      >
        <QRCodeIcon className="w-24 h-24 text-muted-foreground opacity-50" />
      </div>

      <p className="text-xs text-center text-muted-foreground leading-relaxed">
        Scan to open this room's booking page
      </p>
    </div>
  );
}

function QRCodeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      {/* Top-left finder pattern */}
      <rect x="5" y="5" width="30" height="30" rx="4" stroke="currentColor" strokeWidth="5" />
      <rect x="14" y="14" width="12" height="12" rx="2" fill="currentColor" />
      {/* Top-right finder pattern */}
      <rect x="65" y="5" width="30" height="30" rx="4" stroke="currentColor" strokeWidth="5" />
      <rect x="74" y="14" width="12" height="12" rx="2" fill="currentColor" />
      {/* Bottom-left finder pattern */}
      <rect x="5" y="65" width="30" height="30" rx="4" stroke="currentColor" strokeWidth="5" />
      <rect x="14" y="74" width="12" height="12" rx="2" fill="currentColor" />
      {/* Data modules (simplified dots) */}
      <rect x="45" y="5" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="55" y="5" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="45" y="15" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="55" y="25" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="5" y="45" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="15" y="55" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="5" y="55" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="45" y="45" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="55" y="45" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="65" y="45" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="75" y="45" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="85" y="45" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="45" y="55" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="65" y="55" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="85" y="55" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="45" y="65" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="55" y="65" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="75" y="65" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="45" y="75" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="65" y="75" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="85" y="75" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="45" y="85" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="55" y="85" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="75" y="85" width="8" height="8" rx="1.5" fill="currentColor" />
      <rect x="85" y="85" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}
