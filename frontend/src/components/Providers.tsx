"use client";

import React from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "744045567257-aefs26qs3cqh417pmaa27vgbev2vvaa9.apps.googleusercontent.com";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>{children}</AuthProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  );
}
