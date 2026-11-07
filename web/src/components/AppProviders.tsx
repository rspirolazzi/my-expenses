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

/**
 * next-themes renders an inline script that sets the theme before first paint. It only matters in
 * the server HTML; when React creates it on the client it would never run, and React 19 warns
 * ("Encountered a script tag..."). Marking the client copy as a data block silences that warning;
 * next-themes already suppresses the attribute hydration mismatch on this script.
 */
const themeScriptProps =
  typeof window === "undefined" ? undefined : ({ type: "application/json" } as const);

export function AppProviders({ theme, children }: { theme?: ThemeName; children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={themeScriptProps}
    >
      <ThemeSync theme={theme} />
      {children}
    </ThemeProvider>
  );
}
