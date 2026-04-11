import { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { loadConfig, loadConfigFromServer, saveSection, resetConfig } from '../services/systemConfigService';
import { supabase } from '../lib/supabase';
import { setConfigStages } from '../pages/crm/contacts/constants';

const SystemConfigContext = createContext(null);

export function SystemConfigProvider({ children }) {
  const [config, setConfig] = useState(() => {
    const c = loadConfig();
    if (c.pipelineStages) setConfigStages(c.pipelineStages);
    return c;
  });

  const reloadConfig = useCallback(() => {
    const c = loadConfig();
    if (c.pipelineStages) setConfigStages(c.pipelineStages);
    setConfig(c);
  }, []);

  // Reload from Supabase (used when realtime change detected from another user)
  const reloadFromServer = useCallback(async () => {
    try {
      const serverConfig = await loadConfigFromServer();
      if (serverConfig.pipelineStages) setConfigStages(serverConfig.pipelineStages);
      setConfig(serverConfig);
    } catch {
      reloadConfig(); // fallback to localStorage
    }
  }, [reloadConfig]);

  const updateSection = async (key, data) => {
    saveSection(key, data);
    reloadConfig();
    // Force reload from server after a short delay to confirm save
    setTimeout(() => reloadFromServer(), 1500);
  };

  const resetToDefaults = () => {
    resetConfig();
    reloadConfig();
  };

  // Load from Supabase on mount
  useEffect(() => { reloadFromServer(); }, [reloadFromServer]);

  // Subscribe to realtime changes on the system_config table
  useEffect(() => {
    const channel = supabase
      .channel('system_config_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_config' }, () => {
        reloadFromServer();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [reloadFromServer]);

  // Helper functions for backward compatibility
  const getType = (key) => (config.contactTypes || []).find(t => t.key === key);
  const getSourceLabel = (key, isRTL) => {
    const s = (config.sources || []).find(src => src.key === key);
    return s ? (isRTL ? s.label_ar : s.label_en) : key;
  };
  const getDeptStages = (dept) => config.pipelineStages[dept] || [];
  const getDeptLabel = (key, isRTL) => {
    const d = (config.departments || []).find(dep => dep.key === key);
    return d ? (isRTL ? d.label_ar : d.label_en) : key;
  };

  // Build TYPE-compatible map for backward compat
  const typeMap = useMemo(() => {
    const m = {};
    (config.contactTypes || []).forEach(t => {
      m[t.key] = { label: t.label_ar, labelEn: t.label_en, color: t.color, bg: t.bg };
    });
    return m;
  }, [config.contactTypes]);

  const sourceLabels = useMemo(() => {
    const ar = {}, en = {}, platform = {};
    (config.sources || []).forEach(s => {
      ar[s.key] = s.label_ar;
      en[s.key] = s.label_en;
      platform[s.key] = s.platform;
    });
    return { ar, en, platform };
  }, [config.sources]);

  return (
    <SystemConfigContext.Provider value={{
      config,
      updateSection,
      resetToDefaults,
      contactTypes: config.contactTypes || [],
      sources: config.sources || [],
      departments: config.departments || [],
      pipelineStages: config.pipelineStages || {},
      companyInfo: config.companyInfo || {},
      lostReasons: config.lostReasons || [],
      activityTypes: config.activityTypes || [],
      activityResults: config.activityResults || {},
      contactsSettings: config.contactsSettings || { mergeLimit: 2, maxPins: 5, inactiveDays: 5 },
      drawerFields: config.drawerFields || {},
      stageWinRates: config.stageWinRates || {},
      getType,
      getSourceLabel,
      getDeptStages,
      getDeptLabel,
      typeMap,
      sourceLabels,
    }}>
      {children}
    </SystemConfigContext.Provider>
  );
}

export const useSystemConfig = () => {
  const ctx = useContext(SystemConfigContext);
  if (!ctx) throw new Error('useSystemConfig must be inside SystemConfigProvider');
  return ctx;
};
