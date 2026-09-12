// Re-records the golden transcripts under test/transcripts/.
// A tiny wrapper so the workflow is identical on PowerShell and bash
// (`UPDATE_TRANSCRIPTS=1 node --test` is not valid on Windows).
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['--test', 'build/test/**/*.test.js'], {
  stdio: 'inherit',
  env: { ...process.env, UPDATE_TRANSCRIPTS: '1' },
});

process.exit(result.status ?? 1);
