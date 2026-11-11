/**
 * A very small glob matcher - enough for `integrity.protect` patterns.
 * Supports `**`, `*` and `?`; paths are always repo-relative and use `/`.
 */
export function globToRegExp(glob: string): RegExp {
  let out = "^"
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]
    if (char === "*") {
      if (glob[i + 1] === "*") {
        // `**/` matches zero or more directories, bare `**` matches anything.
        if (glob[i + 2] === "/") {
          out += "(?:.*/)?"
          i += 2
        } else {
          out += ".*"
          i += 1
        }
      } else {
        out += "[^/]*"
      }
    } else if (char === "?") {
      out += "[^/]"
    } else if ("\\^$.|+()[]{}".includes(char)) {
      out += `\\${char}`
    } else {
      out += char
    }
  }
  return new RegExp(`${out}$`)
}

export function matchesAny(path: string, globs: readonly string[]): boolean {
  const posix = path.replaceAll("\\", "/")
  return globs.some((glob) => globToRegExp(glob).test(posix))
}
