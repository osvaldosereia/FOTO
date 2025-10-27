/**
 * ESTE É O SEU BANCO DE DADOS DE DISCIPLINAS E TEMAS.
 * * Edite este arquivo para adicionar/remover disciplinas ou temas.
 * * IMPORTANTE:
 * 1. A "chave" (ex: "direito-penal") deve ser o nome exato da pasta em /data/.
 * 2. O "nome" (ex: "Direito Penal") é o texto que aparece no menu.
 * 3. O "provas" (ex: 10) é o NÚMERO TOTAL de arquivos .json que existem 
 * dentro da pasta daquele tema (ex: p1.json, p2.json ... p10.json).
 */
const dbDisciplinas = {
    "direito-penal": {
        nome: "Direito Penal",
        temas: {
            // Formato: "chave-pasta": { nome: "Nome Exibido", provas: (número de arquivos json) }
            "conceitos": { nome: "Conceitos e Características", provas: 4 },
             "norma-penal": { nome: "Norma Penal", provas: 6 },
            "poder-punitivo-estatal": { nome: "Poder Punitivo Estatal", provas: 10 },
            "conflito-aparente": { nome: "Conflito Aparente de Normas", provas: 3 },
            "lei-penal-no-espaco": { nome: "Lei Penal no Espaço", provas: 10 },
            "lei-penal-no-tempo": { nome: "Lei Penal no Tempo", provas: 10 },
            "sistemas-penais": { nome: "Sistemas Penais", provas: 1 },
            "conceito-de-crime": { nome: "Conceito de Crime", provas: 8 },
            "teoria-geral-do-delito": { nome: "Teoria Geral do Delito", provas: 10 }
            
        }
    },
    "direito-civil": {
        nome: "Direito Civil",
        temas: {
            "contratos": { nome: "Contratos", provas: 10 },
            "obrigacoes": { nome: "Obrigações", provas: 10 },
            "posse": { nome: "Posse e Propriedade", provas: 10 }
        }
    },
    "portugues": {
        nome: "Português",
        temas: {
            "concordancia": { nome: "Concordância", provas: 10 },
            "crase": { nome: "Crase", provas: 10 }
        }
    }
};

