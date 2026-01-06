import { Tool, Response } from 'openai/resources/responses/responses';
import { getAiService } from '../../../services/ai';
import { functionDefinitionsMap } from '../../../tools';
import { buildContextInput } from '../context-input';
import { configService } from '../../../services/config';
import { CreateComponentAnswers } from '..';
import { promptForInput } from '../../../tools/prompt-for-input';

export const engine = async (answers: CreateComponentAnswers) => {
  const tools: Tool[] = [
    functionDefinitionsMap['get-config-by-name'],
    functionDefinitionsMap['prompt-for-input'],
    functionDefinitionsMap['write-file'],
    functionDefinitionsMap['get-list-of-files-in-path'],
    functionDefinitionsMap['get-file-by-path'],
    functionDefinitionsMap['get-image-by-path'],
    { type: 'image_generation' },
    functionDefinitionsMap['run-npm-command'],
  ];
  const aiService = await getAiService(tools);
  const configSvc = await configService();
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

  let res: Response | undefined;

  if (!answers.componentDescription) {
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
  } else {
    res = await aiService.startAgent(prompts);
  }

  while (true) {
    res = await aiService.processResponse(res);
  }
};
