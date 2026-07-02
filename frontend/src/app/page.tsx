"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Toggle-gated section keys ─── */
type SectionKey =
  | "rent"
  | "homeLoan"
  | "eduLoan"
  | "investments"
  | "nps"
  | "health"
  | "donations";

/* ─── Section metadata ─── */
const SECTIONS: Record<SectionKey, { label: string; icon: string; color: string }> = {
  rent:        { label: "Rent & HRA",         icon: "🏠", color: "from-sky-500/20 to-cyan-500/20 border-sky-500/40" },
  homeLoan:    { label: "Home Loan",          icon: "🏦", color: "from-amber-500/20 to-orange-500/20 border-amber-500/40" },
  eduLoan:     { label: "Education Loan",     icon: "🎓", color: "from-violet-500/20 to-purple-500/20 border-violet-500/40" },
  investments: { label: "80C Investments",    icon: "📈", color: "from-emerald-500/20 to-green-500/20 border-emerald-500/40" },
  nps:         { label: "NPS (Pension)",      icon: "🏛️", color: "from-blue-500/20 to-indigo-500/20 border-blue-500/40" },
  health:      { label: "Health Insurance",   icon: "🩺", color: "from-rose-500/20 to-pink-500/20 border-rose-500/40" },
  donations:   { label: "Donations (80G)",    icon: "🤝", color: "from-teal-500/20 to-cyan-500/20 border-teal-500/40" },
};

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
  rent:        ["rent_paid", "is_metro"],
  homeLoan:    ["home_loan_interest", "home_loan_principal"],
  eduLoan:     ["education_loan_interest"],
  investments: ["sec80c_invested"],
  nps:         ["nps_self", "nps_employer"],
  health:      ["health_self", "health_parents", "parents_senior_citizen", "self_senior_citizen"],
  donations:   ["donations"],
};

/* ─── Framer Motion variants ─── */
const sectionVariants = {
  hidden: { opacity: 0, height: 0, marginTop: 0 },
  visible: { opacity: 1, height: "auto", marginTop: 16 },
  exit: { opacity: 0, height: 0, marginTop: 0 },
};

export default function TaxSaverPage() {
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

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  /* ─── Handlers ─── */
  const handleField = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]:
          type === "checkbox"
            ? (e.target as HTMLInputElement).checked
            : type === "number"
            ? Number(value)
            : value,
      }));
    },
    []
  );

  const handleToggle = useCallback(
    (key: SectionKey) => {
      const newState = !toggles[key];
      setToggles((prev) => ({ ...prev, [key]: newState }));
      if (!newState) {
        // Reset all fields in this section to defaults
        setFormData((prev) => {
          const updated = { ...prev };
          for (const field of SECTION_FIELDS[key]) {
            (updated as any)[field] = DEFAULT_FORM[field];
          }
          return updated;
        });
      }
    },
    [toggles]
  );

  const generateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("http://localhost:8000/api/tax-strategy/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to generate strategy");
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-indigo-500 selection:text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            AI Tax Strategy Copilot
          </h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Answer a few questions and our engine will calculate the optimal regime and uncover hidden savings.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ──────── LEFT: FORM ──────── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-5 bg-gray-900 p-6 sm:p-8 rounded-3xl shadow-2xl border border-gray-800"
          >
            <form onSubmit={generateStrategy} className="space-y-6">
              {/* ── Always-visible: Income ── */}
              <FormSection title="Income" accent="text-indigo-300">
                <InputField label="Basic Salary (Yearly)" name="basic_salary" value={formData.basic_salary} onChange={handleField} />
                <InputField label="HRA Received" name="hra_received" value={formData.hra_received} onChange={handleField} />
                <InputField label="Other Allowances" name="other_allowances" value={formData.other_allowances} onChange={handleField} />
                <InputField label="Other Income (Interest, etc.)" name="other_income_interest" value={formData.other_income_interest} onChange={handleField} />
              </FormSection>

              {/* ── Always-visible: Personal Details ── */}
              <FormSection title="Personal Details" accent="text-purple-300">
                <InputField label="Age" name="age" value={formData.age} onChange={handleField} prefix="" />
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Employer Type</label>
                  <select
                    name="employer_type"
                    value={formData.employer_type}
                    onChange={handleField}
                    className="block w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-gray-200 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  >
                    <option value="private">Private Sector</option>
                    <option value="government">Government</option>
                  </select>
                </div>
              </FormSection>

              {/* ── Conditional sections ── */}
              {(Object.keys(SECTIONS) as SectionKey[]).map((key) => (
                <ConditionalSection
                  key={key}
                  sectionKey={key}
                  isOpen={toggles[key]}
                  onToggle={() => handleToggle(key)}
                  meta={SECTIONS[key]}
                >
                  {key === "rent" && (
                    <>
                      <InputField label="Rent Paid (Yearly)" name="rent_paid" value={formData.rent_paid} onChange={handleField} />
                      <CheckboxField label="Residing in a Metro City" name="is_metro" checked={formData.is_metro} onChange={handleField} accent="sky" />
                    </>
                  )}
                  {key === "homeLoan" && (
                    <>
                      <InputField label="Home Loan Interest Paid (Yearly)" name="home_loan_interest" value={formData.home_loan_interest} onChange={handleField} />
                      <InputField label="Home Loan Principal Repaid" name="home_loan_principal" value={formData.home_loan_principal} onChange={handleField} />
                    </>
                  )}
                  {key === "eduLoan" && (
                    <InputField label="Education Loan Interest Paid" name="education_loan_interest" value={formData.education_loan_interest} onChange={handleField} />
                  )}
                  {key === "investments" && (
                    <InputField label="80C Investments (PF, PPF, LIC, ELSS, etc.)" name="sec80c_invested" value={formData.sec80c_invested} onChange={handleField} />
                  )}
                  {key === "nps" && (
                    <>
                      <InputField label="NPS Self Contribution (80CCD 1B)" name="nps_self" value={formData.nps_self} onChange={handleField} />
                      <InputField label="NPS Employer Contribution (80CCD 2)" name="nps_employer" value={formData.nps_employer} onChange={handleField} />
                    </>
                  )}
                  {key === "health" && (
                    <>
                      <InputField label="Health Insurance – Self / Family" name="health_self" value={formData.health_self} onChange={handleField} />
                      <CheckboxField label="I am a Senior Citizen (60+)" name="self_senior_citizen" checked={formData.self_senior_citizen} onChange={handleField} accent="rose" />
                      <InputField label="Health Insurance – Parents" name="health_parents" value={formData.health_parents} onChange={handleField} />
                      <CheckboxField label="Parents are Senior Citizens (60+)" name="parents_senior_citizen" checked={formData.parents_senior_citizen} onChange={handleField} accent="rose" />
                    </>
                  )}
                  {key === "donations" && (
                    <InputField label="Total Donations" name="donations" value={formData.donations} onChange={handleField} />
                  )}
                </ConditionalSection>
              ))}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 mt-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 focus:outline-none focus:ring-4 focus:ring-purple-500/50 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)]"
              >
                {isLoading ? "Crunching Numbers..." : "Generate My Strategy"}
              </button>
            </form>
          </motion.div>

          {/* ──────── RIGHT: RESULTS ──────── */}
          <div className="lg:col-span-7 space-y-6">
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-900/50 border border-red-500/50 text-red-200 rounded-xl">
                {error}
              </motion.div>
            )}

            {result && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                {/* Regime Comparison */}
                <div className="bg-gray-900 p-8 rounded-3xl shadow-xl border border-gray-800 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <h2 className="text-2xl font-bold mb-6 text-white relative z-10">Regime Comparison</h2>
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className={`p-6 rounded-2xl border ${result.regime_comparison.winner === "old" ? "border-indigo-500 bg-indigo-900/30" : "border-gray-700 bg-gray-800/50"}`}>
                      <p className="text-sm text-gray-400 mb-1">Old Regime Tax</p>
                      <p className="text-3xl font-bold text-white">₹{result.regime_comparison.old_tax.toLocaleString()}</p>
                    </div>
                    <div className={`p-6 rounded-2xl border ${result.regime_comparison.winner === "new" ? "border-purple-500 bg-purple-900/30" : "border-gray-700 bg-gray-800/50"}`}>
                      <p className="text-sm text-gray-400 mb-1">New Regime Tax</p>
                      <p className="text-3xl font-bold text-white">₹{result.regime_comparison.new_tax.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 relative z-10">
                    <p className="text-green-300 font-medium">
                      Opt for the <strong className="text-white capitalize">{result.regime_comparison.winner}</strong> regime to save{" "}
                      <strong className="text-white">₹{result.regime_comparison.savings.toLocaleString()}</strong>.
                    </p>
                  </div>
                </div>

                {/* Explanation */}
                <div className="bg-gray-900 p-8 rounded-3xl shadow-xl border border-gray-800 relative">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">AI Advisor Explanation</h2>
                    {result.explanation_source && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${result.explanation_source === 'ai' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'}`}>
                        {result.explanation_source === 'ai' ? '⚡ AI Generated' : '🔄 Fallback Logic'}
                      </span>
                    )}
                  </div>
                  <div className="prose prose-invert prose-indigo max-w-none text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {result.explanation}
                  </div>
                </div>

                {/* Sections Breakdown */}
                <div className="bg-gray-900 p-8 rounded-3xl shadow-xl border border-gray-800">
                  <h2 className="text-2xl font-bold mb-6 text-white">Section-wise Room</h2>
                  <div className="space-y-4">
                    {((result.old_regime_sections || []).concat(result.new_regime_sections || [])).map((sec: any, index: number) => (
                      <div key={`${sec.code}-${index}`} className="p-5 rounded-2xl bg-gray-950/50 border border-gray-700/50 hover:border-indigo-500/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 mb-2">
                              Section {sec.code}
                            </span>
                            <h4 className="font-medium text-gray-200">{sec.name}</h4>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">Used / Limit</p>
                            <p className="font-mono text-gray-300">
                              ₹{sec.used.toLocaleString()} / {sec.limit === "No limit" ? "No limit" : `₹${sec.limit.toLocaleString()}`}
                            </p>
                          </div>
                        </div>
                        {sec.room > 0 && sec.limit !== "No limit" && (
                          <div className="mt-4 pt-4 border-t border-gray-800">
                            <p className="text-sm text-emerald-400 flex items-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              You have ₹{sec.room.toLocaleString()} unused room here.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Reusable Components
   ═══════════════════════════════════════════ */

function FormSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className={`text-lg font-semibold ${accent} border-b border-gray-800 pb-2 mb-4`}>{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ConditionalSection({
  sectionKey,
  isOpen,
  onToggle,
  meta,
  children,
}: {
  sectionKey: SectionKey;
  isOpen: boolean;
  onToggle: () => void;
  meta: { label: string; icon: string; color: string };
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border transition-colors duration-300 ${isOpen ? `bg-gradient-to-br ${meta.color}` : "border-gray-800 bg-gray-950/30"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left group"
      >
        <span className="flex items-center gap-3">
          <span className="text-xl">{meta.icon}</span>
          <span className={`font-medium transition-colors ${isOpen ? "text-white" : "text-gray-400 group-hover:text-gray-200"}`}>
            {meta.label}
          </span>
        </span>
        {/* Toggle pill */}
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${isOpen ? "bg-indigo-500" : "bg-gray-700"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${isOpen ? "translate-x-6" : "translate-x-1"}`}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key={sectionKey}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InputField({
  label,
  name,
  value,
  onChange,
  prefix = "₹",
}: {
  label: string;
  name: string;
  value: number;
  onChange: any;
  prefix?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">{prefix}</span>
          </div>
        )}
        <input
          type="number"
          name={name}
          value={value || ""}
          onChange={onChange}
          className={`block w-full ${prefix ? "pl-8" : "pl-4"} pr-3 py-3 bg-gray-950 border border-gray-700 rounded-xl text-gray-200 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-inner`}
          placeholder="0"
          min="0"
        />
      </div>
    </div>
  );
}

function CheckboxField({
  label,
  name,
  checked,
  onChange,
  accent = "indigo",
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: any;
  accent?: string;
}) {
  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className={`w-4 h-4 text-${accent}-600 bg-gray-700 border-gray-600 rounded focus:ring-${accent}-500`}
      />
      <label className="ml-2 text-sm text-gray-300">{label}</label>
    </div>
  );
}
