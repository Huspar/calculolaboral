# -*- coding: utf-8 -*-
"""Envia las URLs del sitio a IndexNow (Bing/Yandex/Seznam) tras cada deploy.

Uso:
    python tools/indexnow.py                 # envia todas las URLs del sitemap
    python tools/indexnow.py url1 url2 ...    # envia solo las URLs indicadas

Requisitos: el archivo de llave IndexNow en la raiz del repo
(0359a0bf81d1fbe3c661316e3e63a540.txt) ya esta desplegado en el sitio.
Fuera de linea o sin red, el script avisa y no rompe el deploy.
"""
import sys, os, re, json, urllib.request, urllib.error

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://calculolaboral.cl'
KEY_FILE = '0359a0bf81d1fbe3c661316e3e63a540.txt'
KEY_LOCATION = SITE + '/' + KEY_FILE

def urls_del_sitemap():
    with open(os.path.join(REPO, 'sitemap.xml'), encoding='utf-8') as f:
        return re.findall(r'<loc>(.*?)</loc>', f.read())

def enviar(urls):
    if not urls:
        print('nada que enviar')
        return
    body = json.dumps({
        'host': 'calculolaboral.cl',
        'key': KEY_FILE[:-4],
        'keyLocation': KEY_LOCATION,
        'urlList': urls
    }).encode('utf-8')
    req = urllib.request.Request(
        'https://api.indexnow.org/indexnow',
        data=body,
        headers={'Content-Type': 'application/json; charset=utf-8'},
        method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print('IndexNow: HTTP', r.status, '-', len(urls), 'URLs enviadas')
            return True
    except urllib.error.HTTPError as e:
        print('IndexNow: HTTP', e.code, '-', e.reason, '(200/202 = OK)')
        return e.code in (200, 202)
    except Exception as e:
        print('IndexNow: fallo de red:', e)
        return False

if __name__ == '__main__':
    if len(sys.argv) > 1:
        lista = sys.argv[1:]
    else:
        lista = urls_del_sitemap()
        print('URLs del sitemap:', len(lista))
    ok = enviar(lista[: 10000])
    sys.exit(0 if ok else 1)
