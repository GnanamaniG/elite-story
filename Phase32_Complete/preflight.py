#!/usr/bin/env python3
"""Strict pre-flight build validator — catches every error class we've hit."""
import re, os, sys, glob

def bracket_scan(src):
    """JSX-aware bracket matcher: skips strings, templates, comments."""
    i, n, line, stack, issues = 0, len(src), 1, [], []
    while i < n:
        ch = src[i]
        if ch=='\n': line+=1; i+=1; continue
        if src.startswith('//',i):
            j=src.find('\n',i); i = n if j<0 else j; continue
        if src.startswith('/*',i):
            j=src.find('*/',i+2); line+=src[i:(j if j>0 else n)].count('\n'); i = n if j<0 else j+2; continue
        if ch=='`':
            i+=1; depth=0
            while i<n:
                if src[i]=='\\': i+=2; continue
                if src[i]=='\n': line+=1
                if src.startswith('${',i): depth+=1; i+=2; continue
                if src[i]=='}' and depth: depth-=1; i+=1; continue
                if src[i]=='`' and not depth: break
                i+=1
            i+=1; continue
        if ch in '"\'':
            q=ch; i+=1
            while i<n and src[i]!=q:
                if src[i]=='\\': i+=1
                i+=1
            i+=1; continue
        if ch in '({[': stack.append((ch,line)); i+=1; continue
        if ch in ')}]':
            want={')':'(','}':'{',']':'['}[ch]
            if not stack: issues.append(f"line {line}: stray '{ch}'")
            elif stack[-1][0]!=want: issues.append(f"line {line}: '{ch}' mismatches '{stack[-1][0]}' from line {stack[-1][1]}"); stack.pop()
            else: stack.pop()
            i+=1; continue
        i+=1
    for ch,ln in stack: issues.append(f"line {ln}: '{ch}' unclosed")
    return issues

def check(root):
    files = sorted(glob.glob(f'{root}/pages/*.jsx')) \
          + sorted(glob.glob(f'{root}/shell/*.jsx')) \
          + [f'{root}/App.jsx', f'{root}/layout/AppShell.jsx']
    files = [f for f in files if os.path.exists(f)]
    errors = []
    all_pages = set(os.path.basename(f)[:-4] for f in glob.glob(f'{root}/pages/*.jsx'))

    for f in files:
        c = open(f).read(); n = os.path.basename(f)

        ids = re.findall(r'^import\s+(\w+)\s+from', c, re.M)
        for d in set(x for x in ids if ids.count(x)>1):
            errors.append((n, f"DUPLICATE IMPORT '{d}'"))

        if c.count('export default') > 1:
            errors.append((n, "MULTIPLE default exports"))
        if 'export default' not in c and n not in ('HubShell.jsx',):
            errors.append((n, "NO default export"))

        if re.search(r'\.map\s*\([^)]{0,80}=>\s*\(?\s*<>', c):
            errors.append((n, "BARE <> fragment as .map() list item — needs <Fragment key=>"))

        for hook in ('useState','useEffect','useRef','useMemo','useCallback'):
            if re.search(r'(?<![\w.])'+hook+r'\s*\(', c) and not re.search(r'import\s*\{[^}]*\b'+hook+r'\b', c):
                errors.append((n, f"{hook} used but NOT imported"))
        if re.search(r'<Fragment[\s>]', c) and not re.search(r'import\s*\{[^}]*\bFragment\b', c):
            errors.append((n, "Fragment used but NOT imported"))

        for target in re.findall(r"from '\./(\w+)'", c):
            if f'{root}/pages/' in f and target not in all_pages and target != 'HubShell':
                errors.append((n, f"imports './{target}' — file does not exist"))

        if n.endswith('Hub.jsx'):
            tabs = re.findall(r"\{ id:'(\w+)'", c)
            for d in set(x for x in tabs if tabs.count(x)>1):
                errors.append((n, f"DUPLICATE tab id '{d}'"))
            rendered = set(re.findall(r"tab==='(\w+)'", c))
            if set(tabs) != rendered:
                miss = set(tabs)-rendered; extra = rendered-set(tabs)
                if miss:  errors.append((n, f"tab(s) never rendered: {miss}"))
                if extra: errors.append((n, f"rendered without tab entry: {extra}"))

    app = f'{root}/App.jsx'
    if os.path.exists(app):
        c = open(app).read()
        keys = re.findall(r'^\s+(\w+):\s+<', c, re.M)
        for d in set(x for x in keys if keys.count(x)>1):
            errors.append(('App.jsx', f"DUPLICATE route key '{d}'"))
        imported = set(re.findall(r"^import (\w+)\s+from './pages/", c, re.M))
        for r in set(re.findall(r'<(\w+)\s+\{\.\.\.props\}', c)):
            if r not in imported: errors.append(('App.jsx', f"route renders <{r}> but never imports it"))
        for name, file in re.findall(r"^import (\w+)\s+from './pages/(\w+)'", c, re.M):
            if file not in all_pages: errors.append(('App.jsx', f"imports missing file ./pages/{file}"))

    return files, errors

if __name__ == '__main__':
    root = sys.argv[1]
    files, errors = check(root)
    print(f"Pre-flight: {len(files)} files scanned in {root}\n")
    if errors:
        print(f"❌ {len(errors)} BUILD BLOCKER(S):\n")
        for n,e in errors: print(f"   {n:28} {e}")
        sys.exit(1)
    print("✅ PASS — no build blockers detected")
