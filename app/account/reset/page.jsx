"use client";

import "../../auth.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextToken = params.get("token") || "";
    setToken(nextToken);
    if (!nextToken) {
      setMessage("This reset link is missing a token. Please request a new password reset.");
    }
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "Could not reset password.");
        return;
      }

      setSuccess(true);
      setMessage("Password updated. You can log in now.");
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell compact">
        <div className="auth-panel auth-form-panel">
          <form className="auth-form" onSubmit={handleSubmit}>
            <span className="auth-eyebrow">Password Reset</span>
            <h1>Choose a new password</h1>
            <label>
              <span>New password</span>
              <div className="auth-input-wrap">
                <Lock size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  disabled={!token || success}
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={!token || success}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {message ? <p className={`auth-message ${success ? "" : "error"}`}>{message}</p> : null}
            {success ? (
              <Link className="auth-submit as-link" href="/account/login">
                Go to login
              </Link>
            ) : (
              <button className="auth-submit" type="submit" disabled={loading || !token}>
                {loading ? "Updating..." : "Reset password"}
              </button>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
