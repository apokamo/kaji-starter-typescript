import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".kaji-artifacts/**",
      ".kaji/artifacts/**",
      ".tools/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "tests/fixtures/**",
      "tools/kaji/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  prettier,
);
