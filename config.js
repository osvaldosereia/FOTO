/**
 * ESTE É O SEU BANCO DE DADOS DE DISCIPLINAS E TEMAS.
 * * Edite este arquivo para adicionar/remover disciplinas ou temas.
 * * IMPORTANTE:
 * 1. A "chave" (ex: "direito-penal") deve ser o nome exato da pasta em /data/.
 * 2. O "nome" (ex: "Direito Penal") é o texto que aparece no menu.
 * 3. O arquivo .json dentro da pasta deve ter o mesmo nome da "chave-pasta" do tema.
 * Ex: /data/direito-penal/conceitos.json
 */
const dbDisciplinas = {
    "direito-penal": {
        nome: "Direito Penal",
        temas: {
            // Formato: "chave-pasta": { nome: "Nome Exibido" }
            // O arquivo .json correspondente deve ser /data/direito-penal/conceitos.json
            "conceitos": { nome: "Conceitos e Características" },
            "norma-penal": { nome: "Norma Penal" },
            "poder-punitivo-estatal": { nome: "Poder Punitivo Estatal" },
            "conflito-aparente": { nome: "Conflito Aparente de Normas" },
            "lei-penal-no-espaco": { nome: "Lei Penal no Espaço" },
            "lei-penal-no-tempo": { nome: "Lei Penal no Tempo" },
            "sistemas-penais": { nome: "Sistemas Penais" },
            "conceito-de-crime": { nome: "Conceito de Crime" },
            "conduta": { nome: "Conduta: Ação e Omissão" },
            "teoria-geral-do-delito": { nome: "Teoria Geral do Delito" }
        }
    },
    "direito-civil": {
        nome: "Direito Civil",
        temas: {
            "contratos": { nome: "Contratos" },
            "obrigacoes": { nome: "Obrigações" },
            "posse": { nome: "Posse e Propriedade" }
        }
    },
    "portugues": {
        nome: "Português",
        temas: {
            "concordancia": { nome: "Concordância" },
            "crase": { nome: "Crase" }
        }
    }
};
