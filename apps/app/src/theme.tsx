import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useTheme } from "@rootpanther/ui";

type ThemeApi = ReturnType<typeof useTheme>;

const ThemeContext = createContext<ThemeApi | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const api = useTheme("rp-theme");
  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used inside ThemeProvider");
  return ctx;
}
