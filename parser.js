// parser.js — versão robusta com parsing específico do Qconcursos

// Util: normalização e utilidades
const norm = (s) => s.replace(/\u00A0/g, ' ').replace(/[ \t]{2,}/g, ' ').replace(/\r/g, '').trim();
const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');

// 1) Extração de texto mantendo quebras de linha decentes
async function extractTextFromPDF(file) {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  let out = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    for (const item of content.items) {
      line += item.str;
      if (item.hasEOL) {
        out.push(line);
        line = '';
      } else {
        line += ' ';
      }
    }
    if (line.trim()) out.push(line);
    out.push('\n');
  }
  return out.join('\n');
}

// 2) Captura do bloco "Respostas ... 221:D 222: E ..."
function parseAnswerKey(fullText) {
  const m = fullText.match(/Respostas[\s\S]*?((?:\d{2,4}\s*:\s*[A-E]\s*)+)/i);
  if (!m) return null;
  const pairs = [...m[1].matchAll(/(\d{2,4})\s*:\s*([A-E])/g)].map(x => ({ n: parseInt(x[1],10), g: x[2].toUpperCase() }));
  if (!pairs.length) return null;
  pairs.sort((a,b)=>a.n-b.n);
  return pairs.map(p=>p.g);
}

// 3) Quebra por blocos de questões a partir de "Ano: .... Banca: .... Órgão: ..."
function splitQuestionBlocks(fullText) {
  const regex = /(Ano:\s*\d{4}\s*Banca:\s*[^\n]+?\s*Órgão:\s*[^\n]+)([\s\S]*?)(?=^\s*Ano:\s*\d{4}\s*Banca:|\Z)/gmi;
  let blocks = [];
  let m;
  while ((m = regex.exec(fullText)) !== null) {
    const header = norm(m[1]);
    const body = norm(m[2]);
    blocks.push({ header, body });
  }
  return blocks;
}

// 4) Extrai header
function parseHeader(h) {
  const ano = (h.match(/Ano:\s*(\d{4})/i) || [,'----'])[1];
  const banca = (h.match(/Banca:\s*([^\|]+?)(?:Órgão:|$)/i) || [,'---'])[1].replace(/Banca:\s*/i,'').trim();
  const orgao = (h.match(/Órgão:\s*(.+)$/i) || [,'---'])[1].trim();
  return { ano, banca, orgao };
}

// 5) Enunciado, alternativas e tema
function parseBody(body) {
  const temaMatch = body.match(/Q\d+\s*>\s*([^\n]+)/i);
  const tema = temaMatch ? temaMatch[1].trim() : '';

  const altMatches = [...body.matchAll(/^[ \t]*([A-E])\s+([^\n]+(?:\n(?![A-E]\s).+)*)/gmi)];
  let alternativas = [];
  if (altMatches.length >= 2) {
    alternativas = altMatches.map(m => ({ k: m[1].toUpperCase(), t: norm(m[2]) }));
  } else {
    const hasCerto = /(^|\s)Certo(\s|$)/i.test(body);
    const hasErrado = /(^|\s)Errado(\s|$)/i.test(body);
    if (hasCerto || hasErrado) {
      alternativas = [{k:'A', t:'Certo'}, {k:'B', t:'Errado'}];
    }
  }

  let enunciado = body;
  if (altMatches.length) {
    enunciado = body.slice(0, altMatches[0].index).trim();
  } else {
    const iC = body.search(/Certo|Errado/i);
    if (iC > 0) enunciado = body.slice(0, iC).trim();
  }

  return { enunciado: norm(enunciado), alternativas, tema };
}

// 6) Monta saída no formato solicitado
function formatQuestion(idx, header, body, gabaritoLetra, removeAcento) {
  const { ano, banca, orgao } = parseHeader(header);
  const { enunciado, alternativas, tema } = parseBody(body);

  const altStr = alternativas.length
    ? alternativas.map(a => `** ${a.k}) ${a.t}`).join('\n')
    : '** A) Certo\n\n** B) Errado';

  const temaFmt = tema ? tema.replace(/\s*,\s*/g, ', ') : 'Tema';

  let out = `-----
***** Ano: ${ano} | Banca: ${banca} | Órgão: ${orgao}

* ${enunciado}

${altStr}

*** Gabarito: ${gabaritoLetra || '?'}

**** ${temaFmt}
`;
  out = removeAcento ? stripAccents(out) : out;
  return out.trim();
}

// 7) Pipeline principal para um PDF → TXT
async function convertPdfToTxt(file, removeAcento=false) {
  const raw = await extractTextFromPDF(file);
  const answers = parseAnswerKey(raw) || [];
  const blocks = splitQuestionBlocks(raw);

  if (!blocks.length) return 'Nenhuma questão encontrada.';

  const parts = [];
  for (let i = 0; i < blocks.length; i++) {
    const g = answers[i] || '?';
    parts.push(formatQuestion(i, blocks[i].header, blocks[i].body, g, removeAcento));
  }
  return parts.join('\n\n');
}

// 8) UI
const input = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const log = document.getElementById('log');
const downloadLink = document.getElementById('downloadLink');
const stripDiacritics = document.getElementById('stripDiacritics');
const onePerFile = document.getElementById('onePerFile');

// suporte a arrastar-e-soltar
const dropzone = document.querySelector('.dropzone');
if (dropzone) {
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.background = '#f8fbff'; });
  dropzone.addEventListener('dragleave', e => { dropzone.style.background = ''; });
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.style.background = '';
    input.files = e.dataTransfer.files;
  });
}

convertBtn.addEventListener('click', async () => {
  const files = [...(input.files || [])];
  if (!files.length) { alert('Selecione um PDF.'); return; }
  log.textContent = 'Extraindo texto...';

  const removeAcento = !!stripDiacritics?.checked;
  const perFile = !!onePerFile?.checked;

  if (perFile && files.length > 1) {
    for (const f of files) {
      log.textContent = `Processando: ${f.name}`;
      const txt = await convertPdfToTxt(f, removeAcento);
      const blob = new Blob([txt], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name.replace(/\.pdf$/i, '.txt');
      a.textContent = `Baixar: ${a.download}`;
      a.style.display = 'block';
      document.body.appendChild(a);
    }
    log.textContent = 'Concluído.';
    downloadLink.style.display = 'none';
    return;
  }

  const outputs = [];
  for (const f of files) {
    log.textContent = `Processando: ${f.name}`;
    const txt = await convertPdfToTxt(f, removeAcento);
    outputs.push(txt);
  }
  const merged = outputs.join('\n\n');
  const blob = new Blob([merged], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = files.length === 1
    ? files[0].name.replace(/\.pdf$/i, '.txt')
    : 'questoes.txt';
  downloadLink.style.display = 'block';
  downloadLink.textContent = 'Baixar TXT';
  log.textContent = 'Concluído.';
});
