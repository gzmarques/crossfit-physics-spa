import fs from 'fs';
import path from 'path';

// CONFIGURAÇÕES
const PASTA_PROJETO = '.'; 
const ARQUIVO_SAIDA = 'codigo_consolidado.txt';

const EXTENSOES_PERMITIDAS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.html', '.css', 
  '.json', '.md', '.yml', '.yaml', '.env', '.local'
]);

const IGNORAR_PASTAS = new Set([
  'node_modules', '.git', '.venv', 'venv', 'env', 
  '__pycache__', 'dist', 'build', '.next', '.idea', '.vscode', 'coverage'
]);

const IGNORAR_ARQUIVOS = new Set([
  ARQUIVO_SAIDA, 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store'
]);

let contadorArquivos = 0;

function andarPorPastas(diretorio, listaArquivos = []) {
  const arquivos = fs.readdirSync(diretorio);

  for (const arquivo of arquivos) {
    const caminhoCompleto = path.join(diretorio, arquivo);
    const estatisticas = fs.statSync(caminhoCompleto);

    if (estatisticas.isDirectory()) {
      if (!IGNORAR_PASTAS.has(arquivo)) {
        andarPorPastas(caminhoCompleto, listaArquivos);
      }
    } else {
      const extensao = path.extname(arquivo).toLowerCase();
      const nomeOuExtensao = extensao || arquivo; 
      
      if ((EXTENSOES_PERMITIDAS.has(extensao) || EXTENSOES_PERMITIDAS.has(nomeOuExtensao)) && !IGNORAR_ARQUIVOS.has(arquivo)) {
        listaArquivos.push(caminhoCompleto);
      }
    }
  }
  return listaArquivos;
}

function consolidarCodigo() {
  console.log(`🔍 Analisando arquivos em: ${path.resolve(PASTA_PROJETO)}`);
  
  try {
    const todosArquivos = andarPorPastas(PASTA_PROJETO);
    const fluxoSaida = fs.createWriteStream(ARQUIVO_SAIDA, { encoding: 'utf8' });

    fluxoSaida.write("==================================================\n");
    fluxoSaida.write("ESTRUTURA COMPLETA DO PROJETO E CÓDIGOS-FONTE\n");
    fluxoSaida.write("==================================================\n\n");
    
    fluxoSaida.write("--- ESTRUTURA DE ARQUIVOS ---\n");
    for (const arquivo of todosArquivos) {
      const caminhoRelativo = path.relative(PASTA_PROJETO, arquivo);
      fluxoSaida.write(`[ARQUIVO] ${caminhoRelativo}\n`);
    }

    fluxoSaida.write("\n==================================================\n");
    fluxoSaida.write("CONTEÚDO DOS ARQUIVOS\n");
    fluxoSaida.write("==================================================\n\n");

    for (const arquivo of todosArquivos) {
      const caminhoRelativo = path.relative(PASTA_PROJETO, arquivo);
      
      try {
        const conteudo = fs.readFileSync(arquivo, 'utf8');
        fluxoSaida.write(`--- INÍCIO DO ARQUIVO: ${caminhoRelativo} ---\n`);
        
        // Separa o conteúdo original em um array de linhas
        const linhas = conteudo.split(/\r?\n/);
        
        // Define um tamanho fixo baseado na quantidade de linhas para alinhar os números à direita
        const padding = Math.max(3, String(linhas.length).length);
        
        linhas.forEach((linha, index) => {
          const numeroLinha = String(index + 1).padStart(padding, ' ');
          fluxoSaida.write(`${numeroLinha} | ${linha}\n`);
        });

        fluxoSaida.write(`\n--- FIM DO ARQUIVO: ${caminhoRelativo} ---\n\n`);
        fluxoSaida.write("=".repeat(40) + "\n\n");
        
        console.log(`✅ Incluído: ${caminhoRelativo}`);
        contadorArquivos++;
      } catch (erroLeitura) {
        console.log(`❌ Erro ao ler ${caminhoRelativo}: ${erroLeitura.message}`);
      }
    }

    fluxoSaida.end();
    console.log(`\n🎉 Concluído! ${contadorArquivos} arquivos consolidados em: ${ARQUIVO_SAIDA}`);

  } catch (erro) {
    console.error(`❌ Ocorreu um erro geral: ${erro.message}`);
  }
}

consolidarCodigo();