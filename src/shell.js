import { run } from './pop.js';

let [res, error] = run('<stdin>', 'FOR i = 0 UPTO 10000000000 DO VAR r = i');
if (error) console.log(error.toString());
else if (res !== null) console.log(res.toString());
