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

class RuntimeError extends Error {
    constructor(start, end, details, ctx) {
        super(start, end, 'Runtime Error', details);
        this.context = ctx;
    }

    toString() {
        let res = this.traceback();
        res += `${this.name}: ${this.details}\n`;
        return res;
    }

    traceback() {
        let [res, pos, ctx] = [[], this.start, this.context];

        while (ctx !== null) {
            res.push(
                `  File ${pos.fileName}, line ${pos.ln + 1}, in ${ctx.name}\n`
            );
            pos = ctx.parentPos;
            ctx = ctx.parent;
        }
        res.reverse();

        return 'Traceback (most recent call last):\n' + res.join('');
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
CONTEXT
*/
class Context {
    constructor(name, parent = null, parentPos = null) {
        this.name = name;
        this.parent = parent;
        this.parentPos = parentPos;
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
        this.start = this.token.start;
        this.end = this.token.end;
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
        this.start = this.left.start;
        this.end = this.right.end;
    }

    toString() {
        return `(${this.left}, ${this.op}, ${this.right})`;
    }
}

class UnaryOpNode {
    constructor(op, node) {
        this.op = op;
        this.node = node;
        this.start = this.op.start;
        this.end = this.node.end;
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
PRIMITIVES
*/
class Number {
    constructor(value) {
        this.value = value;
        this.setPos();
        this.setContext();
    }

    setPos(start = null, end = null) {
        this.start = start;
        this.end = end;
        return this;
    }

    setContext(ctx) {
        this.context = ctx;
        return this;
    }

    add(other) {
        if (other instanceof Number)
            return [
                new Number(this.value + other.value).setContext(this.context),
                null,
            ];
    }

    subtract(other) {
        if (other instanceof Number)
            return [
                new Number(this.value - other.value).setContext(this.context),
                null,
            ];
    }

    multiply(other) {
        if (other instanceof Number)
            return [
                new Number(this.value * other.value).setContext(this.context),
                null,
            ];
    }

    divide(other) {
        if (other instanceof Number) {
            if (other.value === 0)
                return [
                    null,
                    new RuntimeError(
                        other.start,
                        other.end,
                        'Division by zero',
                        this.context
                    ),
                ];
            return [
                new Number(this.value / other.value).setContext(this.context),
                null,
            ];
        }
    }

    toString() {
        return `${this.value}`;
    }
}
/*
RUNTIME RESULT
*/
class RTResult {
    constructor() {
        this.value = null;
        this.error = null;
    }

    register(res) {
        if (res.error) this.error = res.error;
        return res.value;
    }

    success(value) {
        this.value = value;
        return this;
    }

    failure(error) {
        this.error = error;
        return this;
    }
}

/*
INTERPRETER
*/
class Interpreter {
    traverse(node, ctx) {
        if (node instanceof NumberNode)
            return this.traverseNumberNode(node, ctx);
        if (node instanceof UnaryOpNode)
            return this.traverseUnaryOpNode(node, ctx);
        if (node instanceof BinaryOpNode)
            return this.traverseBinaryOpNode(node, ctx);
        return this.traverseNull(node, ctx);
    }

    traverseNull(node, ctx) {
        return null;
    }

    traverseNumberNode(node, ctx) {
        return new RTResult().success(
            new Number(node.token.value)
                .setContext(ctx)
                .setPos(node.start, node.end)
        );
    }

    traverseBinaryOpNode(node, ctx) {
        let rtRes = new RTResult();
        let left = rtRes.register(this.traverse(node.left, ctx));
        if (rtRes.error) return rtRes;
        let right = rtRes.register(this.traverse(node.right, ctx));
        if (rtRes.error) return rtRes;
        let [res, error] = [null, null];

        if (node.op.type === PLUS) [res, error] = left.add(right);
        if (node.op.type === MINUS) [res, error] = left.subtract(right);
        if (node.op.type === MUL) [res, error] = left.multiply(right);
        if (node.op.type === DIV) [res, error] = left.divide(right);

        if (error) return rtRes.failure(error);
        return rtRes.success(res.setPos(node.start, node.end));
    }

    traverseUnaryOpNode(node, ctx) {
        let [rtRes, error] = [new RTResult(), null];
        let num = rtRes.register(this.traverse(node.node, ctx));

        if (node.op.type === MINUS) [num, error] = num.multiply(new Number(-1));

        if (error) return rtRes.failure(error);
        return rtRes.success(num.setPos(node.start, node.end));
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
    if (ast.error) return [null, ast.error];

    // 3) Interpret abstract syntax tree
    const interpreter = new Interpreter();
    const ctx = new Context('<pop-main>');
    let res = interpreter.traverse(ast.node, ctx);

    return [res.value, res.error];
};
