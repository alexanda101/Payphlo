"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { AuthShell } from "../components/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      await api.signup(name, email, password);
      router.push("/dashboard");
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message);
      if (apiErr.errors) setFieldErrors(apiErr.errors);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account."
      subtitle="Free forever. $10,000 in virtual cash on day one."
      altText="Already have an account?"
      altHref="/login"
      altCta="Log in"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="label">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Anthony"
            className="input"
          />
          {fieldErrors.name && (
            <p className="text-xs text-[var(--negative)]">{fieldErrors.name[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="input"
          />
          {fieldErrors.email && (
            <p className="text-xs text-[var(--negative)]">{fieldErrors.email[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="label">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="At least 8 characters"
            className="input"
          />
          {fieldErrors.password && (
            <p className="text-xs text-[var(--negative)]">{fieldErrors.password[0]}</p>
          )}
        </div>

        {error && !Object.keys(fieldErrors).length && (
          <p className="text-sm text-[var(--negative)]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-brand w-full disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-[11px] text-[var(--muted-2)]">
          By signing up you agree to our (forthcoming) Terms.
        </p>
      </form>
    </AuthShell>
  );
}
