import { Tool } from 'openai/resources/responses/responses';
import { getAiService } from '../../../services/ai';
import { functionDefinitionsMap } from '../../../tools';
import { contextInput } from '../context-input';
import { configService } from '../../../services/config';

export const engine = async () => {
  const tools: Tool[] = [
    functionDefinitionsMap['get-config-by-name'],
    functionDefinitionsMap['prompt-for-input'],
    functionDefinitionsMap['write-file'],
  ];
  const aiService = await getAiService(tools);
  const projectConfigsAvailable = (
    await configService()
  ).projectConfigsAvailable();
  console.log('Project configs available:', projectConfigsAvailable);
  let prompts = contextInput.join('\n');
  prompts += `\n\nThe following project configurations are available: ${projectConfigsAvailable.join(', ')}. You can use the get-config-by-name tool to get the configuration of a specific project.`;

  let res = await aiService.startAgent(prompts);

  console.log(JSON.stringify(res, null, 2));
  while (true) {
    res = await aiService.processResponse(res);
  }
};
