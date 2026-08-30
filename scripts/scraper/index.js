import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

import { movimentosDB } from '../../src/data/movements.ts'; 

dotenv.config({ path: '.env.local' });

console.log("URL:", process.env.VITE_SUPABASE_URL ? "OK" : "FALTOU");
console.log("ANON KEY:", process.env.VITE_SUPABASE_ANON_KEY ? "OK" : "FALTOU");
console.log("SERVICE ROLE:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "FALTOU");

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY 
);

const DICIONARIO_HEURISTICO = [
  { id: 'burpee_over_db', keywords: ['burpee', /over|facing|lateral/, /dumbbell|db/], score: 30, usaCarga: false, defaultTech: 'normal' },
  { id: 'burpee_over_bar', keywords: ['burpee', /over|facing|lateral/, /bar|barbell/], score: 30, usaCarga: false, defaultTech: 'normal' },
  { id: 'burpee_box_jump_over', keywords: ['burpee', 'box', 'jump', 'over'], score: 40, usaCarga: false, defaultTech: 'normal' },
  { id: 'burpee_box_jump', keywords: ['burpee', 'box', 'jump'], score: 30, usaCarga: false, defaultTech: 'normal' },
  { id: 'burpee', keywords: ['burpee'], score: 10, usaCarga: false, defaultTech: 'normal' },
  { id: 'box_jump_over', keywords: ['box jump over'], score: 30, usaCarga: false, defaultTech: 'normal' },
  { id: 'box_jump', keywords: ['box jump'], score: 25, usaCarga: false, defaultTech: 'normal' },
  { id: 'db_snatch', keywords: [/dumbbell|db/, 'snatch'], score: 20, usaCarga: true, defaultTech: 'tng' },
  { id: 'db_clean', keywords: [/dumbbell|db/, 'clean'], score: 20, usaCarga: true, defaultTech: 'tng' },
  { id: 'db_jerk', keywords: [/dumbbell|db/, /jerk|push press/], score: 20, usaCarga: true, defaultTech: 'tng' },
  { id: 'bmu', keywords: [/bar muscle-?up|\bbmu\b/], score: 20, usaCarga: false, defaultTech: 'kipping' },
  { id: 'rmu', keywords: [/ring muscle-?up|\brmu\b/], score: 20, usaCarga: false, defaultTech: 'kipping' },
  { id: 'c2b', keywords: [/chest-?to-?bar|\bc2b\b/], score: 20, usaCarga: false, defaultTech: 'kipping' },
  { id: 't2b', keywords: [/toes-?to-?bar|\bt2b\b/], score: 20, usaCarga: false, defaultTech: 'kipping' },
  { id: 'pullup', keywords: [/pull-?up/], score: 15, usaCarga: false, defaultTech: 'kipping' },
  { id: 'hspu', keywords: [/handstand push-?up|\bhspu\b/], score: 25, usaCarga: false, defaultTech: 'kipping' },
  { id: 'pushup', keywords: [/push-?up/], score: 10, usaCarga: false, defaultTech: 'normal' },
  { id: 'double_under', keywords: [/double-?under|\bdu\b/], score: 20, usaCarga: false, defaultTech: 'normal' },
  { id: 'single_under', keywords: [/single-?under|\bsu\b/], score: 20, usaCarga: false, defaultTech: 'normal' },
  { id: 'overhead_squat', keywords: ['overhead', 'squat'], score: 20, usaCarga: true, defaultTech: 'tng' },
  { id: 'front_squat', keywords: ['front', 'squat'], score: 20, usaCarga: true, defaultTech: 'tng' },
  { id: 'back_squat', keywords: ['back', 'squat'], score: 20, usaCarga: true, defaultTech: 'tng' },
  { id: 'air_squat', keywords: ['squat'], score: 10, usaCarga: false, defaultTech: 'normal' },
  { id: 'thruster', keywords: ['thruster'], score: 20, usaCarga: true, defaultTech: 'tng' },
  { id: 'deadlift', keywords: ['deadlift'], score: 20, usaCarga: true, defaultTech: 'tng' },
  { id: 'clean_jerk', keywords: ['clean', 'jerk'], score: 30, usaCarga: true, defaultTech: 'tng' },
  { id: 'clean', keywords: ['clean'], score: 10, usaCarga: true, defaultTech: 'tng' },
  { id: 'snatch', keywords: ['snatch'], score: 10, usaCarga: true, defaultTech: 'tng' },
  { id: 'ghd_situp', keywords: [/ghd/], score: 20, usaCarga: false, defaultTech: 'normal' },
  { id: 'situp', keywords: [/sit-?up/], score: 10, usaCarga: false, defaultTech: 'normal' },
  { id: 'wall_ball', keywords: ['wall', 'ball'], score: 20, usaCarga: true, defaultTech: 'normal' },
  { id: 'farmers_carry', keywords: [/farmer/, /carry/], score: 25, usaCarga: true, defaultTech: 'normal' },
  { id: 'lunge_suitcase', keywords: [/lunge/, /weighted|dumbbell|db/], score: 25, usaCarga: true, defaultTech: 'normal' },
  { id: 'walking_lunge', keywords: [/lunge/], score: 10, usaCarga: false, defaultTech: 'normal' },
  { id: 'row', keywords: ['row'], score: 20, usaCarga: false, defaultTech: 'normal' },
  { id: 'run', keywords: ['run'], score: 20, usaCarga: false, defaultTech: 'normal' },
  { id: 'bike_erg', keywords: ['bikeerg'], score: 20, usaCarga: false, defaultTech: 'normal' },
  { id: 'echo_bike', keywords: [/echo bike/], score: 20, usaCarga: false, defaultTech: 'normal' },
  { id: 'assault_bike', keywords: [/assault bike/], score: 20, usaCarga: false, defaultTech: 'normal' },
  { id: 'skierg', keywords: ['skierg'], score: 20, usaCarga: false, defaultTech: 'normal' },
];

Object.keys(movimentosDB).forEach(id => {
  if (DICIONARIO_HEURISTICO.some(r => r.id === id)) return;
  const config = movimentosDB[id];
  const palavrasChave = config.nome.toLowerCase().replace(/[()-]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  DICIONARIO_HEURISTICO.push({ id, keywords: palavrasChave, score: palavrasChave.length * 10, usaCarga: config.usaCarga, defaultTech: config.usaCarga ? 'tng' : 'normal' });
});

function converterLbParaKg(valorLb) {
  return Math.round((valorLb * 0.453592) * 10) / 10;
}

function extrairCarga(linha) {
  let cM = 0; let cF = 0;
  const matchSlash = linha.match(/(\d+)\s*(?:\/|\|)\s*(\d+)\s*(?:lb|lbs|kg|#)/i);
  const matchMasc = linha.match(/(?:♂|men|male|m)\s*:?\s*(\d+)\s*(?:lb|lbs|kg|#)/i);
  const matchFem = linha.match(/(?:♀|women|female|w)\s*:?\s*(\d+)\s*(?:lb|lbs|kg|#)/i);
  const matchGeneric = linha.match(/(\d+)\s*(?:lb|lbs|kg|#)/i);

  if (matchSlash) {
    const v1 = parseInt(matchSlash[1], 10);
    const v2 = parseInt(matchSlash[2], 10);
    cM = Math.max(v1, v2); cF = Math.min(v1, v2);
  } else {
    if (matchMasc) cM = parseInt(matchMasc[1], 10);
    if (matchFem) cF = parseInt(matchFem[1], 10);
    if (!matchMasc && !matchFem && matchGeneric) cM = parseInt(matchGeneric[1], 10); 
  }
  if (/(?:lb|lbs|#)/i.test(linha)) {
    if (cM > 0) cM = converterLbParaKg(cM);
    if (cF > 0) cF = converterLbParaKg(cF);
  }
  return { cM, cF };
}

function extrairAltura(linha) {
  let aM = 0; let aF = 0;
  const matchSlash = linha.match(/(\d+)\s*(?:\/|\|)\s*(\d+)\s*(?:-?\s*in|-?\s*inch|"|in\b)/i);
  const matchMasc = linha.match(/(?:♂|men|male|m)\s*:?\s*(\d+)\s*(?:-?\s*in|-?\s*inch|"|in\b)/i);
  const matchFem = linha.match(/(?:♀|women|female|w)\s*:?\s*(\d+)\s*(?:-?\s*in|-?\s*inch|"|in\b)/i);
  const matchGeneric = linha.match(/(\d+)\s*(?:-?\s*in|-?\s*inch|"|in\b)/i);

  if (matchSlash) {
    const v1 = parseInt(matchSlash[1], 10);
    const v2 = parseInt(matchSlash[2], 10);
    aM = Math.max(v1, v2); aF = Math.min(v1, v2);
  } else {
    if (matchMasc) aM = parseInt(matchMasc[1], 10);
    if (matchFem) aF = parseInt(matchFem[1], 10);
    if (!matchMasc && !matchFem && matchGeneric) aM = parseInt(matchGeneric[1], 10); 
  }
  return { aM, aF };
}

function abreviarMovimento(movId) {
  const mapaSiglas = {
    bmu: 'BMU', rmu: 'RMU', c2b: 'C2B', t2b: 'T2B', pullup: 'PU', hspu: 'HSPU', pushup: 'PUSH',
    double_under: 'DU', single_under: 'SU', overhead_squat: 'OHS', front_squat: 'FS', back_squat: 'BS',
    air_squat: 'SQT', thruster: 'THR', deadlift: 'DL', clean_jerk: 'CJ', clean: 'CLN', snatch: 'SN',
    ghd_situp: 'GHD', situp: 'SIT', wall_ball: 'WB', row: 'ROW', run: 'RUN', skierg: 'SKI'
  };
  if (mapaSiglas[movId]) return mapaSiglas[movId];
  
  const partes = movId.split('_');
  if (partes.length >= 3) return partes.map(p => p[0].toUpperCase()).join('');
  return partes.map(p => {
    let consoantes = p.replace(/[aeiouAEIOU]/g, '').toUpperCase();
    if (consoantes.length === 0) return p.substring(0, 3).toUpperCase();
    return consoantes.substring(0, 3);
  }).join('-');
}

function analisarLinha(linhaTexto) {
  if (/time cap|post time|resources|find a gym|crossfit games/i.test(linhaTexto)) return null;
  const repMatch = linhaTexto.match(/^[\s\-]*(max|\d+)/i);
  if (!repMatch) return null;

  const normalizedLine = linhaTexto.toLowerCase();
  let bestMatch = null; let highestScore = 0;

  for (const item of DICIONARIO_HEURISTICO) {
    let matchesAll = true;
    for (const kw of item.keywords) {
      if (typeof kw === 'string') { if (!normalizedLine.includes(kw)) matchesAll = false; } 
      else if (kw instanceof RegExp) { if (!kw.test(normalizedLine)) matchesAll = false; }
    }
    if (matchesAll && item.score > highestScore) {
      highestScore = item.score;
      bestMatch = item;
    }
  }
  
  if (!bestMatch) return null;

  let reps = repMatch[1].toLowerCase() === 'max' ? 99 : parseInt(repMatch[1], 10);
  let cargaMasc = 0; let cargaFem = 0;
  let tecnica = bestMatch.defaultTech;
  let extraVal = '-';

  if (bestMatch.usaCarga) {
    const { cM, cF } = extrairCarga(linhaTexto);
    cargaMasc = cM; cargaFem = cF;
  }

  if (/box|wall|target|jump/i.test(linhaTexto)) {
    const { aM, aF } = extrairAltura(linhaTexto);
    if (aM > 0 && aF > 0 && aM !== aF) extraVal = `${aM}/${aF}in`;
    else if (aM > 0) extraVal = `${aM}in`;
  }

  if (/strict/i.test(linhaTexto)) tecnica = 'strict';
  if (/butterfly/i.test(linhaTexto)) tecnica = 'butterfly';
  
  return {
    originalId: crypto.randomUUID(), movId: bestMatch.id, phase: 'round',
    reps, cargaMasc, cargaFem, tecnica, extraVal
  };
}

async function rasparTreino(urlBase) {
  console.log(`\n🚀 [DEBUG] Iniciando navegador headless para varredura em: ${urlBase}`);
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(urlBase, { waitUntil: 'networkidle2', timeout: 30000 });

    const html = await page.content();
    await browser.close();

    const { load } = await import('cheerio');
    const $ = load(html);

    let tituloWod = $('h1, .workout-title, .post-title').first().text().trim() || 'WOD Importado';

    $('script, style, iframe, noscript').remove();
    $('br').replaceWith('\n');
    $('p, div, li, h1, h2, h3, h4, tr, article, section').append('\n');

    const textoBruto = $('body').text();
    const linhasBrutas = textoBruto.split('\n')
      .map(linha => linha.replace(/\s+/g, ' ').trim())
      .filter(linha => linha.length > 2 && linha.length < 150);

    let indiceFimWod = linhasBrutas.length;
    for (let i = 0; i < linhasBrutas.length; i++) {
      if (/^(scaling|compare to|comments on|resources)/i.test(linhasBrutas[i])) {
        indiceFimWod = i; break;
      }
    }
    const linhasWod = linhasBrutas.slice(0, indiceFimWod);

    let tituloDetectado = null;
    for (let i = 0; i < Math.min(6, linhasWod.length); i++) {
      if (/(open workout \d{2}\.\d+|quarterfinal(s)? workout|semifinal(s)? workout|hero workout|benchmark)/i.test(linhasWod[i])) { tituloDetectado = linhasWod[i]; break; }
      if (/^(Fran|Murph|Grace|Isabel|Diane|Amanda|Cindy|Mary|Angie|Barbara|Chelsea|Linda|Helen|Karen|Jackie|Nancy|Eva|Kelly|Lynne|Nicole)$/i.test(linhasWod[i])) { tituloDetectado = linhasWod[i]; break; }
    }
    if (tituloDetectado) tituloWod = tituloDetectado;

    let roundsPrescritos = 1; let tipoTreino = 'FOR_TIME'; let tempoAlvo = ''; let AMRAPDetectado = false;

    for (let i = 0; i < linhasWod.length; i++) {
      const linha = linhasWod[i];
      const amrapMatch = linha.match(/(?:amrap|as many rounds).*?(\d+)\s*(?:min|minute)/i) || linha.match(/(\d+)\s*(?:-?minute|-?min).*?(?:amrap|as many rounds)/i);
      if (amrapMatch || /amrap|as many rounds/i.test(linha)) {
        tipoTreino = 'AMRAP'; AMRAPDetectado = true; roundsPrescritos = 1; 
        if (amrapMatch) tempoAlvo = `${parseInt(amrapMatch[1] || amrapMatch[2], 10).toString().padStart(2, '0')}:00`;
      }
      if (/emom/i.test(linha)) tipoTreino = 'EMOM';

      const roundMatch = linha.match(/(\d+)\s*rounds?(?:\s*for time|\s*to complete|\s*of)?/i);
      if (roundMatch && !AMRAPDetectado && tipoTreino !== 'EMOM') {
        const val = parseInt(roundMatch[1], 10);
        if (val > 1 && val < 30) roundsPrescritos = val;
      }

      const timeCapMatch = linha.match(/(?:time\s*)?cap:?\s*(\d+)\s*(?:min|minute)/i);
      if (timeCapMatch && tipoTreino === 'FOR_TIME') tempoAlvo = `${parseInt(timeCapMatch[1], 10).toString().padStart(2, '0')}:00`;
    }

    let cargaGlobalM = 0; let cargaGlobalF = 0; let alturaGlobalBox = '-';

    for (let i = 0; i < linhasWod.length; i++) {
      const { cM, cF } = extrairCarga(linhasWod[i]);
      if (cM > cargaGlobalM) cargaGlobalM = cM;
      if (cF > cargaGlobalF) cargaGlobalF = cF;

      const { aM, aF } = extrairAltura(linhasWod[i]);
      if (aM > 0 && aF > 0 && aM !== aF) alturaGlobalBox = `${aM}/${aF}in`;
      else if (aM > 0) alturaGlobalBox = `${aM}in`;
    }

    const lousa = [];
    for (let i = 0; i < linhasWod.length; i++) {
      const item = analisarLinha(linhasWod[i]);
      if (item) lousa.push(item);
    }

    if (lousa.length === 0) return;

    lousa.forEach(item => {
      if (item.cargaMasc === 0 && movimentosDB[item.movId]?.usaCarga) {
        item.cargaMasc = cargaGlobalM;
        item.cargaFem = cargaGlobalF;
      }
      if (item.extraVal === '-' && /box/.test(item.movId) && alturaGlobalBox !== '-') {
        item.extraVal = alturaGlobalBox;
      }
    });

    if (!tituloDetectado) {
      const movsUnicos = [...new Set(lousa.map(m => abreviarMovimento(m.movId)))];
      const movsNomes = movsUnicos.slice(0, 3).join('+');
      const sufixo = movsUnicos.length > 3 ? '...' : '';
      if (tipoTreino === 'AMRAP') tituloWod = `AMRAP ${tempoAlvo ? tempoAlvo.split(':')[0] : ''}: ${movsNomes}${sufixo}`.replace(/\s+:/, ':');
      else if (tipoTreino === 'EMOM') tituloWod = `EMOM ${tempoAlvo ? tempoAlvo.split(':')[0] : ''}: ${movsNomes}${sufixo}`.replace(/\s+:/, ':');
      else tituloWod = `${roundsPrescritos} RFT: ${movsNomes}${sufixo}`;
    }

    console.table(lousa.map(m => ({ Movimento: m.movId, Reps: m.reps, CargaM: m.cargaMasc, CargaF: m.cargaFem, Extra: m.extraVal })));

    const assinaturaHash = `${tipoTreino}_${roundsPrescritos}_[${lousa.map(m => `${m.movId}:${m.reps}:${m.cargaMasc}:${m.tecnica}`).join('|')}]`;

    const payload = {
      title: tituloWod, short_code: crypto.randomBytes(3).toString('hex').toUpperCase(),
      tipo_treino: tipoTreino, tempo_alvo: tempoAlvo, rounds_prescritos: roundsPrescritos, movimentos: lousa, hash: assinaturaHash
    };

    const { error } = await supabase.from('wod_templates').insert([payload]);
    if (error) console.error(error.message);
    else console.log(`💾 Treino "${tituloWod}" [${payload.short_code}] salvo!`);
    
  } catch (erro) { console.error('❌ Falha:', erro.message); }
}

rasparTreino('https://www.crossfit.com/240309');