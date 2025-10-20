/* parser.js — extrator completo e arrumado para PDFs com padrão Qconcursos
   Regras implementadas:
   - Extração com pdf.js respeitando hasEOL
   - Normalização, des-hifenização, limpeza de ruídos (Prova:, URLs, "Resumo relacionado")
   - Detecção de blocos por "Ano / Banca / Órgão"
   - Enunciado, alternativas A–E ou Certo/Errado, tema (Q\d+ > Tema)
   - Gabarito global "Respostas" ou "Gabarito" no formato "n: Letra"
   - Formatação do TXT no modelo solicitado
   - Opções: remover acentos; 1 TXT por PDF ou único arquivo
*/

/* =========================
 * Utilitários de texto
 * ========================= */
const norm = (s) =>
  s
    .replace(/\u00A0/g, " ")             // NBSP → espaço
    .replace(/\r/g, "")                  // \r → ''
    .replace(/[ \t]{2,}/g, " ")          // espaços múltiplos → 1
    .trim();

const stripAccents = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Remove espaços antes de pontuação
const fixSpacingBeforePunct = (s) =>
  s.replace(/\s+([,.;:!?])/g, "$1");

// Des-hifeniza onde quebra no fim de linha
const fixHyphenation = (s) =>
  s.replace(/(\w)-\n(\w)/g, "$1$2");

// Remove ruídos: linhas "Prova:", URLs, blocos "Resumo relacionado"
function stripNoise(raw) {
  const lines = raw.split("\n");
  const out = [];
  let skippingResumo = false;

  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];

    // Início de bloco "Resumo relacionado"
    if (/^\s*Resumo\s+relacionado/i.test(L)) {
      skippingResumo = true;
      continue;
    }
    // Fim do bloco quando atingir linha em branco dupla ou separadora
    if (skippingResumo) {
      if (/^\s*$/.test(L)) {
        // aguarda mais uma em branco para sair, para ser seguro
        // (duas linhas vazias consecutivas)
        if (i + 1 < lines.length && /^\s*$/.test(lines[i + 1])) {
          i += 1;
          skippingResumo = false;
        }
      }
      continue;
    }

    // Remover linhas "Prova: ..."
    if (/^\s*Prova:\s*/i.test(L)) continue;

    // Remover URLs puras
    if (/^\s*https?:\/\/\S+\s*$/i.test(L)) continue;

    out.push(L);
  }
  return out.join("\n");
}

/* =========================
 * Extração com pdf.js
 * ========================= */
async function extractTextFromPDF(file) {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  let out = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    let line = "";
    for (const item of content.items) {
      line += item.str;
      if (item.hasEOL) {
        out.push(line);
        line = "";
      } else {
        line += " ";
      }
    }
    if (line.trim()) out.push(line);
    out.push("\n");
  }

  // Pós: normalizações globais base
  let txt = out.join("\n");
  txt = fixHyphenation(txt);
  txt = stripNoise(txt);
  // Não aplicar stripAccents aqui; só no fim se o usuário pedir
  return txt;
}

/* =========================
 * Parsing do gabarito global
 * ========================= */
function parseAnswerKey(fullText) {
  // Aceita cabeçalho "Respostas" ou "Gabarito"
  const m = fullText.match(
    /(Respostas|Gabarito)[\s\S]*?((?:\d{1,4}\s*[:\-]\s*[A-E]\s*)+)/i
  );
  if (!m) return null;

  const pairs = [...m[2].matchAll(/(\d{1,4})\s*[:\-]\s*([A-E])/gi)].map(
    (mm) => ({ n: parseInt(mm[1], 10), g: mm[2].toUpperCase() })
  );
  if (!pairs.length) return null;

  // Ordena por número e devolve só letras
  pairs.sort((a, b) => a.n - b.n);
  return pairs.map((p) => p.g);
}

/* =========================
 * Quebra em blocos por cabeçalho
 * ========================= */
function splitQuestionBlocks(fullText) {
  const regex =
    /(^\s*Ano:\s*\d{4}\s*Banca:\s*[^\n]+?\s*Órgão:\s*[^\n]+)([\s\S]*?)(?=^\s*Ano:\s*\d{4}\s*Banca:|\Z)/gmi;
  const blocks = [];
  let m;
  while ((m = regex.exec(fullText)) !== null) {
    const header = norm(m[1]);
    const body = m[2].replace(/\s+$/g, ""); // recorte cru do corpo
    blocks.push({ header, body });
  }
  return blocks;
}

/* =========================
 * Cabeçalho
 * ========================= */
function parseHeader(h) {
  const ano = (h.match(/Ano:\s*(\d{4})/i) || [, "----"])[1];
  const banca = (
    h.match(/Banca:\s*([^\|]+?)(?:Órgão:|$)/i) || [, "---"]
  )[1]
    .replace(/Banca:\s*/i, "")
    .trim();
  const orgao = (h.match(/Órgão:\s*(.+)$/i) || [, "---"])[1].trim();
  return { ano, banca, orgao };
}

/* =========================
 * Corpo: enunciado, alternativas, tema
 * ========================= */
function parseBody(rawBody) {
  // Normalizações leves por linha antes de segmentar
  let body = rawBody
    .replace(/\r/g, "")
    .replace(/[ \t]+$/gm, "")           // trim right por linha
    .replace(/\n{3,}/g, "\n\n");        // no máx. 2 quebras seguidas

  // Tema: "Q<id> > <tema>"
  const temaMatch = body.match(/\bQ\d+\s*>\s*([^\n]+)/i);
  const tema = temaMatch ? norm(temaMatch[1]) : "";

  // Alternativas A–E multilinha; evita capturar nova alternativa
  const altMatches = [...body.matchAll(
    /^[ \t]*([A-E])\s*[\)\.-]?\s+([^\n]+(?:\n(?![ \t]*[A-E]\s*[\)\.-]?\s+).+)*)/gmi
  )];

  let alternativas = [];
  if (altMatches.length >= 2) {
    alternativas = altMatches.map((m) => ({
      k: m[1].toUpperCase(),
      t: fixSpacingBeforePunct(norm(m[2]))
    }));
  } else {
    // Certo/Errado
    const hasCerto = /(^|\s)Certo(\s|$)/i.test(body);
    const hasErrado = /(^|\s)Errado(\s|$)/i.test(body);
    if (hasCerto || hasErrado) {
      alternativas = [
        { k: "A", t: "Certo" },
        { k: "B", t: "Errado" },
      ];
    }
  }

  // Enunciado: até primeira alternativa ou até primeira ocorrência de Certo/Errado
  let enunciado = body;
  if (altMatches.length) {
    enunciado = body.slice(0, altMatches[0].index).trim();
  } else {
    const iCerto = body.search(/\bCerto\b/i);
    const iErr   = body.search(/\bErrado\b/i);
    const idx = [iCerto, iErr].filter((x) => x >= 0).sort((a,b)=>a-b)[0];
    if (idx > 0) enunciado = body.slice(0, idx).trim();
  }
  enunciado = fixSpacingBeforePunct(norm(enunciado));

  // Ordena alternativas por rótulo se houver duplicadas
  if (alternativas.length) {
    const map = new Map();
    for (const a of alternativas) if (!map.has(a.k)) map.set(a.k, a);
    alternativas = [...map.values()].sort((x, y) => x.k.localeCompare(y.k));
  }

  return { enunciado, alternativas, tema };
}

/* =========================
 * Formatação final do bloco
 * ========================= */
function formatQuestion(header, body, gabaritoLetra, removeAcento) {
  const { ano, banca, orgao } = parseHeader(header);
  const { enunciado, alternativas, tema } = parseBody(body);

  const altStr = alternativas.length
    ? alternativas.map((a) => `** ${a.k}) ${a.t}`).join("\n\n")
    : `** A) Certo\n\n** B) Errado`;

  const temaFmt = tema ? tema.replace(/\s*,\s*/g, ", ") : "Tema";

  let out = `-----\n***** Ano: ${ano} | Banca: ${banca} | Órgão: ${orgao}\n\n* ${enunciado}\n\n${altStr}\n\n*** Gabarito: ${gabaritoLetra || "?"}\n\n**** ${temaFmt}\n`;
  out = removeAcento ? stripAccents(out) : out;
  return out.trim();
}

/* =========================
 * Pipeline por PDF
 * ========================= */
async function convertPdfToTxt(file, removeAcento = false) {
  const raw = await extractTextFromPDF(file);
  const answers = parseAnswerKey(raw) || [];
  const blocks = splitQuestionBlocks(raw);

  if (!blocks.length) return "Nenhuma questão encontrada.";

  const parts = [];
  let countAlt = 0;
  let countCE = 0;

  for (let i = 0; i < blocks.length; i++) {
    const g = answers[i] || "?";
    const formatted = formatQuestion(blocks[i].header, blocks[i].body, g, removeAcento);

    // contagens de diagnóstico
    const hasAE = /\n\*\*\s*[A-E]\)/.test(formatted);
    const hasCE = /\*\*\s*A\)\s*Certo/.test(formatted) && /\*\*\s*B\)\s*Errado/.test(formatted);
    if (hasAE) countAlt++;
    if (hasCE) countCE++;

    parts.push(formatted);
  }

  // Log mínimo no topo como comentário, útil para debug local (opcional)
  const banner = `/* blocos=${blocks.length} gabaritos=${answers.length} comAlternativas=${countAlt} certoErrado=${countCE} */\n`;
  return banner + parts.join("\n\n");
}

/* =========================
 * UI (opcional) — funciona com index.html fornecido
 * ========================= */
const input = document.getElementById("fileInput");
const convertBtn = document.getElementById("convertBtn");
const log = document.getElementById("log");
const downloadLink = document.getElementById("downloadLink");
const stripDiacritics = document.getElementById("stripDiacritics");
const onePerFile = document.getElementById("onePerFile");

// Arrastar e soltar
const dropzone = document.querySelector(".dropzone");
if (dropzone) {
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.style.background = "#f8fbff";
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.style.background = "";
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.style.background = "";
    input.files = e.dataTransfer.files;
  });
}

if (convertBtn) {
  convertBtn.addEventListener("click", async () => {
    const files = [...(input?.files || [])];
    if (!files.length) {
      alert("Selecione um PDF.");
      return;
    }
    log && (log.textContent = "Extraindo texto...");

    const removeAcento = !!stripDiacritics?.checked;
    const perFile = !!onePerFile?.checked;

    if (perFile && files.length > 1) {
      // um TXT por PDF
      for (const f of files) {
        log && (log.textContent = `Processando: ${f.name}`);
        const txt = await convertPdfToTxt(f, removeAcento);
        const blob = new Blob([txt], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = f.name.replace(/\.pdf$/i, ".txt");
        a.textContent = `Baixar: ${a.download}`;
        a.style.display = "block";
        document.body.appendChild(a);
      }
      log && (log.textContent = "Concluído.");
      if (downloadLink) downloadLink.style.display = "none";
      return;
    }

    // único TXT com todos
    const outputs = [];
    for (const f of files) {
      log && (log.textContent = `Processando: ${f.name}`);
      const txt = await convertPdfToTxt(f, removeAcento);
      outputs.push(txt);
    }
    const merged = outputs.join("\n\n");
    const blob = new Blob([merged], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    if (downloadLink) {
      downloadLink.href = url;
      downloadLink.download =
        files.length === 1
          ? files[0].name.replace(/\.pdf$/i, ".txt")
          : "questoes.txt";
      downloadLink.style.display = "block";
      downloadLink.textContent = "Baixar TXT";
    }
    log && (log.textContent = "Concluído.");
  });
}

// Exporta funções principais para eventuais testes
window.__parser = {
  extractTextFromPDF,
  parseAnswerKey,
  splitQuestionBlocks,
  parseHeader,
  parseBody,
  formatQuestion,
  convertPdfToTxt,
};
