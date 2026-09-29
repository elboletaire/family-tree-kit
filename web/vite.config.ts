/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const version = (pkg: string): string => JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, 'utf-8')).version;
// License notices of the libraries included in the bundle
const banner = `/* Family history. Includes Solid v${version('solid-js')} (https://www.solidjs.com, MIT, Copyright 2016-2025 Ryan Carniato), `
  + `d3 v${version('d3')} (https://d3js.org, ISC, Copyright 2010-2023 Mike Bostock) `
  + `family-chart v${version('family-chart')} (https://donatso.github.io/family-chart/, MIT, Copyright 2025 donatso), `
  + `Leaflet v${version('leaflet')} (https://leafletjs.com, BSD-2-Clause, Copyright 2010-2023 Volodymyr Agafonkin, 2010-2011 CloudMade), `
  + `topojson-client v${version('topojson-client')} (ISC, Copyright 2012-2019 Michael Bostock) `
  + `and world-atlas v${version('world-atlas')} (ISC, Copyright 2013-2019 Michael Bostock; Natural Earth data, public domain) */`;

// A single script (IIFE) and a single stylesheet, with Solid, d3, family-chart and Leaflet inside: scripts/build_site.py embeds
// them in index.html, which works without network and without a server.
export default defineConfig({
  plugins: [solid()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    cssTarget: 'chrome120',
    cssMinify: false,
    lib: {
      entry: 'src/main.tsx',
      formats: ['iife'],
      name: 'Arbre',
      fileName: () => 'web.js',
      cssFileName: 'web',
    },
    // postBanner: after minifying, so that it is not lost
    rolldownOptions: { output: { postBanner: banner } },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
  },
});
