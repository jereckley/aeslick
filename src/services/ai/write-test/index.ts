import chalk from 'chalk';
import type OpenAI from 'openai';
import * as fse from 'fs-extra';
import * as path from 'path';

const root = process.cwd();
export const writeTest =
  (client: OpenAI) =>
  async (
    filePath: string,
    context: string,
    writePath: string,
    exampleTests: string,
    responseId?: string,
  ) => {
    const prompt = ` *Please write unit tests for the following TypeScript code using Jest. Cover:*

- *Normal cases*
- *Edge cases*
- *Error cases (invalid inputs, exceptions)*

*Please follow these instructions:*
- *Use fixtures from the .fixtures.ts files and mocks from the .mock.ts files. Match by looking at the type in the types folder*
- *Use the file paths listed to figure out relative imports. Test files should go next to the file it is testing. Files in the same directory should use ./ while if you need to go up a directory use ../*
- *If type doesn't match the arg type you are passing data into add "as any" to the end*
- *Do not add any comments in the test*
- *any fixture data you create should have a type*
- *do not require files in the tests code. import at the top*
- *Use the DBMock class when mocking the db and get the import path correct*
- *Should have 90 percent confidence test will run*

* look at these files for fixtures, types, mocks:*
${context}

* Example tests:*
${exampleTests ? exampleTests : 'none'}

*file to write test for:*
${filePath}

`;
    await fse.writeFile(path.join(root, './context.txt'), prompt);
    let followUpPrompt =
      'Now write tests for this file using the same instructions an the original prompt: ' +
      filePath;

    const res = await client.responses.create({
      model: 'o4-mini',
      input: responseId ? followUpPrompt : prompt,
      reasoning: { effort: 'high' },
      previous_response_id: responseId,
    });
    for (const item of res.output) {
      if (item.type === 'message') {
        for (const content of item.content) {
          if (content.type === 'output_text') {
            const split = content.text.split('```typescript');
            if (split.length === 2) {
              const secondPart = split[1].split('```')[0];
              if (secondPart) {
                await fse.writeFile(path.join(root, writePath), secondPart);
              }
            } else {
              const split = content.text.split('```ts');
              if (split.length === 2) {
                const secondPart = split[1].split('```')[0];
                if (secondPart) {
                  await fse.writeFile(path.join(root, writePath), secondPart);
                }
              } else {
                await fse.writeFile(path.join(root, writePath), content.text);
              }
            }
          }
        }
      }
    }
    return res.id;
  };
