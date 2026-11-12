"""Build script: python build.py  (needs only Python 3; no packages to install).

Creates the production files the page actually loads:
    style.css  -> style.min.css
    action.js  -> action.min.js
and stamps their content hash into index.html for cache busting."""
import re


# ----------------------------------------------------------------- tidy (readable source)

_DECL = re.compile(r'^\s*(--[\w-]+|[a-z-]+)\s*:.*;\s*$|^\s*[a-z-]+\s*:\s*$')


def tidy_css(text):
    """Consistent spacing: no blank lines inside rules, one between rules, two between sections."""
    lines = [l.rstrip() for l in text.replace('\r\n', '\n').split('\n')]
    out = []
    for i, line in enumerate(lines):
        if line == '':
            prev = next((x for x in reversed(out) if x != ''), '').strip()
            nxt = next((x for x in lines[i + 1:] if x != ''), '')
            ns = nxt.strip()
            if ns.startswith('}'):
                continue
            if prev.endswith('{') and not ns.startswith('/*'):
                continue
            if prev.endswith(';') and _DECL.match(nxt):
                continue
        out.append(line)

    res, i = [], 0
    while i < len(out):
        if out[i] == '':
            j = i
            while j < len(out) and out[j] == '':
                j += 1
            nxt = out[j] if j < len(out) else ''
            res.extend([''] * min(j - i, 2 if nxt.startswith('/* ===') else 1))
            i = j
        else:
            res.append(out[i])
            i += 1
    return '\n'.join(res).strip('\n') + '\n'


def tidy_js(text):
    """No blank lines at block edges or between simple statements; max one blank elsewhere."""
    lines = [l.rstrip() for l in text.replace('\r\n', '\n').split('\n')]
    indent = lambda s: len(s) - len(s.lstrip())
    out = []
    for i, line in enumerate(lines):
        if line == '':
            prev = next((x for x in reversed(out) if x != ''), '')
            nxt = next((x for x in lines[i + 1:] if x != ''), '')
            ps, ns = prev.strip(), nxt.strip()
            if ps.endswith(('{', '(', '[')) or ns.startswith(('}', ')', ']')):
                continue
            plain = lambda s: not s.startswith(('//', '/*', '*'))
            if (ps.endswith(';') and ns.endswith(';') and indent(prev) == indent(nxt)
                    and plain(ps) and plain(ns)):
                continue
        out.append(line)
    res = []
    for line in out:
        if line == '' and res and res[-1] == '':
            continue
        res.append(line)
    return '\n'.join(res).strip('\n') + '\n'


# ----------------------------------------------------------------- minify (production files)

def minify_css(src):
    strings = []

    def scan(m):
        # one left-to-right pass: a comment may contain quote characters
        # (e.g. "icon's") and a string may contain "/*", so neither can be
        # handled by a separate earlier step
        if m.group(1):
            return ''
        strings.append(m.group(2))
        return '\x00%d\x00' % (len(strings) - 1)

    src = re.sub(r'(/\*.*?\*/)|("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')', scan, src, flags=re.S)
    src = re.sub(r'\s+', ' ', src)
    src = re.sub(r'\s*([{};,>~])\s*', r'\1', src)      # structural characters
    src = re.sub(r':\s+', ':', src)                      # "prop: value" (never meaningful in selectors)
    src = re.sub(r';}', '}', src)
    src = re.sub(r'(?<![\d.])0\.(\d)', r'.\1', src)      # 0.5 -> .5
    src = src.strip()
    return re.sub(r'\x00(\d+)\x00', lambda m: strings[int(m.group(1))], src) + '\n'


_WORD = re.compile(r'[A-Za-z0-9_$\u0080-\uffff]')
_REGEX_KW = {'return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'else', 'do', 'new'}


def minify_js(src):
    """Removes comments and redundant whitespace. Keeps one newline per statement so
    automatic semicolon insertion behaves exactly as in the source."""
    out = []
    i, n = 0, len(src)
    pending = None            # None | ' ' | '\n'

    def last():
        return out[-1][-1] if out else ''

    def last_word():
        j = len(out) - 1
        word = ''
        while j >= 0 and _WORD.fullmatch(out[j][-1:] or ' '):
            word = out[j] + word
            j -= 1
        return word

    def emit(token, literal=False):
        nonlocal pending
        if pending and out:
            p, c = last(), token[0]
            if pending == '\n':
                # only drop the newline where it can never matter (after an opener / separator,
                # or before a closer); anything else keeps it so ++/-- and regex literals stay safe
                if not (p in '{([,;:' or c in '})]'):
                    out.append('\n')
            elif (_WORD.match(p) and _WORD.match(c)) or (p in '+-' and c == p) or (p == '/' and c == '/'):
                out.append(' ')
            elif literal and _WORD.match(p):
                out.append(' ')
        pending = None
        out.append(token)

    while i < n:
        c = src[i]
        if c in ' \t\r\n':
            j = i
            while j < n and src[j] in ' \t\r\n':
                j += 1
            ws = src[i:j]
            pending = '\n' if '\n' in ws else (pending or ' ')
            if '\n' in ws:
                pending = '\n'
            i = j
        elif src.startswith('//', i):
            while i < n and src[i] != '\n':
                i += 1
        elif src.startswith('/*', i):
            end = src.index('*/', i + 2)
            i = end + 2
            pending = pending or ' '
        elif c in '"\'':
            j = i + 1
            while src[j] != c:
                j += 2 if src[j] == '\\' else 1
            emit(src[i:j + 1], literal=True)
            i = j + 1
        elif c == '`':
            raise SystemExit('template literals are not supported by this minifier')
        elif c == '/':
            p = last()
            prev_is_value = p in ')]}' or bool(_WORD.match(p or ' '))
            if prev_is_value and p and _WORD.match(p) and last_word() in _REGEX_KW:
                prev_is_value = False
            if prev_is_value:
                emit('/')
                i += 1
            else:                                   # regular-expression literal
                j, in_class = i + 1, False
                while True:
                    ch = src[j]
                    if ch == '\\':
                        j += 2
                        continue
                    if ch == '[':
                        in_class = True
                    elif ch == ']':
                        in_class = False
                    elif ch == '/' and not in_class:
                        break
                    j += 1
                j += 1
                while j < n and src[j].isalpha():
                    j += 1
                emit(src[i:j], literal=True)
                i = j
        else:
            j = i
            while j < n and _WORD.match(src[j]):
                j += 1
            if j == i:
                j = i + 1
            emit(src[i:j])
            i = j
    return ''.join(out).strip() + '\n'


# ----------------------------------------------------------------- build

if __name__ == '__main__':
    import hashlib
    import pathlib
    import subprocess
    import sys

    root = pathlib.Path(__file__).resolve().parent

    def read(name):
        return (root / name).read_text(encoding='utf-8').replace('\r\n', '\n')

    css = minify_css(read('style.css'))
    js = minify_js(read('action.js'))

    assert css.count('{') == css.count('}'), 'unbalanced braces in the CSS'

    (root / 'style.min.css').write_text(css, encoding='utf-8')
    (root / 'action.min.js').write_text(js, encoding='utf-8')

    try:                                    # optional extra safety when Node is installed
        subprocess.run(['node', '--check', str(root / 'action.min.js')], check=True,
                       capture_output=True)
    except FileNotFoundError:
        pass
    except subprocess.CalledProcessError as err:
        sys.exit('action.min.js failed a syntax check:\n' + err.stderr.decode())

    # cache busting: ?v=<hash> changes only when the file's content changes, so
    # visitors get new code immediately while unchanged files stay cached for a year
    page = (root / 'index.html').read_text(encoding='utf-8')
    for name, text in (('style.min.css', css), ('action.min.js', js)):
        stamp = hashlib.sha1(text.encode('utf-8')).hexdigest()[:8]
        page = re.sub(re.escape(name) + r'(\?v=[0-9a-f]+)?"', name + '?v=' + stamp + '"', page)
    (root / 'index.html').write_text(page, encoding='utf-8', newline='')

    def kb(n): return '%.1f KB' % (n / 1024)
    print('style.css  %8s -> style.min.css %8s' % (kb(len(read('style.css').encode())), kb(len(css.encode()))))
    print('action.js  %8s -> action.min.js %8s' % (kb(len(read('action.js').encode())), kb(len(js.encode()))))
    print('index.html now references the new versions.')
