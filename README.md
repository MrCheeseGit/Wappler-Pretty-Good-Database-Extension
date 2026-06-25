# Pretty Good Database (PGD)


Wappler extension for **armored OpenPGP** field encryption. Store sensitive values (account numbers, notes, credentials) as `-----BEGIN PGP MESSAGE-----` text in your database.

**v0.2.0+** adds **App Connect** for **Mode Secure** (browser encrypt on save, unlock-to-decrypt on read). **v0.2.1** adds a **Lock** button on PGD Decrypt View. **v0.1.0** Server Connect steps remain available for **Mode Simple** (server encrypt/decrypt).

---

## Two modes

| | Mode Secure (recommended) | Mode Simple (convenience) |
|--|---------------------------|---------------------------|
| **Encrypt** | Browser (`dmx-pgd-encrypt-field`) | Server (**PGD Encrypt** step) |
| **Decrypt** | Browser (`dmx-pgd-decrypt-view`, unlock panel) | Server (**PGD Decrypt** / **Decrypt Fields**) |
| **Env: public key** | `PGD_PUBLIC_KEY` | `PGD_PUBLIC_KEY` |
| **Env: private key** | **Not on server** | `PGD_PRIVATE_KEY` (+ optional `PGD_PASSPHRASE`) |
| **Server sees plaintext** | No (on wired fields) | Yes (over HTTPS) |
| **Protects DB dumps** | Yes | Yes |

Do not mix modes on the same column without re-encrypting.

---

## Mode Secure (Phase 2, v0.2.0+)

The server stores armored ciphertext only. Plaintext stays in the browser.

### App Connect components

| Component | Purpose |
|-----------|---------|
| **PGD Encrypt Field** (`dmx-pgd-encrypt-field`) | User types a secret. Browser encrypts with the **public key** before POST. A hidden input sends armored ciphertext only. |
| **PGD Decrypt View** (`dmx-pgd-decrypt-view`) | Bind armored ciphertext from your API. User **unlocks** with pasted **private key** + passphrase. Plaintext stays in the browser. |

Components appear under **Mr Cheese** in the App Connect picker after install (see [Updating](#updating) below) and a full Wappler restart.

The encrypt field keeps a **static hidden** `<input name="…">` in the page HTML so Server Connect **Import From Form** picks up the armored POST field (same idea as TipWap / BeeGone). Set **Ciphertext field name** on the component to match your database column (e.g. `secret_pgp`).

### Mode Secure environment

| Variable | Required |
|----------|----------|
| `PGD_PUBLIC_KEY` | Yes. Armored public key block |
| `PGD_PRIVATE_KEY` | **No.** Unlock in the browser only. |
| `PGD_PASSPHRASE` | Entered at unlock in the browser |

### Mode Secure workflows

**Save**

```
Browser: PGD Encrypt Field → armored POST
API: PGD Is Armored (optional) → Database Insert
```

**Load**

```
API: Database Query → return ciphertext (no server decrypt step)
Page: PGD Decrypt View → unlock → show plaintext
```

**Public key for encrypt field**

Add a small GET API with **PGD Public Key** (`publicKey` = `{{$_ENV.PGD_PUBLIC_KEY}}`). Set `public-key-url` on the encrypt field (e.g. `/api/pgd/publicKey`). Or bind a static `public-key` on the component.

Unlock UX v1: **paste** the full contents of your private key **`.asc` file** plus your **key passphrase** in the inline unlock panel. Click **Lock** when done to hide plaintext and clear the remembered key for this browser tab. Session remember is **opt-in only** (`remember-session`, default off).

### Mode Secure: where to keep the private key

| Store in Wappler Environment | Store offline (recommended for unlock) |
|------------------------------|--------------------------------------|
| `PGD_PUBLIC_KEY` only | Private `.asc` file (password manager, secure vault, offline backup) |
| Never `PGD_PRIVATE_KEY` in Mode Secure | Staff paste from `.asc` when unlocking |

**Do not copy the private key from Wappler Environment** into the unlock panel. The Environment editor often **removes line breaks**, which breaks armored keys. PGD tries to repair common paste issues, but your **`.asc` export** is the reliable source.

The **key passphrase** is the one you chose when you generated the key pair (same as `PGD_PASSPHRASE` in Environment for Mode Simple). It is **not** your portal or app login password.

---

## Mode Simple (Phase 1, v0.1.0)

Server Connect encrypt and decrypt using keys in Wappler **Environment**. Protects data **at rest** (dumps, backups, casual SQL). The server sees plaintext over HTTPS on write and read.

| Step | Purpose |
|------|---------|
| **PGD Encrypt** | Plaintext to armored ciphertext |
| **PGD Decrypt** | One armored value to plaintext |
| **PGD Decrypt Fields** | After a database query; decrypt chosen columns on each row (repeats) |
| **PGD Is Armored** | Validate armored POST values before insert |
| **PGD Key Fingerprint** | Confirm `PGD_PUBLIC_KEY` in Environment |
| **PGD Public Key** | Return public key only (for Mode Secure pages) |

All steps appear under **Mr Cheese** in the Server Connect action picker.

### Mode Simple environment

| Variable | Required |
|----------|----------|
| `PGD_PUBLIC_KEY` | Yes |
| `PGD_PRIVATE_KEY` | Yes (server decrypt) |
| `PGD_PASSPHRASE` | Optional |

Bind as `{{$_ENV.PGD_PUBLIC_KEY}}`, `{{$_ENV.PGD_PRIVATE_KEY}}`, etc.

### Mode Simple workflows

**Insert (encrypt on save)**

```
POST field → PGD Encrypt (plaintext, publicKey {{$_ENV.PGD_PUBLIC_KEY}})
          → Database Insert (ciphertext column, e.g. account_number_pgp)
```

**List with repeat (decrypt after query)**

```
Database Query (SELECT)
  → PGD Decrypt Fields
       sourceData: {{accountsQuery}}
       decryptFields grid: account_number_pgp → output account_number
       privateKey: {{$_ENV.PGD_PRIVATE_KEY}}
  → Page Repeat: bind to step name (see below)
```

**App Connect repeat:** use `dmx-repeat:itemName="yourServerConnect.data.stepName"`. Use `dmx-show` until `data.stepName` exists after the Server Connect has loaded.

More flow ideas: `examples/README.md` in this repo.

---

## Installation

| Path | |
|------|--|
| **npm** | Wappler Project Settings → Extensions (`wappler-pretty-good-database`) |
| **Git** | [Extension Installer](https://www.mrcheese.co.uk/extensions/install) or manual copy below |

Git manual copy installs into `extensions/`, `lib/modules/`, and `public/`.

### Git install — Extension Installer (recommended)

This repo ships **`wappler-install.json`**. Use the **[Extension Installer](https://www.mrcheese.co.uk/extensions/install)** — select **Pretty Good Database**, choose **Both**, run the script from your Wappler project root.

### Manual install (Git)

Run from your **Wappler project root** (folder with `package.json`). Skip `git clone` if you already cloned this repo alongside your project.

**Server Connect**

```bash
git clone https://github.com/MrCheeseGit/Wappler-Pretty-Good-Database-Extension.git ../Wappler-Pretty-Good-Database-Extension

cp ../Wappler-Pretty-Good-Database-Extension/server_connect/modules/pgd.js lib/modules/pgd.js
cp ../Wappler-Pretty-Good-Database-Extension/server_connect/modules/pgd.js extensions/server_connect/modules/pgd.js
cp ../Wappler-Pretty-Good-Database-Extension/pgd_*.hjson extensions/server_connect/modules/
```

**App Connect (Mode Secure)**

```bash
cp ../Wappler-Pretty-Good-Database-Extension/app_connect/components.hjson extensions/app_connect/components/pgd_components.hjson
cp ../Wappler-Pretty-Good-Database-Extension/includes/dmx-pgd-*.js public/js/
cp ../Wappler-Pretty-Good-Database-Extension/includes/dmx-pgd-openpgp.bundle.js public/js/
cp ../Wappler-Pretty-Good-Database-Extension/includes/dmx-pgd.css public/css/
```

Or add script/link tags on your layout (see component `linkFiles` in `components.hjson`).

Wappler runs `npm install openpgp` on the first API that uses PGD steps. **Quit Wappler completely and restart** after installing.

### npm install (Wappler Project Settings)

1. **Wappler** → Project Settings → Extensions → Add → `wappler-pretty-good-database`
2. From your project root: `npm install`
3. Run **Project Updater → Update** when prompted.
4. **Quit Wappler completely** and reopen your project.

#### Local `file:` development (optional)

```json
"devDependencies": {
  "wappler-pretty-good-database": "file:../path/to/this-extension"
}
```

After you change extension source, run `npm install` again, then Project Updater if needed, and restart Wappler.

### Updating

When a new PGD version is released (check [CHANGELOG](CHANGELOG.md) on GitHub), refresh **both** the IDE property panel and runtime files:

| Step | Why |
|------|-----|
| `npm install wappler-pretty-good-database` (or `npm update`) in the project root | Wappler reads `components.hjson` from **`node_modules`**, not from `extensions/app_connect/` alone |
| Run Git manual copy per `wappler-install.json` | Refreshes `public/js`, `public/css`, and Server Connect modules for the live site |
| **Project Updater → Update** | Syncs App Connect assets after the copy script |
| **Quit Wappler completely** (tray icon too) and reopen the project | Reloads the component picker and property panel |

**Local `file:` development** (extension linked from a folder on disk):

```json
"devDependencies": {
  "wappler-pretty-good-database": "file:../path/to/Pretty-Good-Database-Extension"
}
```

After you change extension source, run **`npm install wappler-pretty-good-database`** again. If the version in `package.json` did not change, remove the cached copy first:

```bash
rm -rf node_modules/wappler-pretty-good-database
npm install wappler-pretty-good-database
```

Then run the npm install assistant copy script (or Git manual copy), Project Updater, and restart Wappler.

**Symptom:** new properties (e.g. **Show lock button**) appear in page source or `pgd_components.hjson` but **not** in the Wappler property panel → `node_modules` is still on an old version, or Wappler was not fully restarted after `npm install`.

**GitHub:** https://github.com/MrCheeseGit/Wappler-Pretty-Good-Database-Extension

---

## Creating a PGP keypair

Generate keys **outside Wappler** once per project (or per Development / Production target).

### GnuPG (Mac / Linux / Windows with Gpg4win)

```bash
gpg --full-generate-key
gpg --list-keys
gpg --armor --export you@example.com > pgd-public.asc
gpg --armor --export-secret-keys you@example.com > pgd-private.asc
```

Copy the full file contents (including `BEGIN` / `END` lines) into Environment.

- Public → `PGD_PUBLIC_KEY`
- Private → browser unlock (Mode Secure) or `PGD_PRIVATE_KEY` (Mode Simple)
- Passphrase → unlock panel or `PGD_PASSPHRASE` if your key uses one

### Kleopatra (Windows GUI)

1. Install [Gpg4win](https://www.gpg4win.org/) → Kleopatra
2. File → New OpenPGP Key Pair → set a passphrase
3. Export public key → `PGD_PUBLIC_KEY`
4. Backup secret keys → browser unlock (Mode Secure) or `PGD_PRIVATE_KEY` (Mode Simple)

### Do not

- Commit `.asc` files to git
- Put `PGD_PRIVATE_KEY` in Environment if you want Mode Secure
- Use random online key generators for production

### Verify your public key

Add **PGD Key Fingerprint** with `publicKey` = `{{$_ENV.PGD_PUBLIC_KEY}}`. Run the API once; confirm `fingerprint` is returned.

---

## Database columns (you manage the schema)

**PGD does not create or change database tables.** Add ciphertext columns yourself in **Wappler Database Manager**.

- Type: `LONGTEXT` (or `TEXT`), nullable
- Naming: `_pgp` suffix is a useful convention (e.g. `account_number_pgp`, `secret_pgp`)

Wire normal Wappler Database Query / Insert / Update steps and bind PGD output (e.g. `{{pgdEncrypt.ciphertext}}` or armored POST from the encrypt field).

---

## Security notes

| Claim | Mode Secure | Mode Simple |
|-------|-------------|-------------|
| Encrypted in the database | Yes | Yes |
| Protects DB backups / dumps | Yes | Yes |
| Server sees plaintext on write/read | No (wired fields) | Yes (over HTTPS) |
| Protects against compromised server or env | Partial (needs private key) | No |

PGD does not replace HTTPS, parameterized queries, or Wappler Security Provider. It is an optional field-level layer.

---

## Requirements

- Wappler 6.x
- Node.js Server Connect target
- Node 18+ recommended

---

## Roadmap

- **v0.2.x:** optional `.asc` file upload on unlock; session remember polish
- **Later:** per-user keys, re-encrypt migration helper

---

## Compatibility

Standalone extension. For shared patterns (Redirect-IT step order, PuSH-IT, optional pairs), see [Mr Cheese extension docs](https://github.com/MrCheeseGit/Wappler-Extension-Docs/blob/main/extension-compatibility.md).

## License

[Mr Cheese Extension License v1.0](https://www.mrcheese.co.uk/extension-license) — see [LICENSE](LICENSE). © [Mr Cheese](https://www.mrcheese.co.uk)

## Support

Wappler Community. Speak with Cheese.
