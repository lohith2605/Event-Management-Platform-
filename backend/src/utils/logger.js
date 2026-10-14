/**
 * Professional Terminal Logger for UTSAV Backend
 * Zero external dependencies — Uses standard ANSI escape sequences
 */

const isColorSupported =
  process.env.NO_COLOR === undefined &&
  (process.stdout.isTTY || process.env.FORCE_COLOR !== undefined);

export const c = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',

  red: isColorSupported ? '\x1b[31m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  white: isColorSupported ? '\x1b[37m' : '',
  gray: isColorSupported ? '\x1b[90m' : '',

  bgRed: isColorSupported ? '\x1b[41m' : '',
  bgGreen: isColorSupported ? '\x1b[42m' : '',
  bgYellow: isColorSupported ? '\x1b[43m' : '',
  bgBlue: isColorSupported ? '\x1b[44m' : '',
};

export const getTimestamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const logger = {
  info: (message, ...args) => {
    console.log(
      `${c.gray}[${getTimestamp()}]${c.reset} ${c.cyan}${c.bold}[INFO]${c.reset}  ${message}`,
      ...args
    );
  },

  success: (message, ...args) => {
    console.log(
      `${c.gray}[${getTimestamp()}]${c.reset} ${c.green}${c.bold}[SUCCESS]${c.reset} ${message}`,
      ...args
    );
  },

  warn: (message, ...args) => {
    console.warn(
      `${c.gray}[${getTimestamp()}]${c.reset} ${c.yellow}${c.bold}[WARN]${c.reset}  ${message}`,
      ...args
    );
  },

  error: (message, error, ...args) => {
    console.error(
      `${c.gray}[${getTimestamp()}]${c.reset} ${c.red}${c.bold}[ERROR]${c.reset} ${message}`,
      ...args
    );
    if (error && error.stack && process.env.NODE_ENV !== 'production') {
      console.error(`${c.dim}${error.stack}${c.reset}`);
    }
  },

  /**
   * HTTP Request formatting helper
   */
  request: ({ method, url, status, durationMs }) => {
    // Status color
    let statusColor = c.green;
    let tag = `${c.cyan}${c.bold}[INFO]${c.reset} `;

    if (status >= 500) {
      statusColor = c.red;
      tag = `${c.red}${c.bold}[ERROR]${c.reset}`;
    } else if (status >= 400) {
      statusColor = c.yellow;
      tag = `${c.yellow}${c.bold}[WARN]${c.reset} `;
    } else if (status >= 300) {
      statusColor = c.cyan;
    }

    // Method color
    let methodColor = c.green;
    if (method === 'POST') methodColor = c.blue;
    else if (method === 'PUT' || method === 'PATCH') methodColor = c.yellow;
    else if (method === 'DELETE') methodColor = c.red;

    const formattedMethod = `${methodColor}${c.bold}${method.padEnd(6)}${c.reset}`;
    const formattedStatus = `${statusColor}${c.bold}${status}${c.reset}`;
    const formattedDuration = `${c.gray}${durationMs}ms${c.reset}`;
    const formattedUrl = `${c.white}${url}${c.reset}`;

    console.log(
      `${c.gray}[${getTimestamp()}]${c.reset} ${tag} ${formattedMethod} ${formattedUrl} ${formattedStatus} - ${formattedDuration}`
    );
  },

  /**
   * Professional startup banner
   */
  startupBanner: ({ appName, environment, port, dbStatus, dbHost, corsOrigin }) => {
    const divider = `${c.cyan}${'═'.repeat(60)}${c.reset}`;
    const localUrl = `http://localhost:${port}`;
    const healthUrl = `${localUrl}/api/health`;

    console.log('\n' + divider);
    console.log(`  ${c.bold}${c.white}${appName || 'UTSAV'}${c.reset} — ${c.yellow}Smart Event Management Platform API${c.reset}`);
    console.log(`  ${c.gray}Environment:${c.reset} ${c.green}${c.bold}${environment || 'development'}${c.reset}  ${c.gray}|${c.reset}  ${c.gray}Node:${c.reset} ${c.white}${process.version}${c.reset}  ${c.gray}|${c.reset}  ${c.gray}PID:${c.reset} ${c.white}${process.pid}${c.reset}`);
    console.log(divider);
    console.log(`  ${c.green}●${c.reset} ${c.bold}Server:${c.reset}    ${c.cyan}${localUrl}${c.reset}`);
    console.log(`  ${c.green}●${c.reset} ${c.bold}Health:${c.reset}    ${c.cyan}${healthUrl}${c.reset}`);
    console.log(
      `  ${dbStatus === 'connected' ? c.green + '●' : c.red + '○'}${c.reset} ${c.bold}Database:${c.reset}  ${
        dbStatus === 'connected'
          ? `${c.green}MongoDB Atlas Connected${c.reset} ${c.gray}(${dbHost || 'Cluster'})${c.reset}`
          : `${c.red}Disconnected${c.reset}`
      }`
    );
    console.log(`  ${c.green}●${c.reset} ${c.bold}Security:${c.reset}  ${c.gray}CORS allowed for${c.reset} ${c.white}${corsOrigin || 'http://localhost:5173'}${c.reset}`);
    console.log(divider + '\n');
  },
};

export default logger;
