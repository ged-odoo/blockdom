import pkg from "./package.json";
import typescript from 'rollup-plugin-typescript2';
import { terser } from "rollup-plugin-terser";

/**
 * Generate from a string depicting a path a new path for the minified version.
 * @param {string} pkgFileName file name
 */
function generateMinifiedNameFromPkgName(pkgFileName) {
  const parts = pkgFileName.split('.');
  parts.splice(parts.length - 1, 0, "min");
  return parts.join('.');
}

/**
 * Get the rollup config based on the arguments
 * @param {string} format format of the bundle
 * @param {string} generatedFileName generated file name
 * @param {boolean} minified should it be minified
 */
function getConfigForFormat(format, generatedFileName, minified = false) {
  return {
    file: minified ? generateMinifiedNameFromPkgName(generatedFileName) : generatedFileName,
    format: format,
    name: "blockdom",
    extend: true,
    freeze: false,
    plugins: minified ? [terser()] : [],
    indent: '    ', // indent with 4 spaces
  };
}

export default {
  input: "src/index.ts",
  output: [
    getConfigForFormat('esm', pkg.module),
    getConfigForFormat('esm', pkg.module, true),
    getConfigForFormat('cjs', pkg.main),
    getConfigForFormat('cjs', pkg.main, true),
    getConfigForFormat('iife', pkg.browser),
    getConfigForFormat('iife', pkg.browser, true),
  ],
  plugins: [
    typescript({
      useTsconfigDeclarationDir: true
    }),
  ]
};
