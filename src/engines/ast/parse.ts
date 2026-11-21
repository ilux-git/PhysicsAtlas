import type { AstNode } from '../../domain/types.ts';

export type ParseErrorCode =
  | 'empty-expression'
  | 'unexpected-character'
  | 'unexpected-token'
  | 'unexpected-end'
  | 'unknown-symbol'
  | 'unknown-function'
  | 'missing-parenthesis'
  | 'invalid-exponent'
  | 'invalid-equation';

export class FormulaParseError extends Error {
  readonly code: ParseErrorCode;
  readonly position: number;

  constructor(code: ParseErrorCode, message: string, position = 0) {
    super(message);
    this.name = 'FormulaParseError';
    this.code = code;
    this.position = position;
  }
}

export interface ParseOptions {
  /** Map from the written symbol (e.g. "m") to a canonical quantity ID (e.g. "q.mass"). */
  symbols: ReadonlyMap<string, string>;
}

type TokenType = 'number' | 'ident' | 'op' | 'lparen' | 'rparen';

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const OPERATORS = new Set(['+', '-', '*', '/', '^']);

function normalizeSource(source: string): string {
  return source
    .replace(/[−–]/g, '-')
    .replace(/[·×⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/√/g, 'sqrt ');
}

function tokenize(source: string): Token[] {
  const text = normalizeSource(source);
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === undefined) break;
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(character)) {
      const start = index;
      while (index < text.length && /[0-9.]/.test(text[index] ?? '')) index += 1;
      const value = text.slice(start, index);
      if (value === '.' || Number.isNaN(Number(value))) {
        throw new FormulaParseError('unexpected-character', `Некорректное число «${value}».`, start);
      }
      tokens.push({ type: 'number', value, position: start });
      continue;
    }
    if (/[A-Za-z]/.test(character)) {
      const start = index;
      while (index < text.length && /[A-Za-z0-9_]/.test(text[index] ?? '')) index += 1;
      tokens.push({ type: 'ident', value: text.slice(start, index), position: start });
      continue;
    }
    if (OPERATORS.has(character)) {
      tokens.push({ type: 'op', value: character, position: index });
      index += 1;
      continue;
    }
    if (character === '(') {
      tokens.push({ type: 'lparen', value: character, position: index });
      index += 1;
      continue;
    }
    if (character === ')') {
      tokens.push({ type: 'rparen', value: character, position: index });
      index += 1;
      continue;
    }
    throw new FormulaParseError(
      'unexpected-character',
      `Недопустимый символ «${character}» на позиции ${index + 1}. Разрешены числа, символы величин, + − * / ^, скобки и sqrt().`,
      index,
    );
  }
  return tokens;
}

class Parser {
  private readonly tokens: Token[];
  private readonly options: ParseOptions;
  private index = 0;

  constructor(tokens: Token[], options: ParseOptions) {
    this.tokens = tokens;
    this.options = options;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private consume(): Token {
    const token = this.tokens[this.index];
    if (!token) {
      throw new FormulaParseError('unexpected-end', 'Формула заканчивается неожиданно.', this.tokens.length);
    }
    this.index += 1;
    return token;
  }

  parse(): AstNode {
    if (this.tokens.length === 0) {
      throw new FormulaParseError('empty-expression', 'Формула пуста.');
    }
    const node = this.parseBinary(1);
    const rest = this.peek();
    if (rest) {
      throw new FormulaParseError(
        'unexpected-token',
        `Неожиданный фрагмент «${rest.value}» на позиции ${rest.position + 1}.`,
        rest.position,
      );
    }
    return node;
  }

  private parseBinary(minPrecedence: number): AstNode {
    let left = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (!token) break;

      const implicitMultiplication =
        token.type === 'number' || token.type === 'ident' || token.type === 'lparen';
      if (implicitMultiplication) {
        const precedence = 3;
        if (precedence < minPrecedence) break;
        const right = this.parseBinary(precedence + 1);
        left = { type: 'multiply', left, right };
        continue;
      }

      if (token.type !== 'op') break;
      const precedence =
        token.value === '+' || token.value === '-' ? 1 : token.value === '*' || token.value === '/' ? 2 : 99;
      if (precedence === 99 || precedence < minPrecedence) break;

      this.consume();
      const right = this.parseBinary(precedence + 1);
      switch (token.value) {
        case '+':
          left = { type: 'add', left, right };
          break;
        case '-':
          left = { type: 'subtract', left, right };
          break;
        case '*':
          left = { type: 'multiply', left, right };
          break;
        case '/':
          left = { type: 'divide', left, right };
          break;
      }
    }
    return left;
  }

  private parseUnary(): AstNode {
    const token = this.peek();
    if (token?.type === 'op' && token.value === '-') {
      this.consume();
      return { type: 'negate', arg: this.parseUnary() };
    }
    if (token?.type === 'op' && token.value === '+') {
      this.consume();
      return this.parseUnary();
    }
    return this.parsePower();
  }

  private parsePower(): AstNode {
    const base = this.parsePrimary();
    const token = this.peek();
    if (token?.type === 'op' && token.value === '^') {
      this.consume();
      const exponent = this.parseExponent();
      return { type: 'power', base, exponent };
    }
    return base;
  }

  private parseExponent(): number {
    let sign = 1;
    const token = this.peek();
    if (token?.type === 'op' && (token.value === '-' || token.value === '+')) {
      this.consume();
      if (token.value === '-') sign = -1;
    }
    const numberToken = this.peek();
    if (!numberToken || numberToken.type !== 'number') {
      const position = numberToken?.position ?? this.tokens.length;
      throw new FormulaParseError(
        'invalid-exponent',
        'Показатель степени должен быть целым числом.',
        position,
      );
    }
    this.consume();
    const exponent = sign * Number(numberToken.value);
    if (!Number.isInteger(exponent) || exponent < -12 || exponent > 12) {
      throw new FormulaParseError(
        'invalid-exponent',
        `Показатель степени «${numberToken.value}» должен быть целым числом от −12 до 12.`,
        numberToken.position,
      );
    }
    return exponent;
  }

  private parsePrimary(): AstNode {
    const token = this.peek();
    if (!token) {
      throw new FormulaParseError('unexpected-end', 'Формула заканчивается неожиданно.', this.tokens.length);
    }
    if (token.type === 'number') {
      this.consume();
      return { type: 'constant', name: token.value, value: Number(token.value) };
    }
    if (token.type === 'lparen') {
      this.consume();
      const node = this.parseBinary(1);
      const closing = this.peek();
      if (!closing || closing.type !== 'rparen') {
        throw new FormulaParseError(
          'missing-parenthesis',
          'Не найдена закрывающая скобка.',
          closing?.position ?? this.tokens.length,
        );
      }
      this.consume();
      return node;
    }
    if (token.type === 'ident') {
      this.consume();
      const next = this.peek();
      if (next?.type === 'lparen') {
        this.consume();
        if (token.value !== 'sqrt') {
          throw new FormulaParseError(
            'unknown-function',
            `Функция «${token.value}» не поддерживается. Разрешена только sqrt(...).`,
            token.position,
          );
        }
        const argument = this.parseBinary(1);
        const closing = this.peek();
        if (!closing || closing.type !== 'rparen') {
          throw new FormulaParseError(
            'missing-parenthesis',
            'Не найдена закрывающая скобка в sqrt(...).',
            closing?.position ?? this.tokens.length,
          );
        }
        this.consume();
        return { type: 'sqrt', arg: argument };
      }
      const quantityId = this.options.symbols.get(token.value);
      if (!quantityId) {
        throw new FormulaParseError(
          'unknown-symbol',
          `Символ «${token.value}» не связан ни с одной величиной атласа.`,
          token.position,
        );
      }
      return { type: 'variable', quantityId };
    }
    throw new FormulaParseError(
      token.type === 'rparen' ? 'unexpected-token' : 'unexpected-character',
      `Неожиданный фрагмент «${token.value}» на позиции ${token.position + 1}.`,
      token.position,
    );
  }
}

export function parseExpression(source: string, options: ParseOptions): AstNode {
  return new Parser(tokenize(source), options).parse();
}

export function parseEquation(
  source: string,
  options: ParseOptions,
): { lhs: AstNode; rhs: AstNode } {
  const parts = source.split('=');
  if (parts.length !== 2) {
    throw new FormulaParseError(
      'invalid-equation',
      'Уравнение должно содержать ровно один знак «=».',
    );
  }
  const lhsText = parts[0]?.trim() ?? '';
  const rhsText = parts[1]?.trim() ?? '';
  if (lhsText.length === 0 || rhsText.length === 0) {
    throw new FormulaParseError(
      'empty-expression',
      'Обе части уравнения должны быть непустыми.',
    );
  }
  return { lhs: parseExpression(lhsText, options), rhs: parseExpression(rhsText, options) };
}

function astPrecedence(node: AstNode): number {
  switch (node.type) {
    case 'add':
    case 'subtract':
      return 1;
    case 'multiply':
    case 'divide':
      return 2;
    case 'negate':
      return 3;
    case 'power':
    case 'sqrt':
      return 4;
    case 'variable':
    case 'constant':
      return 5;
  }
}

export function astToInfix(node: AstNode, quantitySymbols?: ReadonlyMap<string, string>): string {
  const symbol = (quantityId: string): string => quantitySymbols?.get(quantityId) ?? quantityId;
  const render = (child: AstNode, minPrecedence: number, side: 'left' | 'right'): string => {
    const text = astToInfix(child, quantitySymbols);
    const precedence = astPrecedence(child);
    const needsParentheses =
      precedence < minPrecedence || (side === 'right' && precedence === minPrecedence);
    return needsParentheses ? `(${text})` : text;
  };

  switch (node.type) {
    case 'variable':
      return symbol(node.quantityId);
    case 'constant':
      return node.display ?? String(node.value);
    case 'negate':
      return `−${render(node.arg, 3, 'right')}`;
    case 'sqrt':
      return `sqrt(${astToInfix(node.arg, quantitySymbols)})`;
    case 'power': {
      const atomLike =
        node.base.type === 'variable' || node.base.type === 'constant' || node.base.type === 'sqrt';
      const base = atomLike ? astToInfix(node.base, quantitySymbols) : `(${astToInfix(node.base, quantitySymbols)})`;
      return `${base}^${node.exponent}`;
    }
    case 'add':
      return `${render(node.left, 1, 'left')} + ${render(node.right, 1, 'right')}`;
    case 'subtract':
      return `${render(node.left, 1, 'left')} − ${render(node.right, 1, 'right')}`;
    case 'multiply':
      return `${render(node.left, 2, 'left')} · ${render(node.right, 2, 'right')}`;
    case 'divide':
      return `${render(node.left, 2, 'left')} / ${render(node.right, 2, 'right')}`;
  }
}