import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="XTools"
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      <span className="brand-gradient grid size-9 place-items-center rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="white"
            strokeWidth="2.75"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="text-[1.35rem] leading-none font-extrabold tracking-tight">
        <span className="brand-text">X</span>
        <span className="text-fg">Tools</span>
      </span>
    </Link>
  );
}
