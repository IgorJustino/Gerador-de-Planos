// ========================================
// CONFIGURAÇÕES
// ========================================

// URLs dinâmicas (funciona tanto local quanto em produção)
const API_URL = `${window.location.origin}/api/planos/gerar`;
// Base para outras rotas da API (listar, visualizar, deletar)
const API_BASE = `${window.location.origin}/api/planos`;

// Supabase Cloud (substitua pelos seus valores de produção)
const SUPABASE_URL = 'https://anstiasaorbnvllgnvac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuc3RpYXNhb3JibnZsbGdudmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODY5MjcsImV4cCI6MjA3NjM2MjkyN30.rBcXFZT8G924D-OSXlykClOCPKONTJeCe7V7UTz945g';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variáveis de autenticação
let authToken = null;
let userId = null;
let userEmail = null;

// ========================================
// ELEMENTOS DO DOM
// ========================================

const form = document.getElementById('formPlanoAula');
const resultado = document.getElementById('resultado');
const submitButton = form.querySelector('button[type="submit"]');
const userEmailElement = document.getElementById('userEmail');
const btnLogout = document.getElementById('btnLogout');

// ========================================
// EVENT LISTENERS
// ========================================

form.addEventListener('submit', handleSubmit);
btnLogout.addEventListener('click', handleLogout);

// ========================================
// AUTENTICAÇÃO
// ========================================

async function checkAuthentication() {
    try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.user) {
            window.location.href = 'login.html';
            return false;
        }

        userId = payload.user.id;
        userEmail = payload.user.email;
        if (userEmailElement) userEmailElement.textContent = userEmail;
        return true;
    } catch (error) {
        window.location.href = 'login.html';
        return false;
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        authToken = null;
        userId = null;
        userEmail = null;
        window.location.href = 'login.html';
    } catch (error) {
        alert('Erro ao sair. Tente novamente.');
    }
}

// ========================================
// FUNÇÃO PRINCIPAL: SUBMIT DO FORMULÁRIO
// ========================================

async function handleSubmit(e) {
    e.preventDefault();

    const dados = coletarDadosFormulario();
    
    mostrarLoading();
    desabilitarBotao();
    scrollParaResultado();

    try {
        const plano = await gerarPlanoDeAula(dados);
        mostrarPlano(plano);
    } catch (error) {
        mostrarErro(error);
    } finally {
        habilitarBotao();
    }
}

// ========================================
// FUNÇÕES DE COLETA DE DADOS
// ========================================

function coletarDadosFormulario() {
    return {
        tema: document.getElementById('tema').value.trim(),
        disciplina: document.getElementById('disciplina').value || undefined,
        nivelEnsino: document.getElementById('nivelEnsino').value,
        duracaoMinutos: parseInt(document.getElementById('duracao').value),
        codigoBNCC: document.getElementById('codigoBNCC').value.trim() || undefined,
        observacoes: document.getElementById('observacoes').value.trim() || undefined
    };
}

// ========================================
// FUNÇÕES DE API
// ========================================

async function gerarPlanoDeAula(dados) {
    try {
        // Adicionar userId aos dados
        const dadosComUsuario = {
            ...dados,
            usuarioId: userId
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(dadosComUsuario)
        });

        console.log('📡 Response Status:', response.status);
        console.log('📡 Response Headers:', response.headers);

        // Verificar se o token expirou
        if (response.status === 401) {
            alert('Sua sessão expirou. Faça login novamente.');
            window.location.href = 'login.html';
            return;
        }

        // Tentar ler o corpo da resposta como texto primeiro
        const responseText = await response.text();
        console.log('📡 Response Text:', responseText);

        // Verificar se há resposta
        if (!responseText) {
            throw new Error('Servidor retornou resposta vazia. Possível timeout ou erro no servidor.');
        }

        // Tentar fazer parse do JSON
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('❌ Erro ao fazer parse do JSON:', parseError);
            throw new Error(`Resposta do servidor inválida: ${responseText.substring(0, 200)}`);
        }

        // Verificar erro de validação
        if (response.status === 400) {
            throw new Error(result.erro || 'Dados inválidos. Verifique os campos do formulário.');
        }

        // Verificar erro do servidor
        if (response.status === 500) {
            throw new Error(
                result.erro || 'Erro no servidor ao gerar o plano. Por favor, tente novamente.'
            );
        }

        if (!response.ok) {
            throw new Error(
                result.erro || `Erro na API: ${response.status} - ${response.statusText}`
            );
        }
        
        if (!result.sucesso) {
            throw new Error(result.erro || 'Erro ao gerar plano de aula');
        }

        // A API retorna as seções diretas, não dentro de result.plano
        return {
            introducaoLudica: result.introducaoLudica,
            objetivoAprendizagem: result.objetivoAprendizagem,
            passoAPasso: result.passoAPasso,
            rubricaAvaliacao: result.rubricaAvaliacao
        };
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error(
                '❌ Não foi possível conectar à API. Verifique se o servidor está rodando em http://localhost:3000'
            );
        }
        throw error;
    }
}

// ========================================
// FUNÇÕES DE UI - LOADING
// ========================================

function mostrarLoading() {
    resultado.style.display = 'block';
    resultado.innerHTML = `
        <div class="card">
            <div class="loading">
                <div class="loading-spinner"></div>
                <p class="loading-text" id="loadingStatus">Preparando sua requisição...</p>
                <div class="loading-steps">
                    <div class="step" id="step1">✓ Validando dados</div>
                    <div class="step" id="step2">⏳ Enviando para IA...</div>
                    <div class="step" id="step3">⏳ Gerando plano de aula...</div>
                    <div class="step" id="step4">⏳ Salvando no banco de dados...</div>
                </div>
                <p class="loading-text" style="font-size: 0.9rem; opacity: 0.7; margin-top: 20px;">
                    Isso pode levar alguns segundos
                </p>
            </div>
        </div>
    `;
    
    // Animação de progresso
    setTimeout(() => updateLoadingStep(1, '✓ Dados validados'), 500);
    setTimeout(() => updateLoadingStep(2, '⏳ Conectando com Gemini AI...'), 1000);
}

function updateLoadingStep(stepNumber, message) {
    const stepElement = document.getElementById(`step${stepNumber}`);
    const statusElement = document.getElementById('loadingStatus');
    
    if (stepElement) {
        stepElement.innerHTML = message;
        stepElement.style.color = message.includes('✓') ? '#10b981' : '#3b82f6';
        stepElement.style.fontWeight = '500';
    }
    
    if (statusElement) {
        const messages = {
            1: 'Validando seus dados...',
            2: 'Enviando requisição para IA...',
            3: 'A IA está gerando seu plano personalizado...',
            4: 'Salvando no banco de dados...'
        };
        statusElement.textContent = messages[stepNumber] || 'Processando...';
    }
}

// ========================================
// FUNÇÕES DE UI - PLANO GERADO
// ========================================

function mostrarPlano(plano) {
    resultado.innerHTML = `
        <div class="card">
            <div class="secao">
                <div class="secao-header acordeao-header" onclick="toggleSecao(this)">
                    <span class="secao-icon">📘</span>
                    <h2>Introdução Lúdica</h2>
                    <span class="acordeao-seta">▼</span>
                </div>
                <div class="secao-content acordeao-content aberto">${escaparHTML(plano.introducaoLudica)}</div>
            </div>
            
            <div class="secao">
                <div class="secao-header acordeao-header" onclick="toggleSecao(this)">
                    <span class="secao-icon">🎯</span>
                    <h2>Objetivo de Aprendizagem</h2>
                    <span class="acordeao-seta">▼</span>
                </div>
                <div class="secao-content acordeao-content aberto">${escaparHTML(plano.objetivoAprendizagem)}</div>
            </div>
            
            <div class="secao">
                <div class="secao-header acordeao-header" onclick="toggleSecao(this)">
                    <span class="secao-icon">🧩</span>
                    <h2>Passo a Passo da Atividade</h2>
                    <span class="acordeao-seta">▼</span>
                </div>
                <div class="secao-content acordeao-content aberto">${escaparHTML(plano.passoAPasso)}</div>
            </div>
            
            <div class="secao">
                <div class="secao-header acordeao-header" onclick="toggleSecao(this)">
                    <span class="secao-icon">✅</span>
                    <h2>Rubrica de Avaliação</h2>
                    <span class="acordeao-seta">▼</span>
                </div>
                <div class="secao-content acordeao-content aberto">${escaparHTML(plano.rubricaAvaliacao)}</div>
            </div>

            <button type="button" class="btn btn-secondary" onclick="gerarNovoPlano()">
                🔄 Gerar Novo Plano
            </button>
        </div>
    `;
}

// ========================================
// FUNÇÃO DE ACORDEÃO
// ========================================

function toggleSecao(header) {
    const content = header.nextElementSibling;
    const seta = header.querySelector('.acordeao-seta');
    
    if (content.classList.contains('aberto')) {
        content.classList.remove('aberto');
        seta.textContent = '▶';
    } else {
        content.classList.add('aberto');
        seta.textContent = '▼';
    }
}

// ========================================
// FUNÇÕES DE UI - ERRO
// ========================================

function mostrarErro(error) {
    resultado.innerHTML = `
        <div class="card">
            <div class="error">
                <strong>❌ Erro ao gerar plano de aula</strong>
                <p>${escaparHTML(error.message)}</p>
            </div>
            <button type="button" class="btn btn-secondary" onclick="gerarNovoPlano()">
                🔄 Tentar Novamente
            </button>
        </div>
    `;
    
    console.error('Erro ao gerar plano:', error);
}

// ========================================
// FUNÇÕES DE CONTROLE DE BOTÃO
// ========================================

function desabilitarBotao() {
    submitButton.disabled = true;
    submitButton.textContent = 'Gerando...';
}

function habilitarBotao() {
    submitButton.disabled = false;
    submitButton.textContent = 'Gerar Plano de Aula';
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function scrollParaResultado() {
    setTimeout(() => {
        resultado.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
        });
    }, 100);
}

function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function gerarNovoPlano() {
    resultado.style.display = 'none';
    resultado.innerHTML = '';
    window.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
    });
}

// ========================================
// VALIDAÇÕES ADICIONAIS
// ========================================

// Validação em tempo real da duração
document.getElementById('duracao').addEventListener('input', (e) => {
    const valor = parseInt(e.target.value);
    if (valor < 10) {
        e.target.setCustomValidity('A duração mínima é de 10 minutos');
    } else if (valor > 300) {
        e.target.setCustomValidity('A duração máxima é de 300 minutos (5 horas)');
    } else {
        e.target.setCustomValidity('');
    }
});

// Formatação e validação automática do código BNCC
document.getElementById('codigoBNCC').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
});

document.getElementById('codigoBNCC').addEventListener('blur', (e) => {
    const valor = e.target.value.trim();
    
    if (valor && !/^[A-Z]{2}\d{2}[A-Z]{2}\d{2}$/.test(valor)) {
        e.target.setCustomValidity('Código BNCC inválido. Formato: EF05MA01 (2 letras + 2 números + 2 letras + 2 números)');
        e.target.reportValidity();
    } else {
        e.target.setCustomValidity('');
    }
});

// ========================================
// PLANOS ANTERIORES
// ========================================

async function togglePlanosAnteriores() {
    const planosDiv = document.getElementById('planosAnteriores');
    const btn = document.getElementById('btnMostrarPlanos');
    
    if (planosDiv.style.display === 'none') {
        planosDiv.style.display = 'block';
        btn.textContent = '🔼 Ocultar Planos Anteriores';
        await carregarPlanosAnteriores();
    } else {
        planosDiv.style.display = 'none';
        btn.textContent = '📚 Ver Meus Planos Anteriores';
    }
}

async function carregarPlanosAnteriores() {
    const listaDiv = document.getElementById('listaPlanos');
    listaDiv.innerHTML = '<p style="text-align: center; color: #718096;">Carregando seus planos...</p>';
    
    try {
        const response = await fetch(`${API_BASE}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar planos');
        }

        const result = await response.json();
        
        if (!result.sucesso || !result.planos || result.planos.length === 0) {
            listaDiv.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="font-size: 3rem;">📭</p>
                    <p style="color: #718096; margin-top: 10px;">Você ainda não tem planos salvos.</p>
                    <p style="color: #a0aec0; font-size: 0.9rem;">Gere seu primeiro plano usando o formulário acima!</p>
                </div>
            `;
            return;
        }

        // Renderizar lista de planos
        listaDiv.innerHTML = result.planos.map(plano => `
            <div class="plano-item" onclick="visualizarPlano(${plano.id})">
                <div class="plano-info">
                    <h3 class="plano-titulo">${escaparHTML(plano.tema)}</h3>
                    <div class="plano-meta">
                        ${plano.disciplina ? `<span class="meta-tag">📖 ${escaparHTML(plano.disciplina)}</span>` : ''}
                        <span class="meta-tag">🎓 ${escaparHTML(plano.nivel_ensino)}</span>
                        <span class="meta-tag">⏱️ ${plano.duracao_minutos} min</span>
                        ${plano.codigo_bncc ? `<span class="meta-tag">📋 ${escaparHTML(plano.codigo_bncc)}</span>` : ''}
                    </div>
                    <p class="plano-data">Criado em: ${formatarData(plano.created_at)}</p>
                </div>
                <div class="plano-acoes">
                    <button class="btn-acao btn-ver" onclick="event.stopPropagation(); visualizarPlano(${plano.id})">
                        👁️ Ver
                    </button>
                    <button class="btn-acao btn-deletar" onclick="event.stopPropagation(); confirmarDeletar(${plano.id}, '${escaparHTML(plano.tema)}')">
                        🗑️ Deletar
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Erro ao carregar planos:', error);
        listaDiv.innerHTML = `
            <div class="error">
                <strong>❌ Erro ao carregar planos</strong>
                <p>${escaparHTML(error.message)}</p>
            </div>
        `;
    }
}

async function visualizarPlano(planoId) {
    try {
        const response = await fetch(`${API_BASE}/${planoId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Plano não encontrado');
        }

        const result = await response.json();
        
        if (!result.sucesso || !result.plano) {
            throw new Error('Plano não encontrado');
        }

        const plano = result.plano;

        // Mostrar o plano no resultado
        resultado.style.display = 'block';
        resultado.innerHTML = `
            <div class="card">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h2 style="margin: 0 0 10px 0; color: white;">${escaparHTML(plano.tema)}</h2>
                    <div class="plano-meta" style="gap: 10px;">
                        ${plano.disciplina ? `<span class="meta-tag" style="background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3);">📖 ${escaparHTML(plano.disciplina)}</span>` : ''}
                        <span class="meta-tag" style="background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3);">🎓 ${escaparHTML(plano.nivel_ensino)}</span>
                        <span class="meta-tag" style="background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3);">⏱️ ${plano.duracao_minutos} min</span>
                        ${plano.codigo_bncc ? `<span class="meta-tag" style="background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3);">📋 ${escaparHTML(plano.codigo_bncc)}</span>` : ''}
                    </div>
                    <p style="margin: 10px 0 0 0; font-size: 0.9rem; opacity: 0.9;">Criado em: ${formatarData(plano.created_at)}</p>
                </div>

                <div class="secao">
                    <div class="secao-header acordeao-header" onclick="toggleSecao(this)">
                        <span class="secao-icon">📘</span>
                        <h2>Introdução Lúdica</h2>
                        <span class="acordeao-seta">▼</span>
                    </div>
                    <div class="secao-content acordeao-content aberto">${escaparHTML(plano.introducao_ludica)}</div>
                </div>
                
                <div class="secao">
                    <div class="secao-header acordeao-header" onclick="toggleSecao(this)">
                        <span class="secao-icon">🎯</span>
                        <h2>Objetivo de Aprendizagem</h2>
                        <span class="acordeao-seta">▼</span>
                    </div>
                    <div class="secao-content acordeao-content aberto">${escaparHTML(plano.objetivo_aprendizagem)}</div>
                </div>
                
                <div class="secao">
                    <div class="secao-header acordeao-header" onclick="toggleSecao(this)">
                        <span class="secao-icon">🧩</span>
                        <h2>Passo a Passo da Atividade</h2>
                        <span class="acordeao-seta">▼</span>
                    </div>
                    <div class="secao-content acordeao-content aberto">${escaparHTML(plano.passo_a_passo)}</div>
                </div>
                
                <div class="secao">
                    <div class="secao-header acordeao-header" onclick="toggleSecao(this)">
                        <span class="secao-icon">✅</span>
                        <h2>Rubrica de Avaliação</h2>
                        <span class="acordeao-seta">▼</span>
                    </div>
                    <div class="secao-content acordeao-content aberto">${escaparHTML(plano.rubrica_avaliacao)}</div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="gerarNovoPlano()" style="flex: 1;">
                        🔄 Gerar Novo Plano
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="confirmarDeletar(${planoId}, '${escaparHTML(plano.tema).replace(/'/g, "\\'")}');" style="flex: 1; background: #fff5f5; color: #e53e3e; border-color: #feb2b2;">
                        🗑️ Deletar Este Plano
                    </button>
                </div>
            </div>
        `;

        // Scroll para o resultado
        scrollParaResultado();

    } catch (error) {
        console.error('Erro ao visualizar plano:', error);
        alert('Erro ao carregar o plano: ' + error.message);
    }
}

async function confirmarDeletar(planoId, temaPlano) {
    const confirmar = confirm(`Tem certeza que deseja deletar o plano "${temaPlano}"?\n\nEsta ação não pode ser desfeita.`);
    
    if (!confirmar) return;

    try {
        const response = await fetch(`${API_BASE}/${planoId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao deletar plano');
        }

        const result = await response.json();
        
        if (!result.sucesso) {
            throw new Error(result.erro || 'Erro ao deletar plano');
        }

        alert('✅ Plano deletado com sucesso!');
        
        // Recarregar lista de planos
        await carregarPlanosAnteriores();
        
        // Limpar área de resultado se estava mostrando o plano deletado
        if (resultado.style.display === 'block') {
            gerarNovoPlano();
        }

    } catch (error) {
        console.error('Erro ao deletar plano:', error);
        alert('❌ Erro ao deletar plano: ' + error.message);
    }
}

function formatarData(dataISO) {
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ========================================
// INICIALIZAÇÃO
// ========================================

// Verificar autenticação ao carregar a página
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuthentication();
    
    if (isAuthenticated) {
        console.log('📚 Gerador de Planos de Aula - Carregado com sucesso!');
        console.log('🔗 API URL:', API_URL);
        console.log('👤 Usuário:', userEmail);
    }
});
