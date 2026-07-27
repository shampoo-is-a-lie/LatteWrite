#!/usr/bin/env python3
"""Spoken punctuation and capitalisation for Latte Dictate.

Chrome's on-device recogniser returns bare words: no punctuation, little
capitalisation. This turns a stream of recognised phrases into written prose.

Stateful on purpose. Recognition arrives one final at a time, but spacing and
capitalisation depend on what came before - "hello" then "comma" has to produce
"hello," and not "hello ,". So the processor emits a *leading* space when one is
needed and never a trailing one; a chunk that begins with attaching punctuation
simply withholds it. That is the whole trick, and it is why this cannot be done
per-phrase in isolation.

Self-test:  python3 dictate/textproc.py --selftest
"""
import re
import sys

# Punctuation that clings to the word before it, then wants a space after.
ATTACH = {
    'period': '.', 'full stop': '.',
    'comma': ',',
    'question mark': '?',
    'exclamation mark': '!', 'exclamation point': '!',
    'colon': ':',
    'semicolon': ';', 'semi colon': ';',
    'ellipsis': '...', 'dot dot dot': '...',
    'close paren': ')', 'close parenthesis': ')',
    'close bracket': ']', 'close quote': '"', 'unquote': '"',
    'percent sign': '%',
}

# Punctuation that takes a space before and glues to whatever follows.
LEAD = {
    'open paren': '(', 'open parenthesis': '(',
    'open bracket': '[', 'open quote': '"',
    'dollar sign': '$', 'hash': '#', 'hashtag': '#',
}

# Free-standing symbols: spaces on both sides.
FREE = {
    'dash': '-', 'hyphen': '-', 'em dash': '--',
    'ampersand': '&', 'plus sign': '+', 'equals sign': '=',
    'slash': '/', 'forward slash': '/', 'backslash': '\\',
    'at sign': '@', 'asterisk': '*',
}

BREAK = {
    'new line': '\n', 'newline': '\n',
    'new paragraph': '\n\n',
    'tab key': '\t',
}

# Sets capitalisation for the next word without emitting anything itself.
CASE = {'cap': 'cap', 'capital': 'cap', 'caps': 'cap', 'all caps': 'upper'}

SENTENCE_END = ('.', '!', '?')
MAX_PHRASE = max(len(p.split()) for p in
                 (*ATTACH, *LEAD, *FREE, *BREAK, *CASE))


def _norm(word):
    """Bare lowercase form, so a recogniser that emits 'Comma.' still matches."""
    return re.sub(r'^\W+|\W+$', '', word.lower())


class Punctuator:
    """Feed it recognised phrases, get back text ready to inject.

    enabled=False still applies spacing, so switching commands off does not
    switch off sane output.
    """

    def __init__(self, enabled=True, auto_caps=True):
        self.enabled = enabled
        self.auto_caps = auto_caps
        self.reset()

    def reset(self):
        """Call at the start of a listening session - no leading space, and the
        first word starts a sentence."""
        self.need_space = False
        self.cap_next = self.auto_caps
        self.upper_next = False
        self.quote_open = False

    # ── emit helpers ─────────────────────────────────────────────────────────

    def _space(self, out):
        if self.need_space:
            out.append(' ')

    def _word(self, out, word):
        self._space(out)
        if self.upper_next:
            word = word.upper()
            self.upper_next = False
        elif self.cap_next and word[:1].isalpha():
            word = word[0].upper() + word[1:]
        self.cap_next = False
        out.append(word)
        self.need_space = True
        # Cloud mode punctuates on its own; respect it so the next word still
        # gets capitalised.
        if self.auto_caps and word.endswith(SENTENCE_END):
            self.cap_next = True

    def _attach(self, out, mark):
        out.append(mark)
        self.need_space = True
        # Precedence matters here: an ellipsis is not a sentence end, and
        # auto_caps=False must suppress capitalisation unconditionally.
        if self.auto_caps and mark in SENTENCE_END:
            self.cap_next = True

    def _lead(self, out, mark):
        self._space(out)
        out.append(mark)
        self.need_space = False

    def _free(self, out, mark):
        self._space(out)
        out.append(mark)
        self.need_space = True

    def _break(self, out, mark):
        out.append(mark)
        self.need_space = False
        if self.auto_caps:
            self.cap_next = True

    # ── main ─────────────────────────────────────────────────────────────────

    def feed(self, text):
        """Return the string to inject for one recognised phrase."""
        words = (text or '').split()
        if not words:
            return ''
        out = []
        i = 0
        while i < len(words):
            if self.enabled:
                hit = self._match(words, i)
                if hit:
                    length, kind, mark = hit
                    if kind == 'attach':
                        self._attach(out, mark)
                    elif kind == 'lead':
                        self._lead(out, mark)
                    elif kind == 'free':
                        self._free(out, mark)
                    elif kind == 'break':
                        self._break(out, mark)
                    elif kind == 'quote':
                        # A bare "quote" opens or closes depending on state.
                        if self.quote_open:
                            self._attach(out, '"')
                        else:
                            self._lead(out, '"')
                        self.quote_open = not self.quote_open
                    elif kind == 'cap':
                        self.cap_next = True
                    elif kind == 'upper':
                        self.upper_next = True
                    i += length
                    continue
            self._word(out, words[i])
            i += 1
        return ''.join(out)

    def _match(self, words, i):
        """Longest phrase first, so 'exclamation mark' wins over 'mark'."""
        for n in range(min(MAX_PHRASE, len(words) - i), 0, -1):
            phrase = ' '.join(_norm(w) for w in words[i:i + n]).strip()
            if not phrase:
                continue
            if phrase in ATTACH:
                return n, 'attach', ATTACH[phrase]
            if phrase in LEAD:
                return n, 'lead', LEAD[phrase]
            if phrase in FREE:
                return n, 'free', FREE[phrase]
            if phrase in BREAK:
                return n, 'break', BREAK[phrase]
            if phrase in CASE:
                return n, CASE[phrase], None
            if phrase == 'quote':
                return n, 'quote', None
        return None


def command_reference():
    groups = [
        ('Punctuation', ATTACH), ('Brackets and symbols', {**LEAD, **FREE}),
        ('Layout', BREAK), ('Casing', {k: '' for k in CASE}),
    ]
    lines = []
    for title, table in groups:
        seen, items = set(), []
        for phrase, mark in table.items():
            if mark in seen and mark:
                continue
            seen.add(mark)
            items.append(f'{phrase}{" -> " + mark.strip() if mark.strip() else ""}')
        lines.append(f'{title}: ' + ', '.join(items))
    return '\n'.join(lines)


# ── self-test ────────────────────────────────────────────────────────────────

def _selftest():
    cases = [
        # (session phrases, expected joined output)
        (['hello comma world period'], 'Hello, world.'),
        (['hello', 'comma world'], 'Hello, world'),
        (['this is a test period', 'it works period'],
         'This is a test. It works.'),
        (['what is this question mark'], 'What is this?'),
        (['wow exclamation point'], 'Wow!'),
        (['dear bob comma new paragraph how are you question mark'],
         'Dear bob,\n\nHow are you?'),
        # mid-sentence brackets must not trigger capitalisation
        (['this is an aside open paren really close paren'],
         'This is an aside (really)'),
        # at a sentence start they still do
        (['open paren aside close paren'], '(Aside)'),
        (['he said quote hello quote to me'], 'He said "hello" to me'),
        # "cap" lifts the NEXT word only - "dictate" stays lowercase
        (['we use cap latte dictate daily'], 'We use Latte dictate daily'),
        # an ellipsis is not a sentence end
        (['wait ellipsis really'], 'Wait... really'),
        (['all caps stop period'], 'STOP.'),
        (['one new line two'], 'One\nTwo'),
        (['a semicolon b colon c'], 'A; b: c'),
        (['five dollar sign ten'], 'Five $ten'),
        (['x plus sign y'], 'X + y'),
        # recogniser already punctuated (cloud mode): capitalisation still right
        (['Hello there.', 'this is next'], 'Hello there. This is next'),
        # trailing/duplicate whitespace must not leak through
        (['  spaced   out  '], 'Spaced out'),
    ]
    fails = 0
    for phrases, expected in cases:
        p = Punctuator()
        got = ''.join(p.feed(ph) for ph in phrases)
        if got != expected:
            fails += 1
            print(f'FAIL  {phrases}\n  expected {expected!r}\n  got      {got!r}')
    # commands off: spacing still sane, command words stay literal
    p = Punctuator(enabled=False)
    got = p.feed('hello comma world')
    if got != 'Hello comma world':
        fails += 1
        print(f'FAIL  disabled mode\n  got {got!r}')
    # reset() clears pending space
    p = Punctuator()
    p.feed('one')
    p.reset()
    if p.feed('two') != 'Two':
        fails += 1
        print('FAIL  reset() did not clear state')

    total = len(cases) + 2
    print(f'{total - fails}/{total} passed')
    return 1 if fails else 0


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(_selftest())
    print(command_reference())
