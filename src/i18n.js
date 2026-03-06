import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ar from './locales/ar/translation.json';
import en from './locales/en/translation.json';

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
});

i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

export default i18n;
