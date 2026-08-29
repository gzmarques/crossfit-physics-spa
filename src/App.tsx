import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import type { Modalidade, WodTemplateRecord } from './types';
import html2canvas from 'html2canvas';

import { LoginScreen } from './components/auth/LoginScreen';
import { OnboardingScreen } from './components/auth/OnboardingScreen';
import { Header } from './components/layout/Header';
import { Tabs } from './components/layout/Tabs';
import { PrescricaoTab } from './components/tabs/PrescricaoTab';
import { AnaliseTab } from './components/tabs/AnaliseTab';
import { AtletaTab } from './components/tabs/AtletaTab';
import { HistoricoTab } from './components/tabs/HistoricoTab';
import { InstagramCard } from './components/export/InstagramCard';

import { useAuth } from './hooks/useAuth';
import { useWodBuilder } from './hooks/useWodBuilder';
import { usePhysics } from './hooks/usePhysics';

export default function App() {
  const { 
    session, loadingAuth, userProfile, isNewUser, myAthletes, selectedAthleteId, 
    coachIdInput, setCoachIdInput, atleta, setAtleta, onboardForm, setOnboardForm, 
    signInWithGoogle, signOut, saveOnboardingProfile, linkToCoach, 
    salvarPerfilAtleta, handleAthleteChange 
  } = useAuth();

  const { 
    lousa, setLousa, addMovimento, removeMovimento, updateMovimento, 
    handleDragStart, handleDragEnter, handleDragEnd 
  } = useWodBuilder();

  // === ESTADOS DO MOTOR (Mantidos) ===
  const [activeTab, setActiveTab] = useState<'prescricao' | 'analise' | 'atleta' | 'historico'>('prescricao');
  const [tipoTreino, setTipoTreino] = useState<Modalidade>('FOR_TIME');
  const [tempoAlvo, setTempoAlvo] = useState('05:00');
  const [roundsPrescritos, setRoundsPrescritos] = useState(3);
  const [roundsReal, setRoundsReal] = useState(0);
  const [tempoReal, setTempoReal] = useState('');
  const [nomeTreino, setNomeTreino] = useState('');

  // === RASTREAMENTO DO WOD ATUAL (Mantidos) ===
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [currentResultId, setCurrentResultId] = useState<string | null>(null);
  const [isScaled, setIsScaled] = useState<boolean>(false);
  const [currentShortCode, setCurrentShortCode] = useState<string | null>(null);

  const [savedWods, setSavedWods] = useState<WodTemplateRecord[]>([]);

  const {
    timelineState, setTimelineState, handleTimelineChange,
    resultado, processarWOD
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
    
    const { data, error } = await supabase.from('wods').select('*').eq('athlete_id', queryId).order('created_at', { ascending: false });
    if (!error && data) setSavedWods(data as WodTemplateRecord[]);
  };

  const generateShortCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const salvarNoSupabase = async (isExporting = false) => {
    if (!session || !userProfile) return null;
    
    const targetAthleteId = selectedAthleteId === 'me' ? session.user.id : selectedAthleteId;
    const newShortCode = currentShortCode || generateShortCode();

    const templatePayload = {
      title: nomeTreino.trim() !== '' ? nomeTreino : `Treino ${tipoTreino} - ${new Date().toLocaleDateString('pt-BR')}`,
      short_code: newShortCode,
      tipo_treino: tipoTreino,
      tempo_alvo: tempoAlvo,
      rounds_prescritos: roundsPrescritos,
      movimentos: lousa,
      creator_id: session.user.id
    };

    let activeTemplateId = currentTemplateId;

    if (activeTemplateId) {
      if (!isExporting && !window.confirm('Deseja sobrescrever as alterações na prescrição deste WOD?')) return null;
      
      const { error } = await supabase.from('wod_templates').update(templatePayload).eq('id', activeTemplateId);
      if (error) { alert('Erro ao atualizar Template: ' + error.message); return null; }
    } else {
      const { data, error } = await supabase.from('wod_templates').insert([templatePayload]).select('id, short_code').single();
      if (error) { alert('Erro ao criar Template: ' + error.message); return null; }
      
      activeTemplateId = data.id;
      setCurrentTemplateId(data.id);
      setCurrentShortCode(data.short_code);
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
        const { error } = await supabase.from('wod_results').update(resultPayload).eq('id', currentResultId);
        if (error) console.error('Erro ao atualizar resultado:', error);
      } else {
        const { data, error } = await supabase.from('wod_results').insert([resultPayload]).select('id').single();
        if (error) {
          console.error('Erro ao salvar resultado:', error);
        } else {
          setCurrentResultId(data.id);
        }
      }
    }

    if (!isExporting) alert('Dados salvos com sucesso no DynaWOD!');
    
    return newShortCode;
  };

  const compartilharWod = async () => {
    const code = await salvarNoSupabase(true); 
    if (code) {
      navigator.clipboard.writeText(code);
      alert(`Código do WOD (${code}) copiado para a área de transferência! Envie para seus alunos.`);
    }
  };

  const importarWod = async () => {
    const codeToFind = window.prompt('Digite o código de 6 dígitos do WOD:');
    if (!codeToFind) return;

    const { data, error } = await supabase.from('wod_templates').select('*').eq('short_code', codeToFind.toUpperCase()).single();
    
    if (error || !data) {
      alert('WOD não encontrado. Verifique o código.');
      return;
    }

    carregarDoSupabase(data);
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
            nomeTreino={nomeTreino}
            setNomeTreino={setNomeTreino}
            tipoTreino={tipoTreino}
            setTipoTreino={setTipoTreino}
            tempoAlvo={tempoAlvo}
            setTempoAlvo={setTempoAlvo}
            roundsPrescritos={roundsPrescritos}
            setRoundsPrescritos={setRoundsPrescritos}
            lousa={lousa}
            addMovimento={addMovimento}
            removeMovimento={removeMovimento}
            updateMovimento={updateMovimento}
            handleDragStart={handleDragStart}
            handleDragEnter={handleDragEnter}
            handleDragEnd={handleDragEnd}
            currentShortCode={currentShortCode}
            currentTemplateId={currentTemplateId}
            importarWod={importarWod}
            compartilharWod={compartilharWod}
            clonarWod={clonarWod}
            salvarNoSupabase={salvarNoSupabase}
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
      
    </div>
  );
}