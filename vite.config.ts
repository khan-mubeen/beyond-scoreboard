import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// one config for the client build and for vitest
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["features/**/tests/**/*.test.ts", "shared/**/*.test.ts"],
  },
});
