/*
 * Clear Calculator
 * A dependency-free calculator and set of everyday math tools.
 * All expression parsing and calculations happen locally in this file.
 */

'use strict';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const state = {
  mode: 'basic',
  tool: 'percent',
  expression: '',
  answer: null,
  preview: 0,
  memory: 0,
  hasMemory: false,
  angleMode: 'DEG',
  second: false,
  error: '',
  justEvaluated: false,
  theme: 'dark',
  graph: { centerX: 0, centerY: 0, zoom: 1, markers: [], cursor: null, drag: null, nextId: 1 },
  converterCategory: 'length',
  converterResult: null,
  statisticsMode: 'population',
  programmerBase: 10,
  lastBitOperation: null
};

class CalculatorError extends Error {
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

function formatNumber(value) {
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

function formatFinance(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function numberForExpression(value) {
  if (!Number.isFinite(value)) throw new CalculatorError('Result is too large');
  return Object.is(value, -0) ? '0' : String(value);
}

function ensureFinite(value) {
  if (!Number.isFinite(value)) throw new CalculatorError('Result is too large');
  return value;
}

function tokenize(source) {
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

function parseExpression(source) {
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
      if (name === 'ans') return { type: 'constant', value: state.answer ?? 0 };
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

function factorial(value) {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value) || value > 170) {
    throw new CalculatorError('Factorial requires a whole number from 0 to 170');
  }
  let result = 1;
  for (let n = 2; n <= value; n += 1) result *= n;
  return ensureFinite(result);
}

function evaluateCall(name, args) {
  const unary = fn => {
    if (args.length !== 1) throw new CalculatorError('Invalid expression');
    return ensureFinite(fn(args[0]));
  };
  const angleInput = value => state.angleMode === 'DEG' ? value * Math.PI / 180 : value;
  const angleOutput = value => state.angleMode === 'DEG' ? value * 180 / Math.PI : value;

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

function evaluateTree(node, context = {}) {
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
    case 'call': return evaluateCall(node.name, node.args.map(argument => evaluateTree(argument, context)));
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

function calculate(source, context = {}) {
  const text = String(source);
  const hasDegreeMarker = text.includes('°');
  const previousAngleMode = state.angleMode;
  if (hasDegreeMarker) state.angleMode = 'DEG';
  try {
    const normalized = hasDegreeMarker ? text.replace(/°/g, '') : text;
    return ensureFinite(evaluateTree(parseExpression(normalized), context));
  } finally {
    state.angleMode = previousAngleMode;
  }
}

const scienceActions = {
  sin: { label: 'sin', secondLabel: 'asin', type: 'function', value: 'sin', secondValue: 'asin' },
  cos: { label: 'cos', secondLabel: 'acos', type: 'function', value: 'cos', secondValue: 'acos' },
  tan: { label: 'tan', secondLabel: 'atan', type: 'function', value: 'tan', secondValue: 'atan' },
  sinh: { label: 'sinh', secondLabel: 'asinh', type: 'function', value: 'sinh', secondValue: 'asinh' },
  cosh: { label: 'cosh', secondLabel: 'acosh', type: 'function', value: 'cosh', secondValue: 'acosh' },
  tanh: { label: 'tanh', secondLabel: 'atanh', type: 'function', value: 'tanh', secondValue: 'atanh' },
  ln: { label: 'ln', secondLabel: 'eˣ', type: 'function', value: 'ln', secondValue: 'exp' },
  log: { label: 'log', secondLabel: '10ˣ', type: 'function', value: 'log', secondValue: 'pow10' },
  log2: { label: 'log₂', secondLabel: '2ˣ', type: 'function', value: 'log2', secondValue: 'pow2' },
  sqrt: { label: '√x', secondLabel: 'x²', type: 'function', value: 'sqrt', secondType: 'suffix', secondValue: '^2' },
  cbrt: { label: '∛x', secondLabel: 'x³', type: 'function', value: 'cbrt', secondType: 'suffix', secondValue: '^3' },
  square: { label: 'x²', secondLabel: '√x', type: 'suffix', value: '^2', secondType: 'function', secondValue: 'sqrt' },
  cube: { label: 'x³', secondLabel: '∛x', type: 'suffix', value: '^3', secondType: 'function', secondValue: 'cbrt' },
  power: { label: 'xʸ', secondLabel: 'ⁿ√', type: 'suffix', value: '^', secondType: 'nthRoot' },
  root: { label: 'ⁿ√', secondLabel: 'xʸ', type: 'nthRoot', secondType: 'suffix', secondValue: '^' },
  reciprocal: { label: '1/x', type: 'function', value: 'recip' },
  factorial: { label: 'n!', type: 'suffix', value: '!' },
  abs: { label: '|x|', type: 'function', value: 'abs' },
  floor: { label: 'floor', type: 'function', value: 'floor' },
  ceil: { label: 'ceil', type: 'function', value: 'ceil' },
  mod: { label: 'mod', type: 'operator', value: ' mod ' },
  pi: { label: 'π', type: 'constant', value: 'π' },
  e: { label: 'e', type: 'constant', value: 'e' },
  exp: { label: 'eˣ', type: 'function', value: 'exp' },
  pow10: { label: '10ˣ', type: 'function', value: 'pow10' },
  ans: { label: 'Ans', type: 'constant', value: 'Ans' },
  percent: { label: '%', type: 'key', value: '%' }
};

function updateDisplay() {
  const expressionDisplay = $('#expression-display');
  const resultDisplay = $('#result-display');
  const errorDisplay = $('#error-message');
  const expression = state.expression;

  expressionDisplay.textContent = expression || 'Type a calculation';
  expressionDisplay.classList.toggle('is-placeholder', !expression);
  if (expression) {
    requestAnimationFrame(() => { expressionDisplay.scrollLeft = expressionDisplay.scrollWidth; });
  }

  if (!expression.trim()) {
    state.preview = 0;
    resultDisplay.textContent = '0';
  } else if (state.justEvaluated && state.preview !== null) {
    resultDisplay.textContent = formatNumber(state.preview);
  } else {
    try {
      state.preview = calculate(expression);
      resultDisplay.textContent = formatNumber(state.preview);
    } catch (error) {
      state.preview = null;
      resultDisplay.textContent = '—';
    }
  }

  if (state.error) {
    errorDisplay.textContent = state.error;
    errorDisplay.hidden = false;
  } else {
    errorDisplay.textContent = '';
    errorDisplay.hidden = true;
  }
  $('#memory-indicator').hidden = !state.hasMemory;
  const answerStatus = $('#ans-status');
  answerStatus.hidden = state.answer === null;
  answerStatus.textContent = state.answer === null ? '' : `ANS = ${formatNumber(state.answer)}`;
}

function clearExpression() {
  state.expression = '';
  state.error = '';
  state.justEvaluated = false;
  updateDisplay();
}

function appendKey(value) {
  const operators = ['+', '−', '×', '÷', '*', '/', '^', ' mod '];
  const isOperator = operators.includes(value);
  const startsNew = /^\d$/.test(value) || value === '.' || value === '(' || value === 'π' || value === 'e' || value === 'Ans';

  if (state.justEvaluated) {
    if (isOperator || value === '%' || value === '!') {
      state.expression = numberForExpression(state.preview ?? state.answer ?? 0);
    } else if (startsNew) {
      state.expression = '';
    }
    state.justEvaluated = false;
  }

  if (value === '.') {
    const currentNumber = state.expression.match(/(?:^|[+\-×÷*/^(, ])(\d*\.?\d*)$/)?.[1] ?? '';
    if (currentNumber.includes('.')) return;
    if (!currentNumber) state.expression += '0';
  }

  if (isOperator && value !== ' mod ') {
    if (!state.expression.trim()) {
      if (value === '−') state.expression = '−';
      else return;
    } else if (/[+−×÷*/^]$/.test(state.expression)) {
      if (value === '−') {
        state.expression += value;
      } else {
        state.expression = state.expression.replace(/[+−×÷*/^]$/, value);
      }
      state.error = '';
      updateDisplay();
      return;
    }
  }

  if (value === ' mod ') {
    if (!state.expression || /[+−×÷*/^(]$/.test(state.expression)) return;
  }

  state.expression += value;
  state.error = '';
  updateDisplay();
}

function backspace() {
  if (state.justEvaluated) {
    state.expression = numberForExpression(state.preview ?? state.answer ?? 0);
    state.justEvaluated = false;
  }
  state.expression = state.expression.slice(0, -1);
  state.error = '';
  updateDisplay();
}

function toggleSign() {
  state.error = '';
  if (state.justEvaluated && state.preview !== null) {
    state.expression = numberForExpression(-state.preview);
    state.justEvaluated = false;
  } else if (!state.expression) {
    state.expression = '−';
  } else if (state.expression.startsWith('(-') && state.expression.endsWith(')')) {
    state.expression = state.expression.slice(2, -1);
  } else if (state.expression.startsWith('(−') && state.expression.endsWith(')')) {
    state.expression = state.expression.slice(2, -1);
  } else {
    state.expression = `(-${state.expression})`;
  }
  updateDisplay();
}

function evaluateCurrent() {
  if (!state.expression.trim()) return;
  try {
    const value = calculate(state.expression);
    state.preview = value;
    state.answer = value;
    state.error = '';
    state.justEvaluated = true;
    updateDisplay();
    $('#app-announcer').textContent = `Result ${formatNumber(value)}`;
  } catch (error) {
    state.error = error instanceof CalculatorError ? error.message : 'Invalid expression';
    state.preview = null;
    updateDisplay();
  }
}

function appendFunction(name) {
  state.error = '';
  if (state.justEvaluated && state.preview !== null) {
    state.expression = `${name}(${numberForExpression(state.preview)})`;
    state.justEvaluated = false;
    updateDisplay();
    return;
  }

  if (state.expression.trim()) {
    const endsWithValue = /(?:\d|\)|!|%|pi|\be|\bans)$/i.test(state.expression.trim());
    if (endsWithValue) {
      try {
        calculate(state.expression);
        state.expression = `${name}(${state.expression})`;
        updateDisplay();
        return;
      } catch (_) {
        // An incomplete expression should keep the function as a prefix.
      }
    }
  }
  state.expression += `${name}(`;
  updateDisplay();
}

function appendNthRoot() {
  state.error = '';
  if (state.justEvaluated && state.preview !== null) {
    state.expression = `root(${numberForExpression(state.preview)},`;
    state.justEvaluated = false;
  } else if (state.expression.trim() && /(?:\d|\)|!|%|pi|\be|\bans)$/i.test(state.expression.trim())) {
    try {
      calculate(state.expression);
      state.expression = `root(${state.expression},`;
    } catch (_) {
      state.expression += 'root(';
    }
  } else {
    state.expression += 'root(';
  }
  updateDisplay();
}

function appendSuffix(suffix) {
  if (!state.expression && state.justEvaluated && state.preview !== null) {
    state.expression = numberForExpression(state.preview);
    state.justEvaluated = false;
  } else if (state.justEvaluated && state.preview !== null) {
    state.expression = numberForExpression(state.preview);
    state.justEvaluated = false;
  }
  if (!state.expression.trim() || /[+−×÷*/^,(]$/.test(state.expression.trim())) return;
  state.expression += suffix;
  state.error = '';
  updateDisplay();
}

function handleScientificButton(button) {
  const id = button.dataset.scientific;
  if (id === 'second') {
    state.second = !state.second;
    button.setAttribute('aria-pressed', String(state.second));
    button.classList.toggle('is-active', state.second);
    renderScientificLabels();
    return;
  }

  const action = scienceActions[id];
  if (!action) return;
  const useSecond = state.second && (action.secondValue || action.secondType);
  const type = useSecond ? (action.secondType || action.type) : action.type;
  const value = useSecond ? action.secondValue : action.value;
  state.error = '';

  if (type === 'function') appendFunction(value);
  else if (type === 'suffix') appendSuffix(value);
  else if (type === 'nthRoot') appendNthRoot();
  else if (type === 'operator' || type === 'constant' || type === 'key') appendKey(value);

  if (state.second) {
    state.second = false;
    const secondButton = $('[data-scientific="second"]');
    if (secondButton) {
      secondButton.setAttribute('aria-pressed', 'false');
      secondButton.classList.remove('is-active');
    }
    renderScientificLabels();
  }
}

function renderScientificLabels() {
  $$('[data-scientific]').forEach(button => {
    const id = button.dataset.scientific;
    if (id === 'second') return;
    const action = scienceActions[id];
    if (!action) return;
    button.textContent = state.second && action.secondLabel ? action.secondLabel : action.label;
  });
}

function currentCalculatorValue() {
  if (state.preview !== null && Number.isFinite(state.preview)) return state.preview;
  if (!state.expression.trim()) return state.answer ?? 0;
  throw new CalculatorError('Enter a valid expression first');
}

function handleMemory(action) {
  try {
    if (action === 'mc') {
      state.memory = 0;
      state.hasMemory = false;
    } else if (action === 'mr') {
      if (state.hasMemory) {
        if (state.justEvaluated) {
          state.expression = '';
          state.justEvaluated = false;
        }
        const endsWithValue = /(?:\d|\)|!|%|pi|\be|\bans)$/i.test(state.expression.trim());
        if (endsWithValue) state.expression += '×';
        state.expression += numberForExpression(state.memory);
        state.error = '';
        updateDisplay();
      }
      return;
    } else {
      const value = currentCalculatorValue();
      if (action === 'ms') state.memory = value;
      if (action === 'mplus') state.memory = (state.hasMemory ? state.memory : 0) + value;
      if (action === 'mminus') state.memory = (state.hasMemory ? state.memory : 0) - value;
      state.hasMemory = true;
      if (!Number.isFinite(state.memory)) throw new CalculatorError('Result is too large');
    }
    state.error = '';
    updateDisplay();
  } catch (error) {
    state.error = error.message || 'Enter a valid expression first';
    updateDisplay();
  }
}

function setMode(mode) {
  state.mode = mode;
  $('#calculator-view').hidden = !(mode === 'basic' || mode === 'scientific');
  $('#converter-view').hidden = mode !== 'converter';
  $('#tools-view').hidden = mode !== 'tools';
  $('#graph-view').hidden = mode !== 'graph';
  $$('[data-mode]').forEach(button => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $('#scientific-functions').hidden = mode !== 'scientific';
  $('#angle-controls').hidden = mode !== 'scientific';
  $('#function-lab').hidden = mode !== 'scientific';
  if (mode === 'scientific') {
    renderLabPresets();
    updateFunctionLab(false);
  }
  $('#display-note').textContent = mode === 'scientific' ? 'Angle mode: ' + state.angleMode : 'Calculations stay on this device';
  if (mode === 'graph') requestAnimationFrame(scheduleGraphDraw);
}

function setTool(tool) {
  state.tool = tool;
  $$('.tool-tab').forEach(button => {
    const active = button.dataset.tool === tool;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $$('.tool-page').forEach(panel => { panel.hidden = panel.id !== `tool-${tool}`; });
}

function setAngleMode(mode) {
  state.angleMode = mode;
  $('#angle-deg').classList.toggle('is-active', mode === 'DEG');
  $('#angle-rad').classList.toggle('is-active', mode === 'RAD');
  $('#angle-deg').setAttribute('aria-pressed', String(mode === 'DEG'));
  $('#angle-rad').setAttribute('aria-pressed', String(mode === 'RAD'));
  $('#lab-deg').classList.toggle('is-active', mode === 'DEG');
  $('#lab-rad').classList.toggle('is-active', mode === 'RAD');
  $('#lab-deg').setAttribute('aria-pressed', String(mode === 'DEG'));
  $('#lab-rad').setAttribute('aria-pressed', String(mode === 'RAD'));
  $('#display-note').textContent = state.mode === 'scientific' ? `Angle mode: ${mode}` : 'Calculations stay on this device';
  renderLabPresets();
  updateDisplay();
  if (state.mode === 'scientific' && $('#lab-input').value !== '') updateFunctionLab();
}

function renderLabPresets() {
  const functionName = $('#lab-function').value;
  const container = $('#lab-presets');
  let presets;
  let heading;
  if (['sin', 'cos', 'tan'].includes(functionName)) {
    if (state.angleMode === 'DEG') {
      heading = 'Quick values · degrees';
      presets = [['0°', '0'], ['1°', '1'], ['30°', '30'], ['45°', '45'], ['60°', '60'], ['90°', '90']];
    } else {
      heading = 'Quick values · radians';
      presets = [['0', '0'], ['π/6', 'pi/6'], ['π/4', 'pi/4'], ['π/3', 'pi/3'], ['π/2', 'pi/2'], ['π', 'pi']];
    }
  } else if (['asin', 'acos', 'atan'].includes(functionName)) {
    heading = 'Try an input';
    presets = [['−1', '-1'], ['−0.5', '-0.5'], ['0', '0'], ['0.5', '0.5'], ['1', '1']];
  } else if (functionName === 'sqrt') {
    heading = 'Perfect squares';
    presets = [['0', '0'], ['1', '1'], ['4', '4'], ['9', '9'], ['25', '25']];
  } else if (functionName === 'cbrt') {
    heading = 'Perfect cubes';
    presets = [['0', '0'], ['1', '1'], ['8', '8'], ['27', '27'], ['64', '64']];
  } else if (functionName === 'abs') {
    heading = 'Try an input';
    presets = [['−10', '-10'], ['−1', '-1'], ['0', '0'], ['1', '1'], ['10', '10']];
  } else if (['ln', 'log', 'log2'].includes(functionName)) {
    heading = 'Common inputs';
    presets = [['1', '1'], ['2', '2'], ['e', 'e'], ['10', '10']];
  } else {
    heading = 'Quick values';
    presets = [['0', '0'], ['0.5', '0.5'], ['1', '1'], ['2', '2'], ['5', '5']];
  }
  $('#lab-preset-heading').textContent = heading;
  container.replaceChildren();
  presets.forEach(([label, value]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lab-preset';
    button.dataset.labValue = value;
    button.textContent = label;
    button.setAttribute('aria-label', `Use ${label}`);
    container.append(button);
  });
}

function updateFunctionLab(syncMain = true) {
  const functionName = $('#lab-function').value;
  const input = $('#lab-input').value.trim();
  const expression = `${functionName}(${input})`;
  const output = $('#lab-result');
  const errorElement = $('#lab-error');
  if (!input) {
    output.textContent = '—';
    errorElement.hidden = true;
    if (syncMain) {
      state.expression = '';
      state.justEvaluated = false;
      state.error = '';
      updateDisplay();
    }
    return;
  }
  try {
    const value = calculate(expression);
    const suffix = ['asin', 'acos', 'atan'].includes(functionName) && state.angleMode === 'DEG' ? '°' : '';
    output.textContent = `${formatNumber(value)}${suffix}`;
    errorElement.hidden = true;
    errorElement.textContent = '';
    if (syncMain) {
      state.expression = expression;
      state.answer = value;
      state.preview = value;
      state.justEvaluated = true;
      state.error = '';
      updateDisplay();
    }
  } catch (error) {
    output.textContent = '—';
    errorElement.textContent = error instanceof CalculatorError ? error.message : 'Invalid expression';
    errorElement.hidden = false;
    if (syncMain) {
      state.expression = expression;
      state.justEvaluated = false;
      state.error = '';
      updateDisplay();
    }
  }
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  const themeColor = theme === 'light' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches) ? '#F4F6F8' : '#12171D';
  $('meta[name="theme-color"]').content = themeColor;
  $('#theme-trigger').setAttribute('aria-label', `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`);
  $$('[data-theme-choice]').forEach(button => {
    button.setAttribute('aria-checked', String(button.dataset.themeChoice === theme));
  });
}

function toggleThemeMenu(force) {
  const menu = $('#theme-menu');
  const open = typeof force === 'boolean' ? force : menu.hidden;
  menu.hidden = !open;
  $('#theme-trigger').setAttribute('aria-expanded', String(open));
}

// Converter data is expressed relative to a base unit for each category.
const conversionData = {
  length: {
    label: 'Length', base: 'm', units: [
      ['mm', 'Millimeter (mm)', 0.001], ['cm', 'Centimeter (cm)', 0.01], ['m', 'Meter (m)', 1], ['km', 'Kilometer (km)', 1000],
      ['in', 'Inch (in)', 0.0254], ['ft', 'Foot (ft)', 0.3048], ['yd', 'Yard (yd)', 0.9144], ['mi', 'Mile (mi)', 1609.344]
    ]
  },
  area: {
    label: 'Area', base: 'm²', units: [
      ['mm2', 'Square millimeter (mm²)', 1e-6], ['cm2', 'Square centimeter (cm²)', 1e-4], ['m2', 'Square meter (m²)', 1], ['km2', 'Square kilometer (km²)', 1e6],
      ['in2', 'Square inch (in²)', 0.00064516], ['ft2', 'Square foot (ft²)', 0.09290304], ['acre', 'Acre', 4046.8564224], ['ha', 'Hectare (ha)', 10000]
    ]
  },
  volume: {
    label: 'Volume', base: 'L', units: [
      ['mL', 'Milliliter (mL)', 0.001], ['L', 'Liter (L)', 1], ['m3', 'Cubic meter (m³)', 1000], ['gal', 'US gallon (gal)', 3.785411784],
      ['qt', 'US quart (qt)', 0.946352946], ['pt', 'US pint (pt)', 0.473176473], ['cup', 'US cup', 0.2365882365]
    ]
  },
  mass: {
    label: 'Mass', base: 'kg', units: [
      ['mg', 'Milligram (mg)', 1e-6], ['g', 'Gram (g)', 0.001], ['kg', 'Kilogram (kg)', 1], ['oz', 'Ounce (oz)', 0.028349523125], ['lb', 'Pound (lb)', 0.45359237], ['ton', 'Metric ton (t)', 1000]
    ]
  },
  temperature: {
    label: 'Temperature', base: '°C', units: [
      ['C', 'Celsius (°C)', 1], ['F', 'Fahrenheit (°F)', 1], ['K', 'Kelvin (K)', 1]
    ]
  },
  time: {
    label: 'Time', base: 's', units: [
      ['ms', 'Millisecond (ms)', 0.001], ['s', 'Second (s)', 1], ['min', 'Minute (min)', 60], ['h', 'Hour (h)', 3600], ['day', 'Day', 86400], ['week', 'Week', 604800], ['year', 'Year (365.25 days)', 31557600]
    ]
  },
  speed: {
    label: 'Speed', base: 'm/s', units: [
      ['mps', 'Meter per second (m/s)', 1], ['kmh', 'Kilometer per hour (km/h)', 1 / 3.6], ['mph', 'Mile per hour (mph)', 0.44704], ['knot', 'Knot (kn)', 0.514444444444]
    ]
  },
  data: {
    label: 'Data', base: 'bit', units: [
      ['bit', 'Bit (bit)', 1], ['byte', 'Byte (B)', 8], ['KB', 'Kilobyte (KB)', 8 * 1024], ['MB', 'Megabyte (MB)', 8 * 1024 ** 2],
      ['GB', 'Gigabyte (GB)', 8 * 1024 ** 3], ['TB', 'Terabyte (TB)', 8 * 1024 ** 4], ['PB', 'Petabyte (PB)', 8 * 1024 ** 5]
    ]
  },
  energy: {
    label: 'Energy', base: 'J', units: [
      ['J', 'Joule (J)', 1], ['kJ', 'Kilojoule (kJ)', 1000], ['cal', 'Calorie (cal)', 4.184], ['kcal', 'Kilocalorie (kcal)', 4184], ['kWh', 'Kilowatt-hour (kWh)', 3600000]
    ]
  },
  pressure: {
    label: 'Pressure', base: 'Pa', units: [
      ['Pa', 'Pascal (Pa)', 1], ['kPa', 'Kilopascal (kPa)', 1000], ['bar', 'Bar', 100000], ['atm', 'Atmosphere (atm)', 101325], ['psi', 'Pound per square inch (psi)', 6894.757293168]
    ]
  }
};

function unitShort(category, id) {
  const unit = conversionData[category].units.find(item => item[0] === id);
  if (!unit) return id;
  const labels = {
    mm2: 'mm²', cm2: 'cm²', m2: 'm²', km2: 'km²', in2: 'in²', ft2: 'ft²',
    m3: 'm³', gal: 'gal', qt: 'qt', pt: 'pt', ton: 't', mps: 'm/s', kmh: 'km/h', knot: 'kn'
  };
  return labels[id] || id;
}

function populateConverter(category, fromId, toId) {
  state.converterCategory = category;
  const units = conversionData[category].units;
  const fromSelect = $('#convert-from');
  const toSelect = $('#convert-to');
  [fromSelect, toSelect].forEach(select => {
    select.replaceChildren();
    units.forEach(([id, label]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = label;
      select.append(option);
    });
  });
  fromSelect.value = units.some(unit => unit[0] === fromId) ? fromId : units[0][0];
  const defaultTo = units[1] ? units[1][0] : units[0][0];
  toSelect.value = units.some(unit => unit[0] === toId) ? toId : defaultTo;
  $$('.category-chip').forEach(button => {
    const active = button.dataset.category === category;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  updateConverter();
}

function temperatureToCelsius(value, unit) {
  if (unit === 'F') return (value - 32) * 5 / 9;
  if (unit === 'K') return value - 273.15;
  return value;
}

function celsiusToTemperature(value, unit) {
  if (unit === 'F') return value * 9 / 5 + 32;
  if (unit === 'K') return value + 273.15;
  return value;
}

function convertValue(value, category, fromId, toId) {
  if (category === 'temperature') return celsiusToTemperature(temperatureToCelsius(value, fromId), toId);
  const units = conversionData[category].units;
  const from = units.find(unit => unit[0] === fromId);
  const to = units.find(unit => unit[0] === toId);
  if (!from || !to) return NaN;
  return value * from[2] / to[2];
}

function updateConverter() {
  const input = $('#convert-input');
  const output = $('#convert-output');
  const inputValue = input.value === '' ? NaN : Number(input.value);
  const fromId = $('#convert-from').value;
  const toId = $('#convert-to').value;
  const category = state.converterCategory;

  if (!Number.isFinite(inputValue)) {
    state.converterResult = null;
    output.textContent = '—';
    $('#converter-footnote').textContent = 'Enter a value to convert.';
    return;
  }
  const converted = convertValue(inputValue, category, fromId, toId);
  state.converterResult = Number.isFinite(converted) ? converted : null;
  output.textContent = Number.isFinite(converted) ? formatNumber(converted) : '—';
  $('#converter-footnote').textContent = `${formatNumber(inputValue)} ${unitShort(category, fromId)} = ${formatNumber(converted)} ${unitShort(category, toId)}`;
}

function swapUnits() {
  const fromSelect = $('#convert-from');
  const toSelect = $('#convert-to');
  const oldValue = $('#convert-input').value === '' ? NaN : Number($('#convert-input').value);
  const converted = state.converterResult;
  const oldFrom = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = oldFrom;
  if (!Number.isFinite(oldValue)) $('#convert-input').value = '';
  else if (Number.isFinite(converted)) $('#convert-input').value = String(converted);
  updateConverter();
}

function updatePercentTools() {
  const valueOf = (selector) => {
    const input = $(selector);
    return input && input.value !== '' ? Number(input.value) : NaN;
  };
  const rate = valueOf('#pct-rate');
  const base = valueOf('#pct-base');
  $('#pct-of-result').textContent = Number.isFinite(rate * base / 100) ? formatNumber(rate * base / 100) : '—';

  const adjustBase = valueOf('#pct-adjust-base');
  const adjustRate = valueOf('#pct-adjust-rate');
  const sign = $('#pct-direction').value === 'decrease' ? -1 : 1;
  const adjusted = adjustBase * (1 + sign * adjustRate / 100);
  $('#pct-adjust-result').textContent = Number.isFinite(adjusted) ? formatNumber(adjusted) : '—';

  const oldValue = valueOf('#pct-old');
  const newValue = valueOf('#pct-new');
  let changeText = '—';
  if (Number.isFinite(oldValue) && Number.isFinite(newValue)) {
    if (oldValue === 0) changeText = newValue === 0 ? '0% change' : 'Undefined from zero';
    else {
      const change = (newValue - oldValue) / Math.abs(oldValue) * 100;
      const direction = change > 0 ? ' increase' : change < 0 ? ' decrease' : ' change';
      changeText = `${formatNumber(Math.abs(change))}%${direction}`;
    }
  }
  $('#pct-change-result').textContent = changeText;
}

function updateStatistics() {
  const raw = $('#statistics-input').value.trim();
  const errorElement = $('#statistics-error');
  const outputIds = ['count', 'sum', 'mean', 'median', 'mode', 'min', 'max', 'range', 'variance', 'deviation'];
  const clearStats = () => outputIds.forEach(id => { $(`#stat-${id}`).textContent = '—'; });
  errorElement.hidden = true;
  errorElement.textContent = '';
  if (!raw) {
    clearStats();
    return;
  }

  const pieces = raw.split(/[\s,;]+/).filter(Boolean);
  const values = pieces.map(piece => Number(piece));
  if (values.some(value => !Number.isFinite(value))) {
    clearStats();
    errorElement.textContent = 'Use finite numbers separated by spaces, commas, or new lines.';
    errorElement.hidden = false;
    return;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const sum = values.reduce((total, value) => total + value, 0);
  const mean = sum / count;
  const median = count % 2 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  const highestFrequency = Math.max(...counts.values());
  const modes = highestFrequency > 1 ? [...counts.entries()].filter(([, frequency]) => frequency === highestFrequency).map(([value]) => value).sort((a, b) => a - b) : [];
  const range = sorted[count - 1] - sorted[0];
  const squaredSum = values.reduce((total, value) => total + (value - mean) ** 2, 0);
  const divisor = state.statisticsMode === 'sample' ? count - 1 : count;
  const variance = divisor > 0 ? squaredSum / divisor : NaN;

  $('#stat-count').textContent = formatNumber(count);
  $('#stat-sum').textContent = formatNumber(sum);
  $('#stat-mean').textContent = formatNumber(mean);
  $('#stat-median').textContent = formatNumber(median);
  $('#stat-mode').textContent = modes.length ? modes.map(formatNumber).join(', ') : 'No mode';
  $('#stat-min').textContent = formatNumber(sorted[0]);
  $('#stat-max').textContent = formatNumber(sorted[count - 1]);
  $('#stat-range').textContent = formatNumber(range);
  $('#stat-variance').textContent = Number.isFinite(variance) ? formatNumber(variance) : '—';
  $('#stat-deviation').textContent = Number.isFinite(variance) ? formatNumber(Math.sqrt(variance)) : '—';
}

function parseBaseInteger(raw, base) {
  const text = String(raw).trim().replace(/_/g, '');
  if (!text) throw new CalculatorError('Enter an integer');
  const sign = text.startsWith('-') ? -1n : 1n;
  const unsignedText = text.replace(/^[+-]/, '');
  if (!unsignedText) throw new CalculatorError('Invalid integer for this base');
  const prefix = base === 16 ? /^0x/i : base === 8 ? /^0o/i : base === 2 ? /^0b/i : null;
  const digits = prefix ? unsignedText.replace(prefix, '') : unsignedText;
  const patterns = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/i };
  if (!patterns[base].test(digits)) throw new CalculatorError('Invalid integer for this base');
  let magnitude;
  try {
    if (base === 10) magnitude = BigInt(digits);
    else if (base === 16) magnitude = BigInt(`0x${digits}`);
    else if (base === 8) magnitude = BigInt(`0o${digits}`);
    else magnitude = BigInt(`0b${digits}`);
  } catch (_) {
    throw new CalculatorError('Invalid integer for this base');
  }
  return sign * magnitude;
}

function baseString(value, base) {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const result = magnitude.toString(base).toUpperCase();
  return negative ? `-${result}` : result;
}

function updateProgrammerConversions() {
  const base = state.programmerBase;
  const aInput = $('#programmer-a');
  const bInput = $('#programmer-b');
  let a = null;
  let b = null;
  let error = '';
  try { a = parseBaseInteger(aInput.value, base); } catch (e) { if (aInput.value.trim()) error = e.message; }
  try { b = parseBaseInteger(bInput.value, base); } catch (e) { if (bInput.value.trim()) error = e.message; }

  if (a !== null) {
    $('#prog-a-bin').textContent = baseString(a, 2);
    $('#prog-a-oct').textContent = baseString(a, 8);
    $('#prog-a-dec').textContent = baseString(a, 10);
    $('#prog-a-hex').textContent = baseString(a, 16);
  } else {
    ['bin', 'oct', 'dec', 'hex'].forEach(baseName => { $(`#prog-a-${baseName}`).textContent = '—'; });
  }
  const errorElement = $('#programmer-error');
  errorElement.textContent = error;
  errorElement.hidden = !error;
  return { a, b };
}

function renderProgrammerOperandB(value) {
  if (value === null) {
    ['bin', 'oct', 'dec', 'hex'].forEach(baseName => { $(`#prog-b-${baseName}`).textContent = '—'; });
    return;
  }
  $('#prog-b-bin').textContent = baseString(value, 2);
  $('#prog-b-oct').textContent = baseString(value, 8);
  $('#prog-b-dec').textContent = baseString(value, 10);
  $('#prog-b-hex').textContent = baseString(value, 16);
}

function displayInt32(value, base) {
  const signed = BigInt(value);
  if (base === 10) return signed.toString(10);
  return BigInt.asUintN(32, signed).toString(base).toUpperCase();
}

function runBitwise(operation) {
  const { a, b } = updateProgrammerConversions();
  const resultOutput = $('#programmer-result');
  const errorElement = $('#programmer-error');
  if (a === null || (operation !== 'not' && b === null)) {
    errorElement.textContent = 'Enter valid integers for the selected base.';
    errorElement.hidden = false;
    resultOutput.textContent = '—';
    return;
  }

  const a32 = Number(BigInt.asIntN(32, a));
  const b32 = b === null ? 0 : Number(BigInt.asIntN(32, b));
  let result;
  switch (operation) {
    case 'and': result = a32 & b32; break;
    case 'or': result = a32 | b32; break;
    case 'xor': result = a32 ^ b32; break;
    case 'not': result = ~a32; break;
    case 'nand': result = ~(a32 & b32); break;
    case 'nor': result = ~(a32 | b32); break;
    case 'shl': result = a32 << (b32 & 31); break;
    case 'shr': result = a32 >> (b32 & 31); break;
    default: return;
  }
  state.lastBitOperation = operation;
  errorElement.hidden = true;
  resultOutput.textContent = displayInt32(result, state.programmerBase);
  $('#prog-result-bin').textContent = displayInt32(result, 2);
  $('#prog-result-oct').textContent = displayInt32(result, 8);
  $('#prog-result-dec').textContent = displayInt32(result, 10);
  $('#prog-result-hex').textContent = displayInt32(result, 16);
  $$('#bitwise-operations button').forEach(button => button.classList.toggle('is-active', button.dataset.bitop === operation));
}

function updateProgrammer() {
  const values = updateProgrammerConversions();
  renderProgrammerOperandB(values.b);
  if (state.lastBitOperation) runBitwise(state.lastBitOperation);
  else {
    $('#programmer-result').textContent = 'Choose an operation';
    ['bin', 'oct', 'dec', 'hex'].forEach(baseName => { $(`#prog-result-${baseName}`).textContent = '—'; });
  }
}

function trimPolynomial(poly) {
  const result = poly.slice();
  while (result.length > 1 && Math.abs(result[result.length - 1]) < 1e-12) result.pop();
  if (result.some(value => !Number.isFinite(value))) throw new CalculatorError('Result is too large');
  return result;
}

function addPolynomials(left, right, sign = 1) {
  const length = Math.max(left.length, right.length);
  return trimPolynomial(Array.from({ length }, (_, index) => (left[index] || 0) + sign * (right[index] || 0)));
}

function multiplyPolynomials(left, right) {
  const result = Array(left.length + right.length - 1).fill(0);
  left.forEach((a, i) => right.forEach((b, j) => { result[i + j] += a * b; }));
  const trimmed = trimPolynomial(result);
  if (trimmed.length > 3) throw new CalculatorError('Only linear and quadratic equations are supported');
  return trimmed;
}

function polynomialPower(poly, exponent) {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 2) {
    throw new CalculatorError('Only powers up to 2 are supported');
  }
  let result = [1];
  for (let index = 0; index < exponent; index += 1) result = multiplyPolynomials(result, poly);
  return result;
}

function polynomialFromTree(node) {
  switch (node.type) {
    case 'number': return [node.value];
    case 'constant': return [node.value];
    case 'variable': return node.name === 'x' ? [0, 1] : [0];
    case 'unary': return node.operator === '-' ? node.argument && polynomialFromTree(node.argument).map(value => -value) : polynomialFromTree(node.argument);
    case 'percent': return polynomialFromTree(node.argument).map(value => value / 100);
    case 'factorial': {
      const poly = polynomialFromTree(node.argument);
      if (poly.length > 1) throw new CalculatorError('Factorials must use a constant');
      return [factorial(poly[0])];
    }
    case 'binary': {
      const left = polynomialFromTree(node.left);
      const right = polynomialFromTree(node.right);
      if (node.operator === '+') return addPolynomials(left, right);
      if (node.operator === '-') return addPolynomials(left, right, -1);
      if (node.operator === '*') return multiplyPolynomials(left, right);
      if (node.operator === '/') {
        if (right.length > 1) throw new CalculatorError('Cannot divide by an expression containing x');
        if (right[0] === 0) throw new CalculatorError('Cannot divide by zero');
        return left.map(value => value / right[0]);
      }
      if (node.operator === '^') {
        if (right.length > 1) throw new CalculatorError('The exponent must be a constant');
        return polynomialPower(left, right[0]);
      }
      throw new CalculatorError('Use addition, subtraction, multiplication, division, and powers up to 2');
    }
    case 'call': {
      const args = node.args.map(polynomialFromTree);
      if (args.some(poly => poly.length > 1)) throw new CalculatorError('Functions of x are not supported in equations');
      return [evaluateCall(node.name, args.map(poly => poly[0]))];
    }
    default: throw new CalculatorError('Invalid equation');
  }
}

function solveEquation(source) {
  const parts = String(source).replace(/[−–—]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').split('=');
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) throw new CalculatorError('Enter one equation with an equals sign');
  const left = polynomialFromTree(parseExpression(parts[0]));
  const right = polynomialFromTree(parseExpression(parts[1]));
  const difference = addPolynomials(left, right, -1);
  if (difference.length > 3) throw new CalculatorError('Only linear and quadratic equations are supported');
  const c = difference[0] || 0;
  const b = difference[1] || 0;
  const a = difference[2] || 0;
  const nearZero = value => Math.abs(value) < 1e-12;

  if (nearZero(a)) {
    if (nearZero(b)) {
      if (nearZero(c)) return { type: 'identity', message: 'Every value of x satisfies this equation.' };
      return { type: 'none', message: 'No solution.' };
    }
    return { type: 'linear', roots: [-c / b] };
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < -1e-12) {
    const real = -b / (2 * a);
    const imaginary = Math.sqrt(-discriminant) / (2 * a);
    return { type: 'complex', real, imaginary };
  }
  const root = Math.sqrt(Math.max(0, discriminant));
  const first = (-b + root) / (2 * a);
  const second = (-b - root) / (2 * a);
  if (nearZero(discriminant)) return { type: 'quadratic-single', roots: [first] };
  return { type: 'quadratic', roots: [first, second] };
}

function showEquationSolution() {
  const resultElement = $('#equation-result');
  resultElement.classList.remove('has-error', 'has-solution');
  try {
    const result = solveEquation($('#equation-input').value);
    resultElement.classList.add('has-solution');
    if (result.type === 'identity' || result.type === 'none') resultElement.textContent = result.message;
    else if (result.type === 'linear') resultElement.textContent = `x = ${formatNumber(result.roots[0])}`;
    else if (result.type === 'quadratic-single') resultElement.textContent = `x = ${formatNumber(result.roots[0])}  (repeated root)`;
    else if (result.type === 'quadratic') resultElement.textContent = `x₁ = ${formatNumber(result.roots[0])}\nx₂ = ${formatNumber(result.roots[1])}`;
    else if (result.type === 'complex') {
      const sign = result.imaginary < 0 ? '−' : '+';
      resultElement.textContent = `x₁ = ${formatNumber(result.real)} ${sign} ${formatNumber(Math.abs(result.imaginary))}i\nx₂ = ${formatNumber(result.real)} ${sign === '+' ? '−' : '+'} ${formatNumber(Math.abs(result.imaginary))}i`;
    }
    $('#app-announcer').textContent = resultElement.textContent.replace('\n', ', ');
  } catch (error) {
    resultElement.classList.add('has-error');
    resultElement.textContent = error instanceof CalculatorError ? error.message : 'Invalid equation';
  }
}

const GRAPH_COLORS = ['#19D3FF', '#9B7BFF', '#FF4FD8', '#39D98A', '#FFB86B', '#60A5FA', '#F472B6', '#A3E635'];
let graphDrawPending = false;

function graphExpressionFor(source) {
  let expression = String(source || '').trim().replace(/[−–—]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3');
  if (!expression) return '';
  const functionPrefix = expression.match(/^(?:y|f(?:_?\d+)?\s*\(\s*x\s*\))\s*=\s*/i);
  if (functionPrefix) expression = expression.slice(functionPrefix[0].length).trim();
  else if (expression.includes('=')) {
    const parts = expression.split('=');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) throw new CalculatorError('Use one equals sign in a graph equation');
    expression = `(${parts[0]})-(${parts[1]})`;
  }
  return expression;
}

function graphEquationRows() {
  return $$('.graph-equation-row', $('#graph-equations')).map((row, index) => ({
    row,
    input: $('.graph-equation-input', row),
    enabled: $('.graph-enabled', row).checked,
    color: GRAPH_COLORS[index % GRAPH_COLORS.length],
    name: `f${index + 1}`
  }));
}

function updateGraphEquationLabels() {
  const subscriptDigits = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈'];
  graphEquationRows().forEach((equation, index) => {
    equation.row.style.setProperty('--curve-color', equation.color);
    $('.curve-swatch', equation.row).style.setProperty('--curve-color', equation.color);
    $('.graph-enabled', equation.row).setAttribute('aria-label', `Show equation ${index + 1}`);
    const subscript = subscriptDigits[index] || `_${index + 1}`;
    $('.graph-prefix', equation.row).textContent = `f${subscript}(x) =`;
    const removeButton = $('[data-remove-equation]', equation.row);
    removeButton.disabled = graphEquationRows().length === 1;
    removeButton.setAttribute('aria-label', `Remove equation ${index + 1}`);
  });
  const addButton = $('#add-equation');
  addButton.disabled = graphEquationRows().length >= 8;
  addButton.title = addButton.disabled ? 'Up to 8 equations' : 'Add an equation';
}

function createGraphEquationRow(expression = '') {
  const list = $('#graph-equations');
  const index = graphEquationRows().length;
  const rowId = state.graph.nextId++;
  const row = document.createElement('div');
  row.className = 'graph-equation-row';
  row.dataset.graphRow = String(rowId);
  row.style.setProperty('--curve-color', GRAPH_COLORS[index % GRAPH_COLORS.length]);

  const checkbox = document.createElement('input');
  checkbox.className = 'graph-enabled';
  checkbox.type = 'checkbox';
  checkbox.checked = true;
  checkbox.setAttribute('aria-label', `Show equation ${index + 1}`);

  const swatch = document.createElement('span');
  swatch.className = 'curve-swatch';
  swatch.setAttribute('aria-hidden', 'true');

  const label = document.createElement('label');
  label.className = 'graph-prefix';

  const input = document.createElement('input');
  input.className = 'graph-equation-input mono-input';
  input.id = `graph-equation-${rowId}`;
  input.type = 'text';
  input.value = expression;
  input.setAttribute('list', 'math-function-suggestions');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('aria-label', `Graph equation ${index + 1}`);
  label.htmlFor = input.id;

  const remove = document.createElement('button');
  remove.className = 'remove-equation';
  remove.type = 'button';
  remove.dataset.removeEquation = '';
  remove.textContent = '×';
  remove.title = 'Remove equation';

  row.append(checkbox, swatch, label, input, remove);
  list.append(row);
  updateGraphEquationLabels();
  return input;
}

function addGraphEquation(expression = '') {
  if (graphEquationRows().length >= 8) {
    $('#app-announcer').textContent = 'The graph supports up to eight equations.';
    return;
  }
  const input = createGraphEquationRow(expression);
  input.focus();
  scheduleGraphDraw();
}

function scheduleGraphDraw() {
  if (graphDrawPending || state.mode !== 'graph') return;
  graphDrawPending = true;
  requestAnimationFrame(() => {
    graphDrawPending = false;
    drawGraph();
  });
}

function graphTickStep(span, targetCount = 9) {
  const raw = span / targetCount;
  const power = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

function graphZoomLabel() {
  $('#graph-zoom-label').textContent = `${Math.round(state.graph.zoom * 100)}%`;
}

function drawGraph() {
  const canvas = $('#graph-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (!width || !height) return;
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const backingWidth = Math.round(width * ratio);
  const backingHeight = Math.round(height * ratio);
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0A0F17';
  context.fillRect(0, 0, width, height);

  const graph = state.graph;
  const worldWidth = 20 / graph.zoom;
  const worldHeight = worldWidth * height / width;
  const xMin = graph.centerX - worldWidth / 2;
  const xMax = graph.centerX + worldWidth / 2;
  const yMin = graph.centerY - worldHeight / 2;
  const yMax = graph.centerY + worldHeight / 2;
  const xToPixel = value => (value - xMin) / worldWidth * width;
  const yToPixel = value => height - (value - yMin) / worldHeight * height;
  const xStep = graphTickStep(worldWidth);
  const yStep = graphTickStep(worldHeight, 7);

  context.lineWidth = 1;
  context.strokeStyle = '#1B2432';
  context.fillStyle = '#78859A';
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textBaseline = 'top';
  for (let x = Math.ceil(xMin / xStep) * xStep, count = 0; x <= xMax + xStep / 2 && count < 120; x += xStep, count += 1) {
    const pixel = xToPixel(x);
    context.beginPath();
    context.moveTo(pixel, 0);
    context.lineTo(pixel, height);
    context.stroke();
    if (Math.abs(x) > xStep * 0.001) context.fillText(formatNumber(x), Math.min(width - 38, pixel + 4), Math.max(4, Math.min(height - 16, yToPixel(0) + 5)));
  }
  for (let y = Math.ceil(yMin / yStep) * yStep, count = 0; y <= yMax + yStep / 2 && count < 120; y += yStep, count += 1) {
    const pixel = yToPixel(y);
    context.beginPath();
    context.moveTo(0, pixel);
    context.lineTo(width, pixel);
    context.stroke();
    if (Math.abs(y) > yStep * 0.001) context.fillText(formatNumber(y), Math.max(4, Math.min(width - 42, xToPixel(0) + 5)), Math.max(3, Math.min(height - 13, pixel - 13)));
  }

  context.strokeStyle = '#657287';
  context.lineWidth = 1.15;
  const xAxis = yToPixel(0);
  const yAxis = xToPixel(0);
  if (xAxis >= 0 && xAxis <= height) {
    context.beginPath(); context.moveTo(0, xAxis); context.lineTo(width, xAxis); context.stroke();
  }
  if (yAxis >= 0 && yAxis <= width) {
    context.beginPath(); context.moveTo(yAxis, 0); context.lineTo(yAxis, height); context.stroke();
  }

  const equations = graphEquationRows();
  const compiled = [];
  let invalidCount = 0;
  const oldAngleMode = state.angleMode;
  state.angleMode = 'RAD';
  try {
    equations.forEach(equation => {
      const source = equation.input.value.trim();
      if (!equation.enabled || !source) return;
      let tree;
      try {
        tree = parseExpression(graphExpressionFor(source));
      } catch (_) {
        invalidCount += 1;
        return;
      }
      compiled.push({ ...equation, tree });
      context.save();
      context.beginPath();
      context.strokeStyle = equation.color;
      context.lineWidth = 2;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      let drawing = false;
      const pixelStep = width > 1500 ? 2 : 1;
      for (let pixelX = 0; pixelX <= width; pixelX += pixelStep) {
        const xValue = xMin + pixelX / width * worldWidth;
        let yValue;
        try { yValue = evaluateTree(tree, { x: xValue }); } catch (_) { drawing = false; continue; }
        if (!Number.isFinite(yValue) || Math.abs(yValue) > worldHeight * 80) { drawing = false; continue; }
        const pixelY = yToPixel(yValue);
        if (!drawing) {
          context.moveTo(pixelX, pixelY);
          drawing = true;
        } else {
          context.lineTo(pixelX, pixelY);
        }
      }
      context.stroke();
      context.restore();
    });
  } finally {
    state.angleMode = oldAngleMode;
  }

  // Roots found by the equation solver are marked on the x-axis.
  graph.markers.forEach(root => {
    if (!Number.isFinite(root) || root < xMin || root > xMax || 0 < yMin || 0 > yMax) return;
    const px = xToPixel(root);
    const py = yToPixel(0);
    context.beginPath();
    context.arc(px, py, 4.5, 0, Math.PI * 2);
    context.fillStyle = '#19D3FF';
    context.fill();
    context.lineWidth = 1.5;
    context.strokeStyle = '#0A0F17';
    context.stroke();
    context.fillStyle = '#19D3FF';
    context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textBaseline = 'bottom';
    context.fillText(formatNumber(root), Math.min(width - 35, px + 6), py - 6);
  });

  $('#graph-empty-state').hidden = compiled.length > 0;
  const graphError = $('#graph-error');
  graphError.textContent = invalidCount ? 'One or more equations need a syntax check.' : '';
  graphError.hidden = invalidCount === 0;
  graphZoomLabel();

  const cursor = graph.cursor;
  const tooltip = $('#graph-tooltip');
  if (!cursor || !compiled.length) {
    tooltip.hidden = true;
    $('#graph-coordinate').textContent = 'Move over a curve for coordinates';
    return;
  }
  const xValue = xMin + cursor.px / width * worldWidth;
  let nearest = null;
  const hoverAngleMode = state.angleMode;
  state.angleMode = 'RAD';
  try {
    compiled.forEach(equation => {
      try {
        const yValue = evaluateTree(equation.tree, { x: xValue });
        if (!Number.isFinite(yValue) || Math.abs(yValue) > worldHeight * 80) return;
        const pixelY = yToPixel(yValue);
        const distance = Math.abs(pixelY - cursor.py);
        if (!nearest || distance < nearest.distance) nearest = { equation, yValue, pixelY, distance };
      } catch (_) { /* skip a function outside its domain */ }
    });
  } finally {
    state.angleMode = hoverAngleMode;
  }
  if (nearest && nearest.distance < 76) {
    context.save();
    context.setLineDash([3, 4]);
    context.strokeStyle = 'rgba(101, 114, 135, .55)';
    context.lineWidth = 1;
    context.beginPath(); context.moveTo(cursor.px, 0); context.lineTo(cursor.px, height); context.stroke();
    context.restore();
    context.beginPath();
    context.arc(cursor.px, nearest.pixelY, 4.5, 0, Math.PI * 2);
    context.fillStyle = nearest.equation.color;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = '#0A0F17';
    context.stroke();
    const details = `${nearest.equation.name}(x)\nx = ${formatNumber(xValue)}\ny = ${formatNumber(nearest.yValue)}`;
    tooltip.textContent = details;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(8, Math.min(width - 148, cursor.px + 13))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(height - 78, nearest.pixelY - 38))}px`;
    $('#graph-coordinate').textContent = `x = ${formatNumber(xValue)} · y = ${formatNumber(nearest.yValue)}`;
  } else {
    tooltip.hidden = true;
    $('#graph-coordinate').textContent = 'Move over a curve for coordinates';
  }
}

function zoomGraph(factor, anchorX, anchorY) {
  const canvas = $('#graph-canvas');
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 700;
  const height = rect.height || 400;
  const px = Number.isFinite(anchorX) ? anchorX : width / 2;
  const py = Number.isFinite(anchorY) ? anchorY : height / 2;
  const oldWorldWidth = 20 / state.graph.zoom;
  const oldWorldHeight = oldWorldWidth * height / width;
  const worldX = state.graph.centerX + (px / width - 0.5) * oldWorldWidth;
  const worldY = state.graph.centerY + (0.5 - py / height) * oldWorldHeight;
  state.graph.zoom = Math.max(0.1, Math.min(16, state.graph.zoom * factor));
  const newWorldWidth = 20 / state.graph.zoom;
  const newWorldHeight = newWorldWidth * height / width;
  state.graph.centerX = worldX - (px / width - 0.5) * newWorldWidth;
  state.graph.centerY = worldY - (0.5 - py / height) * newWorldHeight;
  graphZoomLabel();
  scheduleGraphDraw();
}

function panGraphPixels(deltaX, deltaY) {
  const rect = $('#graph-canvas').getBoundingClientRect();
  const width = rect.width || 700;
  const height = rect.height || 400;
  const worldWidth = 20 / state.graph.zoom;
  const worldHeight = worldWidth * height / width;
  state.graph.centerX -= deltaX / width * worldWidth;
  state.graph.centerY += deltaY / height * worldHeight;
  scheduleGraphDraw();
}

function resetGraphView() {
  state.graph.centerX = 0;
  state.graph.centerY = 0;
  state.graph.zoom = 1;
  state.graph.cursor = null;
  $('#graph-tooltip').hidden = true;
  graphZoomLabel();
  scheduleGraphDraw();
}

function setGraphToSingleEquation(source, roots = []) {
  const expression = graphExpressionFor(source);
  parseExpression(expression);
  let rows = graphEquationRows();
  rows.slice(1).forEach(equation => equation.row.remove());
  rows = graphEquationRows();
  if (!rows.length) createGraphEquationRow(expression);
  else {
    rows[0].input.value = expression;
    $('.graph-enabled', rows[0].row).checked = true;
  }
  state.graph.markers = roots.filter(Number.isFinite);
  updateGraphEquationLabels();
  setMode('graph');
  scheduleGraphDraw();
}

function plotEquationFromSolver(solveAndPlot) {
  const source = $('#equation-input').value.trim();
  if (!source) return;
  let roots = [];
  if (solveAndPlot) {
    showEquationSolution();
    try {
      const result = solveEquation(source);
      if (result.roots) roots = result.roots;
    } catch (_) { /* the plot action below gives its own readable error */ }
  } else {
    state.graph.markers = [];
  }
  try {
    setGraphToSingleEquation(source, roots);
  } catch (error) {
    const resultElement = $('#equation-result');
    resultElement.classList.add('has-error');
    resultElement.textContent = error instanceof CalculatorError ? error.message : 'Unable to plot this equation';
  }
}

function initialiseGraphInteractions() {
  const canvas = $('#graph-canvas');
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    state.graph.drag = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    state.graph.cursor = null;
    $('#graph-tooltip').hidden = true;
    canvas.classList.add('is-panning');
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    if (state.graph.drag) {
      const deltaX = event.clientX - state.graph.drag.lastX;
      const deltaY = event.clientY - state.graph.drag.lastY;
      state.graph.drag.lastX = event.clientX;
      state.graph.drag.lastY = event.clientY;
      panGraphPixels(deltaX, deltaY);
      return;
    }
    state.graph.cursor = { px: event.clientX - rect.left, py: event.clientY - rect.top };
    scheduleGraphDraw();
  });
  const finishDrag = () => {
    state.graph.drag = null;
    canvas.classList.remove('is-panning');
    scheduleGraphDraw();
  };
  canvas.addEventListener('pointerup', finishDrag);
  canvas.addEventListener('pointercancel', finishDrag);
  canvas.addEventListener('pointerleave', () => {
    if (state.graph.drag) return;
    state.graph.cursor = null;
    $('#graph-tooltip').hidden = true;
    scheduleGraphDraw();
  });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoomGraph(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });
  canvas.addEventListener('dblclick', resetGraphView);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleGraphDraw).observe($('#graph-canvas-shell'));
  else window.addEventListener('resize', scheduleGraphDraw);
}

function updateFinance() {
  const read = selector => {
    const field = $(selector);
    return field.value === '' ? NaN : Number(field.value);
  };
  const principal = read('#finance-principal');
  const rate = read('#finance-rate') / 100;
  const years = read('#finance-years');
  const frequency = Number($('#finance-frequency').value);
  const valid = Number.isFinite(principal) && principal >= 0 && Number.isFinite(rate) && rate >= 0 && Number.isFinite(years) && years >= 0 && frequency > 0;
  if (!valid) {
    ['#finance-simple', '#finance-compound', '#finance-interest', '#finance-payment'].forEach(selector => { $(selector).textContent = '—'; });
    return;
  }
  const simpleTotal = principal * (1 + rate * years);
  const compoundTotal = principal * Math.pow(1 + rate / frequency, frequency * years);
  const interest = compoundTotal - principal;
  const months = years * 12;
  const monthlyRate = rate / 12;
  const payment = months > 0
    ? (monthlyRate === 0 ? principal / months : principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1))
    : NaN;
  $('#finance-simple').textContent = formatFinance(simpleTotal);
  $('#finance-compound').textContent = formatFinance(compoundTotal);
  $('#finance-interest').textContent = formatFinance(interest);
  $('#finance-payment').textContent = Number.isFinite(payment) ? formatFinance(payment) : '—';
}

let copyTimer = 0;
async function copyText(text, statusElement) {
  if (!text) return;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const temporary = document.createElement('textarea');
      temporary.value = text;
      temporary.setAttribute('readonly', '');
      temporary.style.position = 'fixed';
      temporary.style.opacity = '0';
      document.body.append(temporary);
      temporary.select();
      document.execCommand('copy');
      temporary.remove();
    }
    statusElement.textContent = 'Copied';
  } catch (_) {
    statusElement.textContent = 'Copy unavailable';
  }
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => { statusElement.textContent = ''; }, 1700);
}

function handleCalculatorClick(event) {
  const button = event.target.closest('button');
  if (!button || !$('#calculator-view').contains(button)) return;
  if (button.dataset.memory) {
    handleMemory(button.dataset.memory);
    return;
  }
  if (button.dataset.scientific) {
    handleScientificButton(button);
    return;
  }
  if (button.dataset.action === 'clear') clearExpression();
  else if (button.dataset.action === 'backspace') backspace();
  else if (button.dataset.action === 'sign') toggleSign();
  else if (button.dataset.action === 'equals') evaluateCurrent();
  else if (button.dataset.key) appendKey(button.dataset.key);
}

function handleKeyboard(event) {
  const target = event.target;
  const isFormField = target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]');
  if (isFormField || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'Escape' && !$('#theme-menu').hidden) {
    toggleThemeMenu(false);
    $('#theme-trigger').focus();
    return;
  }
  if (event.key === 'Escape') {
    if (state.mode === 'basic' || state.mode === 'scientific') clearExpression();
    return;
  }
  if (state.mode === 'graph') {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomGraph(1.2); }
    else if (event.key === '-') { event.preventDefault(); zoomGraph(1 / 1.2); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); panGraphPixels(-46, 0); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); panGraphPixels(46, 0); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); panGraphPixels(0, -46); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); panGraphPixels(0, 46); }
    else if (event.key.toLowerCase() === 'r') { event.preventDefault(); resetGraphView(); }
    return;
  }
  if (!(state.mode === 'basic' || state.mode === 'scientific')) return;
  if (event.key === 'Enter' && target instanceof HTMLButtonElement) return;

  if (/^\d$/.test(event.key)) {
    event.preventDefault();
    appendKey(event.key);
  } else if (event.key === '.') {
    event.preventDefault();
    appendKey('.');
  } else if (event.key === '+') {
    event.preventDefault();
    appendKey('+');
  } else if (event.key === '-') {
    event.preventDefault();
    appendKey('−');
  } else if (event.key === '*') {
    event.preventDefault();
    appendKey('×');
  } else if (event.key === '/') {
    event.preventDefault();
    appendKey('÷');
  } else if (event.key === '%') {
    event.preventDefault();
    appendKey('%');
  } else if (event.key === '(' || event.key === ')') {
    event.preventDefault();
    appendKey(event.key);
  } else if (event.key.toLowerCase() === 'e') {
    event.preventDefault();
    appendKey('e');
  } else if (event.key === '^') {
    event.preventDefault();
    appendKey('^');
  } else if (event.key === '!') {
    event.preventDefault();
    appendKey('!');
  } else if (event.key === ',') {
    event.preventDefault();
    appendKey(',');
  } else if (event.key === 'Backspace') {
    event.preventDefault();
    backspace();
  } else if (event.key === 'Delete') {
    event.preventDefault();
    clearExpression();
  } else if (event.key === 'Enter' || event.key === '=') {
    event.preventDefault();
    evaluateCurrent();
  }
}

function initialiseEvents() {
  $('#mode-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-mode]');
    if (button) setMode(button.dataset.mode);
  });

  $('#calculator-view').addEventListener('click', handleCalculatorClick);
  $('#angle-deg').addEventListener('click', () => setAngleMode('DEG'));
  $('#angle-rad').addEventListener('click', () => setAngleMode('RAD'));
  $('#lab-deg').addEventListener('click', () => setAngleMode('DEG'));
  $('#lab-rad').addEventListener('click', () => setAngleMode('RAD'));
  $('#lab-function').addEventListener('change', () => { renderLabPresets(); updateFunctionLab(); });
  $('#lab-input').addEventListener('input', () => updateFunctionLab());
  $('#lab-presets').addEventListener('click', event => {
    const button = event.target.closest('[data-lab-value]');
    if (!button) return;
    $('#lab-input').value = button.dataset.labValue;
    $$('.lab-preset').forEach(preset => preset.classList.toggle('is-selected', preset === button));
    updateFunctionLab();
  });
  $('#copy-button').addEventListener('click', () => {
    if (state.preview === null) {
      $('#copy-status').textContent = 'No result to copy';
      window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => { $('#copy-status').textContent = ''; }, 1700);
      return;
    }
    copyText(numberForExpression(state.preview), $('#copy-status'));
  });

  $('#theme-trigger').addEventListener('click', () => toggleThemeMenu());
  $('#theme-menu').addEventListener('click', event => {
    const choice = event.target.closest('[data-theme-choice]');
    if (!choice) return;
    setTheme(choice.dataset.themeChoice);
    toggleThemeMenu(false);
    $('#theme-trigger').focus();
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.header-actions')) toggleThemeMenu(false);
  });

  $('#conversion-categories').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (button) populateConverter(button.dataset.category);
  });
  $('#convert-input').addEventListener('input', updateConverter);
  $('#convert-from').addEventListener('change', updateConverter);
  $('#convert-to').addEventListener('change', updateConverter);
  $('#swap-units').addEventListener('click', swapUnits);
  $('#copy-conversion').addEventListener('click', () => {
    if (state.converterResult !== null) copyText(numberForExpression(state.converterResult), $('#converter-copy-status'));
  });

  $('#tool-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-tool]');
    if (button) setTool(button.dataset.tool);
  });

  $('#add-equation').addEventListener('click', () => addGraphEquation(''));
  $('#graph-equations').addEventListener('input', event => {
    if (event.target.matches('.graph-equation-input')) scheduleGraphDraw();
  });
  $('#graph-equations').addEventListener('change', event => {
    if (event.target.matches('.graph-enabled')) scheduleGraphDraw();
  });
  $('#graph-equations').addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-equation]');
    if (!remove) return;
    const rows = graphEquationRows();
    const row = remove.closest('.graph-equation-row');
    if (rows.length === 1) $('.graph-equation-input', row).value = '';
    else row.remove();
    updateGraphEquationLabels();
    scheduleGraphDraw();
  });
  $('#graph-zoom-in').addEventListener('click', () => zoomGraph(1.2));
  $('#graph-zoom-out').addEventListener('click', () => zoomGraph(1 / 1.2));
  $('#graph-reset').addEventListener('click', resetGraphView);

  $('#tools-view').addEventListener('input', event => {
    const id = event.target.id;
    if (id.startsWith('pct-')) updatePercentTools();
    else if (id === 'statistics-input') updateStatistics();
    else if (id === 'programmer-a' || id === 'programmer-b') updateProgrammer();
    else if (id.startsWith('finance-')) updateFinance();
  });
  $('#tools-view').addEventListener('change', event => {
    const id = event.target.id;
    if (id === 'pct-direction') updatePercentTools();
    else if (id === 'finance-frequency') updateFinance();
    else if (id === 'programmer-base') {
      const nextBase = Number(event.target.value);
      let a = null;
      let b = null;
      try { a = parseBaseInteger($('#programmer-a').value, state.programmerBase); } catch (_) { /* cleared below */ }
      try { b = parseBaseInteger($('#programmer-b').value, state.programmerBase); } catch (_) { /* cleared below */ }
      state.programmerBase = nextBase;
      $('#programmer-a').value = a === null ? '' : baseString(a, nextBase);
      $('#programmer-b').value = b === null ? '' : baseString(b, nextBase);
      state.lastBitOperation = null;
      $$('#bitwise-operations button').forEach(button => button.classList.remove('is-active'));
      updateProgrammer();
    }
  });

  $('#tool-statistics').addEventListener('click', event => {
    const modeButton = event.target.closest('[data-stat-mode]');
    if (!modeButton) return;
    state.statisticsMode = modeButton.dataset.statMode;
    $$('[data-stat-mode]').forEach(button => {
      const active = button.dataset.statMode === state.statisticsMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateStatistics();
  });

  $('#bitwise-operations').addEventListener('click', event => {
    const button = event.target.closest('[data-bitop]');
    if (button) runBitwise(button.dataset.bitop);
  });
  $('#solve-equation').addEventListener('click', showEquationSolution);
  $('#plot-equation').addEventListener('click', () => plotEquationFromSolver(false));
  $('#solve-plot-equation').addEventListener('click', () => plotEquationFromSolver(true));
  $('#equation-input').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      showEquationSolution();
    }
  });
  ['#finance-principal', '#finance-rate', '#finance-years'].forEach(selector => $(selector).addEventListener('input', updateFinance));
  document.addEventListener('keydown', handleKeyboard);
}

function initialise() {
  setTheme('dark');
  setMode('basic');
  setTool('percent');
  setAngleMode('DEG');
  populateConverter('length', 'mm', 'm');
  renderLabPresets();
  updateFunctionLab(false);
  updatePercentTools();
  updateStatistics();
  renderProgrammerOperandB(null);
  updateProgrammer();
  updateGraphEquationLabels();
  graphZoomLabel();
  updateFinance();
  updateDisplay();
  initialiseEvents();
  initialiseGraphInteractions();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

initialise();
