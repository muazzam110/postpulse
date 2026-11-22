import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { ScoreRing } from "@/components/brand/ScoreRing";
import { TrustNote } from "@/components/brand/TrustNote";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const MIN_PASSWORD = 10; // mirrors the backend rule
const EMAIL = /^\S+@\S+\.\S+$/;
const strength = (p) => [p.length >= MIN_PASSWORD, p.length >= 14, /[a-z]/.test(p) && /[A-Z\d]/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
const STRENGTH_LABEL = ["Add a longer phrase", "Add a longer phrase", "Okay", "Good", "Strong"];

function Strength({ password }) {
  const s = password ? strength(password) : -1;
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cn("h-1 flex-1 rounded-full bg-line transition-colors", s >= n && (s <= 1 ? "bg-rose" : s === 2 ? "bg-amber" : "bg-moss"))} />
        ))}
      </div>
      <span className="w-36 text-right text-[13px] text-ink-3">{s >= 0 && STRENGTH_LABEL[s]}</span>
    </div>
  );
}

function Vignette() {
  return (
    <figure className="w-full max-w-[400px] -rotate-1 rounded-sheet border bg-surface p-8 shadow-pop">
      <figcaption className="micro mb-4 text-ink-3">Sample draft</figcaption>
      <p className="font-display text-[22px] font-semibold leading-8">We rewrote our onboarding three times before we asked users one question.</p>
      <p className="mt-3 line-clamp-3 text-ink-2">The fix wasn't a better tour. It was removing the one step nobody finished, and saying so plainly in the first line.</p>
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <span className="flex items-center gap-3">
          <ScoreRing value={4} label="Specificity" size={44} />
          <span className="text-[13px] leading-5 text-ink-2">Specificity 4/5<br /><span className="text-ink-3">Advisory</span></span>
        </span>
        <span className="rounded-full bg-sky-soft px-3 py-1 text-[13px] font-medium text-sky">Scheduled · Tue 9:30</span>
      </div>
    </figure>
  );
}

function AuthForm({ mode }) {
  const signUp = mode === "register";
  const { user, expired, login, register } = useAuth();
  const { state } = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [shown, setShown] = useState(false);
  const [touched, setTouched] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");

  if (user) return <Navigate to={state?.from ?? "/app/studio"} replace />;

  const errors = {
    email: !EMAIL.test(form.email.trim()) && "Enter a valid email address.",
    password: !form.password ? "Enter your password." : signUp && form.password.length < MIN_PASSWORD && `Use at least ${MIN_PASSWORD} characters.`,
  };
  const bind = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
    onBlur: () => setTouched({ ...touched, [name]: true }),
  });

  async function submit(e) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (errors.email || errors.password) return;
    setBusy(true);
    setServerError("");
    try {
      await (signUp ? register : login)(form.email.trim(), form.password);
    } catch (err) {
      setServerError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12 animate-fade-up">
          <h1 className="text-[32px] leading-[38px]">{signUp ? "Create your account" : "Log in"}</h1>
          <p className="mt-2 text-ink-2">{signUp ? "Free to start. You bring your own OpenRouter key." : "Pick up where your drafts left off."}</p>
          {expired && !signUp && <TrustNote tone="amber" className="mt-6">Your session ended. Log in to continue.</TrustNote>}
          <form noValidate onSubmit={submit} className="mt-8 space-y-3">
            <Field reserve label="Email" error={touched.email && errors.email}>
              {(p) => <Input {...p} {...bind("email")} type="email" autoComplete="email" autoFocus />}
            </Field>
            <Field reserve label="Password" error={touched.password && errors.password} hint={signUp ? `At least ${MIN_PASSWORD} characters. A short phrase works well.` : undefined}>
              {(p) => (
                <div className="relative">
                  <Input {...p} {...bind("password")} type={shown ? "text" : "password"} autoComplete={signUp ? "new-password" : "current-password"} className="pr-11" />
                  <button type="button" onClick={() => setShown(!shown)} aria-pressed={shown} aria-label={shown ? "Hide password" : "Show password"} className="absolute right-1 top-1 grid size-8 place-items-center rounded-md text-ink-3 hover:text-ink">
                    {shown ? <EyeOff strokeWidth={1.5} className="size-[18px]" /> : <Eye strokeWidth={1.5} className="size-[18px]" />}
                  </button>
                </div>
              )}
            </Field>
            {signUp && <Strength password={form.password} />}
            {serverError && <p role="alert" className="text-[13px] text-rose">{serverError}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "One moment…" : signUp ? "Create account" : "Log in"}
            </Button>
          </form>
          <p className="mt-6 text-ink-2">
            {signUp ? "Already have an account? " : "New here? "}
            <Link to={signUp ? "/login" : "/register"} state={state} className="font-medium text-ink underline underline-offset-4">{signUp ? "Log in" : "Create an account"}</Link>
          </p>
        </div>
      </main>
      <aside aria-hidden className="hidden items-center justify-center border-l bg-surface-2 p-12 lg:flex">
        <Vignette />
      </aside>
    </div>
  );
}

export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;
