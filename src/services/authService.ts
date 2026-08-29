import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types';

export const authService = {
  // --- MÉTODOS DE AUTENTICAÇÃO ---
  async getSession() {
    return supabase.auth.getSession();
  },
  
  onAuthStateChange(callback: (event: any, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
  
  async signInWithGoogle() {
    return supabase.auth.signInWithOAuth({ 
      provider: 'google', 
      options: { redirectTo: window.location.origin } 
    });
  },
  
  async signOut() {
    return supabase.auth.signOut();
  },

  // --- MÉTODOS DE PERFIL (PROFILES) ---
  async getProfileById(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    return data as UserProfile;
  },

  async getAthletesByCoach(coachId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('coach_id', coachId);
      
    if (error) throw error;
    return data as UserProfile[];
  },

  async createProfile(payload: any) {
    const { error } = await supabase.from('profiles').insert([payload]);
    if (error) throw error;
  },

  async updateCoachId(userId: string, coachId: string) {
    const { error } = await supabase.from('profiles').update({ coach_id: coachId }).eq('id', userId);
    if (error) throw error;
  },

  async updateProfile(userId: string, payload: any) {
    const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
    if (error) throw error;
  }
};