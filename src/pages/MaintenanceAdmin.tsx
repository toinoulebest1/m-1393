
import { MaintenanceSettings } from "@/components/MaintenanceSettings";
import { Layout } from "@/components/Layout";

const MaintenanceAdmin = () => {
  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Administration - Maintenance
          </h1>
          <p className="text-spotify-neutral">
            Gérez le mode maintenance du site
          </p>
        </div>
        
        <MaintenanceSettings />
      </div>
    </Layout>
  );
};

export default MaintenanceAdmin;
