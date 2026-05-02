import { execFileSync } from 'child_process';
import * as fse from 'fs-extra';
import { FunctionTool } from 'openai/resources/responses/responses';
import * as path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { ChromeHeadlessBrowserInput } from './types';

const DEFAULT_TIMEOUT_MS = 15000;
const HARD_TIMEOUT_MS = 120000;
const DEFAULT_MAX_TEXT_CHARS = 4000;
const DEFAULT_VIEWPORT_WIDTH = 1440;
const DEFAULT_VIEWPORT_HEIGHT = 900;
const MAX_STORED_EVENTS = 200;
const MAX_RETURNED_EVENTS = 20;
const DEFAULT_MAX_LINKS = 15;
const DEFAULT_SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  'assets/output/browser',
);

type ConsoleEvent = {
  id: number;
  timestamp: string;
  type: string;
  text: string;
  argsPreview: string[];
  location?: string;
};

type PageErrorEvent = {
  id: number;
  timestamp: string;
  message: string;
  stack?: string;
};

type RequestFailureEvent = {
  id: number;
  timestamp: string;
  url: string;
  method: string;
  errorText?: string;
};

type HttpErrorEvent = {
  id: number;
  timestamp: string;
  url: string;
  status: number;
  statusText: string;
};

type BrowserSession = {
  id: string;
  browser: Browser;
  page: Page;
  createdAt: string;
  updatedAt: string;
  nextEventId: number;
  consoleEvents: ConsoleEvent[];
  pageErrors: PageErrorEvent[];
  requestFailures: RequestFailureEvent[];
  httpErrors: HttpErrorEvent[];
};

const sessions = new Map<string, BrowserSession>();

export const chromeHeadlessBrowser = async (input: string) => {
  const data = JSON.parse(input) as ChromeHeadlessBrowserInput;

  try {
    switch (data.action) {
      case 'open':
        return await openSession(data);
      case 'navigate':
        return await navigateSession(data);
      case 'click':
        return await clickInSession(data);
      case 'type':
        return await typeInSession(data);
      case 'wait':
        return await waitInSession(data);
      case 'evaluate':
        return await evaluateInSession(data);
      case 'snapshot':
        return await snapshotSession(data);
      case 'console':
        return getConsoleSnapshot(data);
      case 'screenshot':
        return await screenshotSession(data);
      case 'close':
        return await closeSession(data);
      default:
        return {
          success: false,
          error: `Unsupported action "${String((data as any).action)}".`,
        };
    }
  } catch (error) {
    const session = data.sessionId ? sessions.get(data.sessionId) : undefined;
    return {
      success: false,
      action: data.action,
      sessionId: data.sessionId,
      error: formatError(error),
      ...(session ? { debug: buildDebugSnapshot(session, data.sinceEventId) } : {}),
    };
  }
};

const openSession = async (data: ChromeHeadlessBrowserInput) => {
  const executablePath = resolveChromeExecutablePath(data.executablePath);
  const timeoutMs = clampTimeoutMs(data.timeoutMs);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: {
      width: clampViewportValue(data.width, DEFAULT_VIEWPORT_WIDTH),
      height: clampViewportValue(data.height, DEFAULT_VIEWPORT_HEIGHT),
    },
    acceptInsecureCerts: data.acceptInsecureCerts !== false,
    args: buildLaunchArgs(data.disableSandbox !== false),
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(timeoutMs);
  page.setDefaultTimeout(timeoutMs);

  const session: BrowserSession = {
    id: createSessionId(),
    browser,
    page,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nextEventId: 1,
    consoleEvents: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };

  sessions.set(session.id, session);
  browser.on('disconnected', () => {
    sessions.delete(session.id);
  });
  attachPageListeners(session);

  try {
    let navigationResult:
      | {
          finalUrl: string;
          status?: number;
          statusText?: string;
        }
      | undefined;
    if (data.url) {
      navigationResult = await navigatePage(session.page, data.url, {
        timeoutMs,
        waitUntil: data.waitUntil,
      });
    }

    session.updatedAt = new Date().toISOString();
    const pageSnapshot = await buildPageSnapshot(session, data.maxTextChars);
    return {
      success: true,
      action: data.action,
      sessionId: session.id,
      executablePath,
      page: pageSnapshot,
      navigation: navigationResult,
      debug: buildDebugSnapshot(session, data.sinceEventId),
    };
  } catch (error) {
    return {
      success: false,
      action: data.action,
      sessionId: session.id,
      executablePath,
      error: formatError(error),
      debug: buildDebugSnapshot(session, data.sinceEventId),
    };
  }
};

const navigateSession = async (data: ChromeHeadlessBrowserInput) => {
  const session = requireSession(data);
  const url = requireString(data.url, 'url');
  const timeoutMs = clampTimeoutMs(data.timeoutMs);
  const navigation = await navigatePage(session.page, url, {
    timeoutMs,
    waitUntil: data.waitUntil,
  });
  session.updatedAt = new Date().toISOString();
  return {
    success: true,
    action: data.action,
    sessionId: session.id,
    navigation,
    page: await buildPageSnapshot(session, data.maxTextChars),
    debug: buildDebugSnapshot(session, data.sinceEventId),
  };
};

const clickInSession = async (data: ChromeHeadlessBrowserInput) => {
  const session = requireSession(data);
  const selector = requireString(data.selector, 'selector');
  const timeoutMs = clampTimeoutMs(data.timeoutMs);
  const button = data.button ?? 'left';
  await session.page.waitForSelector(selector, { timeout: timeoutMs });
  if (data.waitForNavigation) {
    await Promise.all([
      session.page.waitForNavigation({
        timeout: timeoutMs,
        waitUntil: data.waitUntil ?? 'load',
      }),
      session.page.click(selector, { button }),
    ]);
  } else {
    await session.page.click(selector, { button });
  }
  session.updatedAt = new Date().toISOString();
  return {
    success: true,
    action: data.action,
    sessionId: session.id,
    clicked: selector,
    page: await buildPageSnapshot(session, data.maxTextChars),
    debug: buildDebugSnapshot(session, data.sinceEventId),
  };
};

const typeInSession = async (data: ChromeHeadlessBrowserInput) => {
  const session = requireSession(data);
  const selector = requireString(data.selector, 'selector');
  const text = requireString(data.text, 'text');
  const timeoutMs = clampTimeoutMs(data.timeoutMs);
  await session.page.waitForSelector(selector, { timeout: timeoutMs });
  if (data.clearExisting) {
    await session.page.click(selector, { clickCount: 3 });
    await session.page.keyboard.press('Backspace');
  }
  await session.page.type(selector, text, {
    delay: clampDelayMs(data.delayMs),
  });
  if (data.pressEnter) {
    await session.page.keyboard.press('Enter');
  }
  session.updatedAt = new Date().toISOString();
  return {
    success: true,
    action: data.action,
    sessionId: session.id,
    typedInto: selector,
    textLength: text.length,
    page: await buildPageSnapshot(session, data.maxTextChars),
    debug: buildDebugSnapshot(session, data.sinceEventId),
  };
};

const waitInSession = async (data: ChromeHeadlessBrowserInput) => {
  const session = requireSession(data);
  const timeoutMs = clampTimeoutMs(data.timeoutMs);
  if (data.selector) {
    await session.page.waitForSelector(data.selector, {
      timeout: timeoutMs,
      visible: data.visible,
      hidden: data.hidden,
    });
  } else {
    await sleep(timeoutMs);
  }
  session.updatedAt = new Date().toISOString();
  return {
    success: true,
    action: data.action,
    sessionId: session.id,
    waitedFor: data.selector ?? `${timeoutMs}ms`,
    page: await buildPageSnapshot(session, data.maxTextChars),
    debug: buildDebugSnapshot(session, data.sinceEventId),
  };
};

const evaluateInSession = async (data: ChromeHeadlessBrowserInput) => {
  const session = requireSession(data);
  const script = requireString(data.script, 'script');
  const evaluationResult = await session.page.evaluate((source) => {
    const fn = new Function(`return (async () => {\n${source}\n})();`);
    return fn();
  }, script);
  session.updatedAt = new Date().toISOString();
  return {
    success: true,
    action: data.action,
    sessionId: session.id,
    result: evaluationResult,
    page: await buildPageSnapshot(session, data.maxTextChars),
    debug: buildDebugSnapshot(session, data.sinceEventId),
  };
};

const snapshotSession = async (data: ChromeHeadlessBrowserInput) => {
  const session = requireSession(data);
  session.updatedAt = new Date().toISOString();
  return {
    success: true,
    action: data.action,
    sessionId: session.id,
    page: await buildPageSnapshot(session, data.maxTextChars),
    debug: buildDebugSnapshot(session, data.sinceEventId),
  };
};

const getConsoleSnapshot = (data: ChromeHeadlessBrowserInput) => {
  const session = requireSession(data);
  session.updatedAt = new Date().toISOString();
  return {
    success: true,
    action: data.action,
    sessionId: session.id,
    debug: buildDebugSnapshot(session, data.sinceEventId),
  };
};

const screenshotSession = async (data: ChromeHeadlessBrowserInput) => {
  const session = requireSession(data);
  const outputPath = resolveScreenshotPath(data.path);
  await fse.ensureDir(path.dirname(outputPath));
  await session.page.screenshot({
    path: outputPath,
    fullPage: data.fullPage !== false,
  });
  session.updatedAt = new Date().toISOString();
  return {
    success: true,
    action: data.action,
    sessionId: session.id,
    savedTo: outputPath,
    page: await buildPageSnapshot(session, data.maxTextChars),
    debug: buildDebugSnapshot(session, data.sinceEventId),
  };
};

const closeSession = async (data: ChromeHeadlessBrowserInput) => {
  const session = requireSession(data);
  const debug = buildDebugSnapshot(session, data.sinceEventId);
  sessions.delete(session.id);
  await session.browser.close();
  return {
    success: true,
    action: data.action,
    sessionId: session.id,
    closed: true,
    debug,
  };
};

const requireSession = (data: ChromeHeadlessBrowserInput) => {
  const sessionId = requireString(data.sessionId, 'sessionId');
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(
      `No active browser session found for sessionId "${sessionId}". Open a session first.`,
    );
  }
  if (session.page.isClosed()) {
    sessions.delete(sessionId);
    throw new Error(
      `Browser session "${sessionId}" is already closed. Open a new session.`,
    );
  }
  return session;
};

const attachPageListeners = (session: BrowserSession) => {
  session.page.on('console', async (message) => {
    const argsPreview = await Promise.all(
      message.args().map(async (arg) => {
        try {
          return previewValue(await arg.jsonValue(), 500);
        } catch {
          return clipText(String(arg), 500);
        }
      }),
    );
    pushEvent(session.consoleEvents, {
      id: nextEventId(session),
      timestamp: new Date().toISOString(),
      type: message.type(),
      text: clipText(message.text(), 1000),
      argsPreview,
      location: formatConsoleLocation(message.location()),
    });
  });

  session.page.on('pageerror', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack =
      error instanceof Error && error.stack
        ? clipText(error.stack, 3000)
        : undefined;
    pushEvent(session.pageErrors, {
      id: nextEventId(session),
      timestamp: new Date().toISOString(),
      message: clipText(message, 1000),
      stack,
    });
  });

  session.page.on('requestfailed', (request) => {
    pushEvent(session.requestFailures, {
      id: nextEventId(session),
      timestamp: new Date().toISOString(),
      url: request.url(),
      method: request.method(),
      errorText: request.failure()?.errorText,
    });
  });

  session.page.on('response', (response) => {
    if (response.status() < 400) {
      return;
    }
    pushEvent(session.httpErrors, {
      id: nextEventId(session),
      timestamp: new Date().toISOString(),
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
    });
  });
};

const nextEventId = (session: BrowserSession) => {
  const nextId = session.nextEventId;
  session.nextEventId += 1;
  return nextId;
};

const pushEvent = <T>(list: T[], item: T) => {
  list.push(item);
  if (list.length > MAX_STORED_EVENTS) {
    list.splice(0, list.length - MAX_STORED_EVENTS);
  }
};

const navigatePage = async (
  page: Page,
  rawUrl: string,
  options: {
    timeoutMs: number;
    waitUntil?: ChromeHeadlessBrowserInput['waitUntil'];
  },
) => {
  const url = normalizeTargetUrl(rawUrl);
  const response = await page.goto(url, {
    timeout: options.timeoutMs,
    waitUntil: options.waitUntil ?? 'load',
  });
  return {
    finalUrl: page.url(),
    status: response?.status(),
    statusText: response?.statusText(),
  };
};

const buildPageSnapshot = async (
  session: BrowserSession,
  maxTextChars?: number,
) => {
  const snapshot = await session.page.evaluate((maxLinks) => {
    const rawText =
      document.body?.innerText ??
      document.documentElement?.innerText ??
      '';
    const text = rawText.replace(/\s+/g, ' ').trim();
    const links: string[] = [];

    for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
      const href = anchor.getAttribute('href');
      if (!href) {
        continue;
      }
      try {
        const absoluteUrl = new URL(href, document.baseURI).toString();
        if (!links.includes(absoluteUrl)) {
          links.push(absoluteUrl);
        }
      } catch {
        continue;
      }
      if (links.length >= maxLinks) {
        break;
      }
    }

    return {
      title: document.title,
      url: window.location.href,
      readyState: document.readyState,
      text,
      links,
    };
  }, DEFAULT_MAX_LINKS);

  const maxChars = clampMaxTextChars(maxTextChars);
  const textPreview = clipText(snapshot.text, maxChars);
  return {
    title: snapshot.title,
    url: snapshot.url,
    readyState: snapshot.readyState,
    textPreview,
    textLength: snapshot.text.length,
    truncated: snapshot.text.length > textPreview.length,
    links: snapshot.links,
  };
};

const buildDebugSnapshot = (
  session: BrowserSession,
  sinceEventId?: number,
) => {
  const filterByEvent = <T extends { id: number }>(events: T[]) => {
    const filtered =
      typeof sinceEventId === 'number'
        ? events.filter((event) => event.id > sinceEventId)
        : events;
    return filtered.slice(-MAX_RETURNED_EVENTS);
  };

  return {
    lastEventId: session.nextEventId - 1,
    counts: {
      console: session.consoleEvents.length,
      pageErrors: session.pageErrors.length,
      requestFailures: session.requestFailures.length,
      httpErrors: session.httpErrors.length,
    },
    console: filterByEvent(session.consoleEvents),
    pageErrors: filterByEvent(session.pageErrors),
    requestFailures: filterByEvent(session.requestFailures),
    httpErrors: filterByEvent(session.httpErrors),
  };
};

const resolveChromeExecutablePath = (providedPath?: string) => {
  const candidates = [
    providedPath,
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    commandPath('google-chrome'),
    commandPath('google-chrome-stable'),
    commandPath('chromium'),
    commandPath('chromium-browser'),
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fse.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Could not find a Chrome or Chromium executable. Install Chrome or pass executablePath.',
  );
};

const buildLaunchArgs = (disableSandbox: boolean) => {
  const args = ['--disable-dev-shm-usage'];
  if (disableSandbox) {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }
  return args;
};

const commandPath = (command: string) => {
  try {
    return execFileSync('which', [command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
};

const resolveScreenshotPath = (targetPath?: string) => {
  if (targetPath) {
    return path.isAbsolute(targetPath)
      ? targetPath
      : path.resolve(process.cwd(), targetPath);
  }
  const fileName =
    new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-') +
    '-chrome.png';
  return path.join(DEFAULT_SCREENSHOT_DIR, fileName);
};

const normalizeTargetUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('url is required');
  }
  if (/^[a-z][a-z0-9+\-.]*:/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const createSessionId = () => {
  return `chrome-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const requireString = (value: string | undefined, fieldName: string) => {
  if (!value?.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  return value;
};

const clampTimeoutMs = (timeoutMs?: number) => {
  if (typeof timeoutMs !== 'number' || Number.isNaN(timeoutMs)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(0, Math.min(HARD_TIMEOUT_MS, Math.floor(timeoutMs)));
};

const clampDelayMs = (delayMs?: number) => {
  if (typeof delayMs !== 'number' || Number.isNaN(delayMs)) {
    return 0;
  }
  return Math.max(0, Math.min(1000, Math.floor(delayMs)));
};

const clampMaxTextChars = (maxTextChars?: number) => {
  if (typeof maxTextChars !== 'number' || Number.isNaN(maxTextChars)) {
    return DEFAULT_MAX_TEXT_CHARS;
  }
  return Math.max(200, Math.min(30000, Math.floor(maxTextChars)));
};

const clampViewportValue = (value: number | undefined, fallback: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(320, Math.min(4000, Math.floor(value)));
};

const clipText = (value: string, maxChars: number) => {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}... [truncated ${value.length - maxChars} chars]`;
};

const previewValue = (value: unknown, maxChars: number) => {
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return clipText(value, maxChars);
  }
  try {
    return clipText(JSON.stringify(value), maxChars);
  } catch {
    return clipText(String(value), maxChars);
  }
};

const formatConsoleLocation = (
  location: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  },
) => {
  if (!location.url) {
    return undefined;
  }
  const lineNumber = typeof location.lineNumber === 'number'
    ? location.lineNumber + 1
    : undefined;
  const columnNumber = typeof location.columnNumber === 'number'
    ? location.columnNumber + 1
    : undefined;
  if (typeof lineNumber === 'number' && typeof columnNumber === 'number') {
    return `${location.url}:${lineNumber}:${columnNumber}`;
  }
  return location.url;
};

const sleep = async (timeoutMs: number) => {
  await new Promise((resolve) => setTimeout(resolve, timeoutMs));
};

const formatError = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

export const chromeHeadlessBrowserTool: FunctionTool = {
  type: 'function',
  strict: false,
  name: 'chrome-headless-browser',
  description:
    'Use a headless Chrome browser session to open webpages, click/type/wait, run JavaScript in the page context, inspect browser console output, capture request failures, and take screenshots. Start with action "open", then reuse the returned sessionId. Console and error events are returned in debug with lastEventId so you can request only newer events via sinceEventId.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'open',
          'navigate',
          'click',
          'type',
          'wait',
          'evaluate',
          'snapshot',
          'console',
          'screenshot',
          'close',
        ],
        description: 'Which browser action to perform.',
      },
      sessionId: {
        type: 'string',
        description:
          'Required for every action except open. Reuse the sessionId returned by open.',
      },
      url: {
        type: 'string',
        description:
          'URL to open or navigate to. Supports http/https and explicit schemes like data: or file:.',
      },
      selector: {
        type: 'string',
        description:
          'CSS selector used by click, type, or wait actions.',
      },
      text: {
        type: 'string',
        description:
          'Text to type for the type action.',
      },
      script: {
        type: 'string',
        description:
          'JavaScript function body executed in the page context for evaluate. Use return to send a result back, for example: return document.title;',
      },
      timeoutMs: {
        type: 'number',
        description:
          'Optional timeout in milliseconds for navigation or selector waits. Defaults to 15000.',
      },
      waitUntil: {
        type: 'string',
        enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
        description:
          'Navigation readiness target for open, navigate, or click with waitForNavigation.',
      },
      width: {
        type: 'number',
        description: 'Viewport width used by open.',
      },
      height: {
        type: 'number',
        description: 'Viewport height used by open.',
      },
      executablePath: {
        type: 'string',
        description:
          'Optional explicit Chrome/Chromium executable path. If omitted, common system paths are checked.',
      },
      disableSandbox: {
        type: 'boolean',
        description:
          'Whether to launch Chrome with no-sandbox flags. Defaults to true for CLI reliability.',
      },
      acceptInsecureCerts: {
        type: 'boolean',
        description:
          'Whether to ignore HTTPS certificate errors. Defaults to true.',
      },
      maxTextChars: {
        type: 'number',
        description:
          'Optional max number of rendered page text characters to return in page.textPreview.',
      },
      sinceEventId: {
        type: 'number',
        description:
          'Optional event cursor. When set, debug only returns console/errors newer than this event id.',
      },
      path: {
        type: 'string',
        description:
          'Optional output file path for screenshots. Defaults to assets/output/browser/<timestamp>-chrome.png.',
      },
      fullPage: {
        type: 'boolean',
        description:
          'Whether screenshot captures the full page. Defaults to true.',
      },
      delayMs: {
        type: 'number',
        description:
          'Optional per-character typing delay for the type action.',
      },
      clearExisting: {
        type: 'boolean',
        description:
          'Whether to clear existing input contents before typing. Used by the type action.',
      },
      pressEnter: {
        type: 'boolean',
        description:
          'Whether to press Enter after typing. Used by the type action.',
      },
      waitForNavigation: {
        type: 'boolean',
        description:
          'When true, click waits for a navigation after clicking.',
      },
      button: {
        type: 'string',
        enum: ['left', 'middle', 'right'],
        description:
          'Mouse button used by click. Defaults to left.',
      },
      visible: {
        type: 'boolean',
        description:
          'For wait: require selector to become visible.',
      },
      hidden: {
        type: 'boolean',
        description:
          'For wait: require selector to become hidden.',
      },
    },
    required: ['action'],
    additionalProperties: false,
  },
};
