// datajud_dump.js
import fetch from 'node-fetch';
import fs from 'fs';

const ALIAS = (process.argv[2] || 'api_publica_stj').startsWith('api_')
  ? process.argv[2]
  : `api_publica_${process.argv[2]}`; // stj -> api_publica_stj
const TERM  = process.argv[3] || 'Dano estético';
const GTE   = process.argv[4] || '2015-01-01';
const LTE   = process.argv[5] || '2025-12-31';
const LIMIT = parseInt(process.argv[6] || '5000', 10);

// COLE SUA CHAVE AQUI:
const API_KEY = 'ApiKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const URL = `https://api-publica.datajud.cnj.jus.br/${ALIAS}/_search`;

const baseQuery = {
  size: 1000,
  query: {
    bool: {
      must: [{ match: { "assuntos.nome": TERM } }],
      filter: [{ range: { dataAjuizamento: { gte: GTE, lte: LTE } } }]
    }
  },
  sort: [{ "@timestamp": { order: "asc" } }]
};

const headers = { 'Authorization': API_KEY, 'Content-Type': 'application/json' };

function pick(s, path, def='') {
  try { return path.split('.').reduce((o,k)=>o?.[k], s) ?? def; } catch { return def; }
}

function hitToLine(hit) {
  const s = hit._source || {};
  const tribunal = pick(s, 'tribunal.sigla', ALIAS.replace('api_publica_','').toUpperCase());
  const num      = pick(s, 'numeroProcesso');
  const dataJ    = pick(s, 'dataJulgamento') || pick(s, 'dataAjuizamento');
  const orgao    = pick(s, 'orgaoJulgador.nome');
  const classe   = pick(s, 'classe.nome');
  const assunto  = (pick(s, 'assuntos') || []).map(a=>a?.nome).filter(Boolean).slice(0,3).join('; ');
  const ementa   = (pick(s, 'ementa','') || '').replace(/\s+/g,' ').trim();
  // Linha TXT: TRIBUNAL | PROCESSO | DATA | ÓRGÃO | CLASSE | ASSUNTOS | EMENTA
  return [tribunal, num, dataJ, orgao, classe, assunto, ementa].map(v=>String(v||'')).join(' | ');
}

async function run(){
  let out = [];
  let total = 0;
  let search_after = undefined;

  while (total < LIMIT) {
    const q = { ...baseQuery, ...(search_after ? { search_after } : {}) };
    const r = await fetch(URL, { method:'POST', headers, body: JSON.stringify(q) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const hits = j?.hits?.hits || [];
    if (!hits.length) break;

    out.push(...hits.map(hitToLine));
    total += hits.length;
    search_after = hits[hits.length - 1].sort;

    // opcional: respeitar rate limit
    await new Promise(res=>setTimeout(res, 300));
  }

  const fname = `datajud_${ALIAS}_${TERM.replace(/\s+/g,'_')}_${GTE}_${LTE}.txt`;
  fs.writeFileSync(fname, out.join('\n'), 'utf8');
  console.log(`OK: ${out.length} registros -> ${fname}`);
}
run().catch(e=>{ console.error(e); process.exit(1); });
