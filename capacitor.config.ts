
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.476c69f92e1b4382aa54233bd36b838f',
  appName: 'm-1393',
  webDir: 'dist',
  server: {
    url: 'https://476c69f9-2e1b-4382-aa54-233bd36b838f.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    buildOptions: {
      keystorePath: null,
      keystoreAlias: null,
      keystorePassword: null,
      keystoreAliasPassword: null,
      signingType: null,
    }
  }
};

export default config;
