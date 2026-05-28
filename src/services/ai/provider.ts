import OpenAI from 'openai';
import { configService } from '../config';
import { AiProvider, BaseConfig } from '../config/types';

const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1/';

export const isClaudeModel = (model?: string) =>
  typeof model === 'string' &&
  (model.toLowerCase().includes('claude') ||
    model.toLowerCase().includes('anthropic'));

export const resolveAiProvider = (
  provider?: AiProvider,
  model?: string,
): AiProvider => {
  if (isClaudeModel(model)) {
    return 'anthropic';
  }
  return provider ?? 'openai';
};

export const getResolvedBaseConfig = async (model?: string): Promise<
  BaseConfig & { provider: AiProvider }
> => {
  return getResolvedBaseConfigForModel(model);
};

export const getResolvedBaseConfigForModel = async (model?: string): Promise<
  BaseConfig & { provider: AiProvider }
> => {
  const baseConfig = (await configService()).baseConfig();
  return {
    ...baseConfig,
    provider: resolveAiProvider(baseConfig?.provider, model ?? baseConfig?.model),
  };
};

export const createAnthropicCompatibleClient = async () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is required when the base config uses a Claude model.',
    );
  }
  const configuredBaseUrl = process.env.ANTHROPIC_BASE_URL?.trim();
  return new OpenAI({
    apiKey,
    baseURL: configuredBaseUrl || DEFAULT_ANTHROPIC_BASE_URL,
  });
};
