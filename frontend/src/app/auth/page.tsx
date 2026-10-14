"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User as UserIcon,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sun,
  Moon,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useGoogleLogin } from "@react-oauth/google";

type AuthMode = "signin" | "signup" | "forgot" | "reset";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, signup, loginWithGoogleToken, forgotPassword, resetPassword, isAuthenticated, user } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [resetToken, setResetToken] = useState("");
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check URL query parameters for reset token
  useEffect(() => {
    const qMode = searchParams.get("mode");
    const qToken = searchParams.get("token");
    if (qMode === "reset" && qToken) {
      setMode("reset");
      setResetToken(qToken);
      setError(null);
      setSuccessMessage(null);
    }
  }, [searchParams]);

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError(null);
      setIsLoading(true);
      try {
        const res = await loginWithGoogleToken(tokenResponse.access_token);
        if (res.success) {
          router.push("/");
        } else {
          setError(res.error || "Google sign-in failed. Please try again.");
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred during Google sign-in.");
      } finally {
        setIsLoading(false);
      }
    },
    onError: (errorResponse) => {
      setIsLoading(false);
      if (errorResponse && "error_description" in errorResponse && errorResponse.error_description) {
        setError(`Google sign-in error: ${errorResponse.error_description}`);
      } else {
        setError("Google sign-in was cancelled or failed.");
      }
    },
  });

  // If already logged in
  if (isAuthenticated && user) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center space-y-6 shadow-sm">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">You are signed in</h1>
            <p className="text-muted-foreground text-xs">
              Account: <span className="font-semibold text-foreground">{user.email}</span>
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => router.push("/")}
              className="w-full py-2.5 px-4 rounded-lg font-medium text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Go to Tax Calculator
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: "", color: "bg-muted" };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score: 1, label: "Weak", color: "bg-red-500" };
    if (score <= 4) return { score: 2, label: "Medium", color: "bg-amber-500" };
    return { score: 3, label: "Strong", color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (mode === "reset") {
        if (!password || password.length < 6) {
          setError("Password must be at least 6 characters.");
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setIsLoading(false);
          return;
        }
        if (!resetToken) {
          setError("Invalid or missing reset token.");
          setIsLoading(false);
          return;
        }

        const res = await resetPassword(resetToken, password);
        if (res.success) {
          setSuccessMessage(res.message || "Password updated successfully! You can now sign in.");
          setMode("signin");
          setPassword("");
          setConfirmPassword("");
          setDevResetUrl(null);
        } else {
          setError(res.error || "Failed to reset password.");
        }
        setIsLoading(false);
        return;
      }

      if (mode === "forgot") {
        if (!email) {
          setError("Please provide your email address.");
          setIsLoading(false);
          return;
        }
        const res = await forgotPassword(email);
        setSuccessMessage(res.message);
        if (res.resetUrl) {
          setDevResetUrl(res.resetUrl);
        }
        setIsLoading(false);
        return;
      }

      if (mode === "signup") {
        if (!name.trim()) {
          setError("Please enter your full name.");
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setIsLoading(false);
          return;
        }

        const res = await signup(name, email, password);
        if (res.success) {
          router.push("/");
        } else {
          setError(res.error || "Failed to create account");
        }
      } else {
        // Sign in
        const res = await login(email, password);
        if (res.success) {
          router.push("/");
        } else {
          setError(res.error || "Invalid email or password");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-4 z-40">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border shadow-sm cursor-pointer"
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        >
          {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Return to calculator link */}
      <div className="w-full max-w-sm mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Calculator</span>
        </Link>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground mb-1">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            {mode === "reset" ? "Reset Password" : "TaxCopilot Account"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {mode === "signin" && "Sign in to save and manage your tax calculations"}
            {mode === "signup" && "Create an account to track calculations across devices"}
            {mode === "forgot" && "Enter your email for account recovery instructions"}
            {mode === "reset" && "Choose a new password for your account"}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        {(mode === "signin" || mode === "signup") && (
          <div className="grid grid-cols-2 p-1 bg-muted rounded-lg border border-border">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); }}
              className={`py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                mode === "signin"
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(null); }}
              className={`py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                mode === "signup"
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              role="alert"
              className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Alert */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              role="status"
              className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <span>{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dev Reset Link Banner */}
        {devResetUrl && mode === "forgot" && (
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-xs text-blue-800 dark:text-blue-300 space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5">
              <span>Direct Reset Link</span>
              <span className="text-[10px] bg-blue-200 dark:bg-blue-900 px-1.5 py-0.2 rounded font-normal">Local Mode</span>
            </p>
            <p className="text-[11px] text-blue-700 dark:text-blue-400">
              Configure SMTP in <code>backend/.env</code> for live inbox dispatch. In local testing, you can click below:
            </p>
            <a
              href={devResetUrl}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-0.5"
            >
              <span>Set new password now</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          {/* Full Name for Sign Up */}
          {mode === "signup" && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-medium text-foreground mb-1">
                Full Name <span className="text-red-500" aria-label="required">*</span>
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-background border border-input rounded-lg pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
              </div>
            </div>
          )}

          {/* Email Address */}
          {mode !== "reset" && (
            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-foreground mb-1">
                Email Address <span className="text-red-500" aria-label="required">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-background border border-input rounded-lg pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
              </div>
            </div>
          )}

          {/* Password */}
          {mode !== "forgot" && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="auth-password" className="block text-xs font-medium text-foreground">
                  {mode === "reset" ? "New Password" : "Password"} <span className="text-red-500" aria-label="required">*</span>
                </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(null); setSuccessMessage(null); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-input rounded-lg pl-9 pr-9 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Password strength bar */}
              {(mode === "signup" || mode === "reset") && password && (
                <div className="mt-1.5 space-y-1">
                  <div className="flex gap-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        strength.score >= 1 ? strength.color : "bg-transparent"
                      } ${strength.score === 1 ? "w-1/3" : strength.score === 2 ? "w-2/3" : "w-full"}`}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span>Strength</span>
                    <span className="font-medium text-foreground">{strength.label}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirm Password */}
          {(mode === "signup" || mode === "reset") && (
            <div>
              <label htmlFor="auth-confirm-password" className="block text-xs font-medium text-foreground mb-1">
                Confirm {mode === "reset" ? "New " : ""}Password <span className="text-red-500" aria-label="required">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-confirm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-input rounded-lg pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
              </div>
            </div>
          )}

          {/* Remember me */}
          {mode === "signin" && (
            <div className="flex items-center pt-0.5">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 text-primary bg-background border-input rounded focus:ring-ring cursor-pointer"
              />
              <label htmlFor="remember" className="ml-2 text-xs text-muted-foreground cursor-pointer select-none">
                Remember this device
              </label>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 rounded-lg font-medium text-xs bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : mode === "signin" ? (
              "Sign In"
            ) : mode === "signup" ? (
              "Create Account"
            ) : mode === "reset" ? (
              "Update Password"
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>

        {/* Back to sign in */}
        {(mode === "forgot" || mode === "reset") && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); setSuccessMessage(null); setDevResetUrl(null); }}
              className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {/* Social Authentication */}
        {(mode === "signin" || mode === "signup") && (
          <div className="space-y-3 pt-2">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-border w-full" />
              <span className="bg-card px-2.5 text-[10px] text-muted-foreground uppercase tracking-wider shrink-0 font-medium">
                Or
              </span>
              <div className="border-t border-border w-full" />
            </div>

            <div>
              <button
                type="button"
                onClick={() => { setError(null); triggerGoogleLogin(); }}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2.5 py-2 px-3.5 bg-background hover:bg-muted border border-border rounded-lg text-xs font-medium text-foreground transition-colors shadow-sm cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.8z" />
                  <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-1.9z" />
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>.
        </p>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AuthForm />
    </Suspense>
  );
}
