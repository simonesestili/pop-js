import { run } from './pop.js';

if (true) {
    let text = '123 123 +';
    let [res, error] = run('<stdin>', text);

    if (error) console.log(error.toString());
    else console.log(res.toString());
}
