const MAX_LOG_PREVIEW = 1000;
const SENSITIVE_KEY_PARTS = [
  'authorization',
  'cookie',
  'token',
  'secret',
  'password',
  'passwd',
  'api_key',
  'apikey',
  'client_secret',
  'session',
  'private_key',
];
const OMITTED_TEXT_KEYS = ['content', 'output', 'preview', 'result', 'script'];
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED AWS ACCESS KEY]'],
  [/\bAIza[0-9A-Za-z\-_]{35}\b/g, '[REDACTED GOOGLE API KEY]'],
  [/\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,})\b/g, '[REDACTED GITHUB TOKEN]'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '[REDACTED SLACK TOKEN]'],
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, '[REDACTED API KEY]'],
  [/Bearer\s+[A-Za-z0-9._-]{10,}/gi, 'Bearer [REDACTED]'],
];

const clip = (value: string, limit = MAX_LOG_PREVIEW) => {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}... [truncated ${value.length - limit} chars]`;
};

const normalizeKey = (key?: string) => key?.replace(/[^a-z0-9]/gi, '_').toLowerCase();

const isSensitiveKey = (key?: string) => {
  const normalized = normalizeKey(key);
  return normalized
    ? SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
    : false;
};

const redactText = (value: string) => {
  let redacted = value;
  SECRET_PATTERNS.forEach(([pattern, replacement]) => {
    redacted = redacted.replace(pattern, replacement);
  });
  if (/^[A-Za-z0-9+/=]+$/.test(redacted) && redacted.length > 120) {
    return `[REDACTED base64 string: ${redacted.length} chars]`;
  }
  return redacted;
};

const sanitizeValue = (value: unknown, key?: string, depth = 0): unknown => {
  if (depth > 3) {
    return '[omitted]';
  }
  if (typeof value === 'string') {
    if (isSensitiveKey(key)) {
      return '[REDACTED]';
    }
    const redacted = redactText(value);
    if (OMITTED_TEXT_KEYS.includes(normalizeKey(key) || '') && redacted.length > 160) {
      return `[omitted ${redacted.length} chars]`;
    }
    return clip(redacted, 200);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeValue(item, key, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 20)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitizeValue(entryValue, entryKey, depth + 1),
        ]),
    );
  }
  return value;
};

const parseMaybeJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const stringifyLogValue = (value: unknown) => {
  if (typeof value === 'string') {
    return clip(value);
  }
  try {
    return clip(JSON.stringify(value));
  } catch {
    return clip(String(value));
  }
};

export const summarizeToolArgumentsForLog = (rawArgs: unknown) => {
  const parsed = typeof rawArgs === 'string' ? parseMaybeJson(rawArgs) : rawArgs;
  return stringifyLogValue(sanitizeValue(parsed));
};

export const summarizeToolOutputForLog = (
  toolName: string,
  serializedOutput: string,
) => {
  const parsed = parseMaybeJson(serializedOutput);
  if (toolName === 'get-file-by-path' && typeof parsed === 'string') {
    return JSON.stringify({ omitted: 'file contents', length: parsed.length });
  }
  if (toolName === 'get-image-by-path' && typeof parsed === 'string') {
    return JSON.stringify({ omitted: 'image contents', length: parsed.length });
  }
  return stringifyLogValue(sanitizeValue(parsed));
};
