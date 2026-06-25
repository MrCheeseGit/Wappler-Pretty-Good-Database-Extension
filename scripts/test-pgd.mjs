/**
 * Local smoke test for pgd.js (no Wappler required).
 * Generates a disposable keypair, then encrypt / decrypt / decryptFields / isArmored.
 *
 * Usage: npm install && npm run test:pgd
 */

import * as openpgp from 'openpgp';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pgd = require('../pgd.js');

const ctx = {
    parseOptional(value, _type, fallback) {
        if (value === undefined || value === null || value === '') return fallback;
        return value;
    },
};

function bind(fn) {
    return (...args) => fn.apply(ctx, args);
}

async function generateTestKeys() {
    const { privateKey, publicKey } = await openpgp.generateKey({
        type: 'rsa',
        rsaBits: 2048,
        userIDs: [{ name: 'PGD Test', email: 'pgd-test@example.com' }],
        passphrase: 'test-passphrase',
    });
    return { privateKey, publicKey };
}

async function main() {
    const { privateKey, publicKey } = await generateTestKeys();

    const encrypt = bind(pgd.encrypt);
    const decrypt = bind(pgd.decrypt);
    const decryptFields = bind(pgd.decryptFields);
    const isArmored = bind(pgd.isArmored);
    const fingerprint = bind(pgd.fingerprint);

    const secret = 'Account 12345678';
    const enc = await encrypt({ plaintext: secret, publicKey });
    if (enc.error) throw new Error(enc.error);
    if (!enc.ciphertext.includes('BEGIN PGP MESSAGE')) throw new Error('not armored');

    const check = isArmored({ value: enc.ciphertext });
    if (!check.valid) throw new Error('isArmored failed');

    const dec = await decrypt({
        ciphertext: enc.ciphertext,
        privateKey,
        passphrase: 'test-passphrase',
    });
    if (dec.error) throw new Error(dec.error);
    if (dec.plaintext !== secret) throw new Error('decrypt mismatch');

    const rows = await decryptFields(
        {
            sourceData: [{ id: 1, account_number_pgp: enc.ciphertext }],
            decryptFields: [{ field: 'account_number_pgp', outputAs: 'account_number' }],
            privateKey,
            passphrase: 'test-passphrase',
        },
        'pgdRows',
        []
    );
    if (rows[0].account_number !== secret) throw new Error('decryptFields mismatch');

    const fp = await fingerprint({ publicKey });
    if (fp.error) throw new Error(fp.error);

    console.log('PGD smoke test OK');
    console.log('  fingerprint:', fp.fingerprint);
    console.log('  ciphertext length:', enc.ciphertext.length);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
