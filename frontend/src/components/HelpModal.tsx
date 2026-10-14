"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, HelpCircle, BookOpen, ExternalLink, ShieldCheck } from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const faqs = [
    {
      q: "How does the Old vs New Regime comparison work?",
      a: "TaxCopilot evaluates your income under both systems simultaneously. The New Regime offers lower slab rates with an automatic ₹75,000 standard deduction but disallows most Chapter VI-A deductions. The Old Regime allows full itemized deductions (80C, 80D, HRA, home loan interest) under higher slab rates.",
    },
    {
      q: "What is the Section 87A rebate and marginal relief?",
      a: "Under the New Regime, if your total taxable income is up to ₹12,00,000 (effectively ₹12,75,000 for salaried employees after standard deduction), full rebate is granted making payable tax ₹0. If income marginally exceeds ₹12,00,000, marginal relief ensures the tax payable cannot exceed the income exceeding ₹12,00,000.",
    },
    {
      q: "Which deduction sections are supported?",
      a: "The calculator supports Section 80C (up to ₹1.5L), Section 80D (health insurance for self and parents, up to ₹1L combined for seniors), Section 80CCD(1B) (NPS self-contribution up to ₹50k), Section 80CCD(2) (employer NPS), Section 24(b) (home loan interest up to ₹2L), Section 80E (education loan), and Section 10(13A) (HRA exemption).",
    },
    {
      q: "Is this calculation legally grounded?",
      a: "Yes. Rules and limits are indexed directly from the Income Tax Act, 1961, and Finance Act statutory provisions.",
    },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          className="relative w-full max-w-lg bg-card text-card-foreground border border-border rounded-xl shadow-xl p-5 sm:p-6 z-10 space-y-4 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-foreground">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Tax Calculation Reference Guide
                </h3>
                <p className="text-xs text-muted-foreground">
                  Statutory provisions &amp; regime comparison notes
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close guide"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick FAQ List */}
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-border bg-muted/30 space-y-1 text-xs"
              >
                <div className="font-semibold text-foreground">{faq.q}</div>
                <div className="text-muted-foreground leading-relaxed">
                  {faq.a}
                </div>
              </div>
            ))}
          </div>

          {/* Official Portal Reference */}
          <div className="p-3.5 rounded-lg border border-border bg-secondary/50 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-foreground">
                Income Tax Department Portal
              </div>
              <div className="text-[11px] text-muted-foreground">
                Official e-filing portal &amp; circulars
              </div>
            </div>
            <a
              href="https://www.incometax.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-card border border-border hover:bg-muted text-foreground text-xs font-medium transition-colors"
            >
              <span>Visit Portal</span>
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
