#!/usr/bin/env python3
"""Generate Verb Snake art with Gemini (gemini-3-pro-image).

Usage (from repo root):  python3 games/verb-snake/tools/gen_art.py foods:2 keyart backdrop
Reads GEMINI_API_KEY from the repo-root .env (never printed; falls back to
the main checkout's .env when run from a worktree). Sends the Verb Kitchen
hero as style reference. Originals go to _incoming/verb-snake-art/
(gitignored); keying/sizing is done by build_assets.py.
"""
import base64, json, sys, urllib.request, pathlib, concurrent.futures as cf

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = ROOT / '_incoming' / 'verb-snake-art'
REF = ROOT / 'homepage' / 'thumbnails' / 'hero' / 'verb-kitchen.jpg'
MODEL = 'gemini-3-pro-image'

STYLE = ("Match the art style of the reference image: warm, toy-like, glossy "
         "soft-vinyl collectible look, rounded chunky shapes, soft studio lighting, "
         "saturated but warm colours, cosy and friendly, for kids aged 10-14. "
         "Absolutely no text, no letters, no numbers, no logos, no watermark.")

PROMPTS = {
  'foods': ("A sprite sheet of 16 separate food items in a neat 4 by 4 grid, each item "
            "centred in its own equal square cell with generous empty space around it; "
            "items never touch or overlap and nothing crosses a cell border. Slight 3/4 "
            "top-down view. Row 1: shiny red apple, strawberry, pair of red cherries, orange. "
            "Row 2: yellow pear, watermelon slice, carrot, ripe tomato. "
            "Row 3: corn cob, lemon, peach, small bunch of blueberries. "
            "Row 4: banana, green apple, round chocolate cookie, cupcake with pink frosting. "
            "Each item is a chunky glossy toy-like object with a soft highlight. "
            "The background is ONE flat solid pure magenta colour (#FF00FF) everywhere: "
            "no shadows on it, no gradient, no floor, no grid lines, no props. " + STYLE, '1:1'),
  'keyart': ("Key art for a kids' word game: a cute, chunky, friendly toy snake with a "
             "teal-turquoise glossy body of round plump segments and a lighter cream belly, "
             "big shiny dark eyes, rosy cheeks and a happy open smile, curling through a "
             "sunny vegetable garden. Around it lie big glossy fruits (red apple, strawberry, "
             "cherries, watermelon slice, carrot, pear). Wooden garden fence, flowers, soft "
             "green grass, blue sky with fluffy clouds in the top third. Wide landscape "
             "composition, snake in the centre. " + STYLE, '16:9'),
  'backdrop': ("Camera pointing straight down: top-down view of a sunny cosy garden lawn: "
               "lush green grass with small daisies, clover patches, a few round stepping "
               "stones, tiny pink, yellow and white flowers, a few fallen leaves. Detail "
               "spread evenly over the whole image, no single focal object, no path, no "
               "people, no animals, no fence, no horizon. Calm and slightly low contrast "
               "so it works as a background behind a game board. " + STYLE, '9:16'),
}


def api_key():
    for env in (ROOT / '.env', ROOT.parents[2] / '.env'):
        if env.exists():
            for line in env.read_text().splitlines():
                if line.startswith('GEMINI_API_KEY='):
                    return line.split('=', 1)[1].strip().strip('"\'')
    sys.exit('GEMINI_API_KEY not found')


def gen(name, idx, key):
    prompt, ratio = PROMPTS[name]
    body = {
      'contents': [{'parts': [
        {'inline_data': {'mime_type': 'image/jpeg', 'data': base64.b64encode(REF.read_bytes()).decode()}},
        {'text': 'The image above is a style reference only. ' + prompt},
      ]}],
      'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': ratio}},
    }
    req = urllib.request.Request(
      f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
      data=json.dumps(body).encode(),
      headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = json.load(r)
    except Exception as e:  # noqa
        return f'{name}-{idx}: error {e}'
    for c in data.get('candidates', []):
        for p in c.get('content', {}).get('parts', []):
            d = p.get('inlineData') or p.get('inline_data')
            if d:
                out = OUT / f'{name}-{idx}.png'
                out.write_bytes(base64.b64decode(d['data']))
                return str(out)
    return f'{name}-{idx}: no image ({json.dumps(data)[:300]})'


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    key = api_key()
    jobs = []
    for arg in sys.argv[1:]:
        name, _, n = arg.partition(':')
        jobs += [(name, i + 1) for i in range(int(n or 1))]
    with cf.ThreadPoolExecutor(8) as ex:
        for res in ex.map(lambda j: gen(j[0], j[1], key), jobs):
            print(res)
