import { run } from './pop.js';

const runButton = document.getElementById('run-code');

runButton.onclick = () => {
    let text = document.getElementById('line').value;
    let [res, error] = run('<stdin>', text);
    if (error) console.log(error.toString());
    else console.log(res.toString());
};
