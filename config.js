/**
 * ESTE É O SEU BANCO DE DADOS DE DISCIPLINAS E TEMAS.
 * * IMPORTANTE:
 * 1. A "chave" da disciplina (ex: "direito-penal") deve ser o nome exato da pasta em /data/.
 * 2. O "nome" da disciplina (ex: "Direito Penal") é o texto que aparece no menu.
 * 3. O 'temas' é agora um ARRAY apenas com os nomes dos arquivos .json (sem a extensão .json).
 *
 * Ex: A entrada "lei-penal-no-espaco" irá carregar o arquivo:
 * /data/direito-penal/lei-penal-no-espaco.json
 * ... e será exibido no menu como "Lei Penal No Espaco".
 */
const dbDisciplinas = {
    "direito-penal": {
        nome: "Direito Penal",
        temas: [
            // Basta adicionar os nomes dos arquivos .json aqui
            "conceitos",
            "norma-penal",
            "poder-punitivo-estatal",
            "conflito-aparente",
            "lei-penal-no-espaco",
            "lei-penal-no-tempo",
            "sistemas-penais",
            "conceito-de-crime",
            "conduta",
            "teoria-geral-do-delito"
            // Agora você pode colar centenas de nomes de arquivos aqui
        ]
    },
    "direito-civil": {
        nome: "Direito Civil",
        temas: [
            "contratos",
            "obrigacoes",
            "posse"
        ]
    },
    "portugues": {
        nome: "Português",
        temas: [
            "concordancia",
            "crase"
        ]
    }
};
