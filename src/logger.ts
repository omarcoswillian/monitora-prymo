const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function getTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export const logger = {
  info(message: string): void {
    console.log(
      `${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.blue}INFO${colors.reset}  ${message}`
    );
  },

  success(message: string): void {
    console.log(
      `${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.green}OK${colors.reset}    ${message}`
    );
  },

  warn(message: string): void {
    console.log(
      `${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.yellow}WARN${colors.reset}  ${message}`
    );
  },

  error(message: string): void {
    console.log(
      `${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.red}ERROR${colors.reset} ${message}`
    );
  },

  status(name: string, status: number | null, time: number, success: boolean): void {
    const statusColor = success ? colors.green : colors.red;
    const statusText = status ? `${status}` : 'ERR';
    const timeColor = time < 500 ? colors.green : time < 1000 ? colors.yellow : colors.red;

    console.log(
      `${colors.gray}[${getTimestamp()}]${colors.reset} ` +
        `${statusColor}${statusText.padEnd(3)}${colors.reset} ` +
        `${colors.bright}${name}${colors.reset} ` +
        `${timeColor}${time}ms${colors.reset}`
    );
  },
};
