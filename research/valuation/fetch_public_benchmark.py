import urllib.request,urllib.parse,json,concurrent.futures
from pathlib import Path
import argparse
parser=argparse.ArgumentParser();parser.add_argument('cache',type=Path);parser.add_argument('--modern',action='store_true');args=parser.parse_args()
P=args.cache;P.mkdir(parents=True,exist_ok=True)
if not (P/'sales.json').exists():
    q={'$where':"class='100' AND sale_date >= '2015-01-01T00:00:00' AND sale_date < '2025-01-01T00:00:00'",'$select':'pin,year,sale_date,sale_price,doc_no,is_multisale,num_parcels_sale,sale_type,deed_type,sale_filter_same_sale_within_365,sale_filter_less_than_10k,sale_filter_deed_type,nbhd,township_code', '$limit':50000,'$order':'sale_date,pin'}
    u='https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json?'+urllib.parse.urlencode(q)
    data=json.load(urllib.request.urlopen(u,timeout=90))
    if len(data)==50000:raise RuntimeError('Query cap reached; implement pagination before proceeding')
    (P/'sales.json').write_text(json.dumps(data))
a=json.loads((P/'sales.json').read_text())
a=[r for r in a if (r.get('sale_type')=='LAND' or args.modern and r.get('sale_type') is None) and not any(r.get(k) for k in ['is_multisale','sale_filter_same_sale_within_365','sale_filter_less_than_10k','sale_filter_deed_type'])]
fields='pin,year,class,lat,lon,nbhd_code,township_code,env_flood_fema_sfha,env_flood_fema_data_year,access_cmap_walk_total_score,access_cmap_walk_data_year'
queries=[]
for y in (range(2021,2025) if args.modern else range(2015,2021)):
 pins=sorted({r['pin'] for r in a if int(float(r['year']))==y})
 for start in range(0,len(pins),100):
  filt="year='"+str(y-1)+"' AND pin in ("+','.join("'"+p+"'" for p in pins[start:start+100])+")"
  queries.append((y,start,'nj4t-kc8j',fields,filt))
  queries.append((y,start,'x54s-btds','pin,year,class,char_land_sf,char_bldg_sf',filt))
  queries.append((y,start,'uzyt-m557','pin,year,class,certified_land,certified_bldg',filt))
  if args.modern:
   geo_filter="pin10 in ("+','.join("'"+p[:10]+"'" for p in pins[start:start+100])+") AND parceltype='1'"
   queries.append((y,start,'2yvh-uwrw','pin10,pinu,parceltype,the_geom',geo_filter))
def run(q):
 y,start,id,select,where=q;file=P/f'{id}-{y}-{start}.json'
 if file.exists():return json.loads(file.read_text())
 u='https://datacatalog.cookcountyil.gov/resource/'+id+'.json?'+urllib.parse.urlencode({'$where':where,'$select':select,'$limit':5000,'$order':'pin10' if id=='2yvh-uwrw' else 'pin,year'})
 d=json.load(urllib.request.urlopen(u,timeout=90))
 if len(d)==5000:raise RuntimeError('Query cap reached')
 file.with_suffix('.request.json').write_text(json.dumps({'url':u,'retrievedAt':'2026-11-07'}))
 file.write_text(json.dumps(d));return d
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 for q,r in zip(queries,ex.map(run,queries)):print(q[:3],len(r),flush=True)
