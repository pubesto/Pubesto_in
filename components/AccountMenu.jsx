"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Eye, EyeOff, LogOut, Package, RotateCcw, Truck, User } from "lucide-react";
import { useStore } from "./StoreContext";
import GoogleAuthButton from "./GoogleAuthButton";

function getInitials(name) {
  return (name || "C").split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
}

export default function AccountMenu() {
  const { isLoggedIn, user, logout, refreshAuthSession } = useStore();
  const router = useRouter();
  const containerRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("success");
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState("");

  useEffect(() => () => clearTimeout(hoverTimeoutRef.current), []);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function open() {
    clearTimeout(hoverTimeoutRef.current);
    setIsOpen(true);
  }

  function scheduleClose() {
    hoverTimeoutRef.current = setTimeout(() => {
      // Keep the popover open while the user is typing in it.
      if (!document.activeElement?.closest(".pb-popover")) setIsOpen(false);
    }, 300);
  }

  function switchMode(mode) {
    setAuthMode(mode);
    setMessage("");
    setResetUrl("");
    setShowPassword(false);
  }

  function startGoogleAuth() {
    const redirect = `${window.location.pathname}${window.location.search || ""}`;
    window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirect)}`;
  }

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageKind("success");

    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");
      const name = `${String(formData.get("firstName") || "").trim()} ${String(formData.get("lastName") || "").trim()}`.trim();
      const phone = String(formData.get("phone") || "").trim();

      const isSignup = authMode === "signup";
      const response = await fetch(isSignup ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSignup ? { name, email, phone, password } : { email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "Authentication failed.");
        setMessageKind("error");
        return;
      }

      const nextUser = await refreshAuthSession?.();
      if (!nextUser && !data.user) {
        setMessage("Account created, but session could not load.");
        setMessageKind("error");
        setAuthMode("login");
        return;
      }

      setMessage("Successfully signed in!");
      setTimeout(() => {
        setIsOpen(false);
        setMessage("");
      }, 900);
    } catch {
      setMessage("Network error. Please try again.");
      setMessageKind("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageKind("success");

    try {
      const email = String(new FormData(event.currentTarget).get("email") || "").trim().toLowerCase();
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "Password reset failed.");
        setMessageKind("error");
        return;
      }

      setMessage(data.resetPath ? "Password reset link is ready for local testing." : data.message || "Reset link sent!");
      setResetUrl(data.resetPath || data.resetUrl || "");
    } catch {
      setMessage("Network error. Please try again.");
      setMessageKind("error");
    } finally {
      setLoading(false);
    }
  }

  const firstName = user?.name?.split(" ")[0];

  return (
    <div
      className="pb-account"
      ref={containerRef}
      onMouseEnter={open}
      onMouseLeave={scheduleClose}
    >
      <button
        className="pb-icon-btn"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => router.push(isLoggedIn ? "/account" : "/account/login")}
        onFocus={open}
      >
        {isLoggedIn && user ? <span className="pb-avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{getInitials(user.name)}</span> : <User size={20} />}
        <span>{isLoggedIn ? firstName || "Account" : "Login"}</span>
        <ChevronDown size={15} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="pb-popover"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            {isLoggedIn && user ? (
              <>
                <div className="pb-popover-user">
                  <span className="pb-avatar">{getInitials(user.name)}</span>
                  <div>
                    <p>Welcome back</p>
                    <strong>{user.name || "Customer"}</strong>
                  </div>
                </div>
                <Link className="pb-menu-link" href="/account" onClick={() => setIsOpen(false)}>
                  <User size={17} /> My profile
                </Link>
                <Link className="pb-menu-link" href="/account?tab=orders#orders" onClick={() => setIsOpen(false)}>
                  <Package size={17} /> My orders
                </Link>
                <Link className="pb-menu-link" href="/returns/track" onClick={() => setIsOpen(false)}>
                  <Truck size={17} /> Track order
                </Link>
                <Link className="pb-menu-link" href="/returns" onClick={() => setIsOpen(false)}>
                  <RotateCcw size={17} /> Returns
                </Link>
                <button
                  className="pb-menu-link is-danger"
                  type="button"
                  onClick={async () => {
                    await logout();
                    setIsOpen(false);
                    router.push("/");
                  }}
                >
                  <LogOut size={17} /> Log out
                </button>
              </>
            ) : authMode === "forgot" ? (
              <form className="pb-form" onSubmit={handleForgot}>
                <div>
                  <strong style={{ fontSize: 17 }}>Reset your password</strong>
                  <p style={{ margin: "4px 0 0", color: "var(--pb-muted)", fontSize: 13.5 }}>We&apos;ll send a reset link to your email.</p>
                </div>
                <label className="pb-field">
                  <span>Email address</span>
                  <input className="pb-input" type="email" name="email" autoComplete="email" placeholder="you@example.com" required />
                </label>
                {message ? <p className={`pb-form-msg ${messageKind === "error" ? "is-error" : ""}`}>{message}</p> : null}
                {resetUrl ? (
                  <a className="pb-text-link" href={resetUrl} onClick={() => setIsOpen(false)}>
                    Continue to reset password →
                  </a>
                ) : null}
                <button className="pb-btn pb-btn-primary pb-btn-block" type="submit" disabled={loading}>
                  {loading ? "Sending..." : "Send reset link"}
                </button>
                <button className="pb-text-link" style={{ alignSelf: "center" }} type="button" onClick={() => switchMode("login")}>
                  Back to login
                </button>
              </form>
            ) : (
              <>
                <div className="pb-tabs" role="tablist">
                  <button type="button" className={authMode === "login" ? "is-active" : ""} onClick={() => switchMode("login")}>
                    Login
                  </button>
                  <button type="button" className={authMode === "signup" ? "is-active" : ""} onClick={() => switchMode("signup")}>
                    Sign up
                  </button>
                </div>
                <form className="pb-form" onSubmit={handleAuth} key={authMode}>
                  <GoogleAuthButton className="google-auth-button--dropdown" onClick={startGoogleAuth} disabled={loading} />
                  <div className="pb-divider-text">or continue with email</div>
                  {authMode === "signup" ? (
                    <>
                      <div style={{ display: "flex", gap: 10 }}>
                        <label className="pb-field">
                          <span>First name</span>
                          <input className="pb-input" name="firstName" autoComplete="given-name" required />
                        </label>
                        <label className="pb-field">
                          <span>Last name</span>
                          <input className="pb-input" name="lastName" autoComplete="family-name" required />
                        </label>
                      </div>
                      <label className="pb-field">
                        <span>Phone (optional)</span>
                        <input className="pb-input" type="tel" name="phone" autoComplete="tel" />
                      </label>
                    </>
                  ) : null}
                  <label className="pb-field">
                    <span>Email address</span>
                    <input className="pb-input" type="email" name="email" autoComplete="email" placeholder="you@example.com" required />
                  </label>
                  <label className="pb-field">
                    <span>Password</span>
                    <div className="pb-pass">
                      <input
                        className="pb-input"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                        placeholder="At least 8 characters"
                        minLength={8}
                        required
                      />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>
                  {authMode === "login" ? (
                    <button className="pb-text-link" type="button" onClick={() => switchMode("forgot")}>
                      Forgot password?
                    </button>
                  ) : null}
                  {message ? <p className={`pb-form-msg ${messageKind === "error" ? "is-error" : ""}`}>{message}</p> : null}
                  <button className="pb-btn pb-btn-primary pb-btn-block" type="submit" disabled={loading}>
                    {loading ? "Please wait..." : authMode === "signup" ? "Create account" : "Login"}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
