"use client";

import "../../auth.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Lock, Mail, UserRound, Eye, EyeOff, Phone } from "lucide-react";
import GoogleAuthButton from "../../../components/GoogleAuthButton";
import { useStore } from "../../../components/StoreContext";

const EMPTY_LOGIN = { email: "", password: "" };
const EMPTY_SIGNUP = { firstName: "", lastName: "", email: "", phone: "", password: "" };
const AUTH_MODES = new Set(["login", "signup", "forgot"]);

function getSafeMode(value) {
  return AUTH_MODES.has(value) ? value : "login";
}

function getSafeRedirect(value) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

export default function AccountLoginPage() {
  const router = useRouter();
  const { user, isAuthLoading, refreshAuthSession } = useStore();
  const [mode, setMode] = useState("login");
  const [redirectTo, setRedirectTo] = useState("/account");
  const [loginForm, setLoginForm] = useState(EMPTY_LOGIN);
  const [signupForm, setSignupForm] = useState(EMPTY_SIGNUP);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("success");
  const [resetUrl, setResetUrl] = useState("");

  useEffect(() => {
    function syncFromUrl() {
      const params = new URLSearchParams(window.location.search);
      setMode(getSafeMode(params.get("mode")));
      setRedirectTo(getSafeRedirect(params.get("redirect")));
      const authError = params.get("authError");
      if (authError) {
        const messages = {
          google_config: "Google login is not configured yet.",
          google_denied: "Google login was cancelled.",
          google_state: "Google login expired. Please try again.",
          google_failed: "Google login failed. Please try again.",
        };
        setMessage(messages[authError] || "Google login failed. Please try again.");
        setMessageKind("error");
      }
    }

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace(redirectTo);
    }
  }, [isAuthLoading, redirectTo, router, user]);

  function switchMode(nextMode) {
    const safeMode = getSafeMode(nextMode);
    const knownEmail = loginForm.email || signupForm.email || forgotEmail;

    if (safeMode === "forgot" && knownEmail) {
      setForgotEmail((current) => current || knownEmail);
    }
    if (safeMode === "login" && !loginForm.email && signupForm.email) {
      setLoginForm((current) => ({ ...current, email: signupForm.email }));
    }
    if (safeMode === "signup" && !signupForm.email && loginForm.email) {
      setSignupForm((current) => ({ ...current, email: loginForm.email }));
    }

    setMode(safeMode);
    setMessage("");
    setMessageKind("success");
    setResetUrl("");
    setShowPassword(false);

    const params = new URLSearchParams(window.location.search);
    if (safeMode === "login") {
      params.delete("mode");
    } else {
      params.set("mode", safeMode);
    }
    if (redirectTo !== "/account") {
      params.set("redirect", redirectTo);
    }

    const query = params.toString();
    window.history.replaceState(null, "", query ? `/account/login?${query}` : "/account/login");
  }

  function setLoginField(field, value) {
    setLoginForm((current) => ({ ...current, [field]: value }));
  }

  function setSignupField(field, value) {
    setSignupForm((current) => ({ ...current, [field]: value }));
  }

  function startGoogleAuth() {
    window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirectTo)}`;
  }

  async function submitAuth(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageKind("success");
    setResetUrl("");

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload = mode === "signup"
        ? {
            ...signupForm,
            name: `${signupForm.firstName || ""} ${signupForm.lastName || ""}`.trim(),
            email: signupForm.email.trim().toLowerCase(),
            phone: signupForm.phone.trim(),
          }
        : {
            ...loginForm,
            email: loginForm.email.trim().toLowerCase(),
          };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "Could not continue.");
        setMessageKind("error");
        return;
      }

      const nextUser = await refreshAuthSession?.();
      if (!nextUser && !data.user) {
        setMessage("Account created, but the session could not be loaded. Please log in again.");
        setMessageKind("error");
        setMode("login");
        return;
      }

      router.push(redirectTo);
    } catch {
      setMessage("Network error. Please try again.");
      setMessageKind("error");
    } finally {
      setLoading(false);
    }
  }

  async function submitForgot(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageKind("success");
    setResetUrl("");

    try {
      const email = forgotEmail.trim().toLowerCase();
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "Could not start password reset.");
        setMessageKind("error");
        return;
      }

      setForgotEmail(email);
      setMessage(data.resetPath ? "Password reset link is ready for local testing." : data.message);
      setMessageKind("success");
      setResetUrl(data.resetPath || data.resetUrl || "");
    } catch {
      setMessage("Network error. Please try again.");
      setMessageKind("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell compact">
        <div className="auth-panel auth-form-panel">
          <div className="auth-tabs" role="tablist" aria-label="Account actions">
            <button className={mode === "login" ? "active" : ""} type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")}>
              Login
            </button>
            <button className={mode === "signup" ? "active" : ""} type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")}>
              Signup
            </button>
          </div>

          {mode === "forgot" ? (
            <form className="auth-form" onSubmit={submitForgot} noValidate={false}>
              <h2>Reset password</h2>
              <label>
                <span>Email address</span>
                <div className="auth-input-wrap">
                  <Mail size={18} />
                  <input
                    name="email"
                    type="email"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>
              {message ? <p className={`auth-message ${messageKind === "error" ? "error" : ""}`}>{message}</p> : null}
              {resetUrl ? (
                resetUrl.startsWith("/") ? (
                  <Link className="auth-reset-link" href={resetUrl}>
                    Continue to reset password
                  </Link>
                ) : (
                  <a className="auth-reset-link" href={resetUrl}>
                    Continue to reset password
                  </a>
                )
              ) : null}
              <button className="auth-submit" type="submit" disabled={loading} aria-busy={loading}>
                {loading ? "Preparing..." : "Send reset link"}
              </button>
              <button className="auth-link-button" type="button" onClick={() => switchMode("login")}>
                Back to login
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={submitAuth} noValidate={false}>
              <h2>{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
              <GoogleAuthButton onClick={startGoogleAuth} disabled={loading} />
              <div className="auth-oauth-divider"><span>or</span></div>
              {mode === "signup" ? (
                <>
                  <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                    <label style={{ flex: 1, minWidth: 0 }}>
                      <span>First name</span>
                      <div className="auth-input-wrap">
                        <UserRound size={18} />
                        <input
                          name="firstName"
                          value={signupForm.firstName || ""}
                          onChange={(event) => setSignupField("firstName", event.target.value)}
                          placeholder="First name"
                          autoComplete="given-name"
                          required
                        />
                      </div>
                    </label>
                    <label style={{ flex: 1, minWidth: 0 }}>
                      <span>Last name</span>
                      <div className="auth-input-wrap">
                        <UserRound size={18} />
                        <input
                          name="lastName"
                          value={signupForm.lastName || ""}
                          onChange={(event) => setSignupField("lastName", event.target.value)}
                          placeholder="Last name"
                          autoComplete="family-name"
                          required
                        />
                      </div>
                    </label>
                  </div>
                  <label>
                    <span>Phone</span>
                    <div className="auth-input-wrap">
                      <Phone size={18} />
                      <input
                        name="phone"
                        type="tel"
                        value={signupForm.phone}
                        onChange={(event) => setSignupField("phone", event.target.value)}
                        placeholder="Optional"
                        autoComplete="tel"
                        inputMode="tel"
                      />
                    </div>
                  </label>
                </>
              ) : null}
              <label>
                <span>Email address</span>
                <div className="auth-input-wrap">
                  <Mail size={18} />
                  <input
                    name="email"
                    type="email"
                    value={mode === "signup" ? signupForm.email : loginForm.email}
                    onChange={(event) => mode === "signup" ? setSignupField("email", event.target.value) : setLoginField("email", event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>
              <div className="auth-field">
                <label htmlFor="account-password">Password</label>
                <div className="auth-input-wrap">
                  <Lock size={18} />
                  <input
                    id="account-password"
                    name={mode === "signup" ? "new-password" : "current-password"}
                    type={showPassword ? "text" : "password"}
                    value={mode === "signup" ? signupForm.password : loginForm.password}
                    onChange={(event) => mode === "signup" ? setSignupField("password", event.target.value) : setLoginField("password", event.target.value)}
                    placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={8}
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {message ? <p className={`auth-message ${messageKind === "error" ? "error" : ""}`}>{message}</p> : null}
              <button className="auth-submit" type="submit" disabled={loading} aria-busy={loading}>
                {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Login"}
              </button>
              {mode === "login" ? (
                <button className="auth-link-button" type="button" onClick={() => switchMode("forgot")}>
                  Forgot your password?
                </button>
              ) : (
                <button className="auth-link-button" type="button" onClick={() => switchMode("login")}>
                  Already have an account? Login
                </button>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
