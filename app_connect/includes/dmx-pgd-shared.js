/* Pretty Good Database — shared browser helpers */
(function () {
    'use strict';

    const PLACEHOLDER_CLASS = 'pgd-design-placeholder';

    function isPlaceholder(value) {
        return typeof value === 'string' && value.indexOf('@@') !== -1;
    }

    function propString(value, fallback) {
        if (value == null || value === '') return fallback;
        if (isPlaceholder(value)) return fallback;
        return String(value).trim();
    }

    function isDesignView() {
        if (typeof document === 'undefined') return false;

        const body = document.body;
        const html = document.documentElement;

        if (body) {
            if (
                body.classList.contains('design-mode') ||
                body.classList.contains('wappler-design-mode')
            ) {
                return true;
            }
        }
        if (html) {
            if (
                html.classList.contains('design-mode') ||
                html.classList.contains('wappler-design-mode')
            ) {
                return true;
            }
        }

        const path = window.location.pathname || '';
        if (/\.ejs(\?|#|$)/i.test(path)) return true;

        try {
            if (window.self !== window.top) {
                const topLoc = window.top.location;
                const here = window.location;
                if (topLoc.hostname === here.hostname && topLoc.port !== here.port) {
                    return true;
                }
            }
        } catch (e) {
            if (window.self !== window.top) return true;
        }

        return false;
    }

    function bundleScriptUrl() {
        const cur =
            document.currentScript ||
            document.querySelector('script[src*="dmx-pgd-shared.js"]') ||
            document.querySelector('script[src*="dmx-pgd-encrypt-field.js"]') ||
            document.querySelector('script[src*="dmx-pgd-decrypt-view.js"]');
        if (cur && cur.src) {
            return cur.src.replace(
                /dmx-pgd-(shared|encrypt-field|decrypt-view)\.js(\?.*)?$/,
                'dmx-pgd-openpgp.bundle.js$2'
            );
        }
        return '/js/dmx-pgd-openpgp.bundle.js';
    }

    let bundleLoadPromise = null;

    function loadPGDBundle() {
        if (typeof PGDBundle !== 'undefined' && PGDBundle.encryptText) {
            return Promise.resolve();
        }
        if (bundleLoadPromise) return bundleLoadPromise;

        const src = bundleScriptUrl();
        bundleLoadPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[src*="dmx-pgd-openpgp.bundle.js"]');
            const done = () => {
                if (typeof PGDBundle !== 'undefined' && PGDBundle.encryptText) {
                    resolve();
                } else {
                    reject(new Error('PGD: bundle loaded without PGDBundle'));
                }
            };

            if (existing) {
                if (existing.getAttribute('data-pgd-loaded') === '1') {
                    done();
                    return;
                }
                existing.addEventListener('load', () => {
                    existing.setAttribute('data-pgd-loaded', '1');
                    done();
                });
                existing.addEventListener('error', () =>
                    reject(new Error('PGD: failed to load openpgp bundle'))
                );
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.defer = true;
            script.onload = () => {
                script.setAttribute('data-pgd-loaded', '1');
                done();
            };
            script.onerror = () => reject(new Error('PGD: failed to load openpgp bundle'));
            document.head.appendChild(script);
        });

        return bundleLoadPromise;
    }

    function normalizeArmoredPgp(input) {
        if (input == null) return '';
        let s = String(input).trim();
        if (!s) return '';

        if (s.indexOf('\\n') !== -1 && s.indexOf('\n') === -1) {
            s = s.replace(/\\n/g, '\n');
        }
        s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        const pairs = [
            {
                begin: '-----BEGIN PGP PRIVATE KEY BLOCK-----',
                end: '-----END PGP PRIVATE KEY BLOCK-----',
            },
            {
                begin: '-----BEGIN PGP PUBLIC KEY BLOCK-----',
                end: '-----END PGP PUBLIC KEY BLOCK-----',
            },
            {
                begin: '-----BEGIN PGP MESSAGE-----',
                end: '-----END PGP MESSAGE-----',
            },
        ];

        for (let i = 0; i < pairs.length; i++) {
            const begin = pairs[i].begin;
            const end = pairs[i].end;
            if (s.indexOf(end) !== -1 && s.indexOf(begin) === -1) {
                let body = s;
                const endIdx = body.lastIndexOf(end);
                if (endIdx !== -1) {
                    body = body.slice(0, endIdx).trim();
                }
                s = begin + '\n\n' + body + '\n' + end;
                break;
            }
        }

        for (let j = 0; j < pairs.length; j++) {
            const begin = pairs[j].begin;
            const end = pairs[j].end;
            if (s.indexOf(begin) === -1) continue;
            const start = s.indexOf(begin) + begin.length;
            const endIdx = s.indexOf(end);
            if (endIdx === -1) continue;
            let after = s.slice(start, endIdx);
            if (after.charAt(0) !== '\n') {
                s = begin + '\n\n' + after.trim() + '\n' + s.slice(endIdx);
            }
            s = reflowArmoredBlock(s, begin, end);
            break;
        }

        return s.trim();
    }

    function reflowArmoredBlock(s, begin, end) {
        const start = s.indexOf(begin) + begin.length;
        const endIdx = s.indexOf(end);
        if (endIdx === -1) return s;

        const inner = s.slice(start, endIdx).trim();
        const rawLines = inner
            .split('\n')
            .map(function (line) {
                return line.trim();
            })
            .filter(function (line) {
                return line && line.indexOf('-----') !== 0;
            });

        if (rawLines.length > 2) return s;

        let blob = inner.replace(/\s+/g, '');
        let checksum = '';
        const crc = blob.match(/(=[A-Za-z0-9+/]{4})$/);
        if (crc) {
            checksum = crc[1];
            blob = blob.slice(0, -5);
        }

        const lines = [];
        for (let i = 0; i < blob.length; i += 64) {
            lines.push(blob.slice(i, i + 64));
        }
        if (checksum) lines.push(checksum);

        return begin + '\n\n' + lines.join('\n') + '\n' + end;
    }

    function friendlyArmoredError(err) {
        const msg = err && err.message ? String(err.message) : String(err);
        if (msg.indexOf('Decryption key is not decrypted') !== -1) {
            return new Error(
                'PGD: your private key is passphrase-protected. Enter the key passphrase you chose when you created the key (not your site login password).'
            );
        }
        if (msg.indexOf('Misformed armored') !== -1 || msg.indexOf('Ascii armor') !== -1) {
            return new Error(
                'PGD: could not read the private key. Paste from your .asc file (BEGIN through END lines). Do not copy from Wappler Environment; that UI often removes line breaks.'
            );
        }
        if (msg.indexOf('Incorrect key passphrase') !== -1 || msg.indexOf('Bad decrypt') !== -1) {
            return new Error('PGD: wrong key passphrase. Use the passphrase from when you created the PGP key pair.');
        }
        return err instanceof Error ? err : new Error(msg);
    }

    async function fetchPublicKey(url) {
        const res = await fetch(url, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
            throw new Error('PGD: public key request failed (' + res.status + ')');
        }
        const data = await res.json();
        if (data && typeof data.publicKey === 'string' && data.publicKey.trim()) {
            return normalizeArmoredPgp(data.publicKey);
        }
        if (data && typeof data === 'object') {
            for (const key of Object.keys(data)) {
                const val = data[key];
                if (val && typeof val.publicKey === 'string' && val.publicKey.trim()) {
                    return normalizeArmoredPgp(val.publicKey);
                }
            }
        }
        throw new Error('PGD: public key not found in API response');
    }

    window.PGDShared = {
        PLACEHOLDER_CLASS,
        isPlaceholder,
        propString,
        isDesignView,
        loadPGDBundle,
        fetchPublicKey,
        normalizeArmoredPgp,
        friendlyArmoredError,
    };
})();
