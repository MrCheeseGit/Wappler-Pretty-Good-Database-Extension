import * as openpgp from 'openpgp';
import { normalizeArmoredPgp } from './normalize-armored-pgp.mjs';

export { normalizeArmoredPgp };

/**
 * @param {string} plaintext
 * @param {string} publicKeyArmored
 * @returns {Promise<string>}
 */
export async function encryptText(plaintext, publicKeyArmored) {
    const armored = normalizeArmoredPgp(publicKeyArmored);
    if (!armored) {
        throw new Error('PGD: public key is empty');
    }
    const publicKey = await openpgp.readKey({ armoredKey: armored });
    const message = await openpgp.createMessage({ text: String(plaintext) });
    return String(
        await openpgp.encrypt({
            message,
            encryptionKeys: publicKey,
        })
    );
}

/**
 * @param {string} armoredMessage
 * @param {string} privateKeyArmored
 * @param {string} passphrase
 * @returns {Promise<string>}
 */
export async function decryptText(armoredMessage, privateKeyArmored, passphrase) {
    const ciphertext = normalizeArmoredPgp(armoredMessage);
    if (!ciphertext) return '';

    const keyArmored = normalizeArmoredPgp(privateKeyArmored);
    if (!keyArmored) {
        throw new Error('PGD: private key is empty');
    }

    let privateKey = await openpgp.readPrivateKey({ armoredKey: keyArmored });
    const pass = String(passphrase || '');
    if (pass) {
        privateKey = await openpgp.decryptKey({ privateKey, passphrase: pass });
    }

    const message = await openpgp.readMessage({ armoredMessage: ciphertext });
    const { data } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey,
    });
    return String(data);
}
