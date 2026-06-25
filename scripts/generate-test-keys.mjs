/**
 * Generate disposable PGP keys for local PGD testing (not for production).
 * Output: scripts/local-test-keys.json (gitignored)
 *
 * Usage: node scripts/generate-test-keys.mjs
 */

import * as openpgp from 'openpgp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, 'local-test-keys.json');

const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'rsa',
    rsaBits: 2048,
    userIDs: [{ name: 'PGD Local Test', email: 'pgd-test@example.com' }],
    passphrase: 'pgd-local-test',
});

const payload = {
    PGD_PASSPHRASE: 'pgd-local-test',
    PGD_PUBLIC_KEY: publicKey,
    PGD_PRIVATE_KEY: privateKey,
};

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log('Wrote', outPath);
