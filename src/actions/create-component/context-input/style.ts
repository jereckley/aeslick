export const style = ` 
Coding Style Guidelines:
1. Include imports at the top of the files. Do not require or import mid file unless needed.
2. If you need to add things to the package.json read the file first and only add to the file.Add types it in types.ts file in the folder the types are being used. If you want to make separate images you need to make separate image generation calls.
3. Use the types generated from codegen as much as possible instead of writing your own types when working in the 'GraphQL API' repo.
4. Prefer arrow functions.
5. Avoid Classes.
6. **Hard constraint:** Do not write or output any single file over **5,000 characters** (including whitespace). If a change would exceed 5,000 characters, you must **split it into multiple new files/modules** and update imports accordingly. If splitting isn’t feasible, **stop and ask me** how to proceed.
`;
