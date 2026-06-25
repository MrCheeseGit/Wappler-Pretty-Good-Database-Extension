/**
 * Repair armored OpenPGP text mangled by Wappler Environment copy (missing BEGIN, collapsed newlines).
 * @param {unknown} input
 * @returns {string}
 */
export function normalizeArmoredPgp(input) {
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

    for (const { begin, end } of pairs) {
        if (s.includes(end) && !s.includes(begin)) {
            let body = s;
            const endIdx = body.lastIndexOf(end);
            if (endIdx !== -1) body = body.slice(0, endIdx).trim();
            s = `${begin}\n\n${body}\n${end}`;
            break;
        }
    }

    for (const { begin, end } of pairs) {
        if (!s.includes(begin)) continue;
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

/**
 * @param {string} s
 * @param {string} begin
 * @param {string} end
 * @returns {string}
 */
function reflowArmoredBlock(s, begin, end) {
    const start = s.indexOf(begin) + begin.length;
    const endIdx = s.indexOf(end);
    if (endIdx === -1) return s;

    let inner = s.slice(start, endIdx).trim();
    const rawLines = inner
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('-----'));

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

    return `${begin}\n\n${lines.join('\n')}\n${end}`;
}
