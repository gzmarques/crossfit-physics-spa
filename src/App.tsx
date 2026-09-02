import { useState, useEffect } from 'react';
import { wodService } from './services/wodService';
import type { WodTemplateRecord } from './types';
import html2canvas from 'html2canvas';

import { LoginScreen } from './components/auth/LoginScreen';
import { OnboardingScreen } from './components/auth/OnboardingScreen';
import { Header } from './components/layout/Header';
import { Tabs } from './components/layout/Tabs';
import { WodCatalogModal } from './components/shared/WodCatalogModal';
import { PrescricaoTab } from './components/tabs/PrescricaoTab';
import { AnaliseTab } from './components/tabs/AnaliseTab';
import { AtletaTab } from './components/tabs/AtletaTab';
import { HistoricoTab } from './components/tabs/HistoricoTab';
import { InstagramCard } from './components/export/InstagramCard';

import { useAuth } from './hooks/useAuth';
import { usePhysics } from './hooks/usePhysics';
import { useWodStore } from './store/useWodStore';

export default function App() {
  const { 
    session, loadingAuth, userProfile, isNewUser, myAthletes, selectedAthleteId, 
    coachIdInput, setCoachIdInput, atleta, setAtleta, onboardForm, setOnboardForm, 
    signInWithGoogle, signOut, saveOnboardingProfile, linkToCoach, 
    salvarPerfilAtleta, handleAthleteChange 
  } = useAuth();

  // Assina apenas os estados necessários para o salvarNoSupabase e AnaliseTab
  const { nomeTreino, tipoTreino, tempoAlvo, roundsPrescritos, lousa, setTipoTreino, setTempoAlvo, setRoundsPrescritos, setLousa, setNomeTreino } = useWodStore();

  const [activeTab, setActiveTab] = useState<'prescricao' | 'analise' | 'atleta' | 'historico'>('prescricao');
  const [roundsReal, setRoundsReal] = useState(0);
  const [tempoReal, setTempoReal] = useState('');

  // === RASTREAMENTO DO WOD ATUAL (Mantidos) ===
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [currentResultId, setCurrentResultId] = useState<string | null>(null);
  const [isScaled, setIsScaled] = useState<boolean>(false);
  const [currentShortCode, setCurrentShortCode] = useState<string | null>(null);

  const [savedWods, setSavedWods] = useState<WodTemplateRecord[]>([]);

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const {
    timelineState, setTimelineState, handleTimelineChange,
    resultado, processarWOD, temperatura, setTemperatura
  } = usePhysics({
    tipoTreino, tempoAlvo, tempoReal, roundsPrescritos, roundsReal, lousa, atleta
  });

  const gerarCardInstagram = async () => {
    const cardElement = document.getElementById('instagram-card-export');
    
    if (!cardElement) {
      alert('Erro: Card não encontrado na tela.');
      return;
    }

    try {
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#111315', 
        scale: 2, 
        useCORS: true 
      });

      const image = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.href = image;
      link.download = `DynaWOD-${currentShortCode || 'Resultado'}.jpg`;
      link.click();
      
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      alert('Ops! Não foi possível gerar a imagem.');
    }
  };

  useEffect(() => {
    if (session && userProfile && !isNewUser) fetchWodsFromSupabase();
  }, [session, userProfile, isNewUser, selectedAthleteId]);

  const fetchWodsFromSupabase = async () => {
    const queryId = selectedAthleteId === 'me' ? session?.user.id : selectedAthleteId;

    if (!queryId) return;
    
    try {
      const data = await wodService.getWodsByAthlete(queryId);
      setSavedWods(data);
    } catch (error) {
      console.error('Erro ao buscar histórico de WODs:', error);
    }
  };

  const generateShortCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const salvarNoSupabase = async (isExporting = false) => {
    if (!session || !userProfile) return null;
    
    const targetAthleteId = selectedAthleteId === 'me' ? session.user.id : selectedAthleteId;
    const newShortCode = currentShortCode || generateShortCode();

    const assinaturaHash = wodService.gerarAssinatura(tipoTreino, roundsPrescritos, lousa);

    const templatePayload = {
      title: nomeTreino.trim() !== '' ? nomeTreino : `Treino ${tipoTreino} - ${new Date().toLocaleDateString('pt-BR')}`,
      short_code: newShortCode,
      tipo_treino: tipoTreino,
      tempo_alvo: tempoAlvo,
      rounds_prescritos: roundsPrescritos,
      movimentos: lousa,
      creator_id: session.user.id,
      hash: assinaturaHash // <-- Enviando o hash para o banco
    };

    let activeTemplateId = currentTemplateId;

    try {
      if (activeTemplateId) {
        if (!isExporting && !window.confirm('Deseja sobrescrever as alterações na prescrição deste WOD?')) return null;
        await wodService.updateTemplate(activeTemplateId, templatePayload);
      } else {
        // 2. Antes de criar, verifica se a exata mesma prescrição já existe
        const templateExistente = await wodService.getTemplateByHash(assinaturaHash);
        
        if (templateExistente) {
          activeTemplateId = templateExistente.id;
          setCurrentTemplateId(templateExistente.id);
          setCurrentShortCode(templateExistente.short_code);
          
          if (!isExporting) {
            console.log('WOD idêntico encontrado no banco. Vinculando resultado ao template existente para evitar duplicidade.');
          }
        } else {
          // 3. Se não existe, cria um novo
          const data = await wodService.createTemplate(templatePayload);
          activeTemplateId = data.id;
          setCurrentTemplateId(data.id);
          setCurrentShortCode(data.short_code);
        }
      }

      const hasResult = tempoReal || roundsReal > 0 || (resultado && resultado.potenciaReal > 0);

      if (hasResult) {
        const resultPayload = {
          template_id: activeTemplateId, 
          athlete_id: targetAthleteId,
          tempo_real: tempoReal,
          rounds_real: roundsReal,
          score_watts: resultado ? resultado.potenciaReal : 0,
          score_kcal: resultado ? resultado.gastoMetabolico : 0,
          timeline: timelineState,
          cargas_adaptadas: isScaled
        };

        if (currentResultId) {
          await wodService.updateResult(currentResultId, resultPayload);
        } else {
          const data = await wodService.createResult(resultPayload);
          setCurrentResultId(data.id);
        }
      }

      if (!isExporting) alert('Dados salvos com sucesso no DynaWOD!');
      return newShortCode;

    } catch (error: any) {
      console.error('Erro ao salvar no banco:', error);
      alert('Ops! Erro ao comunicar com o banco de dados: ' + error.message);
      return null;
    }
  };

  const compartilharWod = async () => {
    const code = await salvarNoSupabase(true); 
    if (code) {
      navigator.clipboard.writeText(code);
      alert(`Código do WOD (${code}) copiado para a área de transferência! Envie para seus alunos.`);
    }
  };

  const importarWod = () => {
    setIsCatalogOpen(true);
  };

  const clonarWod = () => {
    if (!window.confirm('Deseja usar este treino como base para criar um NOVO WOD seu? O vínculo com o original será quebrado.')) return;
    
    setCurrentTemplateId(null);
    setCurrentShortCode(null);
    setCurrentResultId(null);
    
    alert('Pronto! O WOD foi desvinculado. Faça suas alterações e clique em "Salvar WOD".');
  };

  const carregarDoSupabase = (rec: any) => {
    setTipoTreino(rec.tipo_treino); 
    setTempoAlvo(rec.tempo_alvo); 
    setRoundsPrescritos(rec.rounds_prescritos);
    
    if (rec.rounds_real !== undefined) setRoundsReal(rec.rounds_real);
    if (rec.tempo_real) setTempoReal(rec.tempo_real);
    if (rec.atleta) setAtleta(rec.atleta);
    if (rec.movimentos) setLousa(rec.movimentos);
    if (rec.timeline) setTimelineState(rec.timeline);
    
    setCurrentTemplateId(rec.id);
    setCurrentShortCode(rec.short_code);
    
    setActiveTab('prescricao');

    if (rec.title && !rec.title.startsWith('Treino')) setNomeTreino(rec.title);
    else setNomeTreino('');
  };

  if (loadingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-dark)' }}>
        <img 
          src="/loading.gif" 
          alt="Esquentando o motor biomecânico..." 
          style={{ width: '100%', maxWidth: '160px', height: 'auto', objectFit: 'contain' }} 
        />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onSignIn={signInWithGoogle} />;
  }

  if (isNewUser) {
    return (
      <OnboardingScreen 
        form={onboardForm} 
        setForm={setOnboardForm} 
        onSave={saveOnboardingProfile} 
        onSignOut={signOut} 
      />
    );
  }

  return (
    <div className="container" style={{ padding: 0, maxWidth: '1200px', margin: '0 auto' }}> 
      
      <Header 
        userProfile={userProfile}
        selectedAthleteId={selectedAthleteId}
        myAthletes={myAthletes}
        onAthleteChange={handleAthleteChange}
        onSignOut={signOut}
      />

      <div style={{ padding: '0 24px' }}>
        
        <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === 'prescricao' && (
          <PrescricaoTab 
            currentShortCode={currentShortCode}
            currentTemplateId={currentTemplateId}
            importarWod={importarWod}
            compartilharWod={compartilharWod}
            clonarWod={clonarWod}
            salvarNoSupabase={salvarNoSupabase}
            carregarDoSupabase={carregarDoSupabase}
          />
        )}

        {activeTab === 'analise' && (
          <AnaliseTab
            tipoTreino={tipoTreino}
            tempoReal={tempoReal}
            setTempoReal={setTempoReal}
            roundsReal={roundsReal}
            setRoundsReal={setRoundsReal}
            isScaled={isScaled}
            setIsScaled={setIsScaled}
            lousa={lousa}
            timelineState={timelineState}
            handleTimelineChange={handleTimelineChange}
            processarWOD={processarWOD}
            resultado={resultado}
            gerarCardInstagram={gerarCardInstagram}
            roundsPrescritos={roundsPrescritos}
            temperatura={temperatura}
            setTemperatura={setTemperatura}
          />
        )}

        {activeTab === 'atleta' && (
          <AtletaTab
            selectedAthleteId={selectedAthleteId}
            atleta={atleta}
            setAtleta={setAtleta}
            salvarPerfilAtleta={salvarPerfilAtleta}
          />
        )}

        {activeTab === 'historico' && (
          <HistoricoTab
            selectedAthleteId={selectedAthleteId}
            userProfile={userProfile}
            sessionId={session?.user?.id}
            coachIdInput={coachIdInput}
            setCoachIdInput={setCoachIdInput}
            linkToCoach={linkToCoach}
            savedWods={savedWods}
            carregarDoSupabase={carregarDoSupabase}
          />
        )}
      
      </div> 

      <InstagramCard 
        tipoTreino={tipoTreino}
        tempoAlvo={tempoAlvo}
        roundsPrescritos={roundsPrescritos}
        lousaCount={lousa.length}
        tempoReal={tempoReal}
        isScaled={isScaled}
        resultado={resultado}
      />

      <WodCatalogModal 
        isOpen={isCatalogOpen} 
        onClose={() => setIsCatalogOpen(false)} 
        onSelectWod={carregarDoSupabase} 
      />
      
    </div>
  );
}