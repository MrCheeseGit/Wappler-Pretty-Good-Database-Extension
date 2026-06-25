import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outFile = path.join(root, 'includes/dmx-pgd-openpgp.bundle.js');

await esbuild.build({
    entryPoints: [path.join(__dirname, 'pgd-openpgp-bundle-entry.js')],
    bundle: true,
    format: 'iife',
    globalName: 'PGDBundle',
    platform: 'browser',
    target: ['es2020'],
    outfile: outFile,
    minify: true,
    sourcemap: false,
    legalComments: 'none',
});

console.log('Built', outFile);
