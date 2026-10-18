"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { AuthShell } from "../components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
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
      await api.login(email, password);
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
      title="Welcome back."
      subtitle="Log in to keep your money moving."
      altText="Need an account?"
      altHref="/signup"
      altCta="Sign up"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="••••••••"
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
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
