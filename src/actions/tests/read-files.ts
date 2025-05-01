import * as fs from 'fs';
import * as glob from 'glob';

export const readFiles = (pattern: string): string => {
  const filePaths = glob.sync(pattern);

  let data = '';

  filePaths
    .map((filePath) => {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return { path: filePath, content: fileContent };
      } catch (error) {
        console.error(`Error reading file ${filePath}: ${error.message}`);
        return { path: filePath, content: 'no content in this file', error: error.message };
      }
    })
    .forEach((file) => {
      data += '// ' + file.path + '\n\n' + file.content + '\n';
    });
  return data;
};
