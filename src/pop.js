/*
CONSTANTS
*/
const INT = 'INT';
const FLOAT = 'FLOAT';
const IDENTIFIER = 'IDENTIFIER';
const KEYWORD = 'KEYWORD';
const PLUS = 'PLUS';
const MINUS = 'MINUS';
const MUL = 'MUL';
const DIV = 'DIV';
const POW = 'POW';
const ASSIGN = 'ASSIGN';
const LPAREN = 'LPAREN';
const RPAREN = 'RPAREN';
const EQ = 'EQ';
const NE = 'NE';
const LT = 'LT';
const GT = 'GT';
const LTE = 'LTE';
const GTE = 'GTE';
const EOF = 'EOF';

const LETTERS = new Set(
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
);
const DIGITS = new Set('0123456789'.split(''));
const WHITESPACE = new Set(' \t'.split(''));

const KEYWORDS = new Set(['VAR', 'AND', 'NOT', 'OR']);

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

class ExpectedCharError extends Error {
    constructor(start, end, details) {
        super(start, end, 'Expected Character', details);
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
        this.symbolTable = null;
    }

    setTable(table) {
        this.symbolTable = table;
        return this;
    }
}

/*
TOKENS
*/
class Token {
    constructor(type, value = null, start = null, end = null) {
        this.type = type;
        this.value = value;
        if (start !== null) {
            this.start = start.copy();
            this.end = start.copy();
            this.end.step();
        }

        if (end !== null) {
            this.end = end;
        }
    }

    equals(other) {
        return this.type === other.type && this.value === other.value;
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
            } else if (LETTERS.has(this.curr)) {
                tokens.push(this.parseIdentifier());
                flag = false;
            } else if (this.curr === '+')
                tokens.push(new Token(PLUS, null, this.pos));
            else if (this.curr === '-')
                tokens.push(new Token(MINUS, null, this.pos));
            else if (this.curr === '*')
                tokens.push(new Token(MUL, null, this.pos));
            else if (this.curr === '/')
                tokens.push(new Token(DIV, null, this.pos));
            else if (this.curr === '^')
                tokens.push(new Token(POW, null, this.pos));
            else if (this.curr === '!') {
                let [token, error] = this.parseNE();
                if (error) return [[], error];
                tokens.push(token);
            } else if (this.curr === '=') tokens.push(this.parseEQ());
            else if (this.curr === '>' || this.curr === '<')
                tokens.push(this.parseComp());
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

    parseComp() {
        const start = this.pos.copy();
        let type = this.curr;
        this.step();
        if (this.curr === '=')
            return new Token(type === '>' ? GTE : LTE, start, this.pos);
        return new Token(type === '>' ? GT : LT, start, this.pos);
    }

    parseEQ() {
        const start = this.pos.copy();
        this.step();

        if (this.curr === '=') return new Token(EQ, start, this.pos);
        return new Token(ASSIGN, start, this.pos);
    }

    parseNE() {
        const start = this.pos.copy();
        this.step();
        if (this.curr === '=') return [new Token(NE, null, start), null];
        return [null, new ExpectedCharError(start, this.pos, "'='")];
    }

    parseIdentifier() {
        let [strID, start] = [[], this.pos.copy()];

        while (
            this.curr !== null &&
            (LETTERS.has(this.curr) ||
                DIGITS.has(this.curr) ||
                this.curr === '_')
        ) {
            strID.push(this.curr);
            this.step();
        }
        strID = strID.join('');
        const tokenType = KEYWORDS.has(strID) ? KEYWORD : IDENTIFIER;
        return new Token(tokenType, strID, start, this.pos);
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

class VariableNode {
    constructor(tokenID) {
        this.tokenID = tokenID;
        this.start = this.tokenID.start;
        this.end = this.tokenID.end;
    }
}

class VariableAssignNode {
    constructor(tokenID, value) {
        this.tokenID = tokenID;
        this.value = value;
        this.start = this.tokenID.start;
        this.end = this.value.end;
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
        this.stepCount = 0;
    }

    registerStep(res) {
        this.stepCount++;
    }

    register(res) {
        this.stepCount += res.stepCount;
        if (res.error !== null) this.error = res.error;
        return res.node;
    }

    success(node) {
        this.node = node;
        return this;
    }

    failure(error) {
        if (this.error === null || this.stepCount === 0) this.error = error;
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
            return result.failure(
                new InvalidSyntaxError(
                    this.curr.start,
                    this.curr.end,
                    "'Expected '+', '-', '*' or '/'"
                )
            );
        return result;
    }

    power() {
        const res = new ParseResult();
        let left = res.register(this.atom());
        if (res.error !== null) return res;

        while (this.curr.type === POW) {
            let op = this.curr;
            res.registerStep();
            this.step();
            let right = res.register(this.factor());
            if (res.error !== null) return res;
            left = new BinaryOpNode(left, op, right);
        }

        return res.success(left);
    }

    atom() {
        const res = new ParseResult();
        const currToken = this.curr;

        if (currToken.type === INT || currToken.type === FLOAT) {
            res.registerStep();
            this.step();
            return res.success(new NumberNode(currToken));
        } else if (currToken.type === IDENTIFIER) {
            res.registerStep();
            this.step();
            return res.success(new VariableNode(currToken));
        } else if (currToken.type === LPAREN) {
            res.registerStep();
            this.step();
            let expr = res.register(this.expr());
            if (res.error !== null) return res;
            if (this.curr.type === RPAREN) {
                res.registerStep();
                this.step();
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
                "Expected int, float, identifier, '+', '-' or '('"
            )
        );
    }

    term() {
        const res = new ParseResult();
        let left = res.register(this.factor());
        if (res.error !== null) return res;

        while (this.curr.type === MUL || this.curr.type === DIV) {
            let op = this.curr;
            res.registerStep();
            this.step();
            let right = res.register(this.factor());
            if (res.error !== null) return res;
            left = new BinaryOpNode(left, op, right);
        }

        return res.success(left);
    }

    expr() {
        const res = new ParseResult();

        if (this.curr.equals(new Token(KEYWORD, 'VAR'))) {
            res.registerStep();
            this.step();
            if (this.curr.type !== IDENTIFIER) {
                return res.failure(
                    new InvalidSyntaxError(
                        this.curr.start,
                        this.curr.end,
                        'Expected identifier'
                    )
                );
            }

            const varName = this.curr;
            res.registerStep();
            this.step();

            if (this.curr.type !== ASSIGN)
                return res.failure(
                    new InvalidSyntaxError(
                        this.curr.start,
                        this.curr.end,
                        "Expected '='"
                    )
                );

            res.registerStep();
            this.step();
            const expr = res.register(this.expr());
            if (res.error !== null) return res;

            return res.success(new VariableAssignNode(varName, expr));
        }

        let left = res.register(this.term());
        if (res.error !== null) return res;

        while (this.curr.type === PLUS || this.curr.type === MINUS) {
            let op = this.curr;
            res.registerStep();
            this.step();
            let right = res.register(this.term());
            if (res.error !== null)
                return res.failure(
                    new InvalidSyntaxError(
                        this.curr.start,
                        this.curr.end,
                        "Ecpected 'VAR', int, float, identifier, '+', '-', or '('"
                    )
                );
            left = new BinaryOpNode(left, op, right);
        }

        return res.success(left);
    }

    factor() {
        const res = new ParseResult();
        const currToken = this.curr;

        if (currToken.type === PLUS || currToken.type === MINUS) {
            res.registerStep();
            this.step();
            let factor = res.register(this.factor());
            if (res.error !== null) return res;
            return res.success(new UnaryOpNode(currToken, factor));
        }

        return this.power();
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

    pow(other) {
        if (other instanceof Number) {
            return [
                new Number(Math.pow(this.value, other.value)).setContext(
                    this.context
                ),
                null,
            ];
        }
    }

    copy() {
        let copied = new Number(this.value);
        copied.setPos(this.start, this.end);
        copied.setContext(this.context);
        return copied;
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
SYMBOL TABLE
*/
class SymbolTable {
    constructor() {
        this.symbols = new Map();
        this.parent = null;
    }

    get(varName) {
        let value = this.symbols.get(varName);
        if (value === undefined && this.parent !== null)
            return this.parent.get(varName);
        return value;
    }

    set(varName, value) {
        this.symbols.set(varName, value);
    }

    remove(varName) {
        this.symbols.delete(varName);
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
        if (node instanceof VariableAssignNode)
            return this.traverseVariableAssignNode(node, ctx);
        if (node instanceof VariableNode)
            return this.traverseVariableNode(node, ctx);
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

    traverseVariableNode(node, ctx) {
        let res = new RTResult();
        const varName = node.tokenID.value;
        let value = ctx.symbolTable.get(varName);

        if (value === undefined)
            return res.failure(
                new RuntimeError(
                    node.start,
                    node.end,
                    `'${varName}' is not defined`,
                    ctx
                )
            );

        value = value.copy().setPos(node.start, node.end);
        return res.success(value);
    }

    traverseVariableAssignNode(node, ctx) {
        let res = new RTResult();
        const varName = node.tokenID.value;
        let value = res.register(this.traverse(node.value, ctx));
        if (res.error !== null) return res;

        ctx.symbolTable.set(varName, value);
        return res.success(value);
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
        if (node.op.type == POW) [res, error] = left.pow(right);

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
const GLOBAL = new SymbolTable();
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
    const ctx = new Context('<pop-main>').setTable(GLOBAL);
    let res = interpreter.traverse(ast.node, ctx);

    return [res.value, res.error];
};
