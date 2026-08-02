import { createClient } from '@supabase/supabase-js';
import type { Lead, Property, Room, Tour } from '@/myt/lib/types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export interface CommandCenterSnapshot {
  properties: Property[];
  rooms: Room[];
}

export interface SalesSnapshot {
  leads: Lead[];
  tours: Tour[];
}

async function userId(): Promise<string | null> {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user.id) return sessionData.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user?.id ?? null;
}

export async function loadCommandCenterSnapshot(): Promise<CommandCenterSnapshot | null> {
  const id = await userId();
  if (!supabase || !id) return null;

  const { data, error } = await supabase
    .from('myt_command_center_states')
    .select('properties, rooms')
    .eq('user_id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    properties: Array.isArray(data.properties) ? data.properties as Property[] : [],
    rooms: Array.isArray(data.rooms) ? data.rooms as Room[] : [],
  };
}

export async function saveCommandCenterSnapshot(snapshot: CommandCenterSnapshot) {
  const id = await userId();
  if (!supabase || !id) return;

  const { error } = await supabase.from('myt_command_center_states').upsert({
    user_id: id,
    properties: snapshot.properties,
    rooms: snapshot.rooms,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function loadSalesSnapshot(): Promise<SalesSnapshot | null> {
  const id = await userId();
  if (!supabase || !id) return null;

  const { data, error } = await supabase
    .from('myt_sales_states')
    .select('leads, tours')
    .eq('user_id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    leads: Array.isArray(data.leads) ? data.leads as Lead[] : [],
    tours: Array.isArray(data.tours) ? data.tours as Tour[] : [],
  };
}

export async function saveSalesSnapshot(snapshot: SalesSnapshot) {
  const id = await userId();
  if (!supabase || !id) return;

  const { error } = await supabase.from('myt_sales_states').upsert({
    user_id: id,
    leads: snapshot.leads,
    tours: snapshot.tours,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
