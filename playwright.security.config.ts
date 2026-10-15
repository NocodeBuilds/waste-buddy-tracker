import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/security',fullyParallel:false,workers:1,timeout:60000,
 reporter:'list',use:{baseURL:'http://127.0.0.1:8181',trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node scripts/start-test-server.mjs',url:'http://127.0.0.1:8181',reuseExistingServer:false,timeout:180000},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 5']}}],
});
