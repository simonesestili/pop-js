import { run } from './pop.js';

let [res, error] = run('<stdin>', '5 == 5');
if (error) console.log(error.toString());
else console.log(res.toString());
