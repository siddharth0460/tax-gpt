"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User as UserIcon,
  LogOut,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface UserProfileMenuProps {
  onOpenProfile: () => void;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  onOpenProfile,
}) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  // Extract initials (e.g. "Alex Sharma" -> "AS", "sid" -> "SI")
  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const displayName = user.name || "User";
  const initials = getInitials(displayName);

  return (
    <div className="relative w-full" ref={menuRef}>
      {/* ── Popover Menu (Opens below the trigger in top header) ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute top-full right-0 mt-2 w-56 bg-card text-card-foreground border border-border rounded-xl shadow-xl p-1.5 z-50"
            role="menu"
            aria-orientation="vertical"
          >
            {/* Direct Account Actions: Profile */}
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  onOpenProfile();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted text-foreground transition-colors text-left text-xs font-medium group"
              >
                <div className="flex items-center gap-2.5">
                  <UserIcon className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                  <span>Account Profile</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-border my-1 mx-1" />

            {/* Logout */}
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted text-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors text-left text-xs font-medium group"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-red-500" />
                  <span>Sign out</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-red-500 transition-colors" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-2 rounded-lg border transition-all flex items-center justify-between text-left ${
          isOpen
            ? "bg-secondary border-border"
            : "bg-secondary/40 hover:bg-secondary border-border"
        }`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center font-bold text-xs text-foreground shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-muted-foreground truncate leading-tight">
              {user.email || "Account"}
            </div>
          </div>
        </div>

        <MoreHorizontal className="w-4 h-4 text-muted-foreground/80 shrink-0 ml-2" />
      </button>
    </div>
  );
};
