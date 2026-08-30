import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { movimentosDB } from '../../src/data/movements.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error("❌ ERRO FATAL: SUPABASE_SERVICE_ROLE_KEY não encontrada no ambiente!");
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ ERRO FATAL: GEMINI_API_KEY não encontrada!");
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  serviceKey 
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MOVEMENT_IDS_VALIDOS = Object.keys(movimentosDB);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DELAY_ENTRE_REQUISICOES_MS = 15000; 

// --- LÓGICA ORIGINAL DE ABREVIAÇÃO DE MOVIMENTOS RESGATADA ---
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

function gerarTituloFallback(tipoTreino, tempoAlvo, rounds, movimentos) {
  const movsUnicos = [...new Set(movimentos.filter(m => m.phase === 'round').map(m => abreviarMovimento(m.movId)))];
  const movsNomes = movsUnicos.slice(0, 3).join('+');
  const sufixo = movsUnicos.length > 3 ? '...' : '';
  
  if (tipoTreino === 'AMRAP') return `AMRAP ${tempoAlvo ? tempoAlvo.split(':')[0] : ''}: ${movsNomes}${sufixo}`.replace(/\s+:/, ':');
  if (tipoTreino === 'EMOM') return `EMOM ${tempoAlvo ? tempoAlvo.split(':')[0] : ''}: ${movsNomes}${sufixo}`.replace(/\s+:/, ':');
  return `${rounds} RFT: ${movsNomes}${sufixo}`;
}
// -----------------------------------------------------------

const wodResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Título identificador do WOD. Se for apenas data/número, retorne vazio." },
    tipo_treino: { type: Type.STRING, enum: ["FOR_TIME", "AMRAP", "EMOM"] },
    tempo_alvo: { type: Type.STRING, description: "Tempo limite no formato 'mm:ss' (ex: '15:00'). Se não houver, retornar ''" },
    rounds_prescritos: { type: Type.INTEGER, description: "Quantidade de rounds do treino principal." },
    movimentos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          movId: { type: Type.STRING, enum: MOVEMENT_IDS_VALIDOS },
          phase: { type: Type.STRING, enum: ["buyin", "round", "cashout"] },
          reps: { type: Type.INTEGER },
          cargaMasc: { type: Type.NUMBER },
          cargaFem: { type: Type.NUMBER },
          tecnica: { type: Type.STRING, enum: ["normal", "tng", "drop", "strict", "kipping", "butterfly"] },
          extraVal: { type: Type.STRING }
        },
        required: ["movId", "phase", "reps", "cargaMasc", "cargaFem", "tecnica", "extraVal"]
      }
    }
  },
  required: ["title", "tipo_treino", "tempo_alvo", "rounds_prescritos", "movimentos"]
};

async function rasparTreinoComGemini(url) {
  console.log(`\n🌐 Buscando HTML da página: ${url}`);
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  
  let textoBruto = '';
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });

    const html = await page.content();
    await browser.close();

    const { load } = await import('cheerio');
    const $ = load(html);

    $('script, style, iframe, noscript, header, footer, nav').remove();
    $('br').replaceWith('\n');
    $('p, div, li, h1, h2, h3, h4, tr').append('\n');

    textoBruto = $('body').text()
      .split('\n')
      .map(linha => linha.trim())
      .filter(linha => linha.length > 2)
      .join('\n');

  } catch (error) {
      tentativas++;
      const isRateLimit = error.status === 429 || error.status === 503 || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('high demand');
      
      if (isRateLimit && tentativas < 3) {
        console.warn(`⚠️ API congestionada. Tentativa ${tentativas}/3. Aguardando 15s...`);
        await sleep(15000);
      } else {
        console.error(`❌ Falha na API do Gemini após ${tentativas} tentativa(s):`, error.message);
        
        // NOVO: Se o erro for de cota/limite, envia sinal para abortar todo o lote
        if (isRateLimit) return 'FATAL';
        
        return; // Erro comum (ex: site fora do ar), apenas pula esta URL
      }
    }

  const promptSystem = `
Você é um especialista em interpretação e análise biomecânica de treinos de CrossFit.
Extraia e estruture a prescrição de um treino a partir do texto de uma página web.

REGRAS:
1. Mapeie cada exercício para o 'movId' válido.
2. Se a carga estiver em libras (lbs/#), converta para kg multiplicando por 0.453592.
3. Se houver variação Masc/Fem, preencha cargaMasc e cargaFem. Sem carga, preencha 0.
4. Identifique Buy-in, Round e Cash-out.
5. Se for AMRAP, rounds_prescritos = 1 e tempo_alvo = duração.
6. Não use nomes numéricos (ex: '240302') para o título.
  `;

  let tentativas = 0;
  let sucessoNaIA = false;
  let responseText = null;

  while (tentativas < 3 && !sucessoNaIA) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          { role: 'user', parts: [{ text: `Analise o texto abaixo e extraia o WOD:\n\n${textoBruto.substring(0, 4000)}` }] }
        ],
        config: {
          systemInstruction: promptSystem,
          responseMimeType: 'application/json',
          responseSchema: wodResponseSchema,
          temperature: 0.1, 
        }
      });
      
      responseText = response.text;
      sucessoNaIA = true;

    } catch (error) {
      tentativas++;
      const isRateLimit = error.status === 429 || error.status === 503 || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('high demand');
      
      if (isRateLimit && tentativas < 3) {
        console.warn(`⚠️ API congestionada. Tentativa ${tentativas}/3. Aguardando 15s...`);
        await sleep(15000);
      } else {
        console.error(`❌ Falha na API do Gemini após ${tentativas} tentativa(s):`, error.message);
        return; 
      }
    }
  }

  if (!responseText) return;

  try {
    const parsedData = JSON.parse(responseText);

    if (!parsedData || !parsedData.movimentos || parsedData.movimentos.length === 0) {
      console.warn("⚠️ Nenhum treino estruturado pôde ser identificado.");
      return;
    }

    const movimentosComId = parsedData.movimentos.map(m => ({
      ...m,
      originalId: crypto.randomUUID()
    }));

    // --- APLICAÇÃO DO FALLBACK DE NOME ---
    let tituloFinal = parsedData.title;
    if (!tituloFinal || /^\d+$/.test(tituloFinal.trim()) || tituloFinal.trim() === '') {
      tituloFinal = gerarTituloFallback(parsedData.tipo_treino, parsedData.tempo_alvo, parsedData.rounds_prescritos, movimentosComId);
    }

    const assinaturaHash = `${parsedData.tipo_treino}_${parsedData.rounds_prescritos}_[${movimentosComId.map(m => `${m.movId}:${m.reps}:${m.cargaMasc}:${m.tecnica}`).join('|')}]`;

    const payload = {
      title: tituloFinal,
      short_code: crypto.randomBytes(3).toString('hex').toUpperCase(),
      tipo_treino: parsedData.tipo_treino,
      tempo_alvo: parsedData.tempo_alvo || '',
      rounds_prescritos: parsedData.rounds_prescritos || 1,
      movimentos: movimentosComId,
      creator_id: process.env.BOT_USER_ID || null,
      hash: assinaturaHash,
      source_url: url
    };

    console.log("\n✅ Treino Estruturado com Sucesso:");
    console.log(`📌 Título: ${payload.title}`);
    
    const { error } = await supabase.from('wod_templates').insert([payload]);
    
    if (error) {
      console.error("❌ Erro ao salvar no Supabase:", error.message);
    } else {
      console.log(`💾 Treino salvo com sucesso no banco! Código: [${payload.short_code}]`);
    }

  } catch (error) {
    console.error("❌ Erro ao processar o JSON retornado pela IA:", error.message);
  }
}

async function executarBatch(urls) {
  console.log(`🚀 Iniciando Raspagem Inteligente. Total de URLs: ${urls.length}`);
  
  for (let i = 0; i < urls.length; i++) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Processing [${i + 1}/${urls.length}]`);
    
    // NOVO: Capturamos o status retornado pela função
    const status = await rasparTreinoComGemini(urls[i]);
    
    // NOVO: O Kill Switch é ativado
    if (status === 'FATAL') {
      console.log("\n🛑 KILL SWITCH ATIVADO: Cota do Gemini esgotada. Abortando o resto da fila para evitar bloqueios!");
      break; 
    }

    if (i < urls.length - 1) await sleep(DELAY_ENTRE_REQUISICOES_MS);
  }
  
  console.log("\n🎉 Processamento finalizado!");
}

const urlsParaRaspagem = [
  'https://www.crossfit.com/240301',
  'https://www.crossfit.com/240302',
  'https://www.crossfit.com/240303',
  'https://www.crossfit.com/240304',
  'https://www.crossfit.com/240308',
  'https://www.crossfit.com/240309'
];

// Dicionário de sites permitidos e suas regras de extração
const SITES_ALVO = {
  crossfit_main: {
    urlIndice: 'https://www.crossfit.com/workout',
    // Regra: Só pega links que terminam com 6 números (ex: /240301)
    regexFiltro: /crossfit\.com\/\d{6}\/?$/ 
  },
  wodwell: {
    urlIndice: 'https://wodwell.com/wods/',
    // Regra: Só pega links de workouts específicos
    regexFiltro: /wodwell\.com\/wod\//
  }
};

async function colherLinksDeTreinos(siteKey) {
  const alvo = SITES_ALVO[siteKey];
  if (!alvo) return [];

  console.log(`🕷️ Iniciando Spider na página índice: ${alvo.urlIndice}`);
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(alvo.urlIndice, { waitUntil: 'networkidle2' });
    const html = await page.content();
    await browser.close();

    const { load } = await import('cheerio');
    const $ = load(html);
    
    const linksEncontrados = new Set(); // Set evita links duplicados

    // Procura todas as tags <a> na página
    $('a').each((_, el) => {
      let href = $(el).attr('href');
      if (!href) return;
      
      // Resolve links relativos (ex: /240301 -> https://www.crossfit.com/240301)
      if (href.startsWith('/')) {
        const baseUrl = new URL(alvo.urlIndice).origin;
        href = baseUrl + href;
      }

      // Se o link bater com a nossa regra de ouro, entra pra lista
      if (alvo.regexFiltro.test(href)) {
        linksEncontrados.add(href);
      }
    });

    const urlsFinais = Array.from(linksEncontrados);
    console.log(`🎯 Spider encontrou ${urlsFinais.length} links válidos de treinos!`);
    return urlsFinais;

  } catch (error) {
    await browser.close();
    console.error(`❌ Erro no Spider ao varrer ${alvo.urlIndice}:`, error.message);
    return [];
  }
}

async function filtrarUrlsIneditas(urlsEncontradas) {
  if (urlsEncontradas.length === 0) return [];

  // Pede ao Supabase para verificar quais dessas URLs ele já conhece
  const { data, error } = await supabase
    .from('wod_templates')
    .select('source_url')
    .in('source_url', urlsEncontradas);

  if (error) {
    console.error("❌ Erro ao checar histórico no banco:", error.message);
    return urlsEncontradas; // Na dúvida, tenta processar
  }

  const urlsJaNoBanco = new Set(data.map(d => d.source_url));
  const urlsIneditas = urlsEncontradas.filter(url => !urlsJaNoBanco.has(url));

  console.log(`🛡️ Filtro Anti-Repetição: ${urlsEncontradas.length} links no site -> ${urlsJaNoBanco.size} já estavam no banco -> ${urlsIneditas.length} inéditos para o Gemini.`);
  
  return urlsIneditas;
}

async function iniciarSistema() {
  const urlsFresquinhas = await colherLinksDeTreinos('crossfit_main');
  
  // Passa a lista na peneira do banco de dados
  const urlsIneditas = await filtrarUrlsIneditas(urlsFresquinhas);
  
  // Corta a lista para não estourar a cota diária do plano gratuito (ex: máximo 10 por dia)
  const cotaSegura = urlsIneditas.slice(0, 10);
  
  if (cotaSegura.length > 0) {
    await executarBatch(cotaSegura);
  } else {
    console.log("🛑 Nenhum treino inédito hoje. O bot vai descansar.");
  }
}

iniciarSistema();