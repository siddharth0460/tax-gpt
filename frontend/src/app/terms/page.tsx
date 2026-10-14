import Link from "next/link";
import { ArrowLeft, FileText, AlertTriangle, Scale, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Legal Disclaimer | TaxCopilot",
  description: "Terms of service and legal tax calculation disclaimer for Indian taxpayers.",
};

export default function TermsPage() {
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
          <span className="text-xs font-semibold text-foreground">Terms &amp; Disclaimer</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <article className="space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-secondary text-xs font-medium text-muted-foreground mb-3">
              <Scale className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Statutory Compliance &amp; Guidelines</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Terms of Service &amp; Tax Disclaimer
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Applicable to all calculations for Financial Years 2025-26 and 2026-27
            </p>
          </div>

          <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h2 className="font-semibold text-amber-900 dark:text-amber-200">
                Important Tax Estimator Notice
              </h2>
              <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
                TaxCopilot is an educational planning tool designed to help Indian taxpayers evaluate regime options and legal deduction opportunities under the Income Tax Act, 1961. It does not replace official tax filings with the Income Tax Department or professional advice from a licensed Chartered Accountant.
              </p>
            </div>
          </div>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed border-t border-border pt-6">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">1. Accuracy of Calculations</h2>
              <p>
                Calculations are derived from official tax slabs, rebate under Section 87A, standard deduction provisions (Section 16(ia)), and chapter VI-A deductions. While calculations undergo rigorous verification against statutory rules, your actual tax liability may be influenced by specific factors such as capital gains, clubbed income, advance tax interest (Sections 234A/B/C), or employer-specific payroll policies.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">2. User Responsibility</h2>
              <p>
                You are responsible for ensuring that the income, investments, and rent figures you enter match your actual Form 16, salary slips, and investment proofs. Tax declarations submitted to your employer or filed via ITR forms remain solely your responsibility.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">3. No Chartered Accountant-Client Privilege</h2>
              <p>
                Using TaxCopilot does not establish a Chartered Accountant (CA) or fiduciary relationship. Recommendations provided in the application are computational suggestions based on standard provisions of Indian tax law.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">4. System Availability &amp; Modifications</h2>
              <p>
                We strive to keep the service accessible and up-to-date with annual Union Budget notifications. Provisions and limits are updated when tax laws and Central Board of Direct Taxes (CBDT) circulars take statutory effect.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">5. Governing Law</h2>
              <p>
                These terms and any disputes arising out of the use of this software are governed by the laws of India.
              </p>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
