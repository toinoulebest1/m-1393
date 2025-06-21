
import { Layout } from "@/components/Layout";
import { DropboxSettings } from '@/components/DropboxSettings';

const DropboxSettingsPage = () => {
  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Configuration Dropbox
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Configurez Dropbox pour stocker vos fichiers musicaux et paroles
            </p>
          </div>
          
          <DropboxSettings />
        </div>
      </div>
    </Layout>
  );
};

export default DropboxSettingsPage;
