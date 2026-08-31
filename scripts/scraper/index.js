import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';

// Se o arquivo local existir (na sua máquina), ele usa. Se não (no GitHub), ignora.
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

// ============================================================================
// 1. CONFIGURAÇÕES INICIAIS (Supabase e Gemini)
// ============================================================================
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================================================
// 2. MÓDULO DE INTELIGÊNCIA ARTIFICIAL (Processamento em Lote)
// ============================================================================
async function extrairTreinosEmLoteComIA(loteBruto) {
  // Passamos o array JSON diretamente no prompt para o Gemini
  const prompt = `Extraia os treinos de CrossFit da seguinte lista de textos de páginas web. 
  Retorne estritamente um ARRAY de objetos JSON. 
  Para cada treino identificado, mantenha o valor exato da propriedade 'url' correspondente ao texto analisado.
  Lista de textos brutos: ${JSON.stringify(loteBruto)}`;
  
  let tentativas = 0;
  while (tentativas < 3) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          // O Schema foi alterado de OBJECT para ARRAY de objetos para forçar a formatação em lote
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                url: { type: Type.STRING },
                titulo: { type: Type.STRING },
                descricao: { type: Type.STRING },
                tipo: { type: Type.STRING },
              },
              required: ['url', 'titulo', 'descricao', 'tipo'],
            }
          },
        }
      });
      
      const textoResposta = response.text();
      return JSON.parse(textoResposta);
      
    } catch (error) {
      tentativas++;
      console.error(`⚠️ API congestionada ou erro. Tentativa ${tentativas}/3. Aguardando 15s...`);
      await new Promise(res => setTimeout(res, 15000));
      
      if (tentativas >= 3) {
        console.error(`❌ Falha fatal na API do Gemini após 3 tentativas:`, error.message);
        return 'FATAL';
      }
    }
  }
}

// ============================================================================
// 3. MÓDULO DE BANCO DE DADOS E GERAÇÃO DE LINKS (Backfilling)
// ============================================================================
async function obterDataMaisAntigaCrossfit() {
  const { data, error } = await supabase
    .from('wod_templates')
    .select('source_url')
    .like('source_url', '%crossfit.com/%')
    .order('source_url', { ascending: true }) 
    .limit(1);

  if (error || !data || data.length === 0) {
    if (error) console.error("⚠️ Erro ao consultar o banco:", error.message);
    else console.log("⚠️ Nenhum treino do CrossFit achado no banco. Começando de hoje.");
    
    const hoje = new Date();
    const yy = String(hoje.getFullYear()).slice(-2);
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`; 
  }

  return data[0].source_url.split('/').pop(); 
}

function gerarLinksHistoricosCrossfit(dataBaseYYMMDD, diasParaTras = 30) {
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

// Transformado em um bulk insert para disparar apenas 1 requisição ao Supabase
async function salvarTreinosEmLote(treinosArray) {
  if (!treinosArray || treinosArray.length === 0) return;

  // Formata o array vindo do Gemini (ou do filtro de Rest Day) para as colunas exatas do banco
  const payload = treinosArray.map(t => ({
    titulo: t.titulo, 
    descricao: t.descricao, 
    tipo: t.tipo,
    source_url: t.url
  }));

  const { error } = await supabase
    .from('wod_templates') 
    .insert(payload); 
    
  if (error) {
    console.error(`❌ Erro ao salvar o lote no banco:`, error.message);
  } else {
    console.log(`💾 Lote de ${payload.length} treinos salvo com sucesso!`);
  }
}

// ============================================================================
// 4. MÓDULO DE NAVEGAÇÃO WEB (Puppeteer - Refatorado para performance)
// ============================================================================
// Recebe a instância do navegador pronta para evitar abrir e fechar o Chromium a cada loop
async function extrairTextoBruto(browser, url) {
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    await page.evaluate(() => {
      const seletoresInuteis = ['header', 'footer', 'nav', '.sidebar', '.menu'];
      seletoresInuteis.forEach(seletor => {
        document.querySelectorAll(seletor).forEach(el => el.remove());
      });
    });
    
    const texto = await page.evaluate(() => document.body.innerText);
    return texto.trim();
  } catch (error) {
    console.error(`⚠️ Erro ao raspar página ${url}:`, error.message);
    return null;
  } finally {
    await page.close(); // Fecha apenas a aba para não estourar a memória RAM da máquina virtual
  }
}

// ============================================================================
// 5. ORQUESTADOR PRINCIPAL (Otimizado para Bulk Processing)
// ============================================================================
async function iniciarSistema() {
  console.log("🚀 Iniciando motor de Scraping Histórico (Modo Lote)...");
  
  const dataMaisAntiga = await obterDataMaisAntigaCrossfit();
  console.log(`🕰️ Treino mais antigo no banco é de: ${dataMaisAntiga}. Viajando para trás...`);
  
  // Alterado de 10 para 30 dias por lote para maximizar o uso da cota da IA
  const urlsParaProcessar = gerarLinksHistoricosCrossfit(dataMaisAntiga, 30);
  console.log(`🎯 Processando ${urlsParaProcessar.length} links no formato Máquina do Tempo.`);

  // Inicializa o Puppeteer UMA ÚNICA VEZ para todo o lote
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const loteParaIA = [];
  const loteParaBanco = [];

  let contador = 1;
  for (const url of urlsParaProcessar) {
    console.log(`🌐 [${contador++}/${urlsParaProcessar.length}] Buscando texto: ${url}`);
    
    const textoBruto = await extrairTextoBruto(browser, url);
    if (!textoBruto) continue;

    if (textoBruto.toLowerCase().includes('rest day')) {
      console.log(`⏸️ REST DAY detectado. Separando para bulk insert direto.`);
      loteParaBanco.push({ url, titulo: "Rest Day", descricao: "Rest Day", tipo: "Rest" });
    } else {
      // Guarda URL e o Texto para enviar tudo mastigado para a IA de uma vez
      loteParaIA.push({ url, texto: textoBruto });
    }
  }

  // Derruba o navegador para liberar memória RAM antes de chamar a IA
  await browser.close();

  console.log(`\n🧠 Enviando um lote único de ${loteParaIA.length} treinos para o Gemini processar...`);
  
  if (loteParaIA.length > 0) {
    const treinosProcessados = await extrairTreinosEmLoteComIA(loteParaIA);
    
    if (treinosProcessados === 'FATAL') {
      console.log("🛑 Kill Switch ativado por limite de API. O lote não foi convertido.");
    } else {
      // Junta os treinos processados pela IA com os Rest Days que foram interceptados
      loteParaBanco.push(...treinosProcessados);
    }
  }
  
  if (loteParaBanco.length > 0) {
    console.log(`\n💾 Disparando Bulk Insert para o Supabase...`);
    await salvarTreinosEmLote(loteParaBanco);
  } else {
    console.log("⚠️ Não sobrou nenhum dado para salvar neste lote.");
  }
  
  console.log("✅ Execução finalizada!");
}

// Dispara o script
iniciarSistema();