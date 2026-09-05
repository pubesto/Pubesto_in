import { Sparkles, ShoppingBag } from "lucide-react";

export { Sparkles, ShoppingBag };

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}

export function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h14l-2 9H8L6 7Z" />
      <path d="M6 7 5.4 4H3" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
    </svg>
  );
}

export function InstagramIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect 
        x="2" y="2" width="20" height="20" rx="5" 
        fill="url(#instagram-gradient)" stroke="none" 
      />
      <rect 
        x="5" y="5" width="14" height="14" rx="4" 
        stroke="white" strokeWidth="1.5" 
      />
      <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" />
      <circle cx="16.5" cy="7.5" r="0.75" fill="white" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="none"
    >
      <circle cx="12" cy="12" r="11" fill="#1877F2" />
      <path 
        d="M15 12h-2v7h-3v-7H8v-2.5h2V8.2c0-2 1.2-3.2 3-3.2.9 0 1.6.1 1.9.1v2.1h-1.2c-1 0-1.2.5-1.2 1.2v1.5h2.5L15 12z" 
        fill="white" 
      />
    </svg>
  );
}

export function MenuIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}
