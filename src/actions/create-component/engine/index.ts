import { Tool, Response } from 'openai/resources/responses/responses';
import { getAiService } from '../../../services/ai';
import { functionDefinitionsMap } from '../../../tools';
import { buildContextInput } from '../context-input';
import { configService } from '../../../services/config';
import { CreateComponentAnswers } from '..';
import { promptForInput } from '../../../tools/prompt-for-input';
import { saveLastComponentResponseId } from '../../../services/component-session';
import { isRestartableResponse } from '../../../services/ai/is-restartable-response';

export const engine = async (answers: CreateComponentAnswers) => {
  const tools: Tool[] = [
    functionDefinitionsMap['get-config-by-name'],
    functionDefinitionsMap['prompt-for-input'],
    functionDefinitionsMap['write-file'],
    functionDefinitionsMap['get-list-of-files-in-path'],
    functionDefinitionsMap['get-file-by-path'],
    functionDefinitionsMap['get-image-by-path'],
    functionDefinitionsMap['get-image-inputs-by-file-names'],
    { type: 'image_generation' },
    functionDefinitionsMap['run-npm-command'],
    functionDefinitionsMap['publish-library-and-wait'],
    functionDefinitionsMap['deploy-repo'],
    functionDefinitionsMap['inspect-webpage'],
    functionDefinitionsMap['chrome-headless-browser'],
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
