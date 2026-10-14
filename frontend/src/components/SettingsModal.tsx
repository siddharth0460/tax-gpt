"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Check,
  AlertCircle,
  Loader2,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearHistory?: () => void;
  initialTab?: string;
}

export type TabType = "profile";

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, updateProfile, logout } = useAuth();

  // Profile Form State
  const [name, setName] = useState(user?.name || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Sync state if user changes or modal opens
  React.useEffect(() => {
    if (user) {
      setName(user.name);
    }
  }, [user, isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    if (!name.trim() || name.trim().length < 2) {
      setProfileError("Full Name must be at least 2 characters.");
      return;
    }

    setProfileSaving(true);
    const res = await updateProfile(name.trim(), user?.avatar);
    setProfileSaving(false);

    if (res.success) {
      setProfileSuccess("Profile updated successfully!");
      setTimeout(() => {
        setProfileSuccess(null);
        onClose();
      }, 1500);
    } else {
      setProfileError(res.error || "Failed to update profile.");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
          className="relative w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2
                  id="profile-modal-title"
                  className="text-base font-bold text-foreground"
                >
                  User Profile
                </h2>
                <p className="text-xs text-muted-foreground">
                  View and update your account details
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Close profile modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {profileSuccess && (
                <div className="p-3 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{profileSuccess}</span>
                </div>
              )}
              {profileError && (
                <div className="p-3 text-xs rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{profileError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label
                  htmlFor="profile-name"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your Name"
                  className="w-full px-3.5 py-2.5 text-xs bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label
                  htmlFor="profile-email"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full px-3.5 py-2.5 text-xs bg-muted border border-border rounded-xl text-muted-foreground cursor-not-allowed"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Account email address is verified and permanent.
                </span>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    logout();
                  }}
                  className="px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {profileSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{profileSaving ? "Saving..." : "Save Changes"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
