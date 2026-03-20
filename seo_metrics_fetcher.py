import os
import sys
import datetime
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
)
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDENTIALS_FILE = 'credentials.json'
GA4_PROPERTY_ID = '525092126'
GSC_SITE_URLS = ['sc-domain:calculolaboral.cl', 'https://calculolaboral.cl/']

def get_credentials():
    scopes = [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly'
    ]
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"ERROR: No se encontró el archivo {CREDENTIALS_FILE}")
        sys.exit(1)
    return service_account.Credentials.from_service_account_file(
        CREDENTIALS_FILE, scopes=scopes)

def fetch_ga4_data(credentials):
    print("\n--- [ GA4 ] Extrayendo datos de Google Analytics 4 ---")
    try:
        client = BetaAnalyticsDataClient(credentials=credentials)
        request = RunReportRequest(
            property=f"properties/{GA4_PROPERTY_ID}",
            dimensions=[Dimension(name="pagePath")],
            metrics=[
                Metric(name="sessions"),
                Metric(name="bounceRate"),
                Metric(name="averageSessionDuration"),
                Metric(name="screenPageViews"),
            ],
            date_ranges=[DateRange(start_date="28daysAgo", end_date="yesterday")],
        )
        response = client.run_report(request)
        
        results = []
        for row in response.rows:
            results.append({
                "path": row.dimension_values[0].value,
                "sessions": row.metric_values[0].value,
                "bounce_rate": row.metric_values[1].value,
                "avg_duration": row.metric_values[2].value,
                "views": row.metric_values[3].value
            })
        
        results.sort(key=lambda x: int(x['sessions']), reverse=True)
        if not results:
            print("No hay datos de GA4 en este periodo.")
            
        for r in results[:10]:
            bounce = float(r['bounce_rate']) * 100
            print(f"{r['path']:<30} | Sesiones: {r['sessions']:<5} | Vistas: {r['views']:<5} | Rebote: {bounce:.1f}% | Prom. Tiempo: {float(r['avg_duration']):.1f}s")
            
        return results
    except Exception as e:
        print(f"Error al conectar con GA4: {e}")

def fetch_gsc_data(credentials):
    print("\n--- [ GSC ] Extrayendo datos de Google Search Console ---")
    service = build('searchconsole', 'v1', credentials=credentials)
    
    end_date = datetime.date.today() - datetime.timedelta(days=2) # GSC data usually has a lag
    start_date = end_date - datetime.timedelta(days=28)
    
    req = {
        'startDate': start_date.strftime('%Y-%m-%d'),
        'endDate': end_date.strftime('%Y-%m-%d'),
        'dimensions': ['page', 'query'],
        'rowLimit': 15
    }
    
    for url in GSC_SITE_URLS:
        print(f"Intentando acceder a la propiedad: {url}")
        try:
            response = service.searchanalytics().query(siteUrl=url, body=req).execute()
            rows = response.get('rows', [])
            if not rows:
                print("No hay clics/impresiones en este periodo para esta URL.")
                return []
                
            print(f"¡Éxito con la propiedad {url}!")
            for row in rows:
                keys = row.get('keys', [])
                page = keys[0] if len(keys) > 0 else ''
                query = keys[1] if len(keys) > 1 else ''
                clicks = row.get('clicks', 0)
                impressions = row.get('impressions', 0)
                ctr = row.get('ctr', 0)
                pos = row.get('position', 0)
                
                print(f"Q: {query:<25} | Pág: {page.replace('https://calculolaboral.cl', '')[:20]:<20} | Clicks: {clicks:<3} | Imp: {impressions:<5} | CTR: {ctr*100:.2f}% | Pos: {pos:.1f}")
            return rows
        except Exception as e:
            if "User does not have sufficient permission" in str(e):
                print(f"  -> Sin permiso para {url}.")
                continue
            else:
                print(f"Error inesperado GSC: {e}")
                
    print("No se pudo acceder a ninguna propiedad válida de GSC con estas credenciales.")

if __name__ == '__main__':
    creds = get_credentials()
    if creds:
        fetch_ga4_data(creds)
        fetch_gsc_data(creds)
