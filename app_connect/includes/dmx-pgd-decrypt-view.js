/* PGD Decrypt View — unlock with private key in the browser */
(function () {
    'use strict';

    const S = window.PGDShared;
    const SESSION_KEY = 'pgd_session_unlock_v1';

    dmx.Component('pgd-decrypt-view', {
        attributes: {
            ciphertext: { type: String, default: '' },
            maskUntilUnlock: { type: Boolean, default: true },
            rememberSession: { type: Boolean, default: false },
            showLockButton: { type: Boolean, default: true },
            unlockLabel: { type: String, default: 'Unlock to view' },
            lockLabel: { type: String, default: 'Lock' },
            maskedLabel: { type: String, default: 'Locked' },
            designLabel: { type: String, default: 'PGD decrypt view' },
        },

        init(node) {
            this._node = node;
            this._unlocked = false;
            this._plainCache = '';
            this._panelOpen = false;
            this._onSessionUnlock = () => {
                if (this._unlocked) return;
                const cipher = S.propString(this.props.ciphertext, '');
                if (cipher) this._trySessionUnlock(cipher);
            };
            this._onSessionLock = () => {
                this._lockLocal(false);
            };
            document.addEventListener('pgd-session-unlock', this._onSessionUnlock);
            document.addEventListener('pgd-session-lock', this._onSessionLock);
            this._render();
        },

        performUpdate() {
            if (this._unlocked) return;
            this._render();
        },

        destroy() {
            document.removeEventListener('pgd-session-unlock', this._onSessionUnlock);
            document.removeEventListener('pgd-session-lock', this._onSessionLock);
        },

        _render() {
            const node = this._node;
            if (!node || !S) return;

            const designLabel = S.propString(this.props.designLabel, 'PGD decrypt view');
            const maskedLabel = S.propString(this.props.maskedLabel, 'Locked');
            const unlockLabel = S.propString(this.props.unlockLabel, 'Unlock to view');
            const lockLabel = S.propString(this.props.lockLabel, 'Lock');
            const cipher = S.propString(this.props.ciphertext, '');

            if (S.isDesignView()) {
                node.innerHTML =
                    '<div class="' +
                    S.PLACEHOLDER_CLASS +
                    '"><strong>' +
                    designLabel +
                    '</strong><br><span class="pgd-design-hint">bind armored ciphertext; unlock in browser</span></div>';
                return;
            }

            if (!node.querySelector('.pgd-decrypt-root')) {
                node.innerHTML =
                    '<div class="pgd-decrypt-root">' +
                    '<div class="pgd-decrypt-wrap">' +
                    '<div class="pgd-decrypt-masked"></div>' +
                    '<div class="pgd-decrypt-plaintext" hidden></div>' +
                    '<button type="button" class="pgd-unlock-btn btn btn-outline-primary btn-sm"></button>' +
                    '<button type="button" class="pgd-lock-btn btn btn-outline-secondary btn-sm" hidden></button>' +
                    '</div>' +
                    '<div class="pgd-unlock-panel" hidden>' +
                    '<p class="pgd-unlock-help">Paste the <strong>full contents</strong> of your private key <code>.asc</code> file (keep it offline; do not rely on copying from Wappler Environment). Include <code>BEGIN</code> and <code>END</code> lines. Most keys also need the <strong>key passphrase</strong> below (the one you set when you created the key, not your site login).</p>' +
                    '<label class="pgd-unlock-label">Private key (.asc contents)</label>' +
                    '<textarea class="pgd-unlock-private form-control" rows="5" spellcheck="false" placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----"></textarea>' +
                    '<label class="pgd-unlock-label">Key passphrase <span class="pgd-unlock-required">(required if your key uses one)</span></label>' +
                    '<input type="password" class="pgd-unlock-pass form-control" autocomplete="off" placeholder="Passphrase from key creation — not your site password">' +
                    '<div class="pgd-unlock-actions">' +
                    '<button type="button" class="btn btn-primary pgd-unlock-confirm">Show secret</button>' +
                    '<button type="button" class="btn btn-link pgd-unlock-cancel">Cancel</button>' +
                    '</div>' +
                    '<p class="pgd-unlock-error text-danger" hidden></p>' +
                    '</div>' +
                    '</div>';

                const btn = node.querySelector('.pgd-unlock-btn');
                const lockBtn = node.querySelector('.pgd-lock-btn');
                const confirm = node.querySelector('.pgd-unlock-confirm');
                const cancel = node.querySelector('.pgd-unlock-cancel');
                if (btn) btn.addEventListener('click', () => this._toggleUnlockPanel(true));
                if (lockBtn) lockBtn.addEventListener('click', () => this._lockUser());
                if (confirm) confirm.addEventListener('click', () => this._confirmUnlock());
                if (cancel) cancel.addEventListener('click', () => this._toggleUnlockPanel(false));
            }

            const masked = node.querySelector('.pgd-decrypt-masked');
            const plain = node.querySelector('.pgd-decrypt-plaintext');
            const btn = node.querySelector('.pgd-unlock-btn');
            const lockBtn = node.querySelector('.pgd-lock-btn');
            const panel = node.querySelector('.pgd-unlock-panel');

            if (masked) masked.textContent = maskedLabel;
            if (btn) btn.textContent = unlockLabel;
            if (lockBtn) lockBtn.textContent = lockLabel;
            if (panel) panel.hidden = !this._panelOpen;

            if (this._unlocked && this._plainCache) {
                this._showPlaintext(this._plainCache);
                return;
            }

            if (!cipher) {
                if (masked) masked.textContent = '';
                if (plain) {
                    plain.hidden = true;
                    plain.textContent = '';
                }
                if (btn) btn.hidden = true;
                if (lockBtn) lockBtn.hidden = true;
                if (panel) panel.hidden = true;
                return;
            }

            this._showLockedState();
            this._trySessionUnlock(cipher);
        },

        _showLockedState() {
            const node = this._node;
            if (!node) return;
            const masked = node.querySelector('.pgd-decrypt-masked');
            const plain = node.querySelector('.pgd-decrypt-plaintext');
            const btn = node.querySelector('.pgd-unlock-btn');
            const lockBtn = node.querySelector('.pgd-lock-btn');
            const maskedLabel = S.propString(this.props.maskedLabel, 'Locked');

            if (masked) {
                masked.hidden = false;
                masked.textContent = maskedLabel;
            }
            if (plain) {
                plain.hidden = true;
                plain.textContent = '';
            }
            if (btn) btn.hidden = false;
            if (lockBtn) lockBtn.hidden = true;
        },

        _toggleUnlockPanel(open) {
            const node = this._node;
            if (!node) return;
            this._panelOpen = open !== false;
            const panel = node.querySelector('.pgd-unlock-panel');
            const err = node.querySelector('.pgd-unlock-error');
            if (panel) panel.hidden = !this._panelOpen;
            if (err) err.hidden = true;
            if (this._panelOpen) {
                const ta = node.querySelector('.pgd-unlock-private');
                if (ta) ta.focus();
            }
        },

        _showPlaintext(text) {
            const node = this._node;
            if (!node) return;
            const masked = node.querySelector('.pgd-decrypt-masked');
            const plain = node.querySelector('.pgd-decrypt-plaintext');
            const btn = node.querySelector('.pgd-unlock-btn');
            const lockBtn = node.querySelector('.pgd-lock-btn');
            const panel = node.querySelector('.pgd-unlock-panel');
            const showLock = this.props.showLockButton !== false;

            if (masked) masked.hidden = this.props.maskUntilUnlock !== false;
            if (plain) {
                plain.hidden = false;
                plain.textContent = text;
            }
            if (btn) btn.hidden = true;
            if (lockBtn) lockBtn.hidden = !showLock;
            if (panel) {
                panel.hidden = true;
                this._panelOpen = false;
            }
        },

        _lockUser() {
            try {
                sessionStorage.removeItem(SESSION_KEY);
            } catch (e) {
                /* ignore */
            }
            this._lockLocal(true);
            document.dispatchEvent(new CustomEvent('pgd-session-lock'));
        },

        _lockLocal(dispatchEvent) {
            const node = this._node;
            this._unlocked = false;
            this._plainCache = '';
            this._panelOpen = false;

            if (node) {
                const priv = node.querySelector('.pgd-unlock-private');
                const pass = node.querySelector('.pgd-unlock-pass');
                const err = node.querySelector('.pgd-unlock-error');
                if (priv) priv.value = '';
                if (pass) pass.value = '';
                if (err) err.hidden = true;
            }

            this._showLockedState();
            if (node) {
                const panel = node.querySelector('.pgd-unlock-panel');
                if (panel) panel.hidden = true;
            }

            if (dispatchEvent) {
                this.dispatchEvent('locked', null, {});
            }
        },

        _trySessionUnlock(cipher) {
            try {
                const raw = sessionStorage.getItem(SESSION_KEY);
                if (!raw) return;
                const saved = JSON.parse(raw);
                if (!saved || !saved.privateKey) return;
                this._decryptWithKeys(cipher, saved.privateKey, saved.passphrase || '');
            } catch (e) {
                /* ignore */
            }
        },

        async _confirmUnlock() {
            const node = this._node;
            if (!node) return;
            const priv = node.querySelector('.pgd-unlock-private');
            const pass = node.querySelector('.pgd-unlock-pass');
            const err = node.querySelector('.pgd-unlock-error');
            const cipher = S.propString(this.props.ciphertext, '');

            const privateKey = S.normalizeArmoredPgp(priv ? priv.value.trim() : '');
            const passphrase = pass ? pass.value : '';

            if (!privateKey) {
                if (err) {
                    err.hidden = false;
                    err.textContent = 'Paste your private key (.asc file contents).';
                }
                return;
            }

            try {
                await this._decryptWithKeys(cipher, privateKey, passphrase);
                if (this.props.rememberSession === true) {
                    sessionStorage.setItem(
                        SESSION_KEY,
                        JSON.stringify({ privateKey, passphrase })
                    );
                    document.dispatchEvent(new CustomEvent('pgd-session-unlock'));
                }
            } catch (e) {
                const friendly = S.friendlyArmoredError(e);
                if (err) {
                    err.hidden = false;
                    err.textContent = friendly.message || String(friendly);
                }
                this.dispatchEvent('error', null, { message: friendly.message || String(friendly) });
            }
        },

        async _decryptWithKeys(cipher, privateKey, passphrase) {
            await S.loadPGDBundle();
            const text = await PGDBundle.decryptText(cipher, privateKey, passphrase);
            this._unlocked = true;
            this._plainCache = text;
            this._showPlaintext(text);
            this.dispatchEvent('unlocked', null, { plaintext: text });
        },
    });
})();
