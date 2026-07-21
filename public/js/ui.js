(function exposeUi(root) {
    function setBusy(button, busy, busyLabel, idleLabel) {
        if (!button) return;
        button.disabled = busy;
        button.setAttribute('aria-busy', String(busy));
        button.textContent = busy ? busyLabel : idleLabel;
    }

    function showStatus(container, message, type = 'info') {
        if (!container) return;
        const status = document.createElement('div');
        status.className = `api-message ${type}`;
        status.setAttribute('role', type === 'error' ? 'alert' : 'status');
        status.textContent = message;
        container.replaceChildren(status);
    }

    function showLoading(container, message = 'Carregando...') {
        if (!container) return;
        const card = document.createElement('div');
        card.className = 'card loading';
        const spinner = document.createElement('span');
        spinner.className = 'loading-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        const text = document.createElement('p');
        text.className = 'loading-text';
        text.textContent = message;
        card.append(spinner, text);
        container.style.display = 'block';
        container.replaceChildren(card);
    }

    root.AppUi = {
        setBusy,
        showStatus,
        showLoading,
    };
}(window));
