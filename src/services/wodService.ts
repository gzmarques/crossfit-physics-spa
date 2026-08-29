import { supabase } from '../lib/supabase';
import type { WodTemplateRecord } from '../types';

export const wodService = {
  async getWodsByAthlete(athleteId: string) {
    const { data, error } = await supabase
      .from('wods')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as WodTemplateRecord[];
  },

  async getWodByShortCode(shortCode: string) {
    const { data, error } = await supabase
      .from('wod_templates')
      .select('*')
      .eq('short_code', shortCode)
      .single();
      
    if (error) throw error;
    return data;
  },

  async updateTemplate(id: string, payload: any) {
    const { error } = await supabase.from('wod_templates').update(payload).eq('id', id);
    if (error) throw error;
  },

  async createTemplate(payload: any) {
    const { data, error } = await supabase
      .from('wod_templates')
      .insert([payload])
      .select('id, short_code')
      .single();
      
    if (error) throw error;
    return data;
  },

  async updateResult(id: string, payload: any) {
    const { error } = await supabase.from('wod_results').update(payload).eq('id', id);
    if (error) throw error;
  },

  async createResult(payload: any) {
    const { data, error } = await supabase
      .from('wod_results')
      .insert([payload])
      .select('id')
      .single();
      
    if (error) throw error;
    return data;
  }
};