import { useEffect } from 'react';
import { supabase } from '../services/supabase';

// Fires when a new attack/detection event is recorded on-chain.
export function useRealtimeAttacks(callback) {
  useEffect(() => {
    const channel = supabase
      .channel('attack-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attack_events' }, payload => {
        callback?.(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [callback]);
}

// Fires when a node changes state (trust update / isolation).
export function useRealtimeNodes(callback) {
  useEffect(() => {
    const channel = supabase
      .channel('node-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sensor_nodes' }, payload => {
        callback?.(payload.new, payload.eventType);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [callback]);
}

// Fires when a new ledger block is sealed.
export function useRealtimeLedger(callback) {
  useEffect(() => {
    const channel = supabase
      .channel('ledger-blocks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ledger_blocks' }, payload => {
        callback?.(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [callback]);
}
