(function exposeLessonPlanRenderer(root) {
    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    function formatDate(value) {
        if (!value) return 'Data não informada';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Data não informada';
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function sumLessonDurations(content) {
        return (content?.etapas || []).reduce(
            (total, etapa) => total + Number(etapa.duracaoMinutos || 0),
            0
        );
    }

    function extractLessonNumber(step) {
        if (Number.isInteger(step.aulaNumero)) return step.aulaNumero;
        const match = `${step.titulo || ''} ${step.descricao || ''}`.match(/aula\s+(\d{1,2})/i);
        return match ? Number(match[1]) : null;
    }

    function inferLessonLoad(plan) {
        const steps = plan.conteudo?.etapas || [];
        const lessonNumbers = [...new Set(steps.map(extractLessonNumber).filter(Boolean))];
        const total = Number(plan.duracaoMinutos || 0);
        if (lessonNumbers.length <= 1 || !total || total % lessonNumbers.length !== 0) return null;
        return {
            quantidade: lessonNumbers.length,
            duracaoPorAula: total / lessonNumbers.length,
        };
    }

    function normalizePlan(plan) {
        return {
            ...plan,
            conteudo: plan.conteudo || plan.content || {},
            tema: plan.tema || '',
            nivelEnsino: plan.nivelEnsino || plan.nivel_ensino || '',
            duracaoMinutos: plan.duracaoMinutos || plan.duracao_minutos || 0,
            codigoBNCC: plan.codigoBNCC || plan.codigo_bncc || '',
            status: plan.status || '',
            versaoAtual: plan.versaoAtual || plan.current_version || 1,
            criadoEm: plan.criadoEm || plan.created_at,
            atualizadoEm: plan.atualizadoEm || plan.updated_at,
            habilidadesBNCCUsadas: plan.habilidadesBNCCUsadas || [],
            qualidade: plan.qualidade || null,
        };
    }

    function appendList(parent, items, emptyText = 'Nenhum item informado.') {
        const list = element('ul', 'lesson-list');
        if (!Array.isArray(items) || items.length === 0) {
            list.append(element('li', null, emptyText));
        } else {
            items.forEach((item) => list.append(element('li', null, item)));
        }
        parent.append(list);
    }

    function appendSection(parent, icon, title, content, emptyText = 'Nenhum item informado.') {
        const section = element('section', 'secao');
        const header = element('button', 'secao-header acordeao-header');
        header.type = 'button';
        header.setAttribute('aria-expanded', 'true');
        header.append(
            element('span', 'secao-icon', icon),
            element('span', 'section-title', title),
            element('span', 'acordeao-seta', '▼')
        );

        const body = element('div', 'secao-content acordeao-content aberto');
        if (Array.isArray(content)) {
            appendList(body, content, emptyText);
        } else {
            body.append(element('p', null, content || 'Nenhum conteúdo informado.'));
        }

        header.addEventListener('click', () => {
            const open = header.getAttribute('aria-expanded') === 'true';
            header.setAttribute('aria-expanded', String(!open));
            body.hidden = open;
            body.classList.toggle('aberto', !open);
            header.querySelector('.acordeao-seta').textContent = open ? '▶' : '▼';
        });
        section.append(header, body);
        parent.append(section);
    }

    function appendSteps(parent, steps) {
        const list = element('div', 'steps-list');
        (steps || []).forEach((step, index) => {
            const item = element('article', 'step-item');
            item.append(
                element('h3', null, `${index + 1}. ${step.titulo}`),
                element('p', null, step.descricao),
                element('span', 'meta-tag', `${step.duracaoMinutos} min`)
            );
            if (step.momento) {
                item.append(element('p', null, `Momento: ${step.momento}`));
            }
            if (Array.isArray(step.momentos) && step.momentos.length > 0) {
                const moments = element('ol', 'lesson-list');
                step.momentos.forEach((moment) => {
                    const detail = [
                        `${moment.tipo} - ${moment.duracaoMinutos} min`,
                        moment.descricao,
                        `Professor: ${moment.acaoProfessor}`,
                        `Estudantes: ${moment.acaoEstudantes}`,
                        `Material: ${moment.material}`,
                        `Evidência: ${moment.evidenciaProduzida}`,
                    ].filter(Boolean).join(' | ');
                    moments.append(element('li', null, detail));
                });
                item.append(moments);
            }
            if (Array.isArray(step.objetivosRelacionados)) {
                item.append(element(
                    'p',
                    null,
                    `Objetivos: ${step.objetivosRelacionados.join(', ')}`
                ));
            }
            if (step.produtoDoEstudante) {
                item.append(element('p', null, `Produto: ${step.produtoDoEstudante}`));
            }
            list.append(item);
        });
        parent.append(list);
    }

    function formatObjective(objective) {
        if (!objective || typeof objective !== 'object') return objective;
        return `${objective.id}: ${objective.descricao} | Evidência: ${objective.evidencia} | Critério: ${objective.criterioSucesso}`;
    }

    function formatAssessment(assessment) {
        if (!assessment || typeof assessment !== 'object') return assessment;
        const objectives = Array.isArray(assessment.objetivosRelacionados)
            ? assessment.objetivosRelacionados.join(', ')
            : '';
        return `${assessment.instrumento} | Objetivos: ${objectives} | Critério: ${assessment.criterioSucesso}`;
    }

    function appendMeta(parent, plan) {
        const meta = element('div', 'plano-meta');
        [
            ['🎓', plan.nivelEnsino],
            ['⏱️', `${plan.duracaoMinutos} min`],
            ['📋', plan.codigoBNCC],
            ['📌', plan.status],
            ['#', `v${plan.versaoAtual}`],
            ['Qualidade', plan.qualidade?.disponivel ? `${plan.qualidade.pontuacao}/100` : ''],
            ['BNCC', plan.alinhamentoBNCC?.status === 'confirmado' ? 'confirmado' : 'não selecionado'],
        ].forEach(([icon, value]) => {
            if (value) meta.append(element('span', 'meta-tag', `${icon} ${value}`));
        });
        const lessonLoad = inferLessonLoad(plan);
        if (lessonLoad) {
            meta.append(element(
                'span',
                'meta-tag',
                `🗓️ ${lessonLoad.quantidade} aulas × ${lessonLoad.duracaoPorAula} min`
            ));
        }
        parent.append(meta);
    }

    function appendQualitySummary(parent, quality) {
        if (!quality?.disponivel) return;
        const section = element('section', 'secao quality-summary');
        const heading = element('div', 'quality-heading');
        const title = element('h2', null, 'Qualidade pedagógica');
        const score = element(
            'strong',
            quality.aprovado ? 'quality-score quality-score-pass' : 'quality-score quality-score-review',
            `${quality.pontuacao}/100`
        );
        heading.append(title, score);

        const progress = element('progress', 'quality-progress');
        progress.max = 100;
        progress.value = quality.pontuacao;
        progress.setAttribute('aria-label', `Qualidade pedagógica: ${quality.pontuacao} de 100`);

        const criteria = element('ul', 'quality-criteria');
        quality.criterios.forEach((criterion) => {
            const item = element(
                'li',
                criterion.atendido ? 'quality-criterion-pass' : 'quality-criterion-review'
            );
            item.append(
                element('span', null, criterion.titulo),
                element('strong', null, `${criterion.pontos}/${criterion.maximo}`)
            );
            if (!criterion.atendido) item.title = criterion.detalhe;
            criteria.append(item);
        });

        section.append(
            heading,
            progress,
            element(
                'p',
                'quality-status',
                quality.aprovado
                    ? `Atingiu o patamar mínimo de qualidade de ${quality.limiteAprovacao} pontos.`
                    : `Revisão recomendada: abaixo do patamar mínimo de ${quality.limiteAprovacao} pontos.`
            ),
            criteria
        );
        parent.append(section);
    }

    function mergeBnccSkills(contentSkills, tracedSkills) {
        const skillsByCode = new Map();
        (contentSkills || []).forEach((skill) => {
            skillsByCode.set(String(skill.codigo).toUpperCase(), {
                code: skill.codigo,
                description: skill.descricao,
                origin: 'informada no plano',
            });
        });
        (tracedSkills || []).forEach((skill) => {
            const code = String(skill.code).toUpperCase();
            skillsByCode.set(code, {
                code: skill.code,
                description: skill.description,
                origin: skill.relationSource === 'selected' ? 'selecionada' : 'recuperada',
            });
        });
        return [...skillsByCode.values()];
    }

    function renderLessonPlan(container, originalPlan) {
        const plan = normalizePlan(originalPlan);
        const content = plan.conteudo;
        const card = element('div', 'card');
        const heading = element('div', 'plan-heading');
        heading.append(element('h2', null, content.titulo || plan.tema));
        heading.append(element('p', null, content.resumo || ''));
        appendMeta(heading, plan);
        heading.append(element('p', 'plano-data', `Criado em: ${formatDate(plan.criadoEm)}`));
        card.append(heading);
        appendQualitySummary(card, plan.qualidade);

        const objectives = (content.objetivos || []).map(formatObjective);
        appendSection(card, '🎯', 'Objetivos', objectives);
        appendSection(card, '🧭', 'Metodologia', content.metodologia);
        appendSection(card, '🧰', 'Recursos', content.recursos);

        const stepsSection = element('section', 'secao');
        stepsSection.append(element('h2', null, 'Etapas da aula'));
        appendSteps(stepsSection, content.etapas);
        stepsSection.append(element('p', 'duration-summary', `Duração: ${sumLessonDurations(content)} de ${plan.duracaoMinutos} minutos`));
        card.append(stepsSection);

        const assessments = content.avaliacoes
            ? content.avaliacoes.map(formatAssessment)
            : content.avaliacao;
        appendSection(card, '✅', 'Avaliação', assessments);
        appendSection(card, '♿', 'Adaptações', content.adaptacoes, 'Nenhuma adaptação informada.');

        const bncc = mergeBnccSkills(content.habilidadesBNCC, plan.habilidadesBNCCUsadas)
            .map((skill) => `${skill.code}: ${skill.description} (${skill.origin})`);
        appendSection(card, '📚', 'Habilidades BNCC', bncc, 'Nenhuma habilidade informada.');

        container.style.display = 'block';
        container.replaceChildren(card);
    }

    function appendSectionWithEmpty(parent, icon, title, content, emptyText) {
        const section = element('section', 'secao');
        const header = element('h2', null, `${icon} ${title}`);
        section.append(header);
        if (Array.isArray(content) && content.length > 0) appendList(section, content);
        else section.append(element('p', null, emptyText));
        parent.append(section);
    }

    function renderPlanList(container, plans, onOpen) {
        container.replaceChildren();
        if (!plans || plans.length === 0) {
            const empty = element('div', 'empty-state');
            empty.append(element('p', null, '📭'), element('p', null, 'Você ainda não possui planos gerados.'));
            container.append(empty);
            return;
        }

        plans.forEach((originalPlan) => {
            const plan = normalizePlan(originalPlan);
            const item = element('article', 'plano-item');
            const info = element('div', 'plano-info');
            info.append(element('h3', 'plano-titulo', plan.tema));
            appendMeta(info, plan);
            info.append(element('p', 'plano-data', `Criado em: ${formatDate(plan.criadoEm)}`));
            const button = element('button', 'btn-acao btn-ver', '👁️ Ver plano');
            button.type = 'button';
            button.addEventListener('click', () => onOpen(plan.id));
            item.append(info, element('div', 'plano-acoes'));
            item.lastChild.append(button);
            container.append(item);
        });
    }

    root.LessonPlanRenderer = {
        formatDate,
        normalizePlan,
        sumLessonDurations,
        renderLessonPlan,
        renderPlanList,
        appendSectionWithEmpty,
    };
}(window));
