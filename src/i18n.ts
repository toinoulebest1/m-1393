import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
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
            "accountSettings": "Account Settings",
            "emptyHistory": "Your listening history is empty",
            "startListening": "Listen to music to start building your history",
            "deleteHistory": "Delete history",
            "confirmDeleteHistory": "Delete history?",
            "confirmDeleteHistoryMessage": "Are you sure you want to delete your entire listening history? This action cannot be undone.",
            "cancel": "Cancel",
            "delete": "Delete",
            "loading": "Loading...",
            "changeAvatar": "Change avatar",
            "uploading": "Uploading..."
          }
        }
      },
      fr: {
        translation: {
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
            "accountSettings": "Paramètres du compte",
            "emptyHistory": "Votre historique d'écoute est vide",
            "startListening": "Écoutez de la musique pour commencer à construire votre historique",
            "deleteHistory": "Supprimer l'historique",
            "confirmDeleteHistory": "Supprimer l'historique ?",
            "confirmDeleteHistoryMessage": "Êtes-vous sûr de vouloir supprimer tout votre historique d'écoute ? Cette action est irréversible.",
            "cancel": "Annuler",
            "delete": "Supprimer",
            "loading": "Chargement...",
            "changeAvatar": "Changer l'avatar",
            "uploading": "Téléchargement..."
          }
        }
      }
    },
    lng: 'fr', // langue par défaut
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    }
  });

export default i18n;
