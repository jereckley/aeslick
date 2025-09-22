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
import { fileService } from '../../files';

export const processResponse =
  (client: OpenAI, tools: Tool[]) => async (res: Response) => {
    const items = res.output || [];
    const newList: ResponseInputItem[] = [];
    const fService = await fileService();
    for (const item of items) {
      if (item.type == 'function_call') {
        console.log(chalk.blueBright(JSON.stringify(item)));
        const funcRes = await functionMap[
          item.name as keyof typeof functionMap
        ](item.arguments);

        newList.push({
          type: 'function_call_output',
          call_id: item.call_id,
          output: JSON.stringify(funcRes),
        });
      } else if (item.type === 'message') {
        console.log(chalk.blueBright(JSON.stringify(item)));
        item.content.forEach((content) => {
          if (content.type === 'output_text') {
            console.log(chalk.white(content.text));
          }
        });
      } else if (item.type === 'image_generation_call') {
        const img = item.result;
        if (img) {
          const fileName =
            new Date()
              .toISOString()
              .replaceAll('/', '-')
              .replaceAll('.', '--')
              .replaceAll(',', '')
              .replaceAll(' ', '_') +
            `.` +
            (item as any).output_format;
          await fService.writeBase64Image('assets/' + fileName, img);
        }
        delete item.result;
        console.log(chalk.blueBright(JSON.stringify(item)));
      } else {
        console.log(chalk.bgYellowBright(JSON.stringify(item)));
      }
    }
    if (newList.length === 0) {
      const message = await promptForInput(
        JSON.stringify({ prompt: '>' }),
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
