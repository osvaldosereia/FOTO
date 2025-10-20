// parser.js — versão estável funcional

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    text += pageText + '\n';
  }
  return text;
}

function processText(raw) {
  // Normaliza o texto
  raw = raw.replace(/\s{2,}/g, ' ').replace(/\n+/g, '\n').trim();

  // Divide em blocos por marcador de questão (ex: Q12345)
  const blocos = raw.split(/\bQ\d{3,}\b/).slice(1);
  if (!blocos.length) return 'Nenhuma questão encontrada.';

  let saida = [];

  blocos.slice(0, 20).forEach((bloco, i) => {
    const ano = (bloco.match(/Ano:\s*(\d{4})/) || [, '----'])[1];
    const banca = (bloco.match(/Banca:\s*([^\n]+)/) || [, '---'])[1].trim();
    const orgao = (bloco.match(/Órgão:\s*([^\n]+)/) || [, '---'])[1].trim();

    // Enunciado (antes da primeira alternativa)
    const enunciado = bloco.split(/\bA\s/)[0].trim();

    // Alternativas
    let alternativas = '';
    const opcoes = [...bloco.matchAll(/\b([A-E])\s+([^A-E]+?)(?=\b[A-E]\s|$)/g)];
    if (opcoes.length > 0) {
      alternativas = opcoes
        .map(a => `** ${a[1]}) ${a[2].trim()}`)
        .join('\n');
    } else {
      // Caso de Certo/Errado
      const vf = [...bloco.matchAll(/(Certo|Errado)/gi)];
      alternativas = vf.map((a, j) => `** ${j === 0 ? 'A' : 'B'}) ${a[0]}`).join('\n');
    }

    // Gabarito (pego da linha “Gabarito:” ou da parte final)
    const gabarito = (bloco.match(/Gabarito:\s*([A-E])/i) || raw.match(new RegExp(`\\b${i + 1}\\s*[:\\-]?\\s*([A-E])\\b`, 'i')) || [, '?'])[1];

    // Palavras-chave (duas palavras relevantes)
    const palavras = [...new Set(enunciado.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zçéíóúãõâêô]+\b/g) || [])]
      .filter(p => !['Direito', 'Penal', 'Lei', 'Código', 'Crime'].includes(p));
    const chaves = palavras.slice(0, 2).join(', ') || 'Tema';

    // Modelo final
    saida.push(
`-----
***** Ano: ${ano} | Banca: ${banca} | Órgão: ${orgao}

* ${enunciado}

${alternativas}

*** Gabarito: ${gabarito}

**** ${chaves}`
    );
  });

  return saida.join('\n\n');
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
