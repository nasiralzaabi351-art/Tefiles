import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tefiles.app',
  appName: 'Tefiles',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
