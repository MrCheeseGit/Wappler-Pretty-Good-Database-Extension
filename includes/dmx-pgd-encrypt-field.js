/* PGD Encrypt Field — browser encrypt to armored hidden input */
(function () {
    'use strict';

    const S = window.PGDShared;

    function closestForm(node) {
        if (!node) return null;
        if (node.closest) return node.closest('form');
        let p = node.parentElement;
        while (p) {
            if (p.tagName === 'FORM') return p;
            p = p.parentElement;
        }
        return null;
    }

    dmx.Component('pgd-encrypt-field', {
        attributes: {
            fieldName: { type: String, default: '' },
            publicKeyUrl: { type: String, default: '' },
            publicKey: { type: String, default: '' },
            inputLabel: { type: String, default: 'Secret value' },
            placeholder: { type: String, default: '' },
            inputType: { type: String, default: 'password' },
            designLabel: { type: String, default: 'PGD encrypt field' },
            encryptOnBlur: { type: Boolean, default: true },
        },

        init(node) {
            this._node = node;
            this._publicKeyCache = '';
            this._encrypting = false;
            this._onFormSubmit = (e) => this._handleFormSubmit(e);
            this._render();
        },

        performUpdate() {
            this._render();
        },

        destroy() {
            const form = closestForm(this._node);
            if (form && this._onFormSubmit) {
                form.removeEventListener('submit', this._onFormSubmit, true);
            }
        },

        _fieldName() {
            const node = this._node;
            return S.propString(this.props.fieldName, 'secret_pgp_' + (node && node.id ? node.id : 'pgd'));
        },

        _ensureArmoredField(node, fieldName) {
            let hidden =
                node.querySelector('input.pgd-armored-field') ||
                node.querySelector('input[type="hidden"][name="' + fieldName + '"]');
            if (!hidden) {
                hidden = document.createElement('input');
                hidden.type = 'hidden';
                hidden.className = 'pgd-armored-field';
                hidden.value = '';
                node.appendChild(hidden);
            }
            hidden.name = fieldName;
            hidden.id = fieldName + '_armored';
            hidden.classList.add('pgd-armored-field');
            return hidden;
        },

        _ensurePlainUi(node, inputType) {
            let ui = node.querySelector('.pgd-encrypt-ui');
            if (!ui) {
                ui = document.createElement('div');
                ui.className = 'pgd-encrypt-ui';
                ui.innerHTML =
                    '<label class="pgd-encrypt-label"></label>' +
                    '<input type="' +
                    inputType +
                    '" class="pgd-plain-input form-control" autocomplete="off">';
                const hidden = node.querySelector('input.pgd-armored-field');
                if (hidden) node.insertBefore(ui, hidden);
                else node.appendChild(ui);
            }
            return ui;
        },

        _showDesignPlaceholder(node, fieldName, designLabel) {
            let ph = node.querySelector('.' + S.PLACEHOLDER_CLASS);
            if (!ph) {
                ph = document.createElement('div');
                ph.className = S.PLACEHOLDER_CLASS;
                node.insertBefore(ph, node.firstChild);
            }
            ph.innerHTML =
                '<strong>' +
                designLabel +
                '</strong><br><span class="pgd-design-hint">POST field <code>' +
                fieldName +
                '</code> (armored ciphertext). Hidden input stays in the form for Server Connect <strong>Import From Form</strong>.</span>';

            const ui = node.querySelector('.pgd-encrypt-ui');
            if (ui) ui.hidden = true;
        },

        _hideDesignPlaceholder(node) {
            const ph = node.querySelector('.' + S.PLACEHOLDER_CLASS);
            if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
            const ui = node.querySelector('.pgd-encrypt-ui');
            if (ui) ui.hidden = false;
        },

        _render() {
            const node = this._node;
            if (!node || !S) return;

            const fieldName = this._fieldName();
            const label = S.propString(this.props.inputLabel, 'Secret value');
            const placeholder = S.propString(this.props.placeholder, '');
            const designLabel = S.propString(this.props.designLabel, 'PGD encrypt field');
            const inputType = S.propString(this.props.inputType, 'password') === 'text' ? 'text' : 'password';

            this._ensureArmoredField(node, fieldName);

            if (S.isDesignView()) {
                this._showDesignPlaceholder(node, fieldName, designLabel);
                return;
            }

            this._hideDesignPlaceholder(node);

            const ui = this._ensurePlainUi(node, inputType);
            const labelEl = ui.querySelector('.pgd-encrypt-label');
            const plain = ui.querySelector('.pgd-plain-input');
            if (labelEl) labelEl.textContent = label;
            if (plain) {
                plain.placeholder = placeholder;
                plain.type = inputType;
            }

            const form = closestForm(node);
            if (form) {
                form.removeEventListener('submit', this._onFormSubmit, true);
                form.addEventListener('submit', this._onFormSubmit, true);
            }

            if (this.props.encryptOnBlur !== false && plain && !plain.getAttribute('data-pgd-blur')) {
                plain.setAttribute('data-pgd-blur', '1');
                plain.addEventListener('blur', () => this.encryptNow());
            }
        },

        async _resolvePublicKey() {
            const staticKey = S.normalizeArmoredPgp(S.propString(this.props.publicKey, ''));
            if (staticKey) return staticKey;
            if (this._publicKeyCache) return this._publicKeyCache;

            const url = S.propString(this.props.publicKeyUrl, '');
            if (!url) {
                throw new Error('PGD: set public-key-url or public-key on PGD Encrypt Field');
            }
            this._publicKeyCache = await S.fetchPublicKey(url);
            return this._publicKeyCache;
        },

        async encryptNow() {
            const node = this._node;
            if (!node || S.isDesignView()) return;

            const plain = node.querySelector('.pgd-plain-input');
            const hidden = node.querySelector('input.pgd-armored-field');
            if (!plain || !hidden) return;

            const text = plain.value;
            if (!text) {
                hidden.value = '';
                return;
            }

            if (this._encrypting) return;
            this._encrypting = true;

            try {
                await S.loadPGDBundle();
                const pub = await this._resolvePublicKey();
                const armored = await PGDBundle.encryptText(text, pub);
                hidden.value = armored;
                this.dispatchEvent('encrypted', null, { ciphertext: armored });
            } catch (err) {
                this.dispatchEvent('error', null, { message: err.message || String(err) });
                throw err;
            } finally {
                this._encrypting = false;
            }
        },

        async _handleFormSubmit(event) {
            const plain = this._node && this._node.querySelector('.pgd-plain-input');
            if (!plain || !plain.value) return;
            try {
                await this.encryptNow();
            } catch (err) {
                event.preventDefault();
                event.stopPropagation();
            }
        },
    });
})();
