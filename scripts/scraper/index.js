import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto'; 

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

// ============================================================================
// 1. CONFIGURAÇÕES INICIAIS
// ============================================================================
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================================================
// 2. LÓGICA DE NOMEAÇÃO COMPACTA E UTILITÁRIOS
// ============================================================================
function gerarNomeCompacto(tipoTreino, tempoAlvo, roundsPrescritos, movimentos, url) {
  if (!movimentos || movimentos.length === 0) {
    const dataStr = url.split('/').pop();
    return `WOD ${dataStr}`;
  }

  const tempoMinutos = tempoAlvo ? tempoAlvo.split(':')[0] : '';
  let prefixo = '';

  if (tipoTreino === 'FOR_TIME') {
    const rounds = roundsPrescritos > 0 ? roundsPrescritos : 1;
    prefixo = `${rounds}RFT${parseInt(tempoMinutos) || ''}`;
  } else if (tipoTreino === 'AMRAP' || tipoTreino === 'EMOM') {
    prefixo = `${tipoTreino}${parseInt(tempoMinutos) || roundsPrescritos || ''}`;
  } else {
    prefixo = tipoTreino || 'WOD';
  }

  const siglas = [];
  const classicos = {
    'double_under': 'DU', 'single_under': 'SU', 'overhead_squat': 'OHS', 'wall_ball': 'WB',
    'hspu': 'HSPU', 'c2b': 'C2B', 't2b': 'T2B', 'bmu': 'BMU', 'rmu': 'RMU',
    'push_press': 'PP', 'push_jerk': 'PJ', 'deadlift': 'DL', 'pullup': 'PU',
    'front_squat': 'FS', 'back_squat': 'BS', 'clean_jerk': 'C&J', 'snatch': 'SN',
    'thruster': 'THR', 'burpee': 'BRP', 'walking_lunge': 'WLK-LNG', 'burpee_box_jump_over': 'BBJO'
  };

  const movsUnicos = [...new Set(movimentos.map(m => m.movId))];

  for (const movId of movsUnicos) {
    if (classicos[movId]) {
      siglas.push(classicos[movId]);
      continue;
    }

    const nome = movId.replace(/_/g, ' ');
    const palavras = nome.split(' ').filter(p => p.length > 0);

    if (palavras.length === 1) {
      siglas.push(palavras[0].substring(0, 3).toUpperCase());
    } else if (palavras.length === 2) {
      const get3Consonantes = (word) => {
        const cons = word.replace(/[aeiouAEIOU]/gi, '');
        return (cons + word).substring(0, 3).toUpperCase();
      };
      siglas.push(`${get3Consonantes(palavras[0])}-${get3Consonantes(palavras[1])}`);
    } else {
      siglas.push(palavras.map(p => p[0].toUpperCase()).join(''));
    }
  }

  return `${prefixo}:${siglas.join('+')}`;
}

const generateShortCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ============================================================================
// 3. MÓDULO DE INTELIGÊNCIA ARTIFICIAL (Gemini 3.6 Flash)
// ============================================================================
async function extrairTreinosEmLoteComIA(loteBruto) {
  const movimentosConhecidos = [
    'air_squat', 'front_squat', 'back_squat', 'overhead_squat', 'thruster', 'wall_ball', 
    'deadlift', 'clean', 'clean_power', 'clean_jerk', 'snatch', 'snatch_power',
    'pushup', 'hspu', 'ring_dip', 'pullup', 'c2b', 'bmu', 'rmu', 't2b',
    'burpee', 'burpee_box_jump', 'box_jump', 'walking_lunge', 'double_under',
    'run', 'row', 'assault_bike', 'db_snatch', 'kettlebell_swing'
  ].join(', ');

  const prompt = `Você é um Head Coach de CrossFit analisando textos do site oficial.
  Extraia os treinos do lote de textos fornecido e converta-os estritamente para um ARRAY JSON.
  
  Regras de conversão:
  1. 'tipo_treino' deve ser "FOR_TIME", "AMRAP" ou "EMOM".
  2. Mapeie os exercícios para a chave 'movId'. Use estes IDs exatos se aplicável: ${movimentosConhecidos}. SE o movimento for uma variação física diferente (ex: "burpee over plate" ou "kettlebell snatch"), NÃO force o encaixe na lista. Crie um novo ID descritivo em minúsculas com underscores (ex: 'burpee_over_plate').
  3. 'cargaMasc' e 'cargaFem' devem ser números puros em KG. Se for só peso corporal, use 0.
  4. 'phase' deve ser "buyin", "round" ou "cashout".
  5. 'tecnica' deve ser "normal", "tng", "drop", "strict" ou "kipping". Na dúvida, use "normal".
  6. REGRA DE MONOSTRUTURAIS: Para corrida contínua (run), remo (row), bikes e corda, o valor (em metros ou cal) DEVE ir obrigatoriamente no campo 'reps'. EXCEÇÃO: Para 'shuttle_run', o campo 'reps' é o número de idas/vindas, e o campo 'extraVal' é a distância de cada tiro.
  7. Use 'extraVal' APENAS para métricas secundárias (ex: altura de caixa, target do wall ball, ou para especificar se a repetição no ergômetro é "cal" ou "m").
  8. Mantenha a 'url' original em cada treino.
  9. O campo 'extraVal' DEVE conter APENAS números puros (ex: "3.0" para altura, "115" para drag factor) ou as strings exatas "cal" ou "m". NUNCA inclua descrições, textos, ou unidades junto com o número (errado: "target 10ft/9ft" ou "60 cal", certo: "3.0" ou "60").
  
  Textos brutos: ${JSON.stringify(loteBruto)}`;
  
  let tentativas = 0;
  while (tentativas < 3) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          temperature: 0.0, // <- CRÍTICO: Anula a criatividade da IA, forçando respostas puramente determinísticas
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                url: { type: Type.STRING },
                tipo_treino: { type: Type.STRING },
                tempo_alvo: { type: Type.STRING, description: "Ex: 15:00 ou 00:00" },
                rounds_prescritos: { type: Type.INTEGER, description: "Use 0 se não aplicável" },
                movimentos: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      movId: { type: Type.STRING },
                      reps: { type: Type.INTEGER },
                      cargaMasc: { type: Type.NUMBER },
                      cargaFem: { type: Type.NUMBER },
                      phase: { type: Type.STRING },
                      tecnica: { type: Type.STRING },
                      extraVal: { type: Type.STRING, description: "Distância, altura, etc." }
                    },
                    required: ['movId', 'reps', 'cargaMasc', 'cargaFem', 'phase', 'tecnica']
                  }
                }
              },
              required: ['url', 'tipo_treino', 'tempo_alvo', 'rounds_prescritos', 'movimentos'],
            }
          },
        }
      });
      
      const textoResposta = typeof response.text === 'function' ? response.text() : response.text;
      return JSON.parse(textoResposta);
      
    } catch (error) {
      tentativas++;
      console.error(`\n⚠️ [FALHA NA IA - TENTATIVA ${tentativas}/3]: ${error.message}`);
      await new Promise(res => setTimeout(res, 15000));
      if (tentativas >= 3) return 'FATAL';
    }
  }
}

// ============================================================================
// 3.5 VALIDAÇÃO DE RUNTIME E DETECÇÃO DE ANOMALIAS
// ============================================================================
function validarPayloadEstrito(treinosArray) {
  const tecnicasPermitidas = ['normal', 'tng', 'drop', 'strict', 'kipping', 'butterfly'];
  const fasesPermitidas = ['buyin', 'round', 'cashout'];
  const tiposTreinoPermitidos = ['FOR_TIME', 'AMRAP', 'EMOM'];
  
  // Lista espelhada do src/data/movements.ts (inclua os novos aqui)
  const movimentosConhecidos = new Set([
    'air_squat', 'front_squat', 'back_squat', 'overhead_squat', 'thruster', 'db_thruster', 
    'double_db_thruster', 'wall_ball', 'deadlift', 'clean', 'clean_power', 'clean_jerk', 
    'snatch', 'snatch_power', 'pushup', 'hspu', 'ring_dip', 'pullup', 'c2b', 'bmu', 'rmu', 
    't2b', 'burpee', 'burpee_box_jump', 'box_jump', 'walking_lunge', 'double_under', 'run', 
    'row', 'assault_bike', 'bike_erg', 'echo_bike', 'skierg', 'db_snatch', 'double_db_snatch', 
    'farmers_carry', 'yoke_carry', 'turkish_get_up', 'devil_press'
  ]);

  // Usamos map para poder injetar uma flag 'needs_review' no treino
  return treinosArray.map(treino => {
    if (!treino.movimentos || !Array.isArray(treino.movimentos)) return null;
    if (!tiposTreinoPermitidos.includes(treino.tipo_treino)) return null;

    treino.needs_review = false;

    treino.movimentos = treino.movimentos.filter(mov => {
      // 1. Se for desconhecido, MANTÉM no array, mas avisa e flagra o treino!
      if (!movimentosConhecidos.has(mov.movId)) {
        console.warn(`\n🚨 ALERTA: Movimento não mapeado [${mov.movId}]. Salvo como PENDENTE.`);
        treino.needs_review = true; 
        return true; // <- MUDANÇA AQUI: Mantém o movimento!
      }

      if (mov.extraVal && typeof mov.extraVal === 'string') {
        const extraClean = mov.extraVal.toLowerCase().trim();
        if (['cal', 'm'].includes(extraClean)) {
          mov.extraVal = extraClean;
        } else {
          // Agora permite números, ponto, vírgula e a BARRA (/)
          const stringLimpa = extraClean.replace(/[^\d.,/]/g, '');
          mov.extraVal = stringLimpa !== '' ? stringLimpa : "";
        }
      }

      const isTecnicaValida = tecnicasPermitidas.includes(mov.tecnica);
      const isFaseValida = fasesPermitidas.includes(mov.phase);
      const isCargaValida = typeof mov.cargaMasc === 'number' && typeof mov.cargaFem === 'number';
      const isRepsValida = typeof mov.reps === 'number' && !isNaN(mov.reps);

      return isTecnicaValida && isFaseValida && isCargaValida && isRepsValida;
    });

    return treino.movimentos.length > 0 ? treino : null;
  }).filter(Boolean); // Remove os nulls
}

// ============================================================================
// 4. MÓDULO DE BANCO DE DADOS
// ============================================================================
async function obterDataMaisAntigaCrossfit() {
  try {
    const { data, error } = await supabase
      .from('wod_templates')
      .select('source_url')
      .like('source_url', '%crossfit.com/%')
      .order('source_url', { ascending: true }) 
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Vazio");

    return data[0].source_url.split('/').pop(); 
  } catch (e) {
    const hoje = new Date();
    return `${String(hoje.getFullYear()).slice(-2)}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;
  }
}

function gerarLinksHistoricosCrossfit(dataBaseYYMMDD, diasParaTras = 15) {
  const links = [];
  const ano = 2000 + parseInt(dataBaseYYMMDD.substring(0, 2));
  const mes = parseInt(dataBaseYYMMDD.substring(2, 4)) - 1; 
  const dia = parseInt(dataBaseYYMMDD.substring(4, 6));
  
  let dataReferencia = new Date(ano, mes, dia);

  for (let i = 1; i <= diasParaTras; i++) {
    dataReferencia.setDate(dataReferencia.getDate() - 1);
    const yy = String(dataReferencia.getFullYear()).slice(-2);
    const mm = String(dataReferencia.getMonth() + 1).padStart(2, '0');
    const dd = String(dataReferencia.getDate()).padStart(2, '0');
    links.push(`https://www.crossfit.com/${yy}${mm}${dd}`);
  }
  return links;
}

async function salvarTreinosEmLote(treinosArray) {
  if (!treinosArray || treinosArray.length === 0) return;

  // Filtra descartando alucinações vazias
  const treinosValidos = treinosArray.filter(t => 
    t.movimentos && Array.isArray(t.movimentos) && t.movimentos.length > 0
  );

  if (treinosValidos.length === 0) {
    console.log("⚠️ IA retornou dados vazios. Lote descartado pelo filtro de segurança.");
    return;
  }

  const payload = treinosValidos.map(t => {
    const movimentosSeguros = t.movimentos.map(m => ({
      ...m,
      originalId: crypto.randomUUID(), 
      reps: m.reps || 0,
      cargaMasc: m.cargaMasc || 0,
      cargaFem: m.cargaFem || 0,
      phase: m.phase || 'round',
      tecnica: m.tecnica || 'normal',
      extraVal: m.extraVal || ""
    }));

    const nomeCompacto = gerarNomeCompacto(t.tipo_treino, t.tempo_alvo, t.rounds_prescritos, movimentosSeguros, t.url);

    // Se a IA inventou um movimento, colamos uma etiqueta de aviso no título
    if (t.needs_review) {
      nomeCompacto = `[PENDENTE] ${nomeCompacto}`;
    }

    return {
      title: nomeCompacto, 
      tipo_treino: t.tipo_treino || "FOR_TIME", 
      tempo_alvo: t.tempo_alvo || "00:00",
      rounds_prescritos: t.rounds_prescritos || 0,
      movimentos: movimentosSeguros,
      short_code: generateShortCode(),
      source_url: t.url
    };
  });

  const { error } = await supabase.from('wod_templates').insert(payload); 
    
  if (error) {
    console.error(`❌ [ERRO SUPABASE] Falha ao inserir o lote:`, error.message);
  } else {
    console.log(`💾 Lote salvo! ${payload.length} treinos no banco. (Descartados pela blindagem: ${treinosArray.length - treinosValidos.length})`);
  }
}

// ============================================================================
// 5. MÓDULO DE NAVEGAÇÃO WEB (Puppeteer com Anti-Bot)
// ============================================================================
async function extrairTextoBruto(browser, url) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await page.evaluate(() => {
      const seletoresInuteis = ['header', 'footer', 'nav', '.sidebar', '.menu', 'iframe', 'script', 'style'];
      seletoresInuteis.forEach(s => document.querySelectorAll(s).forEach(el => el.remove()));
    });
    
    const texto = await page.evaluate(() => document.body.innerText);
    const textoLimpo = texto.trim();
    
    console.log(`   └─ Preview: ${textoLimpo.substring(0, 100).replace(/\n/g, ' ')}...`);
    
    return textoLimpo;
  } catch (error) {
    console.error(`⚠️ Erro ao raspar página ${url}`);
    return null;
  } finally {
    await page.close();
  }
}

// ============================================================================
// 6. ORQUESTADOR PRINCIPAL
// ============================================================================
async function iniciarSistema() {
  console.log("🚀 Iniciando Motor de Extração Profunda em Lote (MODO DEBUG)...");
  
  const dataMaisAntiga = await obterDataMaisAntigaCrossfit();
  console.log(`🕰️ Viajando para trás a partir de: ${dataMaisAntiga}`);
  
  const urlsParaProcessar = gerarLinksHistoricosCrossfit(dataMaisAntiga, 15);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const loteParaIA = [];

  let contador = 1;
  for (const url of urlsParaProcessar) {
    console.log(`🌐 [${contador++}/${urlsParaProcessar.length}] Buscando: ${url}`);
    
    const textoBruto = await extrairTextoBruto(browser, url);
    
    const delay = Math.floor(Math.random() * 2000) + 2000;
    await new Promise(res => setTimeout(res, delay));

    if (!textoBruto) continue;

    if (textoBruto.toLowerCase().includes('rest day')) {
      console.log(`   └─ ⏸️ REST DAY. Ignorado completamente.`);
      continue;
    }

    loteParaIA.push({ url, texto: textoBruto });
  }

  await browser.close();

  if (loteParaIA.length > 0) {
    console.log(`\n🕵️ Salvando 'debug_lote.json' localmente para inspeção do HTML processado...`);
    fs.writeFileSync('debug_lote.json', JSON.stringify(loteParaIA, null, 2), 'utf-8');
    
    console.log(`\n🧠 Enviando ${loteParaIA.length} treinos para o Gemini 3.6 Flash...`);
    const treinosProcessados = await extrairTreinosEmLoteComIA(loteParaIA);
    
    if (treinosProcessados !== 'FATAL' && Array.isArray(treinosProcessados)) {
      console.log(`\n🛡️ Executando validação estrita de runtime...`);
      const treinosSeguros = validarPayloadEstrito(treinosProcessados);
      await salvarTreinosEmLote(treinosSeguros);
    } else {
      console.log("🛑 Falha fatal na IA. Nenhum treino salvo neste lote.");
    }
  }
  
  console.log("✅ Execução finalizada!");
}

iniciarSistema();