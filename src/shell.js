import { run } from './pop.js';

const lines = ['VAR n = 0', 'n = 2 + 1'];

for (let line of lines) {
    let [res, error] = run('<stdin>', line);
    if (error) console.log(error.toString());
    else if (res !== null) console.log(res.toString());
    console.log('----------------------------------------------');
}
