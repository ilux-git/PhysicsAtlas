import type { AstNode } from '../../domain/types.ts';
import { FormulaParseError, parseExpression, type ParseOptions } from './parse.ts';

class LatexConverter {
  private readonly source: string;
  private index = 0;

  constructor(source: string) {
    this.source = source;
  }

  convert(): string {
    const text = this.readSequence(false);
    if (this.index < this.source.length) {
      throw this.error('Не удалось разобрать отображение формулы.');
    }
    return text;
  }

  private error(message: string): FormulaParseError {
    return new FormulaParseError('unsupported-latex', message, this.index);
  }

  private readSequence(stopAtBrace: boolean): string {
    let output = '';
    while (this.index < this.source.length) {
      const character = this.source[this.index] ?? '';
      if (character === '}') {
        if (!stopAtBrace) throw this.error('Лишняя закрывающая скобка в отображении.');
        this.index += 1;
        return output;
      }
      if (character === '{') {
        this.index += 1;
        output += `(${this.readSequence(true)})`;
        continue;
      }
      if (character === '\\') {
        output += this.readCommand();
        continue;
      }
      if (character === '^') {
        output += this.readExponent();
        continue;
      }
      if (character === '$' || character === '&' || character === '_') {
        throw this.error(`Неподдерживаемый символ «${character}» в отображении.`);
      }
      output += character;
      this.index += 1;
    }
    if (stopAtBrace) throw this.error('Не закрыта группа в отображении.');
    return output;
  }

  private readCommand(): string {
    this.index += 1;
    const start = this.index;
    while (this.index < this.source.length && /[a-zA-Z]/.test(this.source[this.index] ?? '')) {
      this.index += 1;
    }
    const name = this.source.slice(start, this.index);
    if (name.length === 0) {
      const symbol = this.source[this.index] ?? '';
      this.index += 1;
      if (symbol === ',') return ' ';
      if (symbol === '!' || symbol === ';') return ' ';
      throw this.error(`Неподдерживаемая команда «\\${symbol}».`);
    }
    switch (name) {
      case 'frac': {
        const numerator = this.readArgument();
        const denominator = this.readArgument();
        return `(${numerator})/(${denominator})`;
      }
      case 'sqrt':
        return `sqrt(${this.readArgument()})`;
      case 'cdot':
      case 'times':
        return '*';
      case 'div':
        return '/';
      case 'left':
        return this.readDelimiter(true);
      case 'right':
        return this.readDelimiter(false);
      case 'quad':
      case 'qquad':
        return ' ';
      default:
        throw this.error(`Неподдерживаемая команда «\\${name}».`);
    }
  }

  private readDelimiter(opening: boolean): string {
    while (this.index < this.source.length && /\s/.test(this.source[this.index] ?? '')) {
      this.index += 1;
    }
    const delimiter = this.source[this.index] ?? '';
    this.index += 1;
    if (delimiter === '.') return '';
    if (opening && (delimiter === '(' || delimiter === '[')) return '(';
    if (!opening && (delimiter === ')' || delimiter === ']')) return ')';
    if (delimiter === '|') return '|';
    throw this.error(`Неподдерживаемый разделитель «${delimiter}».`);
  }

  private readArgument(): string {
    while (this.index < this.source.length && /\s/.test(this.source[this.index] ?? '')) {
      this.index += 1;
    }
    const character = this.source[this.index] ?? '';
    if (character !== '{') {
      throw this.error('Аргумент команды должен быть записан в фигурных скобках.');
    }
    this.index += 1;
    return this.readSequence(true).trim();
  }

  private readExponent(): string {
    this.index += 1;
    if (this.source[this.index] === '{') {
      this.index += 1;
      const exponent = this.readSequence(true).trim();
      if (!/^[+-]?\d+$/.test(exponent)) {
        throw this.error('Показатель степени в отображении должен быть целым числом.');
      }
      return `^${exponent}`;
    }
    const start = this.index;
    if (this.source[this.index] === '-' || this.source[this.index] === '+') this.index += 1;
    while (this.index < this.source.length && /[0-9]/.test(this.source[this.index] ?? '')) {
      this.index += 1;
    }
    const exponent = this.source.slice(start, this.index);
    if (!/^[+-]?\d+$/.test(exponent)) {
      throw this.error('Показатель степени в отображении должен быть целым числом.');
    }
    return `^${exponent}`;
  }
}

export function latexToExpression(source: string): string {
  return new LatexConverter(source).convert();
}

export function parseDisplayEquation(
  source: string,
  options: ParseOptions,
): { lhs: AstNode; rhs: AstNode } {
  const parts = source.split('=');
  if (parts.length !== 2) {
    throw new FormulaParseError(
      'invalid-equation',
      'Отображение уравнения должно содержать ровно один знак «=».',
    );
  }
  const lhsText = latexToExpression(parts[0]?.trim() ?? '');
  const rhsText = latexToExpression(parts[1]?.trim() ?? '');
  if (lhsText.trim().length === 0 || rhsText.trim().length === 0) {
    throw new FormulaParseError('empty-expression', 'Обе части отображения должны быть непустыми.');
  }
  return {
    lhs: parseExpression(lhsText, options),
    rhs: parseExpression(rhsText, options),
  };
}