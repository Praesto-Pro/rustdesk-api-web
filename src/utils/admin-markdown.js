import { Marked } from 'marked'
import { Lexer, Parser } from 'marked-legacy'

// Saved administrator messages retain Marked 15's grammar and HTML output.
// Remove these hooks only as part of an intentional message-format migration.
const administratorMarkdown = new Marked({
  hooks: {
    provideLexer: () => Lexer.lex,
    provideParser: () => Parser.parse,
  },
})

export function parseAdministratorMarkdown (source) {
  return administratorMarkdown.parse(source)
}
