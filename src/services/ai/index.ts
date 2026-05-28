import { getClaudeAiService } from './claude-service';
import { getOpenAiService } from './openai-service';
import { getResolvedBaseConfigForModel } from './provider';
import { AiService, AiServiceOptions } from './types';

export const getAiService = async (
  options?: AiServiceOptions,
): Promise<AiService> => {
  const baseConfig = await getResolvedBaseConfigForModel(options?.model);
  if (baseConfig.provider === 'anthropic') {
    return getClaudeAiService(options);
  }
  return getOpenAiService(options);
};
