import { APPSYNC_RESTRICTIONS } from './appsyncRestrictions.js';
import { Parser } from 'acorn';

// AST-based recursive function detection
function checkRecursiveFunctions(ast, filePath) {
  const errors = [];
  const functions = new Map(); // name -> { node, calls: Set }
  
  function visit(node, parent = null) {
    if (!node || typeof node !== 'object') return;
    
    // Track function declarations and expressions
    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      functions.set(node.id.name, { node, calls: new Set() });
    } else if (node.type === 'VariableDeclarator' && 
               node.id?.name && 
               (node.init?.type === 'FunctionExpression' || node.init?.type === 'ArrowFunctionExpression')) {
      functions.set(node.id.name, { node: node.init, calls: new Set() });
    } else if (node.type === 'Property' && 
               node.key?.name && 
               (node.value?.type === 'FunctionExpression' || node.value?.type === 'ArrowFunctionExpression')) {
      functions.set(node.key.name, { node: node.value, calls: new Set() });
    }
    
    // Track function calls
    if (node.type === 'CallExpression') {
      const calleeName = node.callee?.name || node.callee?.property?.name;
      if (calleeName && functions.has(calleeName)) {
        // Find which function contains this call
        let currentFunc = parent;
        while (currentFunc && !isFunctionNode(currentFunc)) {
          currentFunc = currentFunc.parent;
        }
        
        if (currentFunc) {
          const funcName = getFunctionName(currentFunc);
          if (funcName && functions.has(funcName) && funcName === calleeName) {
            functions.get(funcName).calls.add(calleeName);
          }
        }
      }
    }
    
    // Recursively visit child nodes, passing parent reference
    for (const key in node) {
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(item => {
          if (item && typeof item === 'object') {
            item.parent = node;
            visit(item, node);
          }
        });
      } else if (child && typeof child === 'object') {
        child.parent = node;
        visit(child, node);
      }
    }
  }
  
  function isFunctionNode(node) {
    return node?.type === 'FunctionDeclaration' || 
           node?.type === 'FunctionExpression' || 
           node?.type === 'ArrowFunctionExpression';
  }
  
  function getFunctionName(node) {
    if (node.type === 'FunctionDeclaration') return node.id?.name;
    if (node.parent?.type === 'VariableDeclarator') return node.parent.id?.name;
    if (node.parent?.type === 'Property') return node.parent.key?.name;
    return null;
  }
  
  visit(ast);
  
  // Check for recursive calls
  for (const [funcName, { calls }] of functions) {
    if (calls.has(funcName)) {
      errors.push(`❌ Recursive function call detected in ${filePath}. Function '${funcName}' calls itself. AppSync JavaScript resolvers do not support recursive function calls.`);
    }
  }
  
  return errors;
}

// Comprehensive AST-based AppSync restriction validation
function checkAppSyncRestrictions(ast, filePath) {
  const errors = [];
  
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    
    // Check for disallowed globals (identifiers that are not declared in scope)
    if (node.type === 'Identifier') {
      const name = node.name;
      if (APPSYNC_RESTRICTIONS.disallowedGlobals.includes(name)) {
        // Only flag if it's used as a variable, not as a property name
        const parent = node.parent;
        if (parent && 
            parent.type !== 'Property' && 
            parent.type !== 'MemberExpression' && 
            (parent.type !== 'MemberExpression' || parent.object === node)) {
          errors.push(`❌ Disallowed global '${name}' found in ${filePath}. AppSync JavaScript resolvers do not support ${name}.`);
        }
      }
    }
    
    // Check for disallowed operators
    if (node.type === 'BinaryExpression' || node.type === 'UnaryExpression') {
      const operator = node.operator;
      if (APPSYNC_RESTRICTIONS.disallowedOperators.some(op => op.trim() === operator)) {
        errors.push(`❌ Disallowed operator '${operator}' found in ${filePath}. AppSync JavaScript resolvers do not support this operator.`);
      }
    }
    
    // Check for 'in' operator specifically
    if (node.type === 'BinaryExpression' && node.operator === 'in') {
      errors.push(`❌ Disallowed operator 'in' found in ${filePath}. AppSync JavaScript resolvers do not support this operator.`);
    }
    
    // Check for throw statements
    if (node.type === 'ThrowStatement') {
      errors.push(`❌ 'throw' statement found in ${filePath}. Use util.error() instead of throwing errors in AppSync JavaScript resolvers.`);
    }
    
    // Check for standard for loops
    if (node.type === 'ForStatement') {
      errors.push(`❌ Standard 'for' loop found in ${filePath}. Use for-in or for-of loops instead in AppSync JavaScript resolvers.`);
    }
    
    // Check for disallowed function methods (apply, bind, call)
    if (node.type === 'MemberExpression' && 
        node.property?.type === 'Identifier' &&
        ['apply', 'bind', 'call'].includes(node.property.name)) {
      errors.push(`❌ Function method (${node.property.name}) found in ${filePath}. AppSync JavaScript resolvers do not support function.${node.property.name}().`);
    }
    
    // Check for Function constructor
    if (node.type === 'NewExpression' && 
        node.callee?.type === 'Identifier' && 
        node.callee.name === 'Function') {
      errors.push(`❌ Function constructor found in ${filePath}. AppSync JavaScript resolvers do not support Function constructors.`);
    }
    
    // Check for disallowed methods on objects
    if (node.type === 'MemberExpression' && 
        node.object?.type === 'Identifier' && 
        node.property?.type === 'Identifier') {
      const objectName = node.object.name;
      const methodName = node.property.name;
      
      if (APPSYNC_RESTRICTIONS.disallowedMethods[objectName]?.includes(methodName)) {
        if (objectName === 'Date' && methodName === 'now') {
          errors.push(`❌ Date.now() found in ${filePath}. Use new Date().getTime() instead in AppSync JavaScript resolvers.`);
        } else {
          errors.push(`❌ Disallowed method '${objectName}.${methodName}' found in ${filePath}. AppSync JavaScript resolvers do not support ${objectName}.${methodName}.`);
        }
      }
    }
    
    // Recursively visit child nodes with parent reference
    for (const key in node) {
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(item => {
          if (item && typeof item === 'object') {
            item.parent = node;
            visit(item);
          }
        });
      } else if (child && typeof child === 'object') {
        child.parent = node;
        visit(child);
      }
    }
  }
  
  visit(ast);
  
  // Add recursive function detection
  const recursiveErrors = checkRecursiveFunctions(ast, filePath);
  errors.push(...recursiveErrors);
  
  return errors;
}

// Function to validate JavaScript code for AppSync compatibility
export function validateAppSyncJavaScript(code, filePath) {
  const errors = [];
  
  // Use AST-based validation for all checks
  try {
    const ast = Parser.parse(code, { 
      ecmaVersion: 'latest', 
      sourceType: 'module',
      allowHashBang: true 
    });
    
    const astErrors = checkAppSyncRestrictions(ast, filePath);
    errors.push(...astErrors);
  } catch (parseError) {
    // If AST parsing fails, report syntax error
    errors.push(`❌ JavaScript syntax error in ${filePath}: ${parseError.message}`);
  }
  
  // Remove duplicate errors
  const uniqueErrors = [...new Set(errors)];
  
  return { errors: uniqueErrors, warnings: [] };
}