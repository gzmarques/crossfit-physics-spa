import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
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
    authService.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user);
      else setLoadingAuth(false);
    });

    const { data: { subscription } } = authService.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await authService.signInWithGoogle();
  };

  const signOut = async () => {
    await authService.signOut();
    setUserProfile(null);
    // Para limpar corretamente a interface, retornamos ao 'me'
    setSelectedAthleteId('me');
  };

  const loadProfile = async (user: any) => {
    try {
      const data = await authService.getProfileById(user.id);
      
      setUserProfile(data);
      syncAtletaState(data);
      
      if (data.is_coach) {
        try {
          const athletes = await authService.getAthletesByCoach(user.id);
          setMyAthletes(athletes);
        } catch (e) {
          console.error('Erro ao buscar alunos:', e);
        }
      }
      
      setIsNewUser(false);
    } catch (error) {
      // Se não encontrou o perfil, é usuário novo
      setIsNewUser(true); 
      setOnboardForm(prev => ({ 
        ...prev, 
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '' 
      }));
    } finally {
      setLoadingAuth(false);
    }
  };

  const syncAtletaState = (prof: any) => {
    setAtleta({
      estatura: prof.estatura, peso: prof.peso, sexo: prof.sexo,
      nivelTecnico: prof.nivel_tecnico, envergadura: prof.envergadura,
      perna: prof.perna, bf: prof.bf, dataNascimento: prof.data_nascimento,
      usaAntropometriaAvancada: prof.usa_antropometria_avancada,
      circTorax: prof.circ_torax, circCoxa: prof.circ_coxa,
      mobilidade: prof.mobilidade, fenotipo: prof.fenotipo
    });
  };

  const saveOnboardingProfile = async () => {
    if (!session) return;
    if (!onboardForm.full_name || !onboardForm.data_nascimento) {
      alert('⚠️ Por favor, preencha seu Nome Completo e a Data de Nascimento. O motor precisa da sua idade exata para calibrar o desgaste metabólico.');
      return;
    }

    const payload = { id: session.user.id, ...onboardForm };
    try {
      await authService.createProfile(payload);
      loadProfile(session.user);
    } catch (error: any) {
      alert('Erro ao salvar perfil: ' + error.message);
    }
  };

  const linkToCoach = async () => {
    if (!session || !coachIdInput) return;
    try {
      await authService.updateCoachId(session.user.id, coachIdInput);
      alert('Coach vinculado com sucesso!');
      loadProfile(session.user);
    } catch (error) {
      alert('Erro ao vincular coach. Verifique o ID.');
    }
  };

  const salvarPerfilAtleta = async () => {
    if (!session) return;
    const targetId = selectedAthleteId === 'me' ? session.user.id : selectedAthleteId;

    const payload = {
      estatura: atleta.estatura, peso: atleta.peso, sexo: atleta.sexo,
      nivel_tecnico: atleta.nivelTecnico, envergadura: atleta.envergadura,
      perna: atleta.perna, bf: atleta.bf, data_nascimento: atleta.dataNascimento,
      usa_antropometria_avancada: atleta.usaAntropometriaAvancada || false,
      circ_torax: atleta.circTorax || null, circ_coxa: atleta.circCoxa || null,
      mobilidade: atleta.mobilidade || 100, fenotipo: atleta.fenotipo || 'normal'
    };

    try {
      await authService.updateProfile(targetId, payload);
      alert('Perfil oficial atualizado com sucesso no banco de dados!');
      
      if (targetId === session.user.id) {
        loadProfile(session.user);
      } else {
        const athletes = await authService.getAthletesByCoach(session.user.id);
        setMyAthletes(athletes);
      }
    } catch (error: any) {
      alert('Erro ao atualizar perfil oficial: ' + error.message);
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