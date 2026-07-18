const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const activeLevel = LEVELS[(process.env.EDGE_LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

function emit(level, msg, meta) {
  if (LEVELS[level] > activeLevel) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta && typeof meta === 'object' ? meta : meta !== undefined ? { detail: meta } : {}),
  };
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  stream.write(`${JSON.stringify(line)}\n`);
}

export const logger = {
  error: (msg, meta) => emit('error', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  debug: (msg, meta) => emit('debug', msg, meta),
};
