"use client";

import { useState } from "react";

function GoogleIcon() {
  return (
    <svg className="google-auth-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.61-.2-2.37H12v4.48h6.46c-.28 1.5-1.12 2.77-2.39 3.62v2.96h3.86c2.26-2.08 3.56-5.14 3.56-8.69z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.86-2.96c-1.07.72-2.43 1.14-4.07 1.14-3.13 0-5.78-2.11-6.73-4.95H1.28v3.05C3.25 21.3 7.32 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.32A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.58.38-2.32V6.63H1.28A11.95 11.95 0 0 0 0 12c0 1.93.46 3.75 1.28 5.37l3.99-3.05z" />
      <path fill="#EA4335" d="M12 4.73c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.94 1.17 15.23 0 12 0 7.32 0 3.25 2.7 1.28 6.63l3.99 3.05C6.22 6.84 8.87 4.73 12 4.73z" />
    </svg>
  );
}

export default function GoogleAuthButton({
  className = "",
  disabled = false,
  label = "Continue with Google",
  loadingLabel = "Connecting",
  onClick,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const isDisabled = disabled || isLoading;

  function handleClick() {
    if (isDisabled) return;
    setIsLoading(true);
    window.setTimeout(() => {
      onClick?.();
    }, 180);
  }

  return (
    <button
      className={`google-auth-button${isLoading ? " is-loading" : ""}${className ? ` ${className}` : ""}`}
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={isLoading}
    >
      <span className="google-auth-icon-shell" aria-hidden="true">
        <span className="google-auth-orbit" />
        <GoogleIcon />
      </span>
      <span className="google-auth-label">{isLoading ? loadingLabel : label}</span>
      <span className="google-auth-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}
