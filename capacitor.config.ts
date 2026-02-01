import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.peopleon.app',
  appName: 'PeopleOn',
  webDir: 'out',
  server: {
    url: 'https://people-on.vercel.app', // Points to live Vercel deployment
    cleartext: true
  }
};

export default config;
