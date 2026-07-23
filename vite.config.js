import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createPhase163DiagnosisBoundary } from './src/server/phase163DiagnosisBoundary.ts';
import { createStudentWritingCorrectionBoundary } from './src/server/studentWritingCorrectionBoundary.ts';
import { createMaterialObservationDraftGeneratorBoundary } from './src/server/materialObservationDraftGeneratorBoundary.ts';

const execFileAsync = promisify(execFile);

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'deepseek-demo-proxy',
      configureServer(server) {
      server.middlewares.use('/__runtime/phase16-3/diagnose', createPhase163DiagnosisBoundary());
      server.middlewares.use('/__runtime/phase16-3/writing-corrections', createStudentWritingCorrectionBoundary());
      server.middlewares.use('/__runtime/phase17/material-observation-candidates', createMaterialObservationDraftGeneratorBoundary());
      server.middlewares.use('/__demo/deepseek-chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        try {
          const body = await readJsonBody(req);
          const apiKey = String(body.apiKey || '');
          const model = String(body.model || 'deepseek-v4-flash');
          const prompt = String(body.prompt || '');

          if (!apiKey) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'DEEPSEEK_API_KEY is required.' }));
            return;
          }

          if (!prompt) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'prompt is required.' }));
            return;
          }

          const payload = await callDeepSeekWithCurl({ apiKey, model, prompt });
          const content = payload.choices?.[0]?.message?.content || '';

          if (!content) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: 'DeepSeek returned empty content.', payload }));
            return;
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ content, model }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      });
      },
    },
  ],
});

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024 * 2) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON request body.'));
      }
    });

    req.on('error', reject);
  });
}

async function callDeepSeekWithCurl({ apiKey, model, prompt }) {
  const body = JSON.stringify({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    stream: false,
    temperature: 0.2,
  });

  const { stdout, stderr } = await execFileAsync('curl', [
    '-sS',
    'https://api.deepseek.com/chat/completions',
    '-H',
    `Authorization: Bearer ${apiKey}`,
    '-H',
    'Content-Type: application/json',
    '-d',
    body,
  ], {
    maxBuffer: 1024 * 1024 * 10,
    env: process.env,
  });

  if (stderr.trim()) {
    throw new Error(`DeepSeek curl failed: ${stderr.trim()}`);
  }

  const payload = JSON.parse(stdout);

  if (payload.error) {
    throw new Error(`DeepSeek request failed: ${payload.error.message || 'unknown error'}`);
  }

  return payload;
}
