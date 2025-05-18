
import React, { useEffect } from 'react';
import { Player } from "@/components/Player";
import { MusicUploader } from "@/components/MusicUploader";
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

const Index = () => {
  useEffect(() => {
    // Exécuter la fonction pour mettre à jour la structure de la table
    const updateSongsTable = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('update-songs-table');
        
        if (error) {
          console.error('Erreur lors de la mise à jour de la table songs:', error);
        } else {
          console.log('Résultat de la mise à jour de la table:', data);
        }
      } catch (err) {
        console.error('Erreur lors de l\'appel à la fonction de mise à jour:', err);
      }
    };
    
    updateSongsTable();
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto w-full pb-32">
        <div className="max-w-6xl mx-auto p-8">
          <MusicUploader />
        </div>
      </div>
      <Player />
    </div>
  );
};

export default Index;
