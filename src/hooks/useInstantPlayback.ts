import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { searchTidalId } from '@/utils/storage';
import { memoryCache } from '@/utils/memoryCache';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';

// Précharge instantanée des URLs audio pour lecture ultra-rapide
export const useInstantPlayback = (songs: any[]) => {
  useEffect(() => {
    // Précharger immédiatement depuis la DB au premier mount
    UltraFastStreaming.preloadFromDatabase();
  }, []);

  useEffect(() => {
    if (!songs || songs.length === 0) return;

    const preloadSongs = async () => {
      // Précharger les 10 premières chansons en parallèle
      const preloadPromises = songs.slice(0, 10).map(async (song) => {
        try {
          // Si déjà en cache, skip
          if (memoryCache.get(song.file_path)) {
            return;
          }

          let tidalId = song.tidal_id;

          // Si pas de tidal_id, le chercher et le sauvegarder immédiatement
          if (!tidalId && song.title && song.artist) {
            console.log('🚀 Préchargement Tidal ID pour:', song.title);
            tidalId = await searchTidalId(song.title, song.artist);
            
            if (tidalId) {
              // Mettre à jour la DB en arrière-plan (fire & forget)
              supabase
                .from('songs')
                .update({ tidal_id: tidalId })
                .eq('id', song.id)
                .then(() => console.log('💾 Tidal ID sauvegardé:', song.title));
            }
          }

          // Si on a un tidal_id, précharger l'URL audio
          if (tidalId) {
            // D'abord vérifier si le lien existe déjà en base
            const { data: existingLink } = await supabase
              .from('tidal_audio_links')
              .select('audio_url, created_at')
              .eq('tidal_id', tidalId)
              .single();

            if (existingLink) {
              // Utiliser le lien existant
              console.log('✅ URL en cache (DB):', song.title);
              memoryCache.set(song.file_path, existingLink.audio_url);
              
              // Ajouter aussi au warm cache pour accès ultra-rapide
              import('@/utils/ultraFastCache').then(({ UltraFastCache }) => {
                UltraFastCache.setWarm(`tidal:${tidalId}`, existingLink.audio_url);
              });
            } else {
              // Récupérer depuis l'API Frankfurt en priorité
              const frankfurtUrl = `https://frankfurt.monochrome.tf/track/?id=${tidalId}&quality=LOSSLESS`;
              
              try {
                const res = await fetch(frankfurtUrl, { headers: { Accept: 'application/json' } });
                
                if (res.ok) {
                  const data = await res.json();
                  
                  // Extraire l'URL audio
                  let audioUrl: string | null = null;
                  
                  if (Array.isArray(data)) {
                    for (const item of data) {
                      if (item?.OriginalTrackUrl && typeof item.OriginalTrackUrl === 'string') {
                        audioUrl = item.OriginalTrackUrl;
                        break;
                      }
                    }
                  } else if (data?.OriginalTrackUrl) {
                    audioUrl = data.OriginalTrackUrl;
                  }
                  
                  if (audioUrl) {
                    console.log('✅ URL préchargée:', song.title);
                    memoryCache.set(song.file_path, audioUrl);
                    
                     // Sauvegarder dans Supabase pour utilisation future + warm cache
                    supabase
                      .from('tidal_audio_links')
                      .upsert({
                        tidal_id: tidalId,
                        audio_url: audioUrl,
                        quality: 'LOSSLESS',
                        source: 'frankfurt',
                        last_verified_at: new Date().toISOString()
                      })
                      .then(() => {
                        console.log('💾 Lien sauvegardé en DB:', song.title);
                        // Ajouter au warm cache pour accès instantané
                        import('@/utils/ultraFastCache').then(({ UltraFastCache }) => {
                          UltraFastCache.setWarm(`tidal:${tidalId}`, audioUrl);
                        });
                      });
                  }
                }
              } catch (error) {
                console.warn('⚠️ Préchargement échoué:', song.title, error);
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ Erreur préchargement:', song.title, error);
        }
      });

      await Promise.all(preloadPromises);
      console.log('🎯 Préchargement terminé pour', songs.slice(0, 10).length, 'chansons');
    };

    // Lancer le préchargement après un court délai pour ne pas bloquer le rendu
    const timer = setTimeout(() => {
      preloadSongs();
    }, 100);

    return () => clearTimeout(timer);
  }, [songs]);
};
