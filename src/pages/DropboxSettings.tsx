
import { Layout } from "@/components/Layout";
import { DropboxSettings } from '@/components/DropboxSettings';
import { DropboxLinkPreGenerator } from '@/components/DropboxLinkPreGenerator';
import { Player } from "@/components/Player";

const DropboxSettingsPage = () => {
  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Configuration Dropbox
            </h1>
            <p className="text-muted-foreground mt-2">
              Configurez Dropbox pour stocker vos fichiers musicaux et paroles
            </p>
          </div>
          
          <DropboxSettings />
          
          <DropboxLinkPreGenerator />
        </div>
      </div>
      <Player />
    </Layout>
  );
};

export default DropboxSettingsPage;
