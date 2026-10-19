# Usage: curl -so /tmp/v.jsonld https://schema.org/version/latest/schemaorg-current-https.jsonld
#        python3 scripts/validate-schema.py /tmp/v.jsonld urls.txt report.json
# Validate JSON-LD on sample pages: schema.org vocabulary (types, properties
# allowed on the type or its ancestors) + Google's documented rich-result rules.
import json, re, sys, urllib.request, collections
V = json.load(open(sys.argv[1]))['@graph']
short = lambda i: i.split(':', 1)[1] if ':' in i else i
types, props = {}, collections.defaultdict(set)
for n in V:
    t = n.get('@type'); t = t if isinstance(t, list) else [t]
    nid = short(n['@id'])
    if 'rdfs:Class' in t:
        sc = n.get('rdfs:subClassOf', []); sc = sc if isinstance(sc, list) else [sc]
        types[nid] = [short(x['@id']) for x in sc]
    if 'rdf:Property' in t:
        d = n.get('schema:domainIncludes', []); d = d if isinstance(d, list) else [d]
        for x in d: props[nid].add(short(x['@id']))
def ancestors(t, seen=None):
    seen = seen or set()
    if t in seen: return seen
    seen.add(t)
    for p in types.get(t, []): ancestors(p, seen)
    return seen
def allowed(prop, t):
    return bool(props.get(prop, set()) & ancestors(t)) or prop in ('additionalType', 'sameAs', 'url', 'name', 'description', 'image', 'identifier')
issues = collections.Counter(); per = collections.defaultdict(list)
def err(url, sev, msg): issues[(sev, msg)] += 1; per[url].append(sev + ': ' + msg)
def walk(url, node, path='$'):
    if isinstance(node, list):
        for i, x in enumerate(node): walk(url, x, path)
        return
    if not isinstance(node, dict): return
    t = node.get('@type')
    if t:
        for tt in (t if isinstance(t, list) else [t]):
            if tt not in types: err(url, 'ERROR', f'unknown @type {tt}'); continue
            for k, v in node.items():
                if k.startswith('@') or k == '@context': continue
                if k not in props: err(url, 'ERROR', f'{tt}.{k} is not a schema.org property'); continue
                if not allowed(k, tt): err(url, 'ERROR', f'{k} not valid on {tt}')
            google(url, tt, node)
    for k, v in node.items():
        if isinstance(v, (dict, list)): walk(url, v, path + '.' + k)
def google(url, t, n):
    if t in ('Event', 'MusicEvent', 'Festival'):
        for req in ('name', 'startDate', 'location'):
            if not n.get(req): err(url, 'ERROR', f'{t} missing required {req} (Google Event)')
        loc = n.get('location') or {}
        if isinstance(loc, dict):
            if not loc.get('name'): err(url, 'WARN', f'{t}.location missing name')
            a = loc.get('address')
            if not a: err(url, 'ERROR', f'{t}.location missing address (Google Event)')
            elif isinstance(a, dict) and not (a.get('streetAddress') or a.get('addressLocality')): err(url, 'ERROR', f'{t}.location.address empty')
        sd = n.get('startDate', '')
        if sd and not re.match(r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$', sd): err(url, 'ERROR', f'{t}.startDate not ISO 8601: {sd}')
        for rec in ('image', 'description', 'endDate', 'eventStatus', 'offers', 'performer', 'organizer'):
            if not n.get(rec): err(url, 'WARN', f'{t} missing recommended {rec}')
        o = n.get('offers')
        for off in (o if isinstance(o, list) else [o] if o else []):
            for rec in ('price', 'priceCurrency', 'availability', 'url', 'validFrom'):
                if off.get(rec) in (None, ''): err(url, 'WARN', f'Offer missing recommended {rec}')
        if n.get('eventStatus') and not str(n['eventStatus']).startswith('https://schema.org/'): err(url, 'ERROR', 'eventStatus not a schema.org URL')
    if t == 'BreadcrumbList':
        items = n.get('itemListElement') or []
        if len(items) < 2: err(url, 'WARN', 'BreadcrumbList has fewer than 2 items')
        for i, it in enumerate(items):
            if it.get('position') != i + 1: err(url, 'ERROR', 'BreadcrumbList position not 1..n')
            if not it.get('name'): err(url, 'ERROR', 'ListItem missing name')
            if not it.get('item') and i < len(items) - 1: err(url, 'ERROR', 'ListItem missing item (non-last)')
    if t == 'FAQPage':
        for q in n.get('mainEntity') or []:
            if q.get('@type') != 'Question' or not q.get('name'): err(url, 'ERROR', 'FAQ entry not a named Question')
            a = q.get('acceptedAnswer') or {}
            if not a.get('text'): err(url, 'ERROR', 'Question missing acceptedAnswer.text')
    if t == 'ItemList':
        for i, it in enumerate(n.get('itemListElement') or []):
            if it.get('@type') == 'ListItem' and it.get('position') != i + 1: err(url, 'ERROR', 'ItemList position not 1..n')
    if t in ('Place', 'MusicVenue') and not n.get('address'): err(url, 'WARN', f'{t} missing address')
    if t in ('MusicGroup', 'Organization') and not n.get('name'): err(url, 'ERROR', f'{t} missing name')
counts = collections.Counter()
for url in [l.strip() for l in open(sys.argv[2]) if l.strip()]:
    try: html = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 schema-check'}), timeout=30).read().decode()
    except Exception as e: err(url, 'ERROR', f'fetch failed {e}'); continue
    blocks = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>([\s\S]*?)</script>', html)
    if not blocks: err(url, 'WARN', 'no JSON-LD')
    for b in blocks:
        try: d = json.loads(b)
        except Exception as e: err(url, 'ERROR', f'invalid JSON-LD: {e}'); continue
        for x in (d if isinstance(d, list) else [d]):
            for tt in ([x.get('@type')] if not isinstance(x.get('@type'), list) else x['@type']): counts[tt] += 1
        walk(url, d)
print('top-level types:', dict(counts))
for (sev, msg), n in sorted(issues.items(), key=lambda kv: (kv[0][0] != 'ERROR', -kv[1])): print(f'{n:4d}  {sev}  {msg}')
json.dump(per, open(sys.argv[3], 'w'), indent=1)
