/* parser.js — extrator robusto com limpeza de ruídos e gabarito multi-bloco
   Correções:
   - Carrega pdf.js 2.16.105 dinamicamente e configura worker automaticamente.
   - Remove ruídos: URLs, “Prova: …”, linhas “NNN Qdddddd > …”, resumos, trilhas de cargo.
   - Alternativas A–E linha-a-linha: aceita “A” sozinho na linha e junta os parágrafos até a próxima alternativa.
   - Enunciado = corpo até a primeira alternativa ou até “Certo/Errado”.
   - Gabarito: varre TODO o trecho a partir de “Respostas” e coleta todos os pares, mesmo se houver quebras.
*/

/* ========= Loader do pdf.js ========= */
let __pdfReady;
async function ensurePdfJS() {
  if (window.pdfjsLib) return;
  if (!__pdfReady) {
    __pdfReady = (async () => {
      const urls = [
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js",
        "https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.min.js",
      ];
      for (const url of urls) {
        try {
          await new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = url;
            s.crossOrigin = "anonymous";
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
          });
          if (window.pdfjsLib) {
            const workerUrl = url.replace("pdf.min.js", "pdf.worker.min.js");
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
            return true;
          }
        } catch (_) {}
      }
      throw new Error("Falha ao carregar pdf.js");
    })();
  }
  return __pdfReady;
}

/* ========= Utilitários ========= */
const norm = (s) =>
  s.replace(/\u00A0/g, " ").replace(/\r/g, "").replace(/[ \t]{2,}/g, " ").trim();
const stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const fixSpacingBeforePunct = (s) => s.replace(/\s+([,.;:!?])/g, "$1");
const fixHyphenation = (s) => s.replace(/(\w)-\n(\w)/g, "$1$2");

function stripNoise(raw) {
  const lines = raw.split("\n");
  const out = [];
  let skippingResumo = false;
  for (let i = 0; i < lines.length; i++) {
    let L = lines[i];

    // Bloco "Resumo relacionado" → até dupla linha em branco
    if (/^\s*Resumo\s+relacionado/i.test(L)) { skippingResumo = true; continue; }
    if (skippingResumo) {
      if (/^\s*$/.test(L) && i + 1 < lines.length && /^\s*$/.test(lines[i + 1])) {
        i += 1; skippingResumo = false;
      }
      continue;
    }

    // URLs puras
    if (/^\s*https?:\/\/\S+\s*$/i.test(L)) continue;

    // Linhas "NNN Qdddddd > ..."
    if (/^\s*\d{1,4}\s+Q\d+\s*>\s*/i.test(L)) continue;

    // Linhas auxiliares de "Prova:" e cargo isolado
    if (/^\s*Provas?:\s*/i.test(L)) continue;
    if (/^\s*Prova:\s*/i.test(L)) continue;
    if (/^\s*-\s*[A-Za-zÀ-ú\s]+$/.test(L)) continue;       // "- Advogado", etc.
    if (/^\s*[A-Z]{2}\s*-\s*/.test(L)) continue;           // "RS - Auxiliar ..."

    out.push(L);
  }
  return out.join("\n");
}

/* ========= Extração ========= */
async function extractTextFromPDF(file) {
  await ensurePdfJS();
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const out = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      line += item.str;
      if (item.hasEOL) { out.push(line); line = ""; }
      else { line += " "; }
    }
    if (line.trim()) out.push(line);
    out.push("\n");
  }

  let txt = out.join("\n");
  txt = fixHyphenation(txt);
  txt = stripNoise(txt);
  return txt;
}

/* ========= Gabarito ========= */
function parseAnswerKey(fullText) {
  const start = fullText.search(/Respostas/i);
  if (start < 0) return null;
  const tail = fullText.slice(start);

  const pairs = [...tail.matchAll(/(\d{1,4})\s*[:\-]\s*([A-E])/gi)]
    .map(m => ({ n: parseInt(m[1], 10), g: m[2].toUpperCase() }));

  if (!pairs.length) return null;
  pairs.sort((a,b)=>a.n-b.n);
  return pairs.map(p=>p.g);
}

/* ========= Blocos ========= */
function splitQuestionBlocks(fullText) {
  const re = /(^\s*Ano:\s*\d{4}\s*Banca:\s*[^\n]+?\s*Órgão:\s*[^\n]+)([\s\S]*?)(?=^\s*Ano:\s*\d{4}\s*Banca:|\Z)/gmi;
  const blocks = [];
  let m;
  while ((m = re.exec(fullText)) !== null) {
    const header = norm(m[1]);
    const body = m[2].replace(/\s+$/g, "");
    blocks.push({ header, body });
  }
  return blocks;
}

function parseHeader(h) {
  const ano = (h.match(/Ano:\s*(\d{4})/i) || [, "----"])[1];
  const banca = (h.match(/Banca:\s*([^\|]+?)(?:Órgão:|$)/i) || [, "---"])[1]
    .replace(/Banca:\s*/i, "").trim();
  const orgao = (h.match(/Órgão:\s*(.+)$/i) || [, "---"])[1].trim();
  return { ano, banca, orgao };
}

/* ========= Alternativas A–E por linhas ========= */
function parseAlternativesByLines(lines, startIndex) {
  const alts = [];
  let i = startIndex;

  const isAltHead = (s) => {
    const m = s.match(/^[ \t]*([A-E])\s*[\)\.-]?\s*(.*)$/i);
    if (!m) return null;
    return { k: m[1].toUpperCase(), rest: m[2].trim() };
  };

  while (i < lines.length) {
    const head = isAltHead(lines[i]);
    if (!head) break;

    let buf = [];
    if (head.rest) buf.push(head.rest);
    i++;

    while (i < lines.length) {
      const nextHead = isAltHead(lines[i]);
      if (nextHead) break;
      // Para e não absorve se atingiu um marcador evidente de nova questão
      if (/^\s*Ano:\s*\d{4}\s*Banca:/i.test(lines[i])) break;
      buf.push(lines[i]);
      i++;
    }

    const text = fixSpacingBeforePunct(norm(buf.join("\n")));
    alts.push({ k: head.k, t: text });
  }

  return { alts, nextIndex: i };
}

/* ========= Corpo ========= */
function parseBody(rawBody) {
  let body = rawBody.replace(/\r/g, "").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");

  const temaMatch = body.match(/\bQ\d+\s*>\s*([^\n]+)/i);
  const tema = temaMatch ? norm(temaMatch[1]) : "";

  const lines = body.split("\n");

  // encontra primeira alternativa
  let firstAltIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^[ \t]*[A-E](\s*[\)\.-]?\s*.*)?$/i.test(lines[i])) { firstAltIdx = i; break; }
  }

  let enunciado, alternativas = [];
  if (firstAltIdx >= 0) {
    enunciado = fixSpacingBeforePunct(norm(lines.slice(0, firstAltIdx).join("\n")));
    const { alts } = parseAlternativesByLines(lines, firstAltIdx);
    // dedup e ordena
    const map = new Map();
    for (const a of alts) if (!map.has(a.k)) map.set(a.k, a);
    alternativas = [...map.values()].sort((x,y)=>x.k.localeCompare(y.k));
  } else {
    // Certo/Errado
    const iC = body.search(/\bCerto\b/i);
    const iE = body.search(/\bErrado\b/i);
    const idx = [iC,iE].filter(x=>x>=0).sort((a,b)=>a-b)[0];
    enunciado = fixSpacingBeforePunct(norm(idx>0 ? body.slice(0, idx) : body));
    if (/(^|\s)Certo(\s|$)/i.test(body) || /(^|\s)Errado(\s|$)/i.test(body)) {
      alternativas = [{k:"A",t:"Certo"},{k:"B",t:"Errado"}];
    }
  }

  return { enunciado, alternativas, tema };
}

/* ========= Formatação ========= */
function formatQuestion(header, body, gabaritoLetra, removeAcento) {
  const { ano, banca, orgao } = parseHeader(header);
  const { enunciado, alternativas, tema } = parseBody(body);

  const altStr = alternativas.length
    ? alternativas.map(a => `** ${a.k}) ${a.t}`).join("\n\n")
    : `** A) Certo\n\n** B) Errado`;

  const temaFmt = tema ? tema.replace(/\s*,\s*/g, ", ") : "Tema";

  let out =
`-----
***** Ano: ${ano} | Banca: ${banca} | Órgão: ${orgao}

* ${enunciado}

${altStr}

*** Gabarito: ${gabaritoLetra || "?"}

**** ${temaFmt}
`;
  out = removeAcento ? stripAccents(out) : out;
  return out.trim();
}

/* ========= Pipeline ========= */
async function convertPdfToTxt(file, removeAcento=false) {
  const raw = await extractTextFromPDF(file);
  const answers = parseAnswerKey(raw) || [];
  const blocks = splitQuestionBlocks(raw);
  if (!blocks.length) return "Nenhuma questão encontrada.";

  const parts = [];
  let countAlt = 0, countCE = 0;
  for (let i = 0; i < blocks.length; i++) {
    const g = answers[i] || "?";
    const formatted = formatQuestion(blocks[i].header, blocks[i].body, g, removeAcento);
    if (/\n\*\*\s*[A-E]\)/.test(formatted)) countAlt++;
    if (/\*\*\s*A\)\s*Certo/.test(formatted) && /\*\*\s*B\)\s*Errado/.test(formatted)) countCE++;
    parts.push(formatted);
  }
  const banner = `/* blocos=${blocks.length} gabaritos=${answers.length} comAlternativas=${countAlt} certoErrado=${countCE} */\n`;
  return banner + parts.join("\n\n");
}

/* ========= UI ========= */
const input = document.getElementById("fileInput");
const convertBtn = document.getElementById("convertBtn");
const log = document.getElementById("log");
const downloadLink = document.getElementById("downloadLink");
const stripDiacritics = document.getElementById("stripDiacritics");
const onePerFile = document.getElementById("onePerFile");

const dropzone = document.querySelector(".dropzone");
if (dropzone) {
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.style.background = "#f8fbff"; });
  dropzone.addEventListener("dragleave", () => { dropzone.style.background = ""; });
  dropzone.addEventListener("drop", (e) => { e.preventDefault(); dropzone.style.background = ""; input.files = e.dataTransfer.files; });
}

if (convertBtn) {
  convertBtn.addEventListener("click", async () => {
    const files = [...(input?.files || [])];
    if (!files.length) { alert("Selecione um PDF."); return; }
    log && (log.textContent = "Extraindo texto...");

    const removeAcento = !!stripDiacritics?.checked;
    const perFile = !!onePerFile?.checked;

    if (perFile && files.length > 1) {
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
      downloadLink.download = files.length === 1 ? files[0].name.replace(/\.pdf$/i, ".txt") : "questoes.txt";
      downloadLink.style.display = "block";
      downloadLink.textContent = "Baixar TXT";
    }
    log && (log.textContent = "Concluído.");
  });
}

/* ========= Export para testes ========= */
window.__parser = {
  ensurePdfJS,
  extractTextFromPDF,
  parseAnswerKey,
  splitQuestionBlocks,
  parseHeader,
  parseBody,
  formatQuestion,
  convertPdfToTxt,
};
