import Link from "next/link";
import { ArrowLeft, Shield, Lock, EyeOff, Trash2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | TaxCopilot",
  description: "How your financial and tax calculation data is handled, stored, and protected.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Calculator</span>
          </Link>
          <span className="text-xs font-semibold text-foreground">TaxCopilot Privacy Policy</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <article className="space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-secondary text-xs font-medium text-muted-foreground mb-3">
              <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Data Protection &amp; Confidentiality</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Privacy Policy
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: April 2025 • Applicable to all Indian income tax planning sessions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-lg border border-border bg-card space-y-2">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-foreground">
                <Lock className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">No Third-Party Sharing</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your salary, investments, and deductions are never sold, rented, or shared with lenders, insurers, or advertising networks.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card space-y-2">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-foreground">
                <EyeOff className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Session-Based Calculation</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Anonymous calculations are processed in your browser memory and discarded when you close or refresh the window unless you explicitly save them.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card space-y-2">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-foreground">
                <Trash2 className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Instant Deletion Control</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You maintain complete control. You can delete individual calculations or clear your entire history with one click.
              </p>
            </div>
          </div>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed border-t border-border pt-6">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">1. Information We Collect</h2>
              <p>
                When you use TaxCopilot, you enter numerical figures to calculate tax liabilities:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>Salary breakdown (Basic salary, HRA, special allowances, interest income).</li>
                <li>Deduction figures (Section 80C, 80D, 80CCD(1B) NPS, home loan interest, education loan).</li>
                <li>Demographic indicators (Age bracket, senior citizen status, metro city residency).</li>
                <li>Account credentials (Email, name, and hashed passwords if you register an optional account).</li>
              </ul>
              <p className="text-xs">
                We do not collect PAN numbers, Aadhaar numbers, bank account numbers, or employer tax deduction account (TAN) details.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">2. How Your Data Is Processed</h2>
              <p>
                The tax calculation engine applies statutory rules derived from the Income Tax Act framework, the New Tax Regime, and relevant Finance Acts. Calculations are computed deterministically. Natural language advice is generated through secure, transient requests that do not store taxpayer records.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">3. Storage &amp; Data Retention</h2>
              <p>
                If you use the tool without logging in, your data resides strictly within your browser&apos;s local storage. If you sign in, your calculation history is saved under your private account so you can retrieve it across devices. You can delete any saved report or purge all history from the calculation drawer at any time.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">4. Cookies and Local Storage</h2>
              <p>
                We use local storage solely to remember your color theme preference (light or dark mode) and to retain your in-progress calculation draft. We do not use third-party tracking pixels or commercial ad retargeting cookies.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">5. Questions and Contact</h2>
              <p>
                If you have inquiries regarding privacy practices or wish to request complete deletion of your account record, you can reach out via your account settings or contact our support desk.
              </p>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
