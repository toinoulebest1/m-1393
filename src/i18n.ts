
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import frTranslations from './locales/fr.json';

// Initialiser i18n de manière synchrone avant export
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations
      },
      fr: {
        translation: frTranslations
      },
    },
    lng: 'fr', // langue par défaut
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    initImmediate: false, // Force l'initialisation synchrone
  });

// Attendre que l'initialisation soit terminée avant d'exporter
await i18n.initPromise;

export default i18n;
