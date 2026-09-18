import {readFile} from 'node:fs/promises';
import {runRecipe} from '../services/scene-recipe/index.mjs';

const recipePath=process.argv[2] || 'recipes/capability-scene.json';
const apply=process.argv.includes('--apply');
const recipe=JSON.parse(await readFile(recipePath,'utf8'));
const result=await runRecipe(recipe,{apply});
console.log(JSON.stringify(result,null,2));
