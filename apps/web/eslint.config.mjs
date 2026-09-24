import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // A query function that reads the AbortSignal is aborted whenever its
      // last observer unmounts (StrictMode's double mount, a tab switch) and
      // is then sent again from scratch. Reads finish into the cache instead.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Property[key.name='queryFn'] > :function > ObjectPattern > Property[key.name='signal']",
          message:
            "Do not read the AbortSignal in a query function: an aborted read is sent again. See components/providers.tsx.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "storybook-static/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
