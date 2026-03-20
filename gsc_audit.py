import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']
KEY_FILE_LOCATION = 'c:/Users/Jhon/Desktop/Arreglarpagina/credentials.json'

def main():
    try:
        credentials = service_account.Credentials.from_service_account_file(
            KEY_FILE_LOCATION, scopes=SCOPES)
        service = build('searchconsole', 'v1', credentials=credentials)
        
        # Get list of sites
        site_list = service.sites().list().execute()
        print("Sites accessible by this service account:")
        sites = site_list.get('siteEntry', [])
        for site in sites:
            print(f"- {site['siteUrl']}")
            
        if not sites:
            print("WARNING: No sites found. Ensure the service account email is added as a delegated owner/user in Google Search Console.")
    except Exception as e:
        print(f"Error connecting to GSC API: {str(e)}")

if __name__ == '__main__':
    main()
