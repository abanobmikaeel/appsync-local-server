
/** Create resolver context */
export function createContext(args) {
  return { 
    arguments: args, 
    stash: {}, 
    prev: {}, 
    util: {}, 
    env: process.env 
  };
}