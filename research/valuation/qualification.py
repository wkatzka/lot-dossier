"""Research admission is separate from feature support and production readiness."""
import math
from model import day

def qualify(record, as_of, mode='retrospective'):
    errors=[];warnings=[]
    price=record.get('price')
    if isinstance(price,bool) or not isinstance(price,(int,float)) or not math.isfinite(price) or price<=0:
        errors.append('missing_closing_price')
    elif record.get('priceType')!='closed_price' or not record.get('priceVerified'):
        errors.append('closing_price_not_verified')
    if not str(record.get('source','')).startswith('https://'):errors.append('missing_price_source')
    if not record.get('propertyKey'):errors.append('missing_property_identity')
    if record.get('propertyType') not in ('vacant_residential_land','vacant_land','agricultural_development_land'):
        errors.append('not_documented_land_only')
    conditions=record.get('transactionConditions')
    if conditions in ('non_market','seller_financing','unverified',None):errors.append('transaction_evidence_missing_or_adverse')
    elif conditions!='ordinary_market':warnings.append('arms_length_not_independently_verified')
    try:
        sale=day(record['saleDate']);valuation=day(record['valuationDate'])
        if not valuation<=sale<=day(as_of) or (sale-valuation).days>30:errors.append('invalid_sale_chronology')
    except (KeyError,ValueError,TypeError):errors.append('missing_or_invalid_sale_dates')
    if mode=='public_replay':
        try:
            if not day(record['saleDate'])<=day(record['availableAt'])<=day(as_of):errors.append('invalid_publication_chronology')
        except (KeyError,ValueError,TypeError):errors.append('missing_price_publication_date')
    elif not record.get('availableAt'):warnings.append('historical_reconstruction_not_public_asof_replay')
    # Missing optional attributes are unknowns, never defaults such as "no hazard".
    usable={}
    for key,f in record.get('features',{}).items():
        try:
            if f.get('value') is None:continue
            if not str(f.get('source','')).startswith('https://'):raise ValueError()
            if day(f['effectiveAt'])>day(record['valuationDate']):raise ValueError()
            if mode=='public_replay' and day(f['availableAt'])>day(record['valuationDate']):raise ValueError()
            usable[key]=f
        except (ValueError,TypeError,KeyError):warnings.append('feature_not_admitted:'+key)
    warnings.extend(record.get('reviewFlags',[]))
    return dict(eligible=not errors,reasons=sorted(set(errors)),warnings=sorted(set(warnings)),usableFeatures=usable)
