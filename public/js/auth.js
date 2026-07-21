(function initializeAuthPage() {
    const AUTH_API = '/api/auth';

    function showMessage(text, type) {
        const message = document.getElementById('message');
        message.textContent = text;
        message.className = `message ${type}`;
        message.style.display = 'block';
    }

    function hideMessage() {
        const message = document.getElementById('message');
        message.textContent = '';
        message.style.display = 'none';
    }

    function validPassword(password) {
        return password.length >= 8 && password.length <= 72 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
    }

    function setFormLoading(button, loading, idleText) {
        AppUi.setBusy(button, loading, 'Processando...', idleText);
    }

    async function checkAuth() {
        try {
            const payload = await ApiClient.request(`${AUTH_API}/me`, { skipUnauthorized: true });
            if (payload?.user) window.location.href = '/';
        } catch (_error) {
            // A tela permanece disponível quando não há sessão.
        }
    }

    function switchTab(tabName) {
        document.querySelectorAll('.tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        document.querySelectorAll('.form-content').forEach((form) => {
            form.classList.toggle('active', form.id === `${tabName}-form`);
        });
        hideMessage();
    }

    async function handleLogin(event) {
        event.preventDefault();
        hideMessage();
        const form = event.currentTarget;
        const button = form.querySelector('.submit-btn');
        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-password').value;
        setFormLoading(button, true, 'Entrar');

        try {
            await ApiClient.request(`${AUTH_API}/login`, {
                method: 'POST',
                body: { email, senha },
            });
            window.location.href = '/';
        } catch (error) {
            showMessage(error.message || 'Não foi possível fazer login.', 'error');
            setFormLoading(button, false, 'Entrar');
        }
    }

    async function handleRegister(event) {
        event.preventDefault();
        hideMessage();
        const form = event.currentTarget;
        const button = form.querySelector('.submit-btn');
        const nome = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const senha = document.getElementById('register-password').value;
        const confirmacao = document.getElementById('register-password-confirm').value;

        if (!validPassword(senha)) {
            showMessage('A senha deve ter de 8 a 72 caracteres e conter letras e números.', 'error');
            return;
        }
        if (senha !== confirmacao) {
            showMessage('As senhas não coincidem.', 'error');
            return;
        }

        setFormLoading(button, true, 'Criar Conta');
        try {
            await ApiClient.request(`${AUTH_API}/register`, {
                method: 'POST',
                body: { nome, email, senha },
            });
            window.location.href = '/';
        } catch (error) {
            showMessage(error.message || 'Não foi possível criar a conta.', 'error');
            setFormLoading(button, false, 'Criar Conta');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        checkAuth();
        document.querySelectorAll('.tab').forEach((tab) => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });
        document.getElementById('login-form-element').addEventListener('submit', handleLogin);
        document.getElementById('register-form-element').addEventListener('submit', handleRegister);
    });
}());
