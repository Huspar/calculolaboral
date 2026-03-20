import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/webmasters']
KEY_FILE_LOCATION = 'c:/Users/Jhon/Desktop/Arreglarpagina/credentials.json'
SITE_URL = 'sc-domain:calculolaboral.cl'
SITEMAP_URL = 'https://calculolaboral.cl/sitemap.xml'

def main():
    try:
        credentials = service_account.Credentials.from_service_account_file(
            KEY_FILE_LOCATION, scopes=SCOPES)
        service = build('searchconsole', 'v1', credentials=credentials)
        
        print(f"Submitting sitemap: {SITEMAP_URL}")
        # Submit the sitemap
        service.sitemaps().submit(siteUrl=SITE_URL, feedpath=SITEMAP_URL).execute()
        print("Sitemap submitted successfully!")
        
    except Exception as e:
        print(f"Error submitting sitemap: {str(e)}")

if __name__ == '__main__':
    main()
