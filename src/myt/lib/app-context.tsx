import React, { createContext, useContext, useEffect, useState } from 'react';
import { Tour, Role, Lead, Booking, Room, RoomBlock, Property } from './types';
import { tours as initialTours, initialLeads, initialBookings } from './mock-data';
import { rooms as initialRooms, initialBlocks } from './properties-seed';
import { loadCommandCenterSnapshot, loadSalesSnapshot, saveCommandCenterSnapshot, saveSalesSnapshot } from '@/lib/supabase';

export type SyncStatus = 'loading' | 'saved' | 'saving' | 'offline';

interface AppState {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  blocks: RoomBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<RoomBlock[]>>;
  // User-managed properties for the Property Command Center (no seed data).
  managedProperties: Property[];
  setManagedProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  managedRooms: Room[];
  setManagedRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  commandCenterSyncStatus: SyncStatus;
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  currentMemberId: string | null;
  setCurrentMemberId: (id: string | null) => void;
  globalZoneFilter: string | null;
  setGlobalZoneFilter: (id: string | null) => void;
}

const AppContext = createContext<AppState | null>(null);

const MANAGED_PROPERTIES_KEY = 'gharpayy.myt.managed-properties.v1';
const MANAGED_ROOMS_KEY = 'gharpayy.myt.managed-rooms.v1';
const SEED_LEAD_IDS = new Set(initialLeads.map((lead) => lead.id));
const SEED_TOUR_IDS = new Set(initialTours.map((tour) => tour.id));

function readStoredList<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveStoredList<T>(key: string, value: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the in-memory inventory usable when browser storage is unavailable.
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tours, setTours] = useState<Tour[]>(initialTours);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [blocks, setBlocks] = useState<RoomBlock[]>(initialBlocks);
  const [managedProperties, setManagedProperties] = useState<Property[]>(() => readStoredList<Property>(MANAGED_PROPERTIES_KEY));
  const [managedRooms, setManagedRooms] = useState<Room[]>(() => readStoredList<Room>(MANAGED_ROOMS_KEY));
  const [currentRole, setCurrentRole] = useState<Role>('hr');
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [globalZoneFilter, setGlobalZoneFilter] = useState<string | null>(null);
  const [commandCenterHydrated, setCommandCenterHydrated] = useState(false);
  const [salesHydrated, setSalesHydrated] = useState(false);
  const [commandCenterSyncStatus, setCommandCenterSyncStatus] = useState<SyncStatus>('loading');

  useEffect(() => {
    let active = true;
    void loadCommandCenterSnapshot()
      .then((snapshot) => {
        if (!active || !snapshot) return;
        setManagedProperties(snapshot.properties);
        setManagedRooms(snapshot.rooms);
      })
      .catch((error) => {
        console.warn('Could not load Command Center from Supabase', error);
        if (active) setCommandCenterSyncStatus('offline');
      })
      .finally(() => {
        if (!active) return;
        setCommandCenterHydrated(true);
        setCommandCenterSyncStatus((status) => status === 'offline' ? status : 'saved');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void loadSalesSnapshot()
      .then((snapshot) => {
        if (!active || !snapshot) return;
        setLeads([...initialLeads, ...snapshot.leads.filter((lead) => !SEED_LEAD_IDS.has(lead.id))]);
        setTours([...initialTours, ...snapshot.tours.filter((tour) => !SEED_TOUR_IDS.has(tour.id))]);
      })
      .catch((error) => console.warn('Could not load sales data from Supabase', error))
      .finally(() => { if (active) setSalesHydrated(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    saveStoredList(MANAGED_PROPERTIES_KEY, managedProperties);
  }, [managedProperties]);

  useEffect(() => {
    saveStoredList(MANAGED_ROOMS_KEY, managedRooms);
  }, [managedRooms]);

  useEffect(() => {
    if (!commandCenterHydrated) return;
    setCommandCenterSyncStatus('saving');
    void saveCommandCenterSnapshot({ properties: managedProperties, rooms: managedRooms })
      .then(() => setCommandCenterSyncStatus('saved'))
      .catch((error) => {
        console.warn('Could not save Command Center to Supabase', error);
        setCommandCenterSyncStatus('offline');
      });
  }, [commandCenterHydrated, managedProperties, managedRooms]);

  useEffect(() => {
    if (!salesHydrated) return;
    void saveSalesSnapshot({
      leads: leads.filter((lead) => !SEED_LEAD_IDS.has(lead.id)),
      tours: tours.filter((tour) => !SEED_TOUR_IDS.has(tour.id)),
    }).catch((error) => console.warn('Could not save sales data to Supabase', error));
  }, [salesHydrated, leads, tours]);

  return (
    <AppContext.Provider value={{
      tours, setTours,
      leads, setLeads,
      bookings, setBookings,
      rooms, setRooms,
      blocks, setBlocks,
      managedProperties, setManagedProperties,
      managedRooms, setManagedRooms,
      commandCenterSyncStatus,
      currentRole, setCurrentRole,
      currentMemberId, setCurrentMemberId,
      globalZoneFilter, setGlobalZoneFilter,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
