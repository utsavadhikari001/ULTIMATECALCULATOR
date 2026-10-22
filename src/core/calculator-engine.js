export class CalculatorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CalculatorError';
  }
}

const FUNCTION_NAMES = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'ln', 'log', 'log10', 'log2', 'sqrt', 'cbrt', 'root', 'nroot',
  'exp', 'pow10', 'pow2', 'abs', 'floor', 'ceil', 'round', 'recip',
  'fact', 'factorial', 'mod'
]);

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '—';
  if (Object.is(value, -0)) value = 0;
  const magnitude = Math.abs(value);
  if (magnitude >= 1e15 || (magnitude > 0 && magnitude < 1e-7)) {
    return value.toExponential(7)
      .replace(/(\.\d*?[1-9])0+e/, '$1e')
      .replace(/\.0+e/, 'e')
      .replace(/e\+/, 'e');
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 10, useGrouping: true }).format(value);
}

export function formatFinance(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function numberForExpression(value) {
  if (!Number.isFinite(value)) throw new CalculatorError('Result is too large');
  return Object.is(value, -0) ? '0' : String(value);
}

export function ensureFinite(value) {
  if (!Number.isFinite(value)) throw new CalculatorError('Result is too large');
  return value;
}

export function tokenize(source) {
  const text = String(source)
    .replace(/sin⁻¹/gi, 'asin')
    .replace(/cos⁻¹/gi, 'acos')
    .replace(/tan⁻¹/gi, 'atan')
    .replace(/[−–—]/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3');
  const tokens = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const rest = text.slice(index);
    const numberMatch = rest.match(/^(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/);
    if (numberMatch) {
      const value = Number(numberMatch[0]);
      if (!Number.isFinite(value)) throw new CalculatorError('Invalid expression');
      tokens.push({ type: 'number', value });
      index += numberMatch[0].length;
      continue;
    }

    const identifierMatch = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifierMatch) {
      tokens.push({ type: 'identifier', value: identifierMatch[0].toLowerCase() });
      index += identifierMatch[0].length;
      continue;
    }

    if ('+-*/^%!√∛'.includes(char)) {
      tokens.push({ type: 'operator', value: char });
      index += 1;
      continue;
    }
    if (char === '(') {
      tokens.push({ type: 'leftParen', value: char });
      index += 1;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'rightParen', value: char });
      index += 1;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'comma', value: char });
      index += 1;
      continue;
    }
    throw new CalculatorError('Invalid expression');
  }
  return tokens;
}

export function parseExpression(source, options = {}) {
  const tokens = tokenize(source);
  if (!tokens.length) throw new CalculatorError('Incomplete expression');
  let position = 0;
  const peek = (offset = 0) => tokens[position + offset] || null;
  const take = () => tokens[position++] || null;
  const startsAtom = token => Boolean(token && (
    token.type === 'number' || token.type === 'leftParen' || token.type === 'identifier'
  ));

  function parsePrimary() {
    const token = take();
    if (!token) throw new CalculatorError('Incomplete expression');

    if (token.type === 'number') return { type: 'number', value: token.value };

    if (token.type === 'operator' && token.value === '√') {
      return { type: 'call', name: 'sqrt', args: [parseBindingPower(35)] };
    }
    if (token.type === 'operator' && token.value === '∛') {
      return { type: 'call', name: 'cbrt', args: [parseBindingPower(35)] };
    }
    if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
      return { type: 'unary', operator: token.value, argument: parseBindingPower(25) };
    }

    if (token.type === 'leftParen') {
      if (peek()?.type === 'rightParen') throw new CalculatorError('Incomplete expression');
      const inner = parseBindingPower(0);
      if (peek()?.type !== 'rightParen') throw new CalculatorError('Incomplete expression');
      take();
      return inner;
    }

    if (token.type === 'identifier') {
      const name = token.value;
      if (peek()?.type === 'leftParen') {
        take();
        const args = [];
        if (peek()?.type === 'rightParen') {
          take();
          return { type: 'call', name, args };
        }
        while (true) {
          if (!peek() || peek().type === 'comma' || peek().type === 'rightParen') {
            throw new CalculatorError('Incomplete expression');
          }
          args.push(parseBindingPower(0));
          if (peek()?.type === 'comma') {
            take();
            continue;
          }
          if (peek()?.type === 'rightParen') {
            take();
            break;
          }
          throw new CalculatorError('Incomplete expression');
        }
        return { type: 'call', name, args };
      }
      if (name === 'pi') return { type: 'constant', value: Math.PI };
      if (name === 'e') return { type: 'constant', value: Math.E };
      if (name === 'ans') return { type: 'constant', value: options.answer ?? 0 };
      if (name === 'x') return { type: 'variable', name: 'x' };
      if (FUNCTION_NAMES.has(name)) throw new CalculatorError('Incomplete expression');
      throw new CalculatorError('Invalid expression');
    }

    throw new CalculatorError('Incomplete expression');
  }

  function parseBindingPower(minimum) {
    let left = parsePrimary();

    while (position < tokens.length) {
      const token = peek();
      if (!token || token.type === 'rightParen' || token.type === 'comma') break;

      if (token.type === 'operator' && token.value === '!') {
        if (40 < minimum) break;
        take();
        left = { type: 'factorial', argument: left };
        continue;
      }

      let operator = null;
      let leftBinding = -1;
      let rightBinding = -1;
      let implicit = false;

      if (token.type === 'operator' && token.value === '%') {
        const next = peek(1);
        if (startsAtom(next)) {
          operator = '%';
          leftBinding = 20;
          rightBinding = 21;
        } else {
          if (40 < minimum) break;
          take();
          left = { type: 'percent', argument: left };
          continue;
        }
      } else if (token.type === 'identifier' && token.value === 'mod') {
        operator = 'mod';
        leftBinding = 20;
        rightBinding = 21;
      } else if (token.type === 'operator' && ['+', '-', '*', '/', '^'].includes(token.value)) {
        operator = token.value;
        if (operator === '+' || operator === '-') {
          leftBinding = 10;
          rightBinding = 11;
        } else if (operator === '*' || operator === '/') {
          leftBinding = 20;
          rightBinding = 21;
        } else if (operator === '^') {
          leftBinding = 30;
          rightBinding = 30;
        }
      } else if (startsAtom(token) || (token.type === 'operator' && (token.value === '√' || token.value === '∛'))) {
        operator = '*';
        leftBinding = 20;
        rightBinding = 21;
        implicit = true;
      } else {
        break;
      }

      if (leftBinding < minimum) break;
      if (!implicit) take();
      const right = parseBindingPower(rightBinding);
      left = { type: 'binary', operator, left, right };
    }

    return left;
  }

  const tree = parseBindingPower(0);
  if (position < tokens.length) {
    const token = peek();
    if (token?.type === 'rightParen' || token?.type === 'comma') throw new CalculatorError('Incomplete expression');
    throw new CalculatorError('Invalid expression');
  }
  return tree;
}

export function factorial(value) {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value) || value > 170) {
    throw new CalculatorError('Factorial requires a whole number from 0 to 170');
  }
  let result = 1;
  for (let n = 2; n <= value; n += 1) result *= n;
  return ensureFinite(result);
}

function evaluateCall(name, args, angleMode = 'DEG') {
  const unary = fn => {
    if (args.length !== 1) throw new CalculatorError('Invalid expression');
    return ensureFinite(fn(args[0]));
  };
  const angleInput = value => angleMode === 'DEG' ? value * Math.PI / 180 : value;
  const angleOutput = value => angleMode === 'DEG' ? value * 180 / Math.PI : value;

  switch (name) {
    case 'sin': return unary(x => Math.sin(angleInput(x)));
    case 'cos': return unary(x => Math.cos(angleInput(x)));
    case 'tan': return unary(x => {
      const radians = angleInput(x);
      if (Math.abs(Math.cos(radians)) < 1e-12) throw new CalculatorError('Undefined trigonometric value');
      return Math.tan(radians);
    });
    case 'asin': return unary(x => {
      if (Math.abs(x) > 1) throw new CalculatorError('Invalid inverse trigonometric value');
      return angleOutput(Math.asin(x));
    });
    case 'acos': return unary(x => {
      if (Math.abs(x) > 1) throw new CalculatorError('Invalid inverse trigonometric value');
      return angleOutput(Math.acos(x));
    });
    case 'atan': return unary(x => angleOutput(Math.atan(x)));
    case 'sinh': return unary(Math.sinh);
    case 'cosh': return unary(Math.cosh);
    case 'tanh': return unary(Math.tanh);
    case 'asinh': return unary(Math.asinh);
    case 'acosh': return unary(x => {
      if (x < 1) throw new CalculatorError('Invalid hyperbolic value');
      return Math.acosh(x);
    });
    case 'atanh': return unary(x => {
      if (Math.abs(x) >= 1) throw new CalculatorError('Invalid hyperbolic value');
      return Math.atanh(x);
    });
    case 'ln':
      if (args.length !== 1 || args[0] <= 0) throw new CalculatorError('Invalid logarithm');
      return ensureFinite(Math.log(args[0]));
    case 'log':
    case 'log10':
      if (args.length !== 1 || args[0] <= 0) throw new CalculatorError('Invalid logarithm');
      return ensureFinite(Math.log10(args[0]));
    case 'log2':
      if (args.length !== 1 || args[0] <= 0) throw new CalculatorError('Invalid logarithm');
      return ensureFinite(Math.log2(args[0]));
    case 'sqrt':
      if (args.length !== 1 || args[0] < 0) throw new CalculatorError('Invalid square root');
      return ensureFinite(Math.sqrt(args[0]));
    case 'cbrt': return unary(Math.cbrt);
    case 'root':
    case 'nroot': {
      if (args.length !== 2 || args[1] === 0) throw new CalculatorError('Invalid root');
      const [radicand, degree] = args;
      if (radicand < 0) {
        if (!Number.isInteger(degree) || Math.abs(degree % 2) !== 1) throw new CalculatorError('Invalid root');
        return ensureFinite(-Math.pow(-radicand, 1 / degree));
      }
      return ensureFinite(Math.pow(radicand, 1 / degree));
    }
    case 'exp': return unary(Math.exp);
    case 'pow10': return unary(x => Math.pow(10, x));
    case 'pow2': return unary(x => Math.pow(2, x));
    case 'abs': return unary(Math.abs);
    case 'floor': return unary(Math.floor);
    case 'ceil': return unary(Math.ceil);
    case 'round': return unary(Math.round);
    case 'recip':
      if (args.length !== 1) throw new CalculatorError('Invalid expression');
      if (args[0] === 0) throw new CalculatorError('Cannot divide by zero');
      return ensureFinite(1 / args[0]);
    case 'fact':
    case 'factorial':
      if (args.length !== 1) throw new CalculatorError('Invalid expression');
      return factorial(args[0]);
    case 'mod':
      if (args.length !== 2) throw new CalculatorError('Invalid expression');
      if (args[1] === 0) throw new CalculatorError('Cannot divide by zero');
      return ensureFinite(args[0] % args[1]);
    default: throw new CalculatorError('Invalid expression');
  }
}

export function evaluateTree(node, context = {}) {
  switch (node.type) {
    case 'number':
    case 'constant': return node.value;
    case 'variable':
      if (node.name === 'x' && Number.isFinite(context.x)) return context.x;
      throw new CalculatorError('Use a numeric value for x');
    case 'unary': {
      const value = evaluateTree(node.argument, context);
      return ensureFinite(node.operator === '-' ? -value : value);
    }
    case 'percent': return ensureFinite(evaluateTree(node.argument, context) / 100);
    case 'factorial': return factorial(evaluateTree(node.argument, context));
    case 'call': return evaluateCall(node.name, node.args.map(argument => evaluateTree(argument, context)), context.angleMode || 'DEG');
    case 'binary': {
      const left = evaluateTree(node.left, context);
      const right = evaluateTree(node.right, context);
      switch (node.operator) {
        case '+':
          return ensureFinite(node.right.type === 'percent' ? left + left * evaluateTree(node.right.argument, context) / 100 : left + right);
        case '-':
          return ensureFinite(node.right.type === 'percent' ? left - left * evaluateTree(node.right.argument, context) / 100 : left - right);
        case '*': return ensureFinite(left * right);
        case '/':
          if (right === 0) throw new CalculatorError('Cannot divide by zero');
          return ensureFinite(left / right);
        case '%':
        case 'mod':
          if (right === 0) throw new CalculatorError('Cannot divide by zero');
          return ensureFinite(left % right);
        case '^': {
          const value = Math.pow(left, right);
          if (Number.isNaN(value)) throw new CalculatorError('Invalid expression');
          return ensureFinite(value);
        }
        default: throw new CalculatorError('Invalid expression');
      }
    }
    default: throw new CalculatorError('Invalid expression');
  }
}

export function calculate(source, context = {}, settings = {}) {
  const text = String(source);
  const hasDegreeMarker = text.includes('°');
  const angleMode = hasDegreeMarker ? 'DEG' : (settings.angleMode || context.angleMode || 'DEG');
  const normalized = hasDegreeMarker ? text.replace(/°/g, '') : text;
  const evaluationContext = { ...context, angleMode };
  return ensureFinite(evaluateTree(parseExpression(normalized, { answer: settings.answer ?? 0 }), evaluationContext));
}
