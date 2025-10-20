// parser.js (versão corrigida e aprimorada)

// Extrai texto do PDF
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

// Processa o texto e gera o modelo fiel
function processText(raw) {
  // Limpeza básica
  raw = raw.replace(/\s{2,}/g, ' ').replace(/www\.qconcursos\.com.*$/gs, '').trim();

  // Divide por identificadores de questão
  const blocos = raw.split(/\bQ\d{4,}\b/).slice(1);
  let saida = [];

  blocos.slice(0, 20).forEach((bloco, i) => {
    const ano = (bloco.match(/Ano:\s*(\d{4})/) || [, '----'])[1];
    const banca = (bloco.match(/Banca:\s*([^|]+?)(?=Órgão|$)/) || [, '---'])[1].trim();
    const orgao = (bloco.match(/Órgão:\s*([^A]+?)(?=A\s|B\s|C\s|D\s|E\s|$)/) || [, '---'])[1].trim();

    // Enunciado até antes das alternativas
    const enunciado = (bloco.split(/\sA\s| A\s/)[0] || '').trim();

    // Alternativas (A-E ou Certo/Errado)
    const alternativas = [...bloco.matchAll(/([A-E])\s+([^\n]+?)(?=[A-E]\s|$)/g)]
      .map(a => `** ${a[1]}) ${a[2].trim()}`)
      .join('\n')
      || [...bloco.matchAll(/(Certo|Errado)/gi)]
        .map((a, j) => `** ${j === 0 ? 'A' : 'B'}) ${a[0]}`)
        .join('\n');

    // Gabarito (no fim do arquivo original)
    const gabaritoMatch = raw.match(new RegExp(`\\b${i + 1}\\s*[:\\-]?\\s*([A-E])\\b`, 'i'));
    const gabarito = gabaritoMatch ? gabaritoMatch[1].toUpperCase() : '?';

    // Palavras-chave (2 mais relevantes, não genéricas)
    const palavras = [...new Set(enunciado.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zçéíóúãõâêô]+\b/g) || [])]
      .filter(p => !['Direito', 'Penal', 'Lei', 'Código', 'Crime'].includes(p));
    const chaves = palavras.slice(0, 2).join(', ') || 'Tema';

    const blocoFormatado = 
`-----
***** Ano: ${ano} | Banca: ${banca} | Órgão: ${orgao}

* ${enunciado}

${alternativas}

*** Gabarito: ${gabarito}

**** ${chaves}
`;

    saida.push(blocoFormatado);
  });

  return saida.join('\n');
}

// UI
const input = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const log = document.getElementById('log');
const downloadLink = document.getElementById('downloadLink');

convertBtn.addEventListener('click', async () => {
  const file = input.files[0];
  if (!file) return alert('Selecione um PDF primeiro.');
  log.textContent = 'Extraindo texto...';

  const rawText = await extractTextFromPDF(file);
  log.textContent = 'Processando questões...';
  const txt = processText(rawText);

  const blob = new Blob([txt], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = file.name.replace('.pdf', '.txt');
  downloadLink.style.display = 'block';
  downloadLink.textContent = 'Baixar TXT';
  log.textContent = 'Conversão concluída.';
});
