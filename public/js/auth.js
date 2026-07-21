const AUTH_API = '/api/auth';

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

async function parseResponse(response) {
    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch (_error) {
        return {};
    }
}

function getErrorMessage(payload, fallback) {
    return payload?.error?.message || fallback;
}

async function checkAuth() {
    try {
        const response = await fetch(`${AUTH_API}/me`, {
            credentials: 'include'
        });

        if (response.ok) {
            window.location.href = 'index.html';
        }
    } catch (_error) {
        // A tela de login continua disponível se a API estiver indisponível.
    }
}

function setupEventListeners() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    document.getElementById('login-form-element').addEventListener('submit', handleLogin);
    document.getElementById('register-form-element').addEventListener('submit', handleRegister);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');

    document.querySelectorAll('.form-content').forEach(form => form.classList.remove('active'));
    document.getElementById(`${tabName}-form`).classList.add('active');
    hideMessage();
}

function showMessage(text, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
}

function hideMessage() {
    const messageEl = document.getElementById('message');
    messageEl.style.display = 'none';
}

function setLoading(button, isLoading, originalText) {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span>Processando...';
    } else {
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    hideMessage();

    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-password').value;
    const button = event.target.querySelector('.submit-btn');
    setLoading(button, true, 'Entrar');

    try {
        const response = await fetch(`${AUTH_API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, senha })
        });
        const payload = await parseResponse(response);

        if (!response.ok) {
            throw new Error(getErrorMessage(payload, 'Credenciais inválidas'));
        }

        showMessage('Login realizado com sucesso! Redirecionando...', 'success');
        window.setTimeout(() => {
            window.location.href = 'index.html';
        }, 700);
    } catch (error) {
        showMessage(error.message || 'Não foi possível fazer login.', 'error');
        setLoading(button, false, 'Entrar');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    hideMessage();

    const nome = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const senha = document.getElementById('register-password').value;
    const confirmacao = document.getElementById('register-password-confirm').value;
    const button = event.target.querySelector('.submit-btn');

    if (senha !== confirmacao) {
        showMessage('As senhas não coincidem', 'error');
        return;
    }

    setLoading(button, true, 'Criar Conta');

    try {
        const response = await fetch(`${AUTH_API}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ nome, email, senha })
        });
        const payload = await parseResponse(response);

        if (!response.ok) {
            throw new Error(getErrorMessage(payload, 'Não foi possível criar a conta.'));
        }

        showMessage('Conta criada com sucesso! Você pode fazer login agora.', 'success');
        event.target.reset();

        window.setTimeout(() => {
            switchTab('login');
            document.getElementById('login-email').value = email;
        }, 700);
    } catch (error) {
        showMessage(error.message || 'Não foi possível criar a conta.', 'error');
    } finally {
        setLoading(button, false, 'Criar Conta');
    }
}
