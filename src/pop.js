/*
CONSTANTS
*/
const INT = 'INT';
const FLOAT = 'FLOAT';
const PLUS = 'PLUS';
const MINUS = 'MINUS';
const MUL = 'MUL';
const DIV = 'DIV';
const LPAREN = 'LPAREN';
const RPAREN = 'RPAREN';

const DIGITS = new Set('0123456789'.split(''));
const WHITESPACE = new Set(' \t'.split(''));

/*
ERRORS
*/
class Error {
    constructor(start, end, errorName, details) {
        this.start = start;
        this.end = end;
        this.name = errorName;
        this.details = details;
    }

    toString() {
        return `${this.name}: ${this.details}\n
        File ${this.start.fileName}, line ${this.start.ln + 1}`;
    }
}

class IllegalCharacterError extends Error {
    constructor(start, end, details) {
        super(start, end, 'Illegal Character', details);
    }
}

/*
POSITION
*/
class Position {
    constructor(idx, ln, col, fileName, fileTxt) {
        this.idx = idx;
        this.ln = ln;
        this.col = col;
        this.fileName = fileName;
        this.fileTxt = fileTxt;
    }

    step(curr) {
        this.idx++;
        this.col++;

        if (curr === '\n') {
            this.ln++;
            this.col = 0;
        }

        return this;
    }

    copy() {
        return new Position(
            this.idx,
            this.ln,
            this.col,
            this.fileName,
            this.fileTxt
        );
    }
}

/*
TOKENS
*/
class Token {
    constructor(type, value = null) {
        this.type = type;
        this.value = value;
    }

    toString() {
        return this.value === null
            ? `${this.type}`
            : `${this.type}:${this.value}`;
    }
}

/*
LEXER
*/
class Lexer {
    constructor(fileName, text) {
        this.fileName = fileName;
        this.text = text;
        this.pos = new Position(-1, 0, -1, fileName, text);
        this.curr = null;
        this.step();
    }

    step() {
        this.pos.step(this.curr);
        this.curr =
            this.pos.idx >= this.text.length ? null : this.text[this.pos.idx];
    }

    makeTokens() {
        let tokens = [];

        while (this.curr) {
            let flag = true;
            if (DIGITS.has(this.curr)) {
                tokens.push(this.parseNumber());
                flag = false;
            } else if (this.curr === '+') tokens.push(new Token(PLUS));
            else if (this.curr === '-') tokens.push(new Token(MINUS));
            else if (this.curr === '*') tokens.push(new Token(MUL));
            else if (this.curr === '/') tokens.push(new Token(DIV));
            else if (this.curr === '(') tokens.push(new Token(LPAREN));
            else if (this.curr === ')') tokens.push(new Token(RPAREN));
            else if (!WHITESPACE.has(this.curr)) {
                let [c, start] = [this.curr, this.pos.copy()];
                this.step();
                return [
                    [],
                    new IllegalCharacterError(start, this.pos, `'${c}'`),
                ];
            }

            if (flag) this.step();
        }

        return [tokens, null];
    }

    parseNumber() {
        let [num, dot] = [[], 0];

        while (this.curr && (this.curr === '.' || DIGITS.has(this.curr))) {
            if (this.curr === '.' && dot++) break;
            num.push(this.curr);
            this.step();
        }

        if (!dot) return new Token(INT, parseInt(num.join(''), 10));
        return new Token(FLOAT, parseFloat(num.join('')));
    }
}

/*
NODES
*/
class NumberNode {
    constructor(token) {
        this.token = token;
    }

    toString() {
        return `${this.token}`;
    }
}

class BinaryOpNode {
    constructor(left, operator, right) {
        this.left = left;
        this.op = operator;
        this.right = right;
    }

    toString() {
        return `(${this.left}, ${this.op}, ${this.right})`;
    }
}

/*
PARSER
*/
class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.curr = null;
        this.idx = -1;
        this.step();
    }

    step() {
        this.idx++;
        if (this.idx < this.tokens.length) this.curr = this.tokens[this.idx];
        return this.curr;
    }

    parse() {
        let result = this.expr();
        return result;
    }

    term() {
        let left = this.factor();

        while (this.curr.type === MUL || this.curr.type === DIV) {
            let op = this.curr;
            this.step();
            let right = this.factor();
            left = new BinaryOpNode(left, op, right);
        }

        return left;
    }

    expr() {
        let left = this.term();

        while (this.curr.type === PLUS || this.curr.type === MINUS) {
            let op = this.curr;
            this.step();
            let right = this.term();
            left = new BinaryOpNode(left, op, right);
        }

        return left;
    }

    factor() {
        const currToken = this.curr;

        if (currToken.type === INT || currToken.type === FLOAT) {
            this.step();
            return new NumberNode(currToken);
        }
    }
}

/*
RUN
*/
export const run = (fileName, text) => {
    // 1) Tokenize the input
    const lexer = new Lexer(fileName, text);
    const [tokens, error] = lexer.makeTokens();
    if (error) return [null, error];

    // 2) Construct abstract syntax tree
    const parser = new Parser(tokens);
    const ast = parser.parse(tokens);

    return [ast, null];
};
