
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Définir les traductions comme constantes avant l'initialisation
const enTranslations = {
  "common": {
    "appName": "Spotify Clone",
    "home": "Home",
    "favorites": "Favorites",
    "queue": "Queue",
    "search": "Search",
    "nowPlaying": "Now Playing",
    "track": "track",
    "tracks": "tracks",
    "noFavorites": "No favorites yet",
    "clickHeartToAdd": "Click the heart next to a song to add it to your favorites",
    "upload": "Upload files",
    "fileSelected": "{{count}} file imported",
    "fileSelected_plural": "{{count}} files imported",
    "top100": "Top 100",
    "selectSong": "Select a song",
    "noArtist": "Unknown Artist",
    "logout": "Logout",
    "downloads": "Downloads",
    "noDownloads": "No downloads yet",
    "title": "Title",
    "artist": "Artist",
    "duration": "Duration",
    "downloadedAt": "Downloaded on",
    "lastPlayed": "Last played",
    "history": "History",
    "accountSettings": "Account Settings"
  }
};

const frTranslations = {
  "common": {
    "appName": "Spotify Clone",
    "home": "Accueil",
    "favorites": "Favoris",
    "queue": "File d'attente",
    "search": "Rechercher",
    "nowPlaying": "En cours de lecture",
    "track": "titre",
    "tracks": "titres",
    "noFavorites": "Pas encore de favoris",
    "clickHeartToAdd": "Cliquez sur le cœur à côté d'un titre pour l'ajouter à vos favoris",
    "upload": "Importer des fichiers",
    "fileSelected": "{{count}} fichier importé",
    "fileSelected_plural": "{{count}} fichiers importés",
    "top100": "Top 100",
    "selectSong": "Sélectionnez un titre",
    "noArtist": "Artiste inconnu",
    "logout": "Se déconnecter",
    "downloads": "Téléchargements",
    "noDownloads": "Aucun téléchargement",
    "title": "Titre",
    "artist": "Artiste",
    "duration": "Durée",
    "downloadedAt": "Téléchargé le",
    "lastPlayed": "Dernière lecture",
    "history": "Historique",
    "accountSettings": "Paramètres du compte"
  }
};

// Initialiser i18n avec les traductions définies
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
    }
  });

export default i18n;
