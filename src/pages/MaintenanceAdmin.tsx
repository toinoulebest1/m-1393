import { MaintenanceSettings } from "@/components/MaintenanceSettings";
import { UserBanManagement } from "@/components/UserBanManagement";
import { AnnouncementManagement } from "@/components/AnnouncementManagement";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Ban, Megaphone } from "lucide-react";
import { Player } from "@/components/Player";

const MaintenanceAdmin = () => {
  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Administration - Maintenance
          </h1>
          <p className="text-spotify-neutral">
            Gérez le mode maintenance, les utilisateurs du site et les annonces
          </p>
        </div>
        
        <Tabs defaultValue="maintenance" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="maintenance" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Gestion Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              Annonces
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="maintenance" className="mt-6">
            <MaintenanceSettings />
          </TabsContent>
          
          <TabsContent value="users" className="mt-6">
            <UserBanManagement />
          </TabsContent>
          
          <TabsContent value="announcements" className="mt-6">
            <AnnouncementManagement />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default MaintenanceAdmin;