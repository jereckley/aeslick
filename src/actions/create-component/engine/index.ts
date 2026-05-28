import { Tool } from 'openai/resources/responses/responses';
import { getAiService } from '../../../services/ai';
import { buildContextInput } from '../context-input';
import { configService } from '../../../services/config';
import { CreateComponentAnswers } from '..';
import { promptForInput } from '../../../tools/prompt-for-input';
import { saveLastComponentResponseId } from '../../../services/component-session';
import { isRestartableResponse } from '../../../services/ai/is-restartable-response';
import { AiResponse } from '../../../services/ai/types';
import {
  COMPONENT_COMMAND_CONFIG_KEY,
  getModelForCommand,
  getToolsForCommand,
} from '../../../services/config/command-settings';

export const engine = async (answers: CreateComponentAnswers) => {
  const configSvc = await configService();
  const baseConfig = configSvc.baseConfig();
  const tools: Tool[] = getToolsForCommand(
    baseConfig,
    COMPONENT_COMMAND_CONFIG_KEY,
  );
  const aiService = await getAiService({
    model: getModelForCommand(baseConfig, COMPONENT_COMMAND_CONFIG_KEY),
    tools,
  });
  const repoConfigsAvailable = configSvc.projectRepoConfigsAvailable();
  const projects = configSvc.getNamesOfProjectsAvailable();
  console.log('Project configs available:', projects.join(', '));
  const contextConfig = buildContextInput(
    projects.length === 1
      ? configSvc.getProjectContextConfig(projects[0])
      : undefined,
  );

  if (!projects.length) {
    throw new Error('No projects available in configuration.');
  }

  if(projects.length > 1) {
    throw new Error('Multiple projects detected. Support for more than one project is not yet implemented.');
  }

  let prompts = contextConfig;
  prompts += `\n\nThe following projects are available: ${projects.join(', ')}.`;
  prompts += `\n\nThe following repo configurations are available: ${repoConfigsAvailable.join(', ')}. You can use the get-config-by-name tool to get the configuration of a specific project.`;
  prompts += `\n\nUser Prompt: "${answers.componentDescription}"`;

  let res: AiResponse | undefined;
  const previousResponseId = answers.previousResponseId;

  if (previousResponseId && !answers.componentDescription) {
    console.log(`Resume mode enabled (response id: ${previousResponseId})`);
    res = await aiService.startAgent(
      'Continue from where we left off and ask for any missing details before making more changes.',
      previousResponseId,
    );
  } else if (answers.componentDescription) {
    if (previousResponseId) {
      console.log(
        `Resume mode with new prompt (response id: ${previousResponseId})`,
      );
    } else {
      console.log('Fresh mode with new prompt.');
    }
    res = await aiService.startAgent(prompts, previousResponseId);
  } else {
    const message = await promptForInput(
      JSON.stringify({
        prompt:
          "You didn't enter a prompt. Please enter ID where you want to pickup. >",
      }),
    );
    if (!message) {
      res = await aiService.startAgent(
        'Please try to pick up where we left off. The application crashed. Can you confirm by prompting the user with the component description you remember?',
      );
    } else {
      res = await aiService.startAgent(
        'Please try to pick up where we left off. The application crashed. Maybe retry this response ID',
        message.response,
      );
    }
  }

  if (isRestartableResponse(res)) {
    await saveLastComponentResponseId(res.id);
  }
  while (true) {
    res = await aiService.processResponse(res);
    if (isRestartableResponse(res)) {
      await saveLastComponentResponseId(res.id);
    }
  }
};
