import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile, AtletaPerfil } from '../types';

export function useAuth() {
  // === AUTENTICAÇÃO E PERFIL ===
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  
  // === GESTÃO DE COACH E ATLETAS ===
  const [myAthletes, setMyAthletes] = useState<UserProfile[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('me');
  const [coachIdInput, setCoachIdInput] = useState('');

  const [atleta, setAtleta] = useState<AtletaPerfil>({
    estatura: 1.75, peso: 80, sexo: 'M', nivelTecnico: 'intermediario', envergadura: 1.75, perna: 0.85, bf: 15
  });

  const [onboardForm, setOnboardForm] = useState({
    full_name: '', apelido: '', is_coach: false, estatura: 1.75, peso: 80, sexo: 'M', 
    nivel_tecnico: 'intermediario', envergadura: 1.75, perna: 0.85, bf: 15, data_nascimento: ''
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user);
      else setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
    // Para limpar corretamente a interface, retornamos ao 'me'
    setSelectedAthleteId('me');
  };

  const loadProfile = async (user: any) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    
    if (error || !data) {
      setIsNewUser(true); 
      setOnboardForm(prev => ({ 
        ...prev, 
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '' 
      }));
      setLoadingAuth(false);
      return;
    }

    setUserProfile(data as UserProfile);
    syncAtletaState(data);
    
    if (data.is_coach) {
      const { data: athletes } = await supabase.from('profiles').select('*').eq('coach_id', user.id);
      if (athletes) setMyAthletes(athletes as UserProfile[]);
    }
    
    setIsNewUser(false);
    setLoadingAuth(false);
  };

  const syncAtletaState = (prof: any) => {
    setAtleta({
      estatura: prof.estatura, peso: prof.peso, sexo: prof.sexo,
      nivelTecnico: prof.nivel_tecnico, envergadura: prof.envergadura,
      perna: prof.perna, bf: prof.bf, dataNascimento: prof.data_nascimento
    });
  };

  const saveOnboardingProfile = async () => {
    if (!session) return;
    if (!onboardForm.full_name || !onboardForm.data_nascimento) {
      alert('⚠️ Por favor, preencha seu Nome Completo e a Data de Nascimento. O motor precisa da sua idade exata para calibrar o desgaste metabólico.');
      return;
    }

    const payload = { id: session.user.id, ...onboardForm };
    const { error } = await supabase.from('profiles').insert([payload]);
    
    if (error) alert('Erro ao salvar perfil: ' + error.message);
    else loadProfile(session.user);
  };

  const linkToCoach = async () => {
    if (!session || !coachIdInput) return;
    const { error } = await supabase.from('profiles').update({ coach_id: coachIdInput }).eq('id', session.user.id);
    if (error) alert('Erro ao vincular coach. Verifique o ID.');
    else { alert('Coach vinculado com sucesso!'); loadProfile(session.user); }
  };

  const salvarPerfilAtleta = async () => {
    if (!session) return;
    
    const targetId = selectedAthleteId === 'me' ? session.user.id : selectedAthleteId;
    const payload = {
      estatura: atleta.estatura, peso: atleta.peso, sexo: atleta.sexo,
      nivel_tecnico: atleta.nivelTecnico, envergadura: atleta.envergadura,
      perna: atleta.perna, bf: atleta.bf, data_nascimento: atleta.dataNascimento
    };

    const { error } = await supabase.from('profiles').update(payload).eq('id', targetId);

    if (error) {
      alert('Erro ao atualizar perfil oficial: ' + error.message);
    } else {
      alert('Perfil oficial atualizado com sucesso no banco de dados!');
      if (targetId === session.user.id) {
        loadProfile(session.user);
      } else {
        supabase.from('profiles').select('*').eq('coach_id', session.user.id)
          .then(({ data }) => { if (data) setMyAthletes(data as UserProfile[]); });
      }
    }
  };

  const handleAthleteChange = (targetId: string) => {
    setSelectedAthleteId(targetId);
    if (targetId === 'me' && userProfile) {
      syncAtletaState(userProfile);
    } else {
      const athlete = myAthletes.find(a => a.id === targetId);
      if (athlete) syncAtletaState(athlete);
    }
  };

  // Retornamos tudo que o App.tsx vai precisar
  return {
    session, loadingAuth, userProfile, isNewUser,
    myAthletes, selectedAthleteId, coachIdInput, setCoachIdInput,
    atleta, setAtleta, onboardForm, setOnboardForm,
    signInWithGoogle, signOut, saveOnboardingProfile,
    linkToCoach, salvarPerfilAtleta, handleAthleteChange
  };
}