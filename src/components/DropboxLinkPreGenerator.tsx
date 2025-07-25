import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Link, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getDropboxConfig } from '@/utils/dropboxStorage';
import { batchGenerateDropboxLinks } from '@/utils/dropboxLinkGenerator';

interface DropboxLinkPreGeneratorProps {
  className?: string;
}

export const DropboxLinkPreGenerator: React.FC<DropboxLinkPreGeneratorProps> = ({ className }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, generated: 0, existing: 0 });

  const generateMissingLinks = async () => {
    try {
      setIsGenerating(true);
      setProgress(0);
      
      const config = getDropboxConfig();
      if (!config.accessToken) {
        toast.error('Token Dropbox non configuré');
        return;
      }

      toast.info('🔍 Recherche des fichiers sans liens pré-générés...');

      // Récupérer tous les fichiers Dropbox sans lien partagé
      const { data: filesWithoutLinks, error } = await supabase
        .from('dropbox_files')
        .select('local_id, dropbox_path')
        .is('shared_link', null);

      if (error) {
        throw new Error(`Erreur base de données: ${error.message}`);
      }

      if (!filesWithoutLinks || filesWithoutLinks.length === 0) {
        toast.success('✅ Tous les fichiers ont déjà leurs liens pré-générés !');
        return;
      }

      const totalFiles = filesWithoutLinks.length;
      setStats({ total: totalFiles, generated: 0, existing: 0 });

      toast.info(`📝 Génération de ${totalFiles} liens partagés...`);

      // Générer les liens en batch avec mise à jour du progrès
      const BATCH_SIZE = 5;
      let processed = 0;

      for (let i = 0; i < filesWithoutLinks.length; i += BATCH_SIZE) {
        const batch = filesWithoutLinks.slice(i, i + BATCH_SIZE);
        
        await batchGenerateDropboxLinks(
          batch.map(file => ({
            localId: file.local_id,
            dropboxPath: file.dropbox_path
          })),
          config.accessToken
        );

        processed += batch.length;
        const progressPercent = Math.round((processed / totalFiles) * 100);
        setProgress(progressPercent);
        setStats(prev => ({ ...prev, generated: processed }));
      }

      toast.success(`✅ ${totalFiles} liens partagés générés avec succès !`);
      setProgress(100);

    } catch (error) {
      console.error('Erreur génération liens:', error);
      toast.error(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const checkExistingLinks = async () => {
    try {
      const { data: withLinks, error: withLinksError } = await supabase
        .from('dropbox_files')
        .select('local_id')
        .not('shared_link', 'is', null);

      const { data: withoutLinks, error: withoutLinksError } = await supabase
        .from('dropbox_files')
        .select('local_id')
        .is('shared_link', null);

      if (withLinksError || withoutLinksError) {
        throw new Error('Erreur lors de la vérification');
      }

      setStats({
        total: (withLinks?.length || 0) + (withoutLinks?.length || 0),
        generated: withLinks?.length || 0,
        existing: withoutLinks?.length || 0
      });

      toast.info(`📊 ${withLinks?.length || 0} liens générés, ${withoutLinks?.length || 0} manquants`);
    } catch (error) {
      console.error('Erreur vérification:', error);
      toast.error('❌ Erreur lors de la vérification');
    }
  };

  React.useEffect(() => {
    checkExistingLinks();
  }, []);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Pré-génération des liens Dropbox
        </CardTitle>
        <CardDescription>
          Génère en avance les liens partagés Dropbox pour accélérer le chargement des musiques
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-lg">{stats.total}</div>
            <div className="text-muted-foreground">Total fichiers</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg text-green-600">{stats.generated}</div>
            <div className="text-muted-foreground">Liens générés</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg text-orange-600">{stats.existing}</div>
            <div className="text-muted-foreground">Manquants</div>
          </div>
        </div>

        {/* Barre de progression */}
        {isGenerating && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <div className="text-sm text-muted-foreground text-center">
              {progress}% - Génération en cours...
            </div>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex gap-2">
          <Button 
            onClick={generateMissingLinks}
            disabled={isGenerating || stats.existing === 0}
            className="flex-1"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Link className="h-4 w-4 mr-2" />
            )}
            Générer les liens manquants
          </Button>
          
          <Button 
            variant="outline" 
            onClick={checkExistingLinks}
            disabled={isGenerating}
          >
            Actualiser
          </Button>
        </div>

        {stats.existing === 0 && stats.total > 0 && (
          <div className="text-sm text-green-600 text-center">
            ✅ Tous les liens sont déjà pré-générés !
          </div>
        )}
      </CardContent>
    </Card>
  );
};