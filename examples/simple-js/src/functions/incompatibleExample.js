// This file demonstrates AppSync-incompatible code that will be caught by validation

export async function request(ctx) {
  // DISALLOWED: Using Map (not supported in AppSync)
  var myMap = new Map();
  myMap.set('key', 'value');
  
  // DISALLOWED: Using Set (not supported in AppSync)
  var mySet = new Set([1, 2, 3]);
  
  // DISALLOWED: Using Math.random() (not supported in AppSync)
  var randomNumber = Math.random();
  
  // DISALLOWED: Using const/let (should use var in AppSync)
  const disallowedConst = "this is const";
  let disallowedLet = "this is let";
  
  // DISALLOWED: Using arrow functions (not supported in AppSync)
  var arrowFunc = () => "arrow function";
  
  // DISALLOWED: Using template literals (not supported in AppSync)
  var template = `Hello ${ctx.arguments.name}`;
  
  // DISALLOWED: Using spread operator (not supported in AppSync)
  var spreadArray = [...[1, 2, 3]];
  
  // DISALLOWED: Using try-catch (not supported in AppSync)
  try {
    var result = "something";
  } catch (error) {
    var error = "caught";
  }
  
  // DISALLOWED: Using console (not available in AppSync)
  console.log("This won't work");
  
  // DISALLOWED: Using setTimeout (not available in AppSync)
  setTimeout(function() {}, 1000);
  
  return {
    message: "This file has many AppSync incompatibilities"
  };
}

export async function response(ctx) {
  return ctx.prev.result;
} 