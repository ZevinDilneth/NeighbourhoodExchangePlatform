import chalk from 'chalk';

const ts = () => chalk.gray(new Date().toLocaleTimeString());

export type AccountEvent = 'REGISTERED' | 'LOGGED IN' | 'LOGGED OUT' | 'DELETED';

export interface AccountDetails {
  username: string;
  email: string;
  ip: string;
  country?: string;
  city?: string;
  zip?: string;
}

const EVENT_COLOR: Record<AccountEvent, chalk.Chalk> = {
  'REGISTERED': chalk.green,
  'LOGGED IN':  chalk.blue,
  'LOGGED OUT': chalk.yellow,
  'DELETED':    chalk.red,
};

const EVENT_ICON: Record<AccountEvent, string> = {
  'REGISTERED': '✚',
  'LOGGED IN':  '→',
  'LOGGED OUT': '←',
  'DELETED':    '✖',
};

export const logger = {
  info: (msg: string) =>
    console.log(`${ts()} ${chalk.cyan('ℹ')}  ${msg}`),

  success: (msg: string) =>
    console.log(`${ts()} ${chalk.green('✓')}  ${msg}`),

  warn: (msg: string) =>
    console.log(`${ts()} ${chalk.yellow('⚠')}  ${msg}`),

  error: (msg: string) =>
    console.log(`${ts()} ${chalk.red('✗')}  ${msg}`),

  accountEvent: (event: AccountEvent, d: AccountDetails) => {
    const color = EVENT_COLOR[event];
    const icon  = EVENT_ICON[event];
    const location = [d.city, d.country, d.zip].filter(Boolean).join(', ') || 'Unknown location';

    console.log('');
    console.log(
      `${ts()} ${color.bold(`${icon} [${event}]`)}` +
      `  ${chalk.white.bold(d.username)}` +
      `  <${chalk.cyan(d.email)}>`
    );
    console.log(
      `         ${chalk.gray('IP:')} ${chalk.white(d.ip)}` +
      `   ${chalk.gray('Location:')} ${chalk.white(location)}`
    );
    console.log('');
  },

  upload: (filename: string, sizeBytes: number, status: 'start' | 'done' | 'error') => {
    const kb = (sizeBytes / 1024).toFixed(1);
    if (status === 'start') {
      console.log(`${ts()} ${chalk.magenta('↑')}  Uploading ${chalk.white(filename)} (${kb} KB)`);
    } else if (status === 'done') {
      console.log(`${ts()} ${chalk.green('↑')}  Uploaded  ${chalk.white(filename)} (${kb} KB)`);
    } else {
      console.log(`${ts()} ${chalk.red('↑')}  Upload failed: ${chalk.white(filename)}`);
    }
  },
};
