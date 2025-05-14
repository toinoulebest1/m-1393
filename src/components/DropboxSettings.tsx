
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getDropboxConfig, saveDropboxConfig } from '@/utils/dropboxStorage';
import { toast } from 'sonner';

export const DropboxSettings = () => {
  const [accessToken, setAccessToken] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const config = getDropboxConfig();
    setAccessToken(config.accessToken || '');
    setIsEnabled(config.isEnabled || false);
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      saveDropboxConfig({
        accessToken,
        isEnabled
      });
      toast.success('Dropbox configuration saved');
    } catch (error) {
      console.error('Error saving Dropbox config:', error);
      toast.error('Failed to save Dropbox configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Dropbox Integration</CardTitle>
        <CardDescription>
          Configure Dropbox to store your music files instead of using Supabase storage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dropbox-token">Dropbox Access Token</Label>
          <Input
            id="dropbox-token"
            type="password"
            placeholder="Enter your Dropbox access token"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Generate an access token from the <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="underline">Dropbox App Console</a>.
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="enable-dropbox"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
          <Label htmlFor="enable-dropbox">Use Dropbox for file storage</Label>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveConfig} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardFooter>
    </Card>
  );
};
