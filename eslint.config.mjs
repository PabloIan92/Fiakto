import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  nextPlugin.flatConfig.recommended,
  nextPlugin.flatConfig.coreWebVitals,
  ...tseslintPlugin.configs["flat/recommended"],
  // Sin esto, un useEffect con un array de dependencias incompleto (ej.
  // faltar `ready` cuando el efecto lo usa) no tira ningún error/warning —
  // así se coló en producción el bug de "Mis solicitudes"/"Oportunidades"
  // colgadas en "Cargando..." para siempre (2026-08-11): el efecto corría
  // una sola vez con `ready` todavía en false y nunca se volvía a ejecutar.
  reactHooksPlugin.configs["recommended-latest"],
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".worktrees/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated PWA service worker output (next-pwa), not source:
    "public/sw.js",
    "public/workbox-*.js",
    "public/fallback-*.js",
  ]),
  {
    // CommonJS build scripts intentionally use require().
    files: ["scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;