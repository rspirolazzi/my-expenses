"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { type ReactNode, useEffect } from "react";

import type { ThemeName } from "@/lib/api/types";

/** Applies the theme saved in the user's profile, so every device follows it (FR-022). */
function ThemeSync({ theme }: { theme: ThemeName | undefined }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    if (theme) setTheme(theme);
  }, [theme, setTheme]);
  return null;
}

export function AppProviders({ theme, children }: { theme?: ThemeName; children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeSync theme={theme} />
      {children}
    </ThemeProvider>
  );
}
