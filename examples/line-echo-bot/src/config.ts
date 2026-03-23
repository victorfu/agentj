export interface Config {
  lineChannelSecret: string;
  lineChannelAccessToken: string;
  port: number;
  logLevel: string;
}

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
};

export const config: Config = {
  lineChannelSecret: required('LINE_CHANNEL_SECRET'),
  lineChannelAccessToken: required('LINE_CHANNEL_ACCESS_TOKEN'),
  port: Number(process.env['PORT'] ?? 3000),
  logLevel: process.env['LOG_LEVEL'] ?? 'info',
};
