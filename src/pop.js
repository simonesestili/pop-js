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
const EOF = 'EOF';

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

class InvalidSyntaxError extends Error {
    constructor(start, end, details = '') {
        super(start, end, 'Invalid Syntax', details);
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

    step(curr = null) {
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
    constructor(type, value = null, start = null, end = null) {
        this.type = type;
        this.value = value;
        if (this.start !== null) {
            this.start = start.copy();
            this.end = start.copy();
            this.end.step();
        }

        if (this.end !== null) {
            this.end = end;
        }
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
            } else if (this.curr === '+')
                tokens.push(new Token(PLUS, null, this.pos));
            else if (this.curr === '-')
                tokens.push(new Token(MINUS, null, this.pos));
            else if (this.curr === '*')
                tokens.push(new Token(MUL, null, this.pos));
            else if (this.curr === '/')
                tokens.push(new Token(DIV, null, this.pos));
            else if (this.curr === '(')
                tokens.push(new Token(LPAREN, null, this.pos));
            else if (this.curr === ')')
                tokens.push(new Token(RPAREN, null, this.pos));
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

        tokens.push(new Token(EOF, null, this.pos));
        return [tokens, null];
    }

    parseNumber() {
        let [num, dot] = [[], 0];
        let start = this.pos.copy();

        while (this.curr && (this.curr === '.' || DIGITS.has(this.curr))) {
            if (this.curr === '.' && dot++) break;
            num.push(this.curr);
            this.step();
        }

        if (!dot)
            return new Token(INT, parseInt(num.join(''), 10), start, this.pos);
        return new Token(FLOAT, parseFloat(num.join('')), start, this.pos);
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

class UnaryOpNode {
    constructor(op, node) {
        this.op = op;
        this.node = node;
    }

    toString() {
        return `(${this.op}, ${this.node})`;
    }
}

/*
PARSE RESULT
*/
class ParseResult {
    constructor() {
        this.error = null;
        this.node = null;
    }

    register(res) {
        if (res instanceof ParseResult) {
            if (res.error !== null) this.error = res.error;
            return res.node;
        }
        return res;
    }

    success(node) {
        this.node = node;
        return this;
    }

    failure(error) {
        this.error = error;
        return this;
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
        if (result.error === null && this.curr.type !== EOF)
            return res.failure(
                new InvalidSyntaxError(
                    this.curr.start,
                    this.curr.end,
                    "'Expected '+', '-', '*' or '/'"
                )
            );
        return result;
    }

    term() {
        const res = new ParseResult();
        let left = res.register(this.factor());
        if (res.error !== null) return res;

        while (this.curr.type === MUL || this.curr.type === DIV) {
            let op = this.curr;
            res.register(this.step());
            let right = res.register(this.factor());
            if (res.error !== null) return res;
            left = new BinaryOpNode(left, op, right);
        }

        return res.success(left);
    }

    expr() {
        const res = new ParseResult();
        let left = res.register(this.term());
        if (res.error !== null) return res;

        while (this.curr.type === PLUS || this.curr.type === MINUS) {
            let op = this.curr;
            res.register(this.step());
            let right = res.register(this.term());
            if (res.error !== null) return res;
            left = new BinaryOpNode(left, op, right);
        }

        return res.success(left);
    }

    factor() {
        const res = new ParseResult();
        const currToken = this.curr;

        if (currToken.type === PLUS || currToken.type === MINUS) {
            res.register(this.step());
            let factor = res.register(this.factor());
            if (res.error !== null) return res;
            return res.success(UnaryOpNode(currToken, factor));
        } else if (currToken.type === INT || currToken.type === FLOAT) {
            res.register(this.step());
            return res.success(new NumberNode(currToken));
        } else if (currToken.type === LPAREN) {
            res.register(this.step());
            let expr = res.register(this.expr());
            if (res.error !== null) return res;
            if (this.curr.type === RPAREN) {
                res.register(this.step());
                return res.success(expr);
            } else {
                return res.failure(
                    new InvalidSyntaxError(
                        this.curr.start,
                        this.curr.end,
                        "Expected ')'"
                    )
                );
            }
        }

        return res.failure(
            new InvalidSyntaxError(
                currToken.start,
                currToken.end,
                'Expected int or float'
            )
        );
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

    return [ast.node, ast.error];
};
