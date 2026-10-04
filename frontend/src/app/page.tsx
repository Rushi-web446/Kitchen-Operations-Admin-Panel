"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser, login, logout, type AuthUser } from "@/lib/api";

const roleLabels: Record<AuthUser["role"], string> = {
  ADMIN: "Administrator",
  KITCHEN: "Kitchen team",
  DISPATCH: "Dispatch team",
  DRIVER: "Driver",
};

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
          router.replace(`/${currentUser.role.toLowerCase()}`);
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const signedInUser = await login({ email, password });
      setUser(signedInUser);
      setPassword("");
      router.replace(`/${signedInUser.role.toLowerCase()}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setErrorMessage("");
    setIsSigningOut(true);
    try {
      await logout();
      setUser(null);
      setEmail("");
      setPassword("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign out failed.");
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="auth-loading" aria-live="polite">
        <span className="loading-mark" aria-hidden="true" />
        <p>Checking secure session</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="workspace-page">
        <header className="workspace-header">
          <Brand />
          <div className="header-session">
            <span className="session-indicator" aria-hidden="true" />
            <span>Secure session</span>
            <button className="signout-button" onClick={handleLogout} disabled={isSigningOut}>
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </header>

        <section className="workspace-content" aria-labelledby="welcome-title">
          <div className="workspace-kicker"><span className="kicker-rule" /> STAFF WORKSPACE</div>
          <div className="welcome-row">
            <div>
              <p className="welcome-eyebrow">Signed in as {roleLabels[user.role]}</p>
              <h1 id="welcome-title">Welcome back.</h1>
              <p className="welcome-copy">Your Heizen operations account is authenticated and ready.</p>
            </div>
            <div className="user-stamp" aria-hidden="true">{user.email[0].toUpperCase()}</div>
          </div>

          <div className="identity-panel">
            <div className="identity-label">ACCOUNT IDENTITY</div>
            <div className="identity-row">
              <div>
                <p className="identity-email">{user.email}</p>
                <p className="identity-id">Staff account · #{user.id}</p>
              </div>
              <span className={`role-pill role-${user.role.toLowerCase()}`}>
                <span className="role-dot" aria-hidden="true" /> {roleLabels[user.role]}
              </span>
            </div>
          </div>
          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
        </section>

        <footer className="workspace-footer">
          <span>HEIZEN KITCHEN</span><span>INTERNAL OPERATIONS</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-aside" aria-label="Heizen staff sign in">
        <header className="aside-header">
          <Brand inverse />
          <span className="portal-tag">STAFF PORTAL</span>
        </header>
        <div className="aside-message">
          <div className="aside-index"><span>01</span><i /></div>
          <p className="aside-overline">THE WORK BEHIND EVERY TABLE</p>
          <h1>Good food<br />moves together.</h1>
          <p className="aside-copy">One place for the people who plan, prepare and deliver each day.</p>
        </div>
        <div className="aside-bottom">
          <div className="service-mark" aria-hidden="true">
            <span /><span /><span /><span /><span /><span /><span />
          </div>
          <span>BUILT FOR THE DAILY SERVICE</span>
        </div>
        <div className="aside-number" aria-hidden="true">H / 01</div>
      </section>

      <section className="login-main" aria-labelledby="login-title">
        <div className="login-topline">
          <span>HEIZEN / INTERNAL</span>
          <span className="access-status"><i /> ACCESS CONTROLLED</span>
        </div>

        <div className="login-form-wrap">
          <div className="form-heading">
            <div className="form-symbol" aria-hidden="true">
              <span className="symbol-stem" /><span className="symbol-leaf symbol-leaf-left" />
              <span className="symbol-leaf symbol-leaf-right" />
            </div>
            <p className="form-eyebrow">YOUR SHIFT STARTS HERE</p>
            <h2 id="login-title">Sign in</h2>
            <p className="form-subtitle">Use your staff account to continue.</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label className="field-label" htmlFor="email">Work email</label>
            <div className="input-wrap">
              <span className="input-icon" aria-hidden="true">@</span>
              <input id="email" name="email" type="email" autoComplete="username"
                placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)}
                required maxLength={254} disabled={isSubmitting} />
            </div>

            <div className="password-label-row">
              <label className="field-label" htmlFor="password">Password</label>
              <button className="reveal-button" type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
            <div className="input-wrap">
              <span className="input-icon lock-icon" aria-hidden="true">▰</span>
              <input id="password" name="password" type={showPassword ? "text" : "password"}
                autoComplete="current-password" placeholder="Enter your password" value={password}
                onChange={(event) => setPassword(event.target.value)} required maxLength={128}
                disabled={isSubmitting} />
            </div>

            {errorMessage && <div className="form-error" role="alert">{errorMessage}</div>}
            <button className="submit-button" type="submit" disabled={isSubmitting}>
              <span>{isSubmitting ? "VERIFYING ACCESS" : "CONTINUE TO WORKSPACE"}</span>
              <span className="submit-arrow" aria-hidden="true">↗</span>
            </button>
          </form>

          <div className="form-footnote"><span className="footnote-lock" aria-hidden="true">●</span>
            Protected staff access · Sign-in is monitored</div>
        </div>

        <footer className="login-footer">
          <span>© 2026 HEIZEN KITCHEN</span><span>OPERATIONS, WITH CARE.</span>
        </footer>
      </section>
    </main>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link className={`wordmark${inverse ? " wordmark-inverse" : ""}`} href="/" aria-label="Heizen Kitchen home">
      <span className="wordmark-icon" aria-hidden="true">H</span>
      <span>heizen<span className="wordmark-light"> kitchen</span></span>
    </Link>
  );
}
