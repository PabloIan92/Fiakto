declare module "minimatch" {
  export interface MinimatchOptions {
    debug?: boolean;
    nobrace?: boolean;
    noglobstar?: boolean;
    dot?: boolean;
    noext?: boolean;
    nocase?: boolean;
    nonull?: boolean;
    matchBase?: boolean;
    nocomment?: boolean;
    nonegate?: boolean;
    flipNegate?: boolean;
    allowWindowsEscape?: boolean;
    partial?: boolean;
  }

  export class Minimatch {
    constructor(pattern: string, options?: MinimatchOptions);
    match(fname: string): boolean;
    set: string[][];
    regex: RegExp;
    negate: boolean;
    comment: boolean;
    empty: boolean;
    pattern: string;
    options: MinimatchOptions;
  }

  export function minimatch(path: string, pattern: string, options?: MinimatchOptions): boolean;
  export function filter(pattern: string, options?: MinimatchOptions): (path: string) => boolean;
  export function match(list: string[], pattern: string, options?: MinimatchOptions): string[];
  export function makeRe(pattern: string, options?: MinimatchOptions): RegExp;
  export function braceExpand(str: string): string[];
}