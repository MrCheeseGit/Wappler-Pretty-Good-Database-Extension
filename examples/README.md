# PGD example API flows

Copy step ideas into your Wappler Server Connect APIs. Replace connection/table/column names with yours.

## Mode Secure: public key API

1. **PGD Public Key** (`pgdPublicKey`)
   - Public key: `{{$_ENV.PGD_PUBLIC_KEY}}`
2. Page: `dmx-pgd-encrypt-field` with `public-key-url="/api/pgd/publicKey"`

## Mode Secure: insert (browser encrypt)

**Page:** `dmx-pgd-encrypt-field` inside a form. The component includes a **static hidden** `<input name="…">` for Wappler **Import From Form** (same pattern as TipWap / BeeGone). Set **Ciphertext field name** to match your column (e.g. `secret_pgp`).

**API:**

1. **PGD Is Armored** (`pgdCheck`)
   - Value: `{{$_POST.account_number_pgp}}`
2. **Condition**: `{{pgdCheck.valid}}` is true
3. **Database Insert**: `account_number_pgp`: `{{$_POST.account_number_pgp}}`

No **PGD Encrypt** step on the server.

## Mode Secure: list (browser decrypt)

**API:**

1. **Database Query** (`accountsQuery`): SELECT including `account_number_pgp` (no decrypt step)

**Page:**

1. `dmx-serverconnect` loads the API
2. Repeat on `{{accountsQuery}}` or your output step name
3. `dmx-pgd-decrypt-view` with `dmx-bind:ciphertext="{{account_number_pgp}}"`

Staff unlock once per session (opt-in remember) with pasted private key + passphrase.

## Mode Simple: insert with encrypt

1. **PGD Encrypt** (`pgdEncrypt`)
   - Plaintext: `{{$_POST.account_number}}`
   - Public key: `{{$_ENV.PGD_PUBLIC_KEY}}`
2. **Database Insert**
   - `account_number_pgp`: `{{pgdEncrypt.ciphertext}}`

## Mode Simple: list with decrypt + repeat

1. **Database Query** (`accountsQuery`): SELECT including `account_number_pgp`
2. **PGD Decrypt Fields** (`pgdRows`)
   - Query results: `{{accountsQuery}}`
   - Grid: column `account_number_pgp`, output as `account_number` (or leave output blank)
   - Private key: `{{$_ENV.PGD_PRIVATE_KEY}}`
   - Passphrase: `{{$_ENV.PGD_PASSPHRASE}}` (if used)
3. Page **Repeat** on `{{pgdRows.account_number}}`

## Confirm Environment key

1. **PGD Key Fingerprint**
   - Public key: `{{$_ENV.PGD_PUBLIC_KEY}}`
2. Check `{{pgdFingerprint.fingerprint}}` in API output
