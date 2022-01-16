import { run } from './pop.js';

if (true) {
    let text = '(1 + 2) * 3 + 4 / 0';
    let [res, error] = run('<stdin>', text);

    if (error) console.log(error.toString());
    else console.log(res.toString());
}
