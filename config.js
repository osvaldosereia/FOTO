// --- 1. Definição do "Banco de Dados" de Disciplinas e Temas ---
        
// Esta estrutura define quais pastas o sistema irá procurar.
// A chave (ex: "direito-penal") é o nome da pasta.
// O valor (ex: "Direito Penal") é o nome exibido.
const dbDisciplinas = {
    "direito-penal": {
        nome: "Direito Penal",
        temas: {
            "calunia": "Calúnia",
            "difamacao": "Difamação",
            "homicidio": "Homicídio"
        }
    },
    "direito-civil": {
        nome: "Direito Civil",
        temas: {
            "contratos": "Contratos",
            "obrigacoes": "Obrigações",
            "posse": "Posse e Propriedade"
        }
    },
    "portugues": {
        nome: "Português",
        temas: {
            "concordancia": "Concordância",
            "crase": "Crase"
        }
    }
};
