/**
 * pgd.js — Pretty Good Database (OpenPGP armored fields) for Wappler Server Connect (Node).
 * Mode Simple: encrypt / decrypt with keys from Wappler Environment.
 * Mode Secure (E2E): use isArmored on insert; decrypt in App Connect (Phase 2).
 */

const openpgp = require('openpgp');

const ARMORED_MESSAGE_RE = /-----BEGIN PGP MESSAGE-----[\s\S]+-----END PGP MESSAGE-----/;
const ON_ERROR_MODES = new Set(['fail', 'skip', 'clear']);

/**
 * @param {unknown} value
 * @returns {Array<Record<string, unknown>>}
 */
function parseGrid(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
        try {
            return parseGrid(JSON.parse(value));
        } catch {
            return [];
        }
    }
    if (typeof value === 'object') {
        return Object.keys(value)
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => value[k])
            .filter((row) => row && typeof row === 'object');
    }
    return [];
}

/**
 * Grid cells must not be passed through parseValue.
 * @param {unknown} value
 * @returns {Array<Record<string, unknown>>}
 */
function parseGridRaw(value) {
    return parseGrid(value);
}

/**
 * @param {unknown} input
 * @returns {string}
 */
function resolveFieldName(input) {
    const s = String(input || '').trim();
    if (!s) return '';

    const binding = s.match(/\{\{([^}]+)\}\}/);
    const path = binding ? binding[1].trim() : s;

    if (path.includes('{{')) return '';

    const pathMatch = path.match(/(?:^|[.\[])([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (pathMatch) return pathMatch[1];

    if (path.includes('.')) {
        const parts = path.split('.').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : '';
    }

    return path;
}

/**
 * @param {unknown} value
 * @returns {Array<Record<string, unknown>>}
 */
function parseSourceRows(value) {
    const grid = parseGrid(value);
    if (grid.length) return grid;
    if (Array.isArray(value)) return value;
    return [];
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function textInput(value) {
    if (value == null) return '';
    return String(value);
}

/**
 * @param {unknown} armored
 * @returns {boolean}
 */
function isArmoredPgpMessage(armored) {
    const s = textInput(armored).trim();
    if (!s) return false;
    return ARMORED_MESSAGE_RE.test(s);
}

/**
 * @param {string} encryptedField
 * @param {string} outputAs
 * @returns {string}
 */
function defaultOutputName(encryptedField, outputAs) {
    const out = String(outputAs || '').trim();
    if (out) return out;
    if (encryptedField.endsWith('_pgp')) {
        return encryptedField.slice(0, -4);
    }
    return encryptedField;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @returns {Array<{ source: string, output: string }>}
 */
function normalizeDecryptFields(rows) {
    return rows
        .map((row) => {
            const source = resolveFieldName(row.field || row.encryptedField || row.column);
            if (!source) return null;
            return {
                source,
                output: defaultOutputName(source, row.outputAs || row.outputField || row.output),
            };
        })
        .filter(Boolean);
}

/**
 * @param {string} armored
 * @returns {Promise<import('openpgp').PublicKey>}
 */
async function readPublicKey(armored) {
    const key = textInput(armored).trim();
    if (!key) {
        throw new Error('PGD: public key is empty. Set PGD_PUBLIC_KEY in Wappler Environment.');
    }
    return openpgp.readKey({ armoredKey: key });
}

/**
 * @param {string} armored
 * @param {string} passphrase
 * @returns {Promise<import('openpgp').PrivateKey>}
 */
async function readPrivateKey(armored, passphrase) {
    const key = textInput(armored).trim();
    if (!key) {
        throw new Error('PGD: private key is empty. Set PGD_PRIVATE_KEY in Wappler Environment (Mode Simple only).');
    }
    const privateKey = await openpgp.readPrivateKey({ armoredKey: key });
    const pass = textInput(passphrase);
    if (pass) {
        return openpgp.decryptKey({ privateKey, passphrase: pass });
    }
    return privateKey;
}

/**
 * @param {string} plaintext
 * @param {string} publicKeyArmored
 * @returns {Promise<{ ciphertext: string, fingerprint: string }>}
 */
async function encryptText(plaintext, publicKeyArmored) {
    const publicKey = await readPublicKey(publicKeyArmored);
    const message = await openpgp.createMessage({ text: plaintext });
    const ciphertext = await openpgp.encrypt({
        message,
        encryptionKeys: publicKey,
    });
    return {
        ciphertext: String(ciphertext),
        fingerprint: publicKey.getFingerprint(),
    };
}

/**
 * @param {string} armoredMessage
 * @param {string} privateKeyArmored
 * @param {string} passphrase
 * @returns {Promise<string>}
 */
async function decryptText(armoredMessage, privateKeyArmored, passphrase) {
    const armored = textInput(armoredMessage).trim();
    if (!armored) return '';

    const privateKey = await readPrivateKey(privateKeyArmored, passphrase);
    const message = await openpgp.readMessage({ armoredMessage: armored });
    const { data } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey,
    });
    return String(data);
}

/**
 * @param {Array<{ source: string, output: string }>} fields
 * @param {Record<string, unknown>} sampleRow
 * @returns {Array<{ name: string, type: string }>}
 */
function buildMetaFromFields(fields, sampleRow) {
    const meta = [];
    const seen = new Set();

    if (sampleRow && typeof sampleRow === 'object') {
        for (const key of Object.keys(sampleRow)) {
            if (!seen.has(key)) {
                seen.add(key);
                meta.push({ name: key, type: 'text' });
            }
        }
    }

    for (const field of fields) {
        if (!seen.has(field.output)) {
            seen.add(field.output);
            meta.push({ name: field.output, type: 'text' });
        }
    }

    return meta;
}

/**
 * @param {unknown} stepMeta
 * @param {Array<{ source: string, output: string }>} fields
 * @param {Record<string, unknown>|null} sampleRow
 */
function refreshStepMeta(stepMeta, fields, sampleRow) {
    if (!Array.isArray(stepMeta) || !sampleRow) return;
    const built = buildMetaFromFields(fields, sampleRow);
    stepMeta.length = 0;
    for (const entry of built) stepMeta.push(entry);
}

/**
 * @param {object} options
 * @returns {Promise<{ ciphertext: string, fingerprint: string, error: string }>}
 */
exports.encrypt = async function encrypt(options) {
    const plaintext = this.parseOptional(options.plaintext, '*', '');
    const publicKey = this.parseOptional(options.publicKey, '*', '');

    try {
        const result = await encryptText(textInput(plaintext), textInput(publicKey));
        return {
            ciphertext: result.ciphertext,
            fingerprint: result.fingerprint,
            error: '',
        };
    } catch (error) {
        return {
            ciphertext: '',
            fingerprint: '',
            error: error instanceof Error ? error.message : String(error),
        };
    }
};

/**
 * @param {object} options
 * @returns {Promise<{ plaintext: string, error: string }>}
 */
exports.decrypt = async function decrypt(options) {
    const ciphertext = this.parseOptional(options.ciphertext, '*', '');
    const privateKey = this.parseOptional(options.privateKey, '*', '');
    const passphrase = this.parseOptional(options.passphrase, '*', '');

    try {
        const plaintext = await decryptText(
            textInput(ciphertext),
            textInput(privateKey),
            textInput(passphrase)
        );
        return {
            plaintext,
            error: '',
        };
    } catch (error) {
        return {
            plaintext: '',
            error: error instanceof Error ? error.message : String(error),
        };
    }
};

/**
 * @param {object} options
 * @param {string} name
 * @param {unknown} stepMeta
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
exports.decryptFields = async function decryptFields(options, name, stepMeta) {
    const sourceData = this.parseOptional(options.sourceData, '*', []);
    const decryptFields = normalizeDecryptFields(parseGridRaw(options.decryptFields));
    const privateKey = this.parseOptional(options.privateKey, '*', '');
    const passphrase = this.parseOptional(options.passphrase, '*', '');
    const onError = this.parseOptional(options.onError, 'string', 'skip');

    const rows = parseSourceRows(sourceData);
    const mode = ON_ERROR_MODES.has(onError) ? onError : 'skip';

    if (!decryptFields.length) {
        return rows;
    }

    const output = [];

    for (const row of rows) {
        if (!row || typeof row !== 'object') {
            output.push(row);
            continue;
        }

        const next = { ...row };

        for (const field of decryptFields) {
            const raw = row[field.source];
            const armored = textInput(raw).trim();

            if (!armored) {
                next[field.output] = '';
                continue;
            }

            if (!isArmoredPgpMessage(armored)) {
                if (mode === 'fail') {
                    throw new Error(`PGD: "${field.source}" is not armored PGP ciphertext.`);
                }
                if (mode === 'clear') {
                    next[field.output] = '';
                } else {
                    next[field.output] = armored;
                }
                continue;
            }

            try {
                next[field.output] = await decryptText(armored, textInput(privateKey), textInput(passphrase));
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (mode === 'fail') {
                    throw new Error(`PGD: decrypt failed for "${field.source}": ${message}`);
                }
                if (mode === 'clear') {
                    next[field.output] = '';
                } else {
                    next[field.output] = armored;
                }
            }
        }

        output.push(next);
    }

    if (Array.isArray(stepMeta) && output[0]) {
        refreshStepMeta(stepMeta, decryptFields, output[0]);
    }

    return output;
};

/**
 * @param {object} options
 * @returns {{ valid: boolean, error: string }}
 */
exports.isArmored = function isArmored(options) {
    const value = this.parseOptional(options.value, '*', '');
    const armored = textInput(value).trim();

    if (!armored) {
        return { valid: false, error: 'empty' };
    }

    if (!isArmoredPgpMessage(armored)) {
        return { valid: false, error: 'not_armored_pgp_message' };
    }

    return { valid: true, error: '' };
};

/**
 * @param {object} options
 * @returns {Promise<{ fingerprint: string, keyId: string, error: string }>}
 */
exports.fingerprint = async function fingerprint(options) {
    const publicKey = this.parseOptional(options.publicKey, '*', '');

    try {
        const key = await readPublicKey(textInput(publicKey));
        return {
            fingerprint: key.getFingerprint(),
            keyId: key.getKeyID().toHex(),
            error: '',
        };
    } catch (error) {
        return {
            fingerprint: '',
            keyId: '',
            error: error instanceof Error ? error.message : String(error),
        };
    }
};

/**
 * @param {object} options
 * @returns {{ publicKey: string, error: string }}
 */
exports.publicKey = function publicKey(options) {
    const key = textInput(this.parseOptional(options.publicKey, '*', ''));
    if (!key.trim()) {
        return { publicKey: '', error: 'PGD: public key is empty. Set PGD_PUBLIC_KEY in Wappler Environment.' };
    }
    return { publicKey: key, error: '' };
};

exports._parseGrid = parseGrid;
exports._parseGridRaw = parseGridRaw;
exports._resolveFieldName = resolveFieldName;
exports._isArmoredPgpMessage = isArmoredPgpMessage;
exports._normalizeDecryptFields = normalizeDecryptFields;
