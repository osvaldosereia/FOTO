// parser.js

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

function processText(raw) {
  const matches = raw.match(/Ano:\s*\d{4}.+?(?=Ano:|$)/gs) || [];
  let output = [];

  matches.slice(0, 20).forEach((b, idx) => {
    const ano = (b.match(/Ano:\s*(\d{4})/) || [, '----'])[1];
    const banca = (b.match(/Banca:\s*([^\n]+)/) || [, '---'])[1];
    const orgao = (b.match(/Órgão:\s*([^\n]+)/) || [, '---'])[1];
    const gabarito = (raw.match(new RegExp(`${201 + idx}:\\s*([A-E])`, 'i')) || [, '?'])[1];
    const alternativas = [...b.matchAll(/[A-E]\s*(.+?)(?=[A-E]\s|$)/gs)]
      .map(m => `** ${m[0].trim().replace(/\s+/g, ' ')}`)
      .join('\n');

    const enunciado = b.split(/A\s/)[0].trim();
    const palavras = [...new Set((enunciado.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zçéíóúãõâêô]+\b/g) || []))];
    const chaves = palavras.slice(0, 2).join(', ');

    output.push(
`-----
***** Ano: ${ano} | Banca: ${banca} | Órgão: ${orgao}

* ${enunciado}

${alternativas}

*** Gabarito: ${gabarito}

**** ${chaves}
`
    );
  });

  return output.join('\n');
}

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
