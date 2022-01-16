import { run } from './pop.js';

const commands = ['VAR simo = 0', '10 / simo'];

for (let i = 0; i < commands.length; i++) {
    let text = commands[i];
    let [res, error] = run('<stdin>', text);

    if (error) console.log(error.toString());
    else console.log(res.toString());
}
