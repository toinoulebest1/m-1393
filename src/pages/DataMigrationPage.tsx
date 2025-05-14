
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DataMigrationTool } from '@/components/DataMigrationTool';
import { toast } from 'sonner';

export const DataMigrationPage = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminStatus = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      const hasAdminRole = userRole?.role === 'admin';
      setIsAdmin(hasAdminRole);
      
      // If not admin, redirect to home
      if (!hasAdminRole) {
        navigate('/');
        toast.error('Accès non autorisé');
      }
      
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-spotify-accent"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Migration des données</h1>
        <p className="text-muted-foreground">
          Transférez vos fichiers audio depuis Supabase Storage vers Dropbox tout en préservant les métadonnées.
          Cet outil est réservé aux administrateurs.
        </p>
      </div>
      
      <DataMigrationTool />
      
      <div className="mt-8 p-4 border rounded-md bg-card">
        <h2 className="text-xl font-semibold mb-2">À propos de la migration</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Cet outil vous permet de migrer vos fichiers audio de Supabase vers Dropbox. Les métadonnées des chansons (titres, artistes, etc.) sont préservées car elles sont stockées dans la base de données Supabase et non dans les fichiers eux-mêmes.
        </p>
        
        <h3 className="text-lg font-medium mb-2">Comment fonctionne la migration?</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Chaque fichier est téléchargé depuis Supabase Storage</li>
          <li>Il est ensuite uploadé vers Dropbox en conservant le même nom de fichier (ID)</li>
          <li>Une référence est créée dans la table dropbox_files pour établir le lien entre l'ID local et le chemin Dropbox</li>
          <li>Les métadonnées dans la base de données ne sont pas modifiées</li>
        </ol>
        
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-600 dark:text-yellow-400 text-sm">
          <p className="font-medium">Remarque importante:</p>
          <p>Cette opération ne modifie pas les données dans Supabase Storage. Vous pourrez continuer à utiliser les deux systèmes de stockage en parallèle.</p>
        </div>
      </div>
    </div>
  );
};
