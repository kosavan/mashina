import {defineConfig,devices} from '@playwright/test';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
// Workers and CLI helpers share one synthetic data directory per invocation.
process.env.MASHINA_E2E_DATA ||= resolve('../.cache/browser-test-data', randomUUID());
export default defineConfig({testDir:'./tests',timeout:45000,workers:1,fullyParallel:false,use:{baseURL:'http://127.0.0.1:8000',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],webServer:{command:`"${resolve('../.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python')}" -m uvicorn backend.app:app --app-dir .. --host 127.0.0.1 --port 8000 --workers 1`,url:'http://127.0.0.1:8000/api/v1/health',reuseExistingServer:false,env:{MASHINA_API_ENABLED:'1',MASHINA_BOOTSTRAP_TOKEN:'browser-test-bootstrap-only',MASHINA_DATA:process.env.MASHINA_E2E_DATA},timeout:30000}});
