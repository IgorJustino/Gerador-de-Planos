(function exposeLessonPlanEditor(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory;
    } else {
        root.LessonPlanEditor = factory(root.LessonPlanRenderer);
    }
}(typeof window !== 'undefined' ? window : globalThis, function createLessonPlanEditor(renderer) {
    const STATUS_LABELS = {
        draft: 'Rascunho',
        reviewed: 'Revisado',
        approved: 'Aprovado',
        archived: 'Arquivado',
    };

    function normalizePlan(plan) {
        if (renderer?.normalizePlan) return renderer.normalizePlan(plan);
        return {
            ...plan,
            conteudo: plan.conteudo || plan.content || {},
            tema: plan.tema || '',
            nivelEnsino: plan.nivelEnsino || plan.nivel_ensino || '',
            duracaoMinutos: plan.duracaoMinutos || plan.duracao_minutos || 0,
            codigoBNCC: plan.codigoBNCC || plan.codigo_bncc || '',
            versaoAtual: plan.versaoAtual || plan.current_version || 1,
        };
    }

    function asArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function linesToArray(value) {
        return String(value || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
    }

    function arrayToLines(value) {
        return asArray(value).join('\n');
    }

    function stepsToText(steps) {
        return asArray(steps)
            .map((step) => `${step.titulo || ''} | ${step.duracaoMinutos || 0} | ${step.descricao || ''}`)
            .join('\n');
    }

    function textToSteps(value) {
        return String(value || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const parts = line.split('|').map((part) => part.trim());
                return {
                    titulo: parts[0] || 'Etapa',
                    duracaoMinutos: Number(parts[1]),
                    descricao: parts.slice(2).join(' | ') || 'Descrição não informada.',
                };
            });
    }

    function bnccToText(skills) {
        return asArray(skills)
            .map((skill) => `${skill.codigo || ''} | ${skill.descricao || ''}`)
            .join('\n');
    }

    function textToBncc(value) {
        return String(value || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const parts = line.split('|').map((part) => part.trim());
                return {
                    codigo: parts[0] || '',
                    descricao: parts.slice(1).join(' | ') || 'Habilidade informada pelo usuário',
                };
            });
    }

    function createDraftFromPlan(plan) {
        const normalized = normalizePlan(plan);
        const content = normalized.conteudo || {};
        return {
            tema: normalized.tema || '',
            nivelEnsino: normalized.nivelEnsino || '',
            duracaoMinutos: Number(normalized.duracaoMinutos || 0),
            codigoBNCC: normalized.codigoBNCC || '',
            conteudo: {
                titulo: content.titulo || '',
                resumo: content.resumo || '',
                objetivos: arrayToLines(content.objetivos),
                metodologia: arrayToLines(content.metodologia),
                recursos: arrayToLines(content.recursos),
                etapas: stepsToText(content.etapas),
                avaliacao: arrayToLines(content.avaliacao),
                adaptacoes: arrayToLines(content.adaptacoes),
                habilidadesBNCC: bnccToText(content.habilidadesBNCC),
            },
            expectedVersion: Number(normalized.versaoAtual || 1),
        };
    }

    function contentFromDraft(draft) {
        return {
            titulo: draft.conteudo.titulo.trim(),
            resumo: draft.conteudo.resumo.trim(),
            objetivos: linesToArray(draft.conteudo.objetivos),
            metodologia: linesToArray(draft.conteudo.metodologia),
            recursos: linesToArray(draft.conteudo.recursos),
            etapas: textToSteps(draft.conteudo.etapas),
            avaliacao: linesToArray(draft.conteudo.avaliacao),
            adaptacoes: linesToArray(draft.conteudo.adaptacoes),
            habilidadesBNCC: textToBncc(draft.conteudo.habilidadesBNCC),
        };
    }

    function validateDraft(draft) {
        const errors = [];
        const content = contentFromDraft(draft);

        if (draft.tema.trim().length < 3 || draft.tema.trim().length > 200) {
            errors.push('O tema deve ter entre 3 e 200 caracteres.');
        }
        if (draft.nivelEnsino.trim().length < 2 || draft.nivelEnsino.trim().length > 100) {
            errors.push('O nível de ensino deve ter entre 2 e 100 caracteres.');
        }
        if (!Number.isInteger(Number(draft.duracaoMinutos)) || Number(draft.duracaoMinutos) < 10 || Number(draft.duracaoMinutos) > 300) {
            errors.push('A duração deve ser um número inteiro entre 10 e 300 minutos.');
        }
        if (draft.codigoBNCC && !/^[A-Za-z]{2}\d{2}[A-Za-z]{2}\d{2}$/.test(draft.codigoBNCC.trim())) {
            errors.push('Use um código BNCC no formato EF05CI01.');
        }
        if (content.titulo.length < 3 || content.titulo.length > 200) {
            errors.push('O título do plano deve ter entre 3 e 200 caracteres.');
        }
        if (content.resumo.length < 10 || content.resumo.length > 1500) {
            errors.push('O resumo deve ter entre 10 e 1.500 caracteres.');
        }
        if (content.objetivos.length < 1) errors.push('Informe ao menos um objetivo.');
        if (content.metodologia.length < 1) errors.push('Informe ao menos uma metodologia.');
        if (content.avaliacao.length < 1) errors.push('Informe ao menos uma forma de avaliação.');
        if (content.etapas.length < 1) errors.push('Informe ao menos uma etapa.');
        if (content.etapas.some((step) => !Number.isInteger(step.duracaoMinutos) || step.duracaoMinutos <= 0 || step.duracaoMinutos > 300)) {
            errors.push('Cada etapa deve usar o formato: título | duração inteira | descrição.');
        }

        return { valid: errors.length === 0, errors, content };
    }

    function buildUpdatePayload(currentPlan, draft) {
        const current = normalizePlan(currentPlan);
        const validation = validateDraft(draft);
        if (!validation.valid) return { valid: false, errors: validation.errors };

        const payload = {
            expectedVersion: Number(current.versaoAtual || draft.expectedVersion),
        };

        if (draft.tema.trim() !== current.tema) payload.tema = draft.tema.trim();
        if (draft.nivelEnsino.trim() !== current.nivelEnsino) payload.nivelEnsino = draft.nivelEnsino.trim();
        if (Number(draft.duracaoMinutos) !== Number(current.duracaoMinutos)) {
            payload.duracaoMinutos = Number(draft.duracaoMinutos);
        }

        const draftBncc = draft.codigoBNCC.trim().toUpperCase();
        const currentBncc = current.codigoBNCC || '';
        if (draftBncc !== currentBncc) {
            payload.codigoBNCC = draftBncc || null;
        }

        const currentContent = contentFromDraft(createDraftFromPlan(current));
        if (JSON.stringify(validation.content) !== JSON.stringify(currentContent)) {
            payload.conteudo = validation.content;
        }

        if (Object.keys(payload).length === 1) {
            return { valid: false, errors: ['Não há alterações para salvar.'] };
        }

        return { valid: true, payload };
    }

    return {
        STATUS_LABELS,
        createDraftFromPlan,
        contentFromDraft,
        validateDraft,
        buildUpdatePayload,
        linesToArray,
        textToSteps,
        textToBncc,
    };
}));
