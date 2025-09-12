import chalk from 'chalk';
import type OpenAI from 'openai';
import {
  EasyInputMessage,
  Response,
  ResponseInputItem,
  Tool,
} from 'openai/resources/responses/responses';
import { functionMap } from '../../../tools';
import { configService } from '../../config';
import { promptForInput } from '../../../tools/prompt-for-input';

export const processResponse =
  (client: OpenAI, tools: Tool[]) => async (res: Response) => {
    const items = res.output || [];
    const newList: ResponseInputItem[] = [];
    for (const item of items) {
      console.log(chalk.blueBright(JSON.stringify(item)));
      if (item.type == 'function_call') {
        const funcRes = await functionMap[
          item.name as keyof typeof functionMap
        ](item.arguments);

        newList.push({
          type: 'function_call_output',
          call_id: item.call_id,
          output: JSON.stringify(funcRes),
        });
      } else if (item.type === 'message') {
        item.content.forEach((content) => {
          if (content.type === 'output_text') {
            console.log(chalk.white(content.text));
          }
        });
      } else {
        console.log(chalk.bgYellowBright(JSON.stringify(item)));
      }
    }
    if (newList.length === 0) {
      const message = await promptForInput(
        JSON.stringify({ prompt: 'What do you want to do next?' }),
      );
      newList.push({
        type: 'message',
        content: message.response,
        role: 'user',
      } satisfies EasyInputMessage);
    }
    const baseConfig = (await configService()).baseConfig();
    return await client.responses.create({
      model: baseConfig.model,
      tools,
      previous_response_id: res.id,
      input: newList,
    });
  };
