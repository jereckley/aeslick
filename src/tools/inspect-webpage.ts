import { FunctionTool } from 'openai/resources/responses/responses';
import { InspectWebpageInput } from './types';

const DEFAULT_MAX_CHARS = 12000;
const HARD_MAX_CHARS = 30000;

export const inspectWebpage = async (input: string) => {
  const data = JSON.parse(input) as InspectWebpageInput;
  const maxChars = clampMaxChars(data.maxChars);
  const url = normalizeUrl(data.url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'aeslick-cli/0.0.11',
      },
    });

    const html = await response.text();
    const title = extractTitle(html);
    const textContent = extractText(html);
    const clippedText = textContent.slice(0, maxChars);
    const links = extractTopLinks(html, url, 15);

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      title,
      contentType: response.headers.get('content-type'),
      textPreview: clippedText,
      textLength: textContent.length,
      truncated: textContent.length > clippedText.length,
      links,
    };
  } catch (error) {
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const clampMaxChars = (maxChars?: number) => {
  if (typeof maxChars !== 'number' || Number.isNaN(maxChars)) {
    return DEFAULT_MAX_CHARS;
  }
  return Math.max(500, Math.min(HARD_MAX_CHARS, Math.floor(maxChars)));
};

const normalizeUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('url is required');
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const extractTitle = (html: string) => {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return sanitizeWhitespace(stripTags(titleMatch?.[1] ?? ''));
};

const extractText = (html: string) => {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  return sanitizeWhitespace(stripTags(withoutScripts));
};

const stripTags = (value: string) => {
  return value.replace(/<[^>]+>/g, ' ');
};

const sanitizeWhitespace = (value: string) => {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractTopLinks = (html: string, baseUrl: string, limit: number) => {
  const hrefPattern = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = hrefPattern.exec(html)) !== null && links.length < limit) {
    const href = (match[1] ?? '').trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
      continue;
    }
    try {
      const resolved = new URL(href, baseUrl).toString();
      if (!links.includes(resolved)) {
        links.push(resolved);
      }
    } catch {
      continue;
    }
  }
  return links;
};

export const inspectWebpageTool: FunctionTool = {
  type: 'function',
  strict: false,
  name: 'inspect-webpage',
  description:
    'Fetch and inspect a webpage by URL, returning title, extracted text, and top links.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Absolute URL to inspect (http/https).',
      },
      maxChars: {
        type: 'number',
        description:
          'Optional max number of characters to return from extracted page text (default 12000).',
      },
    },
    required: ['url'],
    additionalProperties: false,
  },
};
