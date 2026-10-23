import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const FEATURES = ["stakes", "live", "story"];

// flat config replaces (not merges) a rule per matching block,
// so every block below carries the full list of patterns for its files

const relativeInto = (names) => ({
  regex: `^(\\.\\./)+(features/)?(${names})(/|$)`,
  message: "do not reach into another feature with a relative path. use @/features/<part> or @/features/<part>/server",
});

const noServer = {
  regex: "(^|/)server(/|$)",
  message:
    "browser and pure code must not import server/ code. keep the logic outside server/ as a pure function, or call the api",
};

const noNode = {
  regex: "^(node:|fs$|fs/|path$|os$|child_process$|express$)",
  message: "browser code must not import node built-ins or express",
};

function crossFeature(self, { allowServer }) {
  const others = FEATURES.filter((f) => f !== self).join("|");
  return [
    {
      regex: allowServer ? `^@/features/(${others})/(?!server$).+` : `^@/features/(${others})/.+`,
      message: allowServer
        ? "cross-feature imports must use @/features/<part> (browser-safe) or @/features/<part>/server. deep paths are private. see docs/contract.md"
        : "cross-feature imports must use @/features/<part> (browser-safe). @/features/<part>/server is only allowed inside your own server/ folder. see docs/contract.md",
    },
    relativeInto(others),
  ];
}

const restrict = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

const featureBlocks = FEATURES.flatMap((f) => [
  {
    name: `${f}/pure`,
    files: [`features/${f}/**/*.{ts,tsx}`],
    ignores: [`features/${f}/server/**`],
    rules: restrict(...crossFeature(f, { allowServer: false }), noServer),
  },
  {
    name: `${f}/browser`,
    files: [`features/${f}/components/**/*.{ts,tsx}`, `features/${f}/screens/**/*.{ts,tsx}`, `features/${f}/index.ts`],
    rules: restrict(...crossFeature(f, { allowServer: false }), noServer, noNode),
  },
  {
    name: `${f}/server`,
    files: [`features/${f}/server/**/*.ts`],
    rules: restrict(...crossFeature(f, { allowServer: true })),
  },
]);

export default defineConfig(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    name: "app",
    files: ["app/**/*.{ts,tsx}"],
    rules: restrict(
      {
        regex: "^@/features/(?![^/]+/screens/[^/]+$)",
        message: "app/ only imports feature screens (@/features/<part>/screens/*) and shared/",
      },
      relativeInto("features"),
      noServer,
      noNode,
    ),
  },
  {
    name: "server",
    files: ["server/**/*.ts"],
    rules: restrict(
      {
        regex: "^@/(?!features/[^/]+/server/routes/[^/]+$)",
        message: "server/ only imports route handlers from @/features/<part>/server/routes/*",
      },
      relativeInto("features"),
    ),
  },
  {
    name: "shared",
    files: ["shared/**/*.{ts,tsx}"],
    rules: restrict(
      { regex: "^@/(features|server)(/|$)", message: "shared/ must not depend on features or the server" },
      relativeInto("features"),
    ),
  },
  ...featureBlocks,
);
