"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  LogIn,
  Sun,
  Moon,
  Calculator,
  AlertCircle,
  TrendingUp,
  Info,
  ChevronDown,
  History,
  CheckCircle2,
  Menu,
  X,
  Plus,
  Trash2,
  TrendingDown,
  Home,
  Building2,
  GraduationCap,
  Landmark,
  HeartPulse,
  HeartHandshake,
  Printer,
  RotateCcw,
  Scale,
  FileText,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { HistoryDrawer, HistoryItem } from "@/components/HistoryDrawer";
import { SettingsModal } from "@/components/SettingsModal";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { HelpModal } from "@/components/HelpModal";
import {
  NEW_REGIME_SLABS,
  OLD_REGIME_SLABS,
  formatSlabRange,
} from "@/lib/taxSlabs";

/* ─── Toggle-gated section keys ─── */
type SectionKey =
  | "rent"
  | "homeLoan"
  | "eduLoan"
  | "investments"
  | "nps"
  | "health"
  | "donations";

/* ─── Section metadata with Lucide icons ─── */
const SECTIONS: Record<
  SectionKey,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  rent: {
    label: "House Rent Allowance (HRA)",
    description: "Exemption under Section 10(13A) based on rent paid & metro city status",
    icon: Home,
  },
  homeLoan: {
    label: "Home Loan Interest & Principal",
    description: "Section 24(b) interest (up to ₹2,00,000) & Section 80C principal repayment",
    icon: Building2,
  },
  eduLoan: {
    label: "Education Loan Interest",
    description: "Section 80E interest deduction for higher education (no upper ceiling)",
    icon: GraduationCap,
  },
  investments: {
    label: "Section 80C Investments",
    description: "EPF, PPF, ELSS, Life Insurance, NSC, Tuition Fees (capped at ₹1,50,000)",
    icon: TrendingUp,
  },
  nps: {
    label: "National Pension System (NPS)",
    description: "Section 80CCD(1B) voluntary contribution (up to ₹50,000) & employer NPS",
    icon: Landmark,
  },
  health: {
    label: "Health Insurance (Section 80D)",
    description: "Medical insurance premiums for self, family, and parents (senior citizen limits)",
    icon: HeartPulse,
  },
  donations: {
    label: "Charitable Donations (Section 80G)",
    description: "Eligible donations to notified relief funds & charitable institutions",
    icon: HeartHandshake,
  },
};

/* ─── Friendly display names for section codes ─── */
const SECTION_DISPLAY_NAMES: Record<string, string> = {
  "80C": "Tax-saving investments (Sec 80C)",
  "80CCD(1B)": "NPS self contribution (Sec 80CCD(1B))",
  "80CCD(2)_private": "Employer NPS contribution (Sec 80CCD(2))",
  "80CCD(2)_govt": "Employer NPS contribution (Sec 80CCD(2))",
  "80D_self": "Health insurance — self & family (Sec 80D)",
  "80D_self_senior": "Health insurance — self & family, senior (Sec 80D)",
  "80D_parents": "Health insurance — parents (Sec 80D)",
  "80D_parents_senior": "Health insurance — parents, senior citizen (Sec 80D)",
  "24(b)": "Home loan interest (Sec 24b)",
  "80E": "Education loan interest (Sec 80E)",
  "80EEB": "Electric vehicle loan interest (Sec 80EEB)",
  "80TTA": "Savings account interest (Sec 80TTA)",
  "80TTB": "Interest income — senior citizen (Sec 80TTB)",
  "80G": "Donations to charity (Sec 80G)",
  "80GG": "Rent paid deduction (Sec 80GG)",
  HRA: "HRA exemption (Sec 10(13A))",
  LTA: "LTA exemption (Sec 10(5))",
};

function getDisplayName(sec: any): string {
  return SECTION_DISPLAY_NAMES[sec.code] ?? sec.name ?? sec.code;
}

function formatINR(val: number | string | null | undefined): string {
  if (val == null) return "0";
  if (typeof val === "string") return val;
  return val.toLocaleString("en-IN");
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Default form values ─── */
const DEFAULT_FORM = {
  basic_salary: 0,
  hra_received: 0,
  other_allowances: 0,
  other_income_interest: 0,
  age: 30,
  employer_type: "private" as "private" | "government",
  rent_paid: 0,
  is_metro: false,
  home_loan_interest: 0,
  home_loan_principal: 0,
  education_loan_interest: 0,
  sec80c_invested: 0,
  nps_self: 0,
  nps_employer: 0,
  health_self: 0,
  health_parents: 0,
  parents_senior_citizen: false,
  self_senior_citizen: false,
  donations: 0,
};

/* ─── Which form fields reset when a section is toggled off ─── */
const SECTION_FIELDS: Record<SectionKey, (keyof typeof DEFAULT_FORM)[]> = {
  rent: ["rent_paid", "is_metro"],
  homeLoan: ["home_loan_interest", "home_loan_principal"],
  eduLoan: ["education_loan_interest"],
  investments: ["sec80c_invested"],
  nps: ["nps_self", "nps_employer"],
  health: [
    "health_self",
    "health_parents",
    "parents_senior_citizen",
    "self_senior_citizen",
  ],
  donations: ["donations"],
};

export default function TaxSaverPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [toggles, setToggles] = useState<Record<SectionKey, boolean>>({
    rent: false,
    homeLoan: false,
    eduLoan: false,
    investments: false,
    nps: false,
    health: false,
    donations: false,
  });
  const [toggleBackups, setToggleBackups] = useState<Record<string, any>>({});

  const { user, token, isAuthenticated } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // History & Modals state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showSlabsModal, setShowSlabsModal] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [saveToast, setSaveToast] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Restore draft form if user just signed in
  useEffect(() => {
    try {
      const pending = localStorage.getItem("tax_pending_form");
      if (pending) {
        const parsed = JSON.parse(pending);
        setFormData(parsed);
        const nextToggles: Record<SectionKey, boolean> = {
          rent: !!(parsed.rent_paid > 0 || parsed.is_metro),
          homeLoan: !!(
            parsed.home_loan_interest > 0 || parsed.home_loan_principal > 0
          ),
          eduLoan: !!(parsed.education_loan_interest > 0),
          investments: !!(parsed.sec80c_invested > 0),
          nps: !!(parsed.nps_self > 0 || parsed.nps_employer > 0),
          health: !!(
            parsed.health_self > 0 ||
            parsed.health_parents > 0 ||
            parsed.self_senior_citizen ||
            parsed.parents_senior_citizen
          ),
          donations: !!(parsed.donations > 0),
        };
        setToggles(nextToggles);
        localStorage.removeItem("tax_pending_form");
      }
    } catch (e) {
      console.error("Error restoring pending form:", e);
    }
  }, []);

  // Fetch calculation history
  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setHistory([]);
      return;
    }

    try {
      const url = user.email
        ? `${API_BASE_URL}/api/tax-strategy/history?user_email=${encodeURIComponent(
            user.email
          )}`
        : `${API_BASE_URL}/api/tax-strategy/history?user_id=${encodeURIComponent(
            user.id
          )}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.items || []);
        localStorage.setItem(
          "tax_calc_history",
          JSON.stringify(data.items || [])
        );
      }
    } catch (err) {
      console.error("Failed to load history from backend:", err);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handlePromptAuth = () => {
    try {
      localStorage.setItem("tax_pending_form", JSON.stringify(formData));
    } catch {}
    router.push("/auth");
  };

  const handleSelectHistory = useCallback((item: HistoryItem) => {
    if (item.form_data) {
      setFormData(item.form_data);
      const nextToggles: Record<SectionKey, boolean> = {
        rent: !!(item.form_data.rent_paid > 0 || item.form_data.is_metro),
        homeLoan: !!(
          item.form_data.home_loan_interest > 0 ||
          item.form_data.home_loan_principal > 0
        ),
        eduLoan: !!(item.form_data.education_loan_interest > 0),
        investments: !!(item.form_data.sec80c_invested > 0),
        nps: !!(
          item.form_data.nps_self > 0 || item.form_data.nps_employer > 0
        ),
        health: !!(
          item.form_data.health_self > 0 ||
          item.form_data.health_parents > 0 ||
          item.form_data.self_senior_citizen ||
          item.form_data.parents_senior_citizen
        ),
        donations: !!(item.form_data.donations > 0),
      };
      setToggles(nextToggles);
    }
    if (item.result) {
      setResult(item.result);
      setError(null);
    }
  }, []);

  const handleDeleteHistory = async (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem("tax_calc_history", JSON.stringify(next));
      } catch {}
      return next;
    });

    if (isAuthenticated) {
      try {
        await fetch(`${API_BASE_URL}/api/tax-strategy/history/${id}`, {
          method: "DELETE",
        });
      } catch (e) {
        console.error("Failed to delete history item:", e);
      }
    }
  };

  const handleClearHistory = async () => {
    setHistory([]);
    try {
      localStorage.removeItem("tax_calc_history");
    } catch {}
    if (isAuthenticated) {
      try {
        const url = user?.email
          ? `${API_BASE_URL}/api/tax-strategy/history?user_email=${encodeURIComponent(
              user.email
            )}`
          : `${API_BASE_URL}/api/tax-strategy/history`;
        await fetch(url, { method: "DELETE" });
      } catch (e) {
        console.error("Failed to clear history:", e);
      }
    }
  };

  const handleField = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      setFormData((prev) => {
        const parsedVal =
          type === "checkbox"
            ? (e.target as HTMLInputElement).checked
            : type === "number"
            // Store 0 (not empty string) when the field is cleared — prevents NaN downstream
            ? value === ""
              ? 0
              : Number(value)
            : value;

        const updated: any = {
          ...prev,
          [name]: parsedVal,
        };

        if (name === "age") {
          const ageNum = Number(value) || 0;
          if (ageNum >= 60) {
            updated.self_senior_citizen = true;
          } else if (ageNum > 0 && ageNum < 60) {
            // Auto-clear senior citizen flag when age drops below 60
            updated.self_senior_citizen = false;
          }
        }

        return updated;
      });
    },
    []
  );

  const handleReset = () => {
    setFormData({ ...DEFAULT_FORM });
    setToggles({
      rent: false,
      homeLoan: false,
      eduLoan: false,
      investments: false,
      nps: false,
      health: false,
      donations: false,
    });
    setResult(null);
    setError(null);
  };

  const handleToggle = useCallback(
    (key: SectionKey) => {
      const newState = !toggles[key];
      setToggles((prev) => ({ ...prev, [key]: newState }));
      if (!newState) {
        // Turning OFF: back up current field values before resetting
        setToggleBackups((backups) => {
          const fieldBackup: Record<string, any> = {};
          for (const field of SECTION_FIELDS[key]) {
            fieldBackup[field] = (formData as any)[field];
          }
          return { ...backups, [key]: fieldBackup };
        });
        setFormData((prev) => {
          const updated = { ...prev };
          for (const field of SECTION_FIELDS[key]) {
            (updated as any)[field] = DEFAULT_FORM[field];
          }
          return updated;
        });
      } else {
        // Turning ON: restore previous field values if available
        setFormData((prev) => {
          const updated = { ...prev };
          const saved = toggleBackups[key];
          if (saved) {
            for (const field of SECTION_FIELDS[key]) {
              if (saved[field] !== undefined) {
                (updated as any)[field] = saved[field];
              }
            }
          }
          return updated;
        });
      }
    },
    [toggles, formData, toggleBackups]
  );

  const generateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Auth gate: require sign-in before calculating ──
    if (!isAuthenticated) {
      handlePromptAuth();
      return;
    }

    const basicSalary = Number(formData.basic_salary) || 0;
    if (basicSalary <= 0) {
      setError("Please enter your yearly basic salary to calculate tax.");
      return;
    }

    if (!formData.age || Number(formData.age) <= 0) {
      setError("Please enter your age.");
      return;
    }

    for (const [key, val] of Object.entries(formData)) {
      if (typeof val === "number" && val < 0) {
        setError("Please enter non-negative amounts for all fields.");
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        age: Number(formData.age),
      };

      const res = await fetch(`${API_BASE_URL}/api/tax-strategy/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to compute tax strategy.");
      const data = await res.json();
      setResult(data);

      // Save to user's history on the backend if authenticated
      if (isAuthenticated && user) {
        try {
          const histRes = await fetch(
            `${API_BASE_URL}/api/tax-strategy/history`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: user.id,
                user_email: user.email,
                form_data: payload,
                result: data,
              }),
            }
          );
          if (histRes.ok) {
            const histData = await histRes.json();
            if (histData.item) {
              setHistory((prev) => [
                histData.item,
                ...prev.filter((x) => x.id !== histData.item.id),
              ]);
              setSaveToast(true);
              setTimeout(() => setSaveToast(false), 3500);
            }
          }
        } catch (e) {
          console.error("Failed to save calculation to history:", e);
        }
      }
    } catch (err: any) {
      setError(
        err.message || "An error occurred while computing tax liabilities."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Main Application Navigation Bar ── */}
      <header className="border-b border-border bg-card sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-foreground block leading-tight">
                  TaxCopilot
                </span>
                <span className="text-[10px] text-muted-foreground block leading-none">
                  Income Tax Planner • FY 2025-26 &amp; 2026-27
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs text-muted-foreground font-medium">
            <button
              type="button"
              onClick={() => setShowSlabsModal(true)}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Tax Slabs
            </button>
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Reference Guide
            </button>
          </nav>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2">
            {/* Calculation History Trigger */}
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
              title="Saved calculations"
              aria-label="Open calculation history"
            >
              <History className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">History</span>
              {isAuthenticated && history.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-muted text-foreground font-semibold">
                  {history.length}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={`Switch to ${
                resolvedTheme === "dark" ? "light" : "dark"
              } mode`}
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Auth / Account Profile */}
            {isAuthenticated && user ? (
              <div className="w-auto">
                <UserProfileMenu
                  onOpenProfile={() => setIsSettingsOpen(true)}
                />
              </div>
            ) : (
              <Link
                href="/auth"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ── Hero / Overview ─────────────────────────────── */}
        <section className="space-y-3 no-print" aria-labelledby="hero-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-xs text-muted-foreground font-medium mb-1.5">
                <Scale className="w-3.5 h-3.5" />
                <span>Income Tax Framework • FY 2025-26 &amp; FY 2026-27</span>
              </div>
              <h1
                id="hero-title"
                className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground"
              >
                Income Tax Calculator &amp; Regime Planner
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Inputs</span>
              </button>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Compare your estimated liability under the New Tax Regime and regular
            provisions (Old Tax Regime). Evaluates standard deductions, Section 87A
            rebate with marginal relief, and Chapter VI-A deduction limits.
          </p>

          {/* Quick statutory facts strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-0.5">
              <span className="font-semibold text-foreground block">
                Standard Deduction
              </span>
              <span className="text-muted-foreground">
                ₹75,000 under New Regime vs ₹50,000 under Old Regime
              </span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-0.5">
              <span className="font-semibold text-foreground block">
                Section 87A Rebate
              </span>
              <span className="text-muted-foreground">
                Zero tax up to ₹12,75,000 total salary under New Regime
              </span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-0.5">
              <span className="font-semibold text-foreground block">
                Session Confidentiality
              </span>
              <span className="text-muted-foreground">
                Calculations are stored strictly within your browser
              </span>
            </div>
          </div>
        </section>

        {/* ── Main Two-Column Layout ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ──────── LEFT: FORM (5 cols) ──────── */}
          <div className="lg:col-span-5 no-print">
            <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm">
              <form onSubmit={generateStrategy} className="space-y-5" noValidate>
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Taxpayer Information
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Required fields marked <span className="text-red-500">*</span>
                  </span>
                </div>

                {/* ── Income Details ── */}
                <fieldset className="space-y-3.5">
                  <legend className="text-sm font-semibold text-foreground mb-1 block">
                    Gross Salary &amp; Other Income
                  </legend>
                  <InputField
                    label="Basic Salary (Yearly)"
                    name="basic_salary"
                    value={formData.basic_salary}
                    onChange={handleField}
                    required
                    helper="Your annual basic salary component before deductions"
                  />
                  <InputField
                    label="HRA Received (Yearly)"
                    name="hra_received"
                    value={formData.hra_received}
                    onChange={handleField}
                    helper="House Rent Allowance specified on your payslip"
                  />
                  <InputField
                    label="Special &amp; Other Allowances"
                    name="other_allowances"
                    value={formData.other_allowances}
                    onChange={handleField}
                    helper="LTA, special allowance, performance pay, bonus"
                  />
                  <InputField
                    label="Other Income (Interest, FD, etc.)"
                    name="other_income_interest"
                    value={formData.other_income_interest}
                    onChange={handleField}
                    helper="Savings interest, fixed deposits, other sources"
                  />
                </fieldset>

                {/* ── Personal Details ── */}
                <fieldset className="space-y-3.5 pt-3 border-t border-border">
                  <legend className="text-sm font-semibold text-foreground mb-1 block">
                    Taxpayer Category
                  </legend>

                  <div className="grid grid-cols-2 gap-3">
                    <InputField
                      label="Age (Years)"
                      name="age"
                      value={formData.age}
                      onChange={handleField}
                      prefix=""
                      placeholder="e.g. 30"
                      required
                      min={18}
                      max={120}
                      helper={
                        Number(formData.age) >= 60
                          ? "Senior Citizen slabs apply"
                          : "Standard slabs apply"
                      }
                    />

                    <div>
                      <label
                        htmlFor="employer_type"
                        className="block text-xs font-medium text-foreground mb-1"
                      >
                        Employer Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="employer_type"
                        name="employer_type"
                        value={formData.employer_type}
                        onChange={handleField}
                        required
                        className="block w-full px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                      >
                        <option value="private">Private Sector</option>
                        <option value="government">Government Sector</option>
                      </select>
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        Determines NPS Sec 80CCD(2) limits (10% vs 14%)
                      </span>
                    </div>
                  </div>
                </fieldset>

                {/* ── Deductions & Exemptions Section ── */}
                <div className="pt-3 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Deductions &amp; Exemptions
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Chapter VI-A (Old Regime)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Toggle applicable categories below to enter your eligible
                    deductions.
                  </p>

                  <div className="space-y-2">
                    {(Object.keys(SECTIONS) as SectionKey[]).map((key) => {
                      const meta = SECTIONS[key];
                      const IconComponent = meta.icon;
                      const isOpen = toggles[key];

                      return (
                        <div
                          key={key}
                          className={`rounded-lg border transition-colors ${
                            isOpen
                              ? "border-primary/40 bg-card"
                              : "border-border bg-muted/20"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggle(key)}
                            className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors"
                            aria-expanded={isOpen}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                  isOpen
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                <IconComponent className="w-3.5 h-3.5" />
                              </span>
                              <span className="min-w-0">
                                <span className="text-xs font-medium text-foreground block truncate">
                                  {meta.label}
                                </span>
                              </span>
                            </span>

                            {/* Toggle switch */}
                            <span
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                                isOpen ? "bg-primary" : "bg-muted border border-border"
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                                  isOpen ? "translate-x-4" : "translate-x-0.5"
                                }`}
                              />
                            </span>
                          </button>

                          {isOpen && (
                            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/60">
                              <p className="text-[11px] text-muted-foreground">
                                {meta.description}
                              </p>

                              {key === "rent" && (
                                <>
                                  <InputField
                                    label="Rent Paid (Yearly Total)"
                                    name="rent_paid"
                                    value={formData.rent_paid}
                                    onChange={handleField}
                                    helper="Total annual rent paid for rented residence"
                                  />
                                  <CheckboxField
                                    label="Residing in a Metro City (Delhi, Mumbai, Kolkata, Chennai - 50% basic salary cap)"
                                    name="is_metro"
                                    checked={formData.is_metro}
                                    onChange={handleField}
                                  />
                                </>
                              )}

                              {key === "homeLoan" && (
                                <>
                                  <InputField
                                    label="Home Loan Interest Paid (Section 24b)"
                                    name="home_loan_interest"
                                    value={formData.home_loan_interest}
                                    onChange={handleField}
                                    helper="Maximum allowable deduction is ₹2,00,000 for self-occupied property"
                                  />
                                  <InputField
                                    label="Principal Repayment (Eligible under Sec 80C)"
                                    name="home_loan_principal"
                                    value={formData.home_loan_principal}
                                    onChange={handleField}
                                    helper="Counts towards the combined ₹1,50,000 limit of Section 80C"
                                  />
                                </>
                              )}

                              {key === "eduLoan" && (
                                <InputField
                                  label="Education Loan Interest Paid (Section 80E)"
                                  name="education_loan_interest"
                                  value={formData.education_loan_interest}
                                  onChange={handleField}
                                  helper="Interest paid on loan for higher education of self, spouse, or children"
                                />
                              )}

                              {key === "investments" && (
                                <InputField
                                  label="80C Investments (PPF, EPF, ELSS, Life Insurance)"
                                  name="sec80c_invested"
                                  value={formData.sec80c_invested}
                                  onChange={handleField}
                                  helper="Maximum allowable deduction is ₹1,50,000 per financial year"
                                />
                              )}

                              {key === "nps" && (
                                <>
                                  <InputField
                                    label="NPS Voluntary Contribution (Section 80CCD 1B)"
                                    name="nps_self"
                                    value={formData.nps_self}
                                    onChange={handleField}
                                    helper="Additional deduction up to ₹50,000 over and above Section 80C"
                                  />
                                  <InputField
                                    label="NPS Employer Contribution (Section 80CCD 2)"
                                    name="nps_employer"
                                    value={formData.nps_employer}
                                    onChange={handleField}
                                    helper="Deductible under both Old and New regimes (capped at 10% / 14% of salary)"
                                  />
                                </>
                              )}

                              {key === "health" && (
                                <>
                                  <InputField
                                    label="Health Insurance Premium (Self & Family)"
                                    name="health_self"
                                    value={formData.health_self}
                                    onChange={handleField}
                                    helper="Deduction up to ₹25,000 (or ₹50,000 if senior citizen)"
                                  />
                                  <CheckboxField
                                    label="Self is Senior Citizen (60 years or above)"
                                    name="self_senior_citizen"
                                    checked={formData.self_senior_citizen}
                                    onChange={handleField}
                                  />
                                  <InputField
                                    label="Health Insurance Premium (Parents)"
                                    name="health_parents"
                                    value={formData.health_parents}
                                    onChange={handleField}
                                    helper="Additional deduction up to ₹25,000 (or ₹50,000 for senior parents)"
                                  />
                                  <CheckboxField
                                    label="Parents are Senior Citizens (60 years or above)"
                                    name="parents_senior_citizen"
                                    checked={formData.parents_senior_citizen}
                                    onChange={handleField}
                                  />
                                </>
                              )}

                              {key === "donations" && (
                                <InputField
                                  label="Eligible Donations (Section 80G)"
                                  name="donations"
                                  value={formData.donations}
                                  onChange={handleField}
                                  helper="50% or 100% eligible qualifying donations to approved charities"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div
                    role="alert"
                    className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 rounded-lg flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Primary Action Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-lg font-medium text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        <span>Calculating Tax Liability...</span>
                      </>
                    ) : !isAuthenticated ? (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Sign in to Calculate</span>
                      </>
                    ) : (
                      <>
                        <Calculator className="w-4 h-4" />
                        <span>Calculate Tax Liability</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-muted-foreground text-center mt-2">
                    {isAuthenticated
                      ? "Evaluates Old vs New regime simultaneously. Results are saved to your history."
                      : "Sign in or create an account to calculate your tax and save your history."}
                  </p>
                </div>
              </form>
            </div>
          </div>

          {/* ──────── RIGHT: RESULTS & ANALYSIS (7 cols) ──────── */}
          <div className="lg:col-span-7 space-y-6">
            {/* Save Notification Toast */}
            {saveToast && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-lg flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 no-print">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Calculation saved to your history.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="font-medium underline hover:text-emerald-900 dark:hover:text-emerald-200 ml-2"
                >
                  View History
                </button>
              </div>
            )}

            {/* Loading state skeleton */}
            {isLoading && <LoadingState />}

            {/* Results Display */}
            {result && !isLoading && (
              <ResultsPanel
                result={result}
                formData={formData}
                onPrint={handlePrint}
              />
            )}

            {/* Empty state when no calculation performed yet */}
            {!result && !isLoading && <InitialEmptyState />}
          </div>
        </div>
      </main>

      {/* ── Professional Footer ─────────────────────────── */}
      <footer className="border-t border-border bg-card mt-12 py-8 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">TaxCopilot</span>
            <span>•</span>
            <span>Indian Income Tax Planning Engine</span>
          </div>

          <div className="flex items-center gap-5">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              Terms &amp; Disclaimer
            </Link>
            <a
              href="https://www.incometax.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <span>IT Department Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-3 text-[11px] text-muted-foreground/80 text-center sm:text-left">
          Disclaimer: Figures generated are computational estimates based on the
          Income Tax Act, 1961 and Finance Act amendments. They do not
          constitute licensed Chartered Accountant certification.
        </div>
      </footer>

      {/* ── Slide-Over History Drawer ── */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={handleSelectHistory}
        onDelete={handleDeleteHistory}
        onClear={handleClearHistory}
        isAuthenticated={isAuthenticated}
        onPromptAuth={handlePromptAuth}
      />

      {/* ── Account Settings Modal ── */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* ── Reference Guide Modal ── */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* ── Tax Slabs Reference Modal ── */}
      <TaxSlabsModal
        isOpen={showSlabsModal}
        onClose={() => setShowSlabsModal(false)}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE (Initial View)
   ═══════════════════════════════════════════════════════════════ */

function InitialEmptyState() {
  return (
    <div className="bg-card border border-border rounded-xl p-8 sm:p-12 text-center space-y-4 shadow-sm">
      <div className="w-12 h-12 mx-auto rounded-lg bg-muted border border-border flex items-center justify-center text-foreground">
        <Calculator className="w-6 h-6 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-foreground">
          Ready for regime analysis
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          Enter your gross salary and any applicable deduction figures on the left.
          The engine will calculate Old vs New regime liabilities and highlight
          optimal savings.
        </p>
      </div>

      <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>New vs Old regime comparison</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Marginal relief computation</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Deduction room analysis</span>
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOADING STATE
   ═══════════════════════════════════════════════════════════════ */

function LoadingState() {
  return (
    <div className="space-y-4 animate-pulse" role="status" aria-label="Calculating tax">
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="h-5 w-40 bg-muted rounded" />
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/60 rounded-lg space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-7 w-28 bg-muted rounded" />
          </div>
          <div className="p-4 bg-muted/60 rounded-lg space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-7 w-28 bg-muted rounded" />
          </div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-4/5 bg-muted rounded" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RESULTS PANEL COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function ResultsPanel({
  result,
  formData,
  onPrint,
}: {
  result: any;
  formData: any;
  onPrint: () => void;
}) {
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  const winner = result.regime_comparison.winner; // "old" or "new"
  const loser = winner === "old" ? "new" : "old";
  const savings = result.regime_comparison.savings || 0;

  const activeSections =
    winner === "old"
      ? result.old_regime_sections || []
      : result.new_regime_sections || [];

  const activeCodes = new Set(activeSections.map((s: any) => s.code));
  const rawInactive =
    winner === "old"
      ? result.new_regime_sections || []
      : result.old_regime_sections || [];
  const inactiveSections = rawInactive.filter(
    (s: any) => !activeCodes.has(s.code)
  );

  return (
    <div className="space-y-6">
      {/* ── Recommendation Card ── */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Regime Comparison
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
              <span>
                Recommended:{" "}
                <span className="capitalize">{winner} Tax Regime</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                Optimal
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
              title="Print summary for declaration"
            >
              <Printer className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Side-by-side Regime Tax Boxes */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Old Regime */}
          <div
            className={`p-4 rounded-lg border transition-colors ${
              winner === "old"
                ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                : "border-border bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                Old Regime Tax
              </span>
              {winner === "old" && (
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                  Selected
                </span>
              )}
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
              ₹{formatINR(result.regime_comparison.old_tax)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Includes full itemized deductions
            </p>
          </div>

          {/* New Regime */}
          <div
            className={`p-4 rounded-lg border transition-colors ${
              winner === "new"
                ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                : "border-border bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                New Regime Tax
              </span>
              {winner === "new" && (
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                  Selected
                </span>
              )}
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
              ₹{formatINR(result.regime_comparison.new_tax)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              New Regime + ₹75,000 std deduction
            </p>
          </div>
        </div>

        {/* Savings Announcement */}
        <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              Opting for the <strong className="capitalize">{winner}</strong>{" "}
              regime saves{" "}
              <strong>₹{formatINR(savings)}</strong> in annual tax payable.
            </span>
          </div>
        </div>
      </div>

      {/* ── Tax Breakdown Table ── */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          Comparative Calculation Breakdown
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Component</th>
                <th className="py-2 px-4 font-medium text-right">Old Regime</th>
                <th className="py-2 pl-4 font-medium text-right">New Regime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {/* Gross Income */}
              <tr>
                <td className="py-2.5 pr-4 text-foreground font-medium">
                  Gross Income
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums">
                  ₹{formatINR(
                    (Number(formData.basic_salary) || 0) +
                    (Number(formData.hra_received) || 0) +
                    (Number(formData.other_allowances) || 0) +
                    (Number(formData.other_income_interest) || 0)
                  )}
                </td>
                <td className="py-2.5 pl-4 text-right tabular-nums">
                  ₹{formatINR(
                    (Number(formData.basic_salary) || 0) +
                    (Number(formData.hra_received) || 0) +
                    (Number(formData.other_allowances) || 0) +
                    (Number(formData.other_income_interest) || 0)
                  )}
                </td>
              </tr>

              {/* HRA Exemption - only show if applicable */}
              {(result.regime_comparison.hra_exemption || 0) > 0 && (
                <tr>
                  <td className="py-2.5 pr-4 text-foreground">
                    <span className="text-muted-foreground">Less:</span> HRA Exemption (Sec 10(13A))
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-red-600 dark:text-red-400">
                    −₹{formatINR(result.regime_comparison.hra_exemption)}
                  </td>
                  <td className="py-2.5 pl-4 text-right tabular-nums text-muted-foreground">
                    —
                  </td>
                </tr>
              )}

              {/* Standard Deduction */}
              <tr>
                <td className="py-2.5 pr-4 text-foreground">
                  <span className="text-muted-foreground">Less:</span> Standard Deduction (Sec 16(ia))
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums text-red-600 dark:text-red-400">
                  −₹{formatINR(result.regime_comparison.old_std ?? 50000)}
                </td>
                <td className="py-2.5 pl-4 text-right tabular-nums text-red-600 dark:text-red-400">
                  −₹{formatINR(result.regime_comparison.new_std ?? 75000)}
                </td>
              </tr>

              {/* Chapter VI-A / Section Deductions */}
              <tr>
                <td className="py-2.5 pr-4 text-foreground">
                  <span className="text-muted-foreground">Less:</span> Chapter VI-A Deductions
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums text-red-600 dark:text-red-400">
                  {(() => {
                    const total = (result.old_regime_sections || []).reduce(
                      (acc: number, s: any) => acc + (s.used || 0), 0
                    );
                    return total > 0 ? `−₹${formatINR(total)}` : "₹0";
                  })()}
                </td>
                <td className="py-2.5 pl-4 text-right tabular-nums text-red-600 dark:text-red-400">
                  {(() => {
                    const total = (result.new_regime_sections || []).reduce(
                      (acc: number, s: any) => acc + (s.used || 0), 0
                    );
                    return total > 0 ? `−₹${formatINR(total)}` : "₹0";
                  })()}
                </td>
              </tr>

              {/* Taxable Income - highlighted subtotal */}
              <tr className="bg-muted/20">
                <td className="py-2.5 pr-4 text-foreground font-semibold">
                  Taxable Income
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums font-semibold">
                  ₹{formatINR(result.regime_comparison.old_taxable)}
                </td>
                <td className="py-2.5 pl-4 text-right tabular-nums font-semibold">
                  ₹{formatINR(result.regime_comparison.new_taxable)}
                </td>
              </tr>

              {/* Tax on Taxable Income (slab-wise) */}
              <tr>
                <td className="py-2.5 pr-4 text-foreground">
                  Tax on Taxable Income (slab rates)
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums">
                  ₹{formatINR(result.regime_comparison.old_slab_tax ?? result.regime_comparison.old_tax)}
                </td>
                <td className="py-2.5 pl-4 text-right tabular-nums">
                  ₹{formatINR(result.regime_comparison.new_slab_tax ?? result.regime_comparison.new_tax)}
                </td>
              </tr>

              {/* Section 87A Rebate - only show if applicable */}
              {((result.regime_comparison.old_rebate || 0) > 0 || (result.regime_comparison.new_rebate || 0) > 0) && (
                <tr>
                  <td className="py-2.5 pr-4 text-foreground">
                    <span className="text-muted-foreground">Less:</span> Section 87A Rebate
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {(result.regime_comparison.old_rebate || 0) > 0
                      ? `−₹${formatINR(result.regime_comparison.old_rebate)}`
                      : "—"}
                  </td>
                  <td className="py-2.5 pl-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {(result.regime_comparison.new_rebate || 0) > 0
                      ? `−₹${formatINR(result.regime_comparison.new_rebate)}`
                      : "—"}
                  </td>
                </tr>
              )}

              {/* Marginal Relief u/s 87A Proviso - only show if applicable */}
              {((result.regime_comparison.old_marginal_relief || 0) > 0 || (result.regime_comparison.new_marginal_relief || 0) > 0) && (
                <tr>
                  <td className="py-2.5 pr-4 text-foreground">
                    <span className="text-muted-foreground">Less:</span> Marginal Relief (Sec 87A Proviso)
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {(result.regime_comparison.old_marginal_relief || 0) > 0
                      ? `−₹${formatINR(result.regime_comparison.old_marginal_relief)}`
                      : "—"}
                  </td>
                  <td className="py-2.5 pl-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {(result.regime_comparison.new_marginal_relief || 0) > 0
                      ? `−₹${formatINR(result.regime_comparison.new_marginal_relief)}`
                      : "—"}
                  </td>
                </tr>
              )}

              {/* Surcharge - only show if applicable */}
              {((result.regime_comparison.old_surcharge || 0) > 0 || (result.regime_comparison.new_surcharge || 0) > 0) && (
                <tr>
                  <td className="py-2.5 pr-4 text-foreground">
                    <span className="text-muted-foreground">Add:</span> Surcharge
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums">
                    {(result.regime_comparison.old_surcharge || 0) > 0
                      ? `+₹${formatINR(result.regime_comparison.old_surcharge)}`
                      : "—"}
                  </td>
                  <td className="py-2.5 pl-4 text-right tabular-nums">
                    {(result.regime_comparison.new_surcharge || 0) > 0
                      ? `+₹${formatINR(result.regime_comparison.new_surcharge)}`
                      : "—"}
                  </td>
                </tr>
              )}

              {/* Cess */}
              <tr>
                <td className="py-2.5 pr-4 text-foreground">
                  <span className="text-muted-foreground">Add:</span> Health &amp; Education Cess (4%)
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums">
                  ₹{formatINR(result.regime_comparison.old_cess ?? 0)}
                </td>
                <td className="py-2.5 pl-4 text-right tabular-nums">
                  ₹{formatINR(result.regime_comparison.new_cess ?? 0)}
                </td>
              </tr>

              {/* Net Tax Payable - final row */}
              <tr className="font-semibold bg-muted/20 border-t-2 border-border">
                <td className="py-2.5 pr-4 text-foreground">Net Tax Payable</td>
                <td
                  className={`py-2.5 px-4 text-right tabular-nums ${
                    winner === "old"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground"
                  }`}
                >
                  ₹{formatINR(result.regime_comparison.old_tax)}
                </td>
                <td
                  className={`py-2.5 pl-4 text-right tabular-nums ${
                    winner === "new"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground"
                  }`}
                >
                  ₹{formatINR(result.regime_comparison.new_tax)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tax Advisory & Explanation ── */}
      {result.explanation && (
        <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span>Tax Advisory Analysis</span>
            </h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border">
              Statutory Basis
            </span>
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {result.explanation}
          </div>
        </div>
      )}

      {/* ── Active Deductions Section ── */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Allowable Deductions ({winner.toUpperCase()} Regime)
          </h3>
          <span className="text-xs text-muted-foreground">
            {activeSections.length} eligible{" "}
            {activeSections.length === 1 ? "section" : "sections"}
          </span>
        </div>

        {activeSections.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Under the New Regime, Chapter VI-A deductions are not
            allowable in exchange for lower tax slab rates.
          </p>
        ) : (
          <div className="space-y-3">
            {activeSections.map((sec: any, index: number) => {
              const displayName = getDisplayName(sec);
              const hasNumericLimit = typeof sec.limit === "number";
              const progressPct =
                hasNumericLimit && sec.limit > 0
                  ? Math.min(100, (sec.used / sec.limit) * 100)
                  : 0;

              return (
                <div
                  key={`sec-${sec.code}-${index}`}
                  className="p-3.5 rounded-lg border border-border bg-background space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {displayName}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-foreground shrink-0">
                      ₹{formatINR(sec.used)} /{" "}
                      {sec.limit === "No limit"
                        ? "No ceiling"
                        : `₹${formatINR(sec.limit)}`}
                    </span>
                  </div>

                  {hasNumericLimit && (
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progressPct >= 100
                            ? "bg-emerald-600 dark:bg-emerald-400"
                            : "bg-primary"
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}

                  {typeof sec.room === "number" &&
                    sec.room > 0 &&
                    sec.limit !== "No limit" && (
                      <div className="text-[11px] text-muted-foreground pt-1 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                          ₹{formatINR(sec.room)} unused headroom available in
                          this section.
                        </span>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Inactive Deductions Toggle ── */}
      {inactiveSections.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm no-print">
          <button
            type="button"
            onClick={() => setInactiveExpanded(!inactiveExpanded)}
            className="w-full flex items-center justify-between text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={inactiveExpanded}
          >
            <span className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5" />
              <span>
                View {inactiveSections.length} deductions not available under the{" "}
                {winner} regime
              </span>
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                inactiveExpanded ? "rotate-180" : ""
              }`}
            />
          </button>

          {inactiveExpanded && (
            <div className="mt-3 pt-3 border-t border-border space-y-2 text-xs">
              <p className="text-[11px] text-muted-foreground mb-2">
                These deductions apply exclusively under the {loser} regime:
              </p>
              {inactiveSections.map((sec: any, index: number) => (
                <div
                  key={`inactive-${sec.code}-${index}`}
                  className="flex items-center justify-between p-2.5 rounded-md bg-muted/40 text-muted-foreground"
                >
                  <span>{getDisplayName(sec)}</span>
                  <span className="font-mono tabular-nums line-through">
                    ₹{formatINR(sec.used)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAX SLABS MODAL (Statutory Reference)
   ═══════════════════════════════════════════════════════════════ */

function TaxSlabsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-xl p-6 z-10 space-y-5 overflow-hidden max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Statutory Income Tax Slabs
            </h3>
            <p className="text-xs text-muted-foreground">
              Applicable for Financial Year 2025-26 &amp; 2026-27
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Regime Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              NEW TAX REGIME
            </span>
            <span className="text-[11px] text-muted-foreground">
              Standard deduction ₹75,000
            </span>
          </div>
          <table className="w-full text-xs text-left border border-border rounded-lg overflow-hidden">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="py-2 px-3 font-medium">Income Slab</th>
                <th className="py-2 px-3 font-medium text-right">Tax Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {NEW_REGIME_SLABS.map((slab, i) => (
                <tr key={`new-slab-${i}`}>
                  <td className="py-2 px-3">{formatSlabRange(slab.from, slab.to)}</td>
                  <td className="py-2 px-3 text-right font-medium">{slab.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-muted-foreground">
            * Rebate applies for taxable income up to ₹12,00,000 (effectively zero tax up to ₹12,75,000 for salaried taxpayers).
          </p>
        </div>

        {/* Old Regime Table */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              OLD TAX REGIME (REGULAR PROVISIONS)
            </span>
            <span className="text-[11px] text-muted-foreground">
              Standard deduction ₹50,000
            </span>
          </div>
          <table className="w-full text-xs text-left border border-border rounded-lg overflow-hidden">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="py-2 px-3 font-medium">Income Slab</th>
                <th className="py-2 px-3 font-medium text-right">Tax Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {OLD_REGIME_SLABS.map((slab, i) => (
                <tr key={`old-slab-${i}`}>
                  <td className="py-2 px-3">{formatSlabRange(slab.from, slab.to)}</td>
                  <td className="py-2 px-3 text-right font-medium">{slab.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-muted-foreground">
            * Rebate applies for taxable income up to ₹5,00,000 (max ₹12,500). Exemption limit is ₹3,00,000 for senior citizens (60-79) and ₹5,00,000 for super seniors (80+).
          </p>
        </div>

        {/* Small footer note below both tables */}
        <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/60">
          Plus 4% health and education cess on the tax. Surcharge applies for higher incomes.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REUSABLE FORM FIELDS
   ═══════════════════════════════════════════════════════════════ */

function InputField({
  label,
  name,
  value,
  onChange,
  prefix = "₹",
  placeholder,
  required = false,
  min,
  max,
  helper,
}: {
  label: string;
  name: string;
  value: number | string;
  onChange: any;
  prefix?: string;
  placeholder?: string;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  helper?: string;
}) {
  const inputId = `field-${name}`;
  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-xs font-medium text-foreground mb-1"
      >
        {label}{" "}
        {required && (
          <span className="text-red-500" aria-label="required">
            *
          </span>
        )}
      </label>
      <div className="relative">
        {prefix && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-muted-foreground text-xs">{prefix}</span>
          </div>
        )}
        <input
          id={inputId}
          type="number"
          name={name}
          value={value ?? ""}
          onChange={onChange}
          onFocus={(e) => {
            // Select all on focus so typing replaces "0" instead of appending to it.
            // This prevents the "0150000" leading-zero display bug.
            e.target.select();
          }}
          required={required}
          min={min !== undefined ? min : 0}
          max={max}
          className={`block w-full ${
            prefix ? "pl-7" : "pl-3"
          } pr-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors`}
          placeholder={placeholder ?? (prefix ? "0" : "")}
        />
      </div>
      {helper && (
        <span className="text-[10px] text-muted-foreground mt-0.5 block">
          {helper}
        </span>
      )}
    </div>
  );
}

function CheckboxField({
  label,
  name,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: any;
}) {
  const inputId = `check-${name}`;
  return (
    <div className="flex items-start pt-1">
      <input
        id={inputId}
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 mt-0.5 text-primary bg-background border-input rounded focus:ring-ring cursor-pointer"
      />
      <label
        htmlFor={inputId}
        className="ml-2 text-xs text-muted-foreground cursor-pointer select-none leading-normal"
      >
        {label}
      </label>
    </div>
  );
}
