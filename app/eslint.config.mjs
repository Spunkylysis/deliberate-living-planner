import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// eslint-config-next 15.x ships its configs in the older "extends"-based
// eslintrc format, not the newer flat-config array format -- FlatCompat
// is the standard bridge Next.js itself recommends for exactly this
// combination (older config package + newer ESLint flat config).
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
