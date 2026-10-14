"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  History,
  Trash2,
  ArrowRight,
  TrendingDown,
  Calendar,
  Sparkles,
  Search,
  CheckCircle2,
} from "lucide-react";

export interface HistoryItem {
  id: string;
  user_id?: string;
  user_email?: string;
  timestamp: number;
  title: string;
  winner: string;
  savings: number;
  old_tax: number;
  new_tax: number;
  basic_salary: number;
  form_data: any;
  result: any;
}

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  isAuthenticated: boolean;
  onPromptAuth: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelect,
  onDelete,
  onClear,
  isAuthenticated,
  onPromptAuth,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const filteredHistory = history.filter((item) => {
    const q = searchTerm.toLowerCase();
    const title = (item.title || "").toLowerCase();
    const winner = (item.winner || "").toLowerCase();
    const salary = item.basic_salary?.toString() || "";
    return title.includes(q) || winner.includes(q) || salary.includes(q);
  });

  const formatDate = (ts: number) => {
    try {
      const d = new Date(ts * 1000);
      return d.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recent";
    }
  };

  const formatINR = (val: number | undefined) => {
    if (val == null) return "0";
    return val.toLocaleString("en-IN");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer container (slides vertically from right) */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            role="dialog"
            aria-modal="true"
            aria-label="Tax Strategy History"
            className="fixed top-0 right-0 h-full w-full max-w-md bg-card text-card-foreground border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    Calculation History
                    {isAuthenticated && history.length > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {history.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Your saved tax comparisons
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Close history"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-header / Actions (only when authenticated) */}
            {isAuthenticated && (
              <div className="p-4 border-b border-border bg-muted/20 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by salary, regime..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>

                {history.length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {filteredHistory.length} saved{" "}
                      {filteredHistory.length === 1 ? "report" : "reports"}
                    </span>
                    {confirmClear ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-red-500 font-medium">Clear all?</span>
                        <button
                          type="button"
                          onClick={() => {
                            onClear();
                            setConfirmClear(false);
                          }}
                          className="px-2 py-1 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                        >
                          Yes, Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClear(false)}
                          className="px-2 py-1 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClear(true)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear all
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {!isAuthenticated ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center text-foreground">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      Sign in to view saved history
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Sign in to access past calculations, compare strategies, and retain records across sessions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onPromptAuth();
                    }}
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    Sign In to Account
                  </button>
                </div>
              ) : history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-muted-foreground">
                  <History className="w-12 h-12 stroke-[1.2] opacity-40" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      No calculations saved yet
                    </p>
                    <p className="text-xs max-w-xs">
                      Fill out your salary and deductions, then click &ldquo;Generate Tax Strategy&rdquo; to automatically log your results here.
                    </p>
                  </div>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No calculations match &ldquo;{searchTerm}&rdquo;
                </div>
              ) : (
                filteredHistory.map((item) => {
                  const isNewRegime =
                    item.winner?.toLowerCase().includes("new") ?? true;
                  const winnerLabel = isNewRegime
                    ? "New Regime Optimal"
                    : "Old Regime Optimal";

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group p-4 rounded-xl border border-border bg-background hover:border-primary/40 hover:shadow-md transition-all space-y-3 relative"
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                              isNewRegime
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-muted text-foreground border-border"
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            {winnerLabel}
                          </span>
                          <h4 className="text-sm font-semibold text-foreground">
                            Basic Salary: ₹{formatINR(item.basic_salary)}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-secondary transition-all"
                          title="Delete calculation"
                          aria-label="Delete calculation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-secondary/50 border border-border/50 text-xs">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-medium">
                            Savings
                          </div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />
                            ₹{formatINR(item.savings)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-medium">
                            Estimated Tax
                          </div>
                          <div className="font-semibold text-foreground">
                            ₹
                            {formatINR(
                              isNewRegime ? item.new_tax : item.old_tax
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom row: Date & Load button */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(item.timestamp)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(item);
                            onClose();
                          }}
                          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors group-hover:translate-x-0.5"
                        >
                          <span>Load Strategy</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-background/50 backdrop-blur-sm text-center">
              <p className="text-[11px] text-muted-foreground">
                History is automatically synchronized with your account.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
