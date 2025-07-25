import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Link, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { batchGenerateLinksForExistingSongs } from '@/utils/dropboxLinkGenerator';

interface DropboxLinkPreGeneratorProps {
  className?: string;
}

export const DropboxLinkPreGenerator: React.FC<DropboxLinkPreGeneratorProps> = ({ className }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [stats, setStats] = useState({ total: 0, success: 0, errors: 0 });

  const generateMissingLinks = async () => {
    try {
      setIsGenerating(true);
      setProgress(0);
      setCurrentFile('');
      setStats({ total: 0, success: 0, errors: 0 });
      
      toast.info('🔍 Recherche des musiques sans liens partagés...');

      const result = await batchGenerateLinksForExistingSongs(
        (current, total, currentFileName) => {
          setProgress(Math.round((current / total) * 100));
          setCurrentFile(currentFileName || '');
          setStats(prev => ({ ...prev, total }));
        }
      );

      setStats({
        total: result.success + result.errors,
        success: result.success,
        errors: result.errors
      });

      if (result.success > 0) {
        toast.success(`✅ ${result.success} liens partagés générés avec succès !`);
      }
      
      if (result.errors > 0) {
        toast.warning(`⚠️ ${result.errors} erreurs lors de la génération`);
      }

      if (result.success === 0 && result.errors === 0) {
        toast.info('ℹ️ Toutes les musiques ont déjà leurs liens partagés');
      }

      setProgress(100);

    } catch (error) {
      console.error('Erreur génération liens:', error);
      toast.error(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsGenerating(false);
      setCurrentFile('');
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Génération automatique des liens Dropbox
        </CardTitle>
        <CardDescription>
          Génère automatiquement les liens partagés Dropbox pour toutes vos musiques existantes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-lg">{stats.total}</div>
            <div className="text-muted-foreground">Total traité</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg text-green-600">{stats.success}</div>
            <div className="text-muted-foreground">Succès</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg text-red-600">{stats.errors}</div>
            <div className="text-muted-foreground">Erreurs</div>
          </div>
        </div>

        {/* Barre de progression */}
        {isGenerating && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <div className="text-sm text-muted-foreground text-center">
              {progress}% - {currentFile || 'Préparation...'}
            </div>
          </div>
        )}

        {/* Bouton d'action */}
        <Button 
          onClick={generateMissingLinks}
          disabled={isGenerating}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Link className="h-4 w-4 mr-2" />
          )}
          {isGenerating ? 'Génération en cours...' : 'Générer les liens manquants'}
        </Button>

        {!isGenerating && stats.total > 0 && (
          <div className="text-sm text-center space-y-1">
            {stats.success > 0 && (
              <div className="text-green-600">
                ✅ {stats.success} liens générés avec succès
              </div>
            )}
            {stats.errors > 0 && (
              <div className="text-red-600">
                ❌ {stats.errors} erreurs rencontrées
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};