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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Chave com poderes totais
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================================================
// 2. MÓDULO DE INTELIGÊNCIA ARTIFICIAL (Gemini)
// ============================================================================
async function extrairTreinoComIA(textoBruto) {
  const prompt = `Extraia o treino de CrossFit deste texto. Retorne os dados estritamente no formato JSON exigido. Texto: ${textoBruto}`;
  
  let tentativas = 0;
  while (tentativas < 3) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash', // Ou o modelo que você está usando
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titulo: { type: Type.STRING },
              descricao: { type: Type.STRING },
              tipo: { type: Type.STRING },
            },
            required: ['titulo', 'descricao', 'tipo'],
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
        // O Kill Switch: Retorna 'FATAL' para o orquestrador abortar o lote e proteger a cota
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
    .order('source_url', { ascending: true }) // Busca o link mais antigo
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

  // Extrai o YYMMDD da coluna source_url
  return data[0].source_url.split('/').pop(); 
}

function gerarLinksHistoricosCrossfit(dataBaseYYMMDD, diasParaTras = 10) {
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

async function salvarTreino(treinoData, url) {
  const { error } = await supabase
    .from('wod_templates') // Nome correto da tabela
    .insert([{ ...treinoData, source_url: url }]); // Mapeia a URL para a coluna correta
    
  if (error) {
    console.error(`❌ Erro ao salvar no banco:`, error.message);
  } else {
    console.log(`💾 Treino salvo com sucesso! URL: ${url}`);
  }
}

// ============================================================================
// 4. MÓDULO DE NAVEGAÇÃO WEB (Puppeteer)
// ============================================================================
async function extrairTextoBruto(url) {
  // Argumentos essenciais para rodar liso no servidor Linux do GitHub Actions
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Remove cabeçalhos, rodapés e menus para não sujar o texto da IA
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
    await browser.close();
  }
}

// ============================================================================
// 5. ORQUESTADOR PRINCIPAL (O Motor do Bot)
// ============================================================================
async function iniciarSistema() {
  console.log("🚀 Iniciando motor de Scraping Histórico do CrossFit.com...");
  
  // 1. Consulta o passado
  const dataMaisAntiga = await obterDataMaisAntigaCrossfit();
  console.log(`🕰️ Treino mais antigo no banco é de: ${dataMaisAntiga}. Viajando para trás...`);
  
  // 2. Gera 10 links inéditos do passado (sem usar cota de navegação)
  const urlsParaProcessar = gerarLinksHistoricosCrossfit(dataMaisAntiga, 10);
  console.log(`🎯 Processando ${urlsParaProcessar.length} links no formato Máquina do Tempo.`);

  let contador = 1;
  for (const url of urlsParaProcessar) {
    console.log(`--------------------------------------------------`);
    console.log(`Processing [${contador++}/${urlsParaProcessar.length}]`);
    console.log(`🌐 Buscando texto da página: ${url}`);
    
    // 3. Raspagem da página
    const textoBruto = await extrairTextoBruto(url);
    if (!textoBruto) continue;

    // 4. 🛡️ Trava do Rest Day: Impede que lixo consuma a cota do Gemini
    if (textoBruto.toLowerCase().includes('rest day')) {
      console.log(`⏸️ REST DAY detectado. Ignorando a IA e poupando cota.`);
      // Salva no banco imediatamente como Rest Day para não tentar raspar de novo no futuro
      await salvarTreino({ titulo: "Rest Day", descricao: "Rest Day", tipo: "Rest" }, url); 
      continue;
    }

    // 5. Envia texto limpo para o Gemini
    const treinoData = await extrairTreinoComIA(textoBruto);
    
    // 6. 🛑 Kill Switch: Aborta o lote inteiro se a cota do Google estourar
    if (treinoData === 'FATAL') {
      console.log("🛑 Kill Switch ativado por limite de API. Encerrando lote atual.");
      break; 
    }
    
    // 7. Salva o treino real no banco
    if (treinoData) {
      await salvarTreino(treinoData, url);
    }
  }
  
  console.log("✅ Lote finalizado com sucesso!");
}

// Dispara o script
iniciarSistema();