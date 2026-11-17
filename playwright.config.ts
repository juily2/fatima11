import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 90000, workers: 1,
  use: {baseURL: process.env.PLAY_URL || 'http://127.0.0.1:4173/wind-island/', viewport:{width:1440,height:900}, launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']}, screenshot:'only-on-failure'},
  webServer: process.env.PLAY_URL ? undefined : {command:'npm run dev -- --port 4173',url:'http://127.0.0.1:4173/wind-island/',reuseExistingServer:true},
});
