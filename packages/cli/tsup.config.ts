import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'commands/login': 'src/commands/login.ts',
    'commands/whoami': 'src/commands/whoami.ts',
    'commands/logs': 'src/commands/logs.ts',
    'commands/tunnel/http': 'src/commands/tunnel/http.ts',
    'commands/tunnel/ls': 'src/commands/tunnel/ls.ts',
    'commands/tunnel/stop': 'src/commands/tunnel/stop.ts',
    'commands/line/init': 'src/commands/line/init.ts',
    'commands/line/connect': 'src/commands/line/connect.ts',
    'commands/line/status': 'src/commands/line/status.ts',
    'commands/line/send': 'src/commands/line/send.ts',
    'commands/line/webhook/sync': 'src/commands/line/webhook/sync.ts'
  },
  format: 'esm',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  splitting: true,
  noExternal: ['@agentj/contracts', '@agentj/sdk'],
  external: ['@oclif/core', 'ws', 'keytar'],
  define: {
    'process.env.AGENTJ_BUILTIN_APP_URL': JSON.stringify(process.env.AGENTJ_PUBLISH_APP_URL ?? ''),
    'process.env.AGENTJ_BUILTIN_GATEWAY_URL': JSON.stringify(process.env.AGENTJ_PUBLISH_GATEWAY_URL ?? '')
  }
});
