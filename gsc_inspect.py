import os
import xml.etree.ElementTree as ET
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']
KEY_FILE_LOCATION = 'c:/Users/Jhon/Desktop/Arreglarpagina/credentials.json'
SITE_URL = 'sc-domain:calculolaboral.cl'
SITEMAP_PATH = 'c:/Users/Jhon/Desktop/Arreglarpagina/sitemap.xml'

def get_urls_from_sitemap(sitemap_path):
    tree = ET.parse(sitemap_path)
    root = tree.getroot()
    # XML namespace: {http://www.sitemaps.org/schemas/sitemap/0.9}url
    namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    urls = []
    for url_tag in root.findall('ns:url', namespace):
        loc = url_tag.find('ns:loc', namespace).text
        urls.append(loc)
    return set(urls)

def main():
    credentials = service_account.Credentials.from_service_account_file(
        KEY_FILE_LOCATION, scopes=SCOPES)
    service = build('searchconsole', 'v1', credentials=credentials)
    
    urls = get_urls_from_sitemap(SITEMAP_PATH)
    print(f"Found {len(urls)} URLs in sitemap.")
    
    url_inspection = service.urlInspection().index()
    
    for url in urls:
        print(f"Inspecting {url}...")
        try:
            request = {
                'inspectionUrl': url,
                'siteUrl': SITE_URL,
                'languageCode': 'es-CL'
            }
            response = url_inspection.inspect(body=request).execute()
            status = response.get('inspectionResult', {}).get('indexStatusResult', {})
            verdict = status.get('verdict', 'UNKNOWN')
            coverage_state = status.get('coverageState', 'UNKNOWN')
            print(f"  -> Verdict: {verdict} | State: {coverage_state}")
        except Exception as e:
            print(f"  -> ERROR: {str(e)}")

if __name__ == '__main__':
    main()
