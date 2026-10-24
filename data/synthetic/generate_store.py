#!/usr/bin/env python3
"""
generate_store.py (v2) - synthetic 12-month purchasing data for ONE independent pharmacy,
calibrated so annual purchases land near the NCPA-average store (~$4.35M).

What is real vs. synthetic
  REAL:       drug names, strengths, dosage forms, typical package sizes, brand names and
              their marketers (e.g., Eliquis / Bristol-Myers Squibb).
  SYNTHETIC:  every NDC (labeler codes 900xx are placeholders, not FDA assignments),
              every generic manufacturer, every wholesaler, all quantities, prices,
              shortage events and rebates.
  APPROXIMATE: per-unit benchmark prices ("nadac_per_unit") and national fill counts are
              rough values from memory, NOT pulled from the CMS NADAC file. Swap in the
              current NADAC file before showing any price claim as real.

Mechanics (per drug "equivalence class" = same ingredient + strength + form):
  1. Daily fills ~ Poisson(annual_fills / 365 x day-of-week factor).
  2. Each fill is a 30- or 90-day supply (maintenance) or a fixed course (acute).
  3. Inventory follows a reorder-point / order-up-to policy, checked every business day.
  4. Orders go to the primary wholesaler (next-business-day delivery) using its
     source-program NDC. Every other Tuesday the store forward-buys a few generics
     from a secondary wholesaler, capped to protect primary generic compliance.
  5. Synthetic shortage events force substitutions, backorders and premium secondary buys.

Usage:  python generate_store.py            (writes CSVs to ./out)
"""
import math
import zlib
import datetime as dt
from collections import defaultdict

import numpy as np
import pandas as pd

# ----------------------------------------------------------------------------------
# STORE PARAMETERS (edit to generate other stores)
# ----------------------------------------------------------------------------------
STORE = dict(
    store_id="STORE-001",
    display_name="Beacon Hill Independent (synthetic)",
    modeled_on="Gary Drug Co., 59 Charles St, Boston, MA 02114 (location only; all data synthetic)",
    annual_rx=65_795,            # NCPA 2026 Digest: avg Rx per independent store in 2025
    price_multiplier_center=1.00,  # store-level primary price vs benchmark (1.00 = at benchmark)
    price_multiplier_sd=0.12,      # item-level dispersion around the store center
    primary="Atlas Drug Distribution (fictional)",
    secondaries=["Coastal Rx Supply (fictional)", "Summit Pharma Direct (fictional)"],
    seed=42,
)
START = dt.date(2025, 10, 1)
END = dt.date(2026, 9, 30)

US_TOTAL_RX_MILLIONS = 4_700   # approx annual US prescriptions used to turn national counts into shares
SHARE_90_DAY = 0.35            # share of maintenance fills dispensed as 90-day supplies
SHARE_90_DAY_GLP1 = 0.10
GEN_REORDER_DAYS, GEN_ORDER_UP_TO_DAYS = 14, 45    # generics: reorder point / order-up-to (days of use)
BRAND_REORDER_DAYS, BRAND_ORDER_UP_TO_DAYS = 10, 30 # brands: reorder point / order-up-to (days of use)
LARGE_PKG_THRESHOLD = 0.70     # buy the large bottle if order >= 70% of its count
LARGE_PKG_PRICE_FACTOR = 0.90  # large bottles ~10% cheaper per unit
NON_SOURCE_PRIMARY_FACTOR = 1.30  # off-contract NDC bought from primary costs ~30% more
FWD_BUY_EVERY_N_WEEKS = 2
FWD_BUY_MAX_CLASSES = 40
FWD_BUY_DAYS_SUPPLY = 14
FWD_BUY_MIN_SAVINGS = 0.10
FWD_BUY_MAX_SECONDARY_SHARE = 0.04   # stop forward-buying once month-to-date secondary generic spend > 4% of expected monthly generic spend
GENERIC_WEEKLY_DRIFT_MEAN, GENERIC_WEEKLY_DRIFT_SD = -0.0015, 0.008
# 2026-01-01 list-price (WAC) changes for named brands (factor applied to the 2025 WAC)
#   Eliquis: $606.10 -> $346 per 60 tabs (BMS list price 2025; 2026 list price reported at $346)
#   Jardiance: on NCPA's list of 1/1/2026 WAC decreases; size not verified -> assume 50% cut
#   Others: no change assumed (unverified)
WAC_2026_FACTOR = {"ELIQ5": 346.00 / 606.10, "JARD10": 0.50}
LT_BRAND_WAC_INCREASE = 0.04         # long-tail brands: half take +4% on 1/1/2026 (46brooklyn: median increase 4.0%)
RETURN_DAYS = {dt.date(2025, 12, 31), dt.date(2026, 3, 31), dt.date(2026, 6, 30), dt.date(2026, 9, 30)}
RETURN_MIN_DAYS_SUPPLY, RETURN_MAX_ITEMS, RETURN_CREDIT_PCT = 120, 8, 0.90   # quarterly overstock returns (assumption)
ELIQUIS_SHELF_STOCK = (dt.date(2025, 12, 22), dt.date(2025, 12, 31), dt.date(2026, 1, 15))  # window + credit date

# calibration targets (NCPA-average store)
TARGET_SALES = 5_411_000            # NCPA 2025 Digest avg sales per store
TARGET_GROSS_MARGIN = 0.197         # NCPA gross margin (2023 data)
TARGET_GENERIC_DOLLAR_SHARE = 0.15  # ASSUMPTION (unverified): generics ~15% of purchase dollars
GENERIC_FILL_SHARE = 0.81           # NCPA 2026 Digest: 81% of Rx are generic
LT_N_GENERIC, LT_N_BRAND = 600, 250 # long-tail items (synthetic placeholders)
LT_GENERIC_SECONDARY_SHARE = 0.35   # share of long-tail generics also sold by secondaries
LT_GEN_CATS = {"Cardiovascular": .16, "CNS": .12, "Psychiatric": .12, "GI": .07, "Anti-infective": .09,
               "Endocrine": .05, "Diabetes": .05, "Respiratory": .05, "Pain/MSK": .07, "Urology": .04,
               "Dermatology": .06, "Ophthalmic": .05, "Women's health": .03, "Other": .04}
LT_BRAND_CATS = {"Diabetes": .16, "Respiratory": .14, "Cardiovascular": .08, "CNS": .10, "Psychiatric": .08,
                 "Immunology": .10, "HIV/Antiviral": .08, "GI": .06, "Ophthalmic": .05, "Dermatology": .05,
                 "Oncology (oral)": .04, "Endocrine": .03, "Other": .03}
BRAND_INVOICE_DISCOUNT = 0.025       # brand invoice = WAC x (1 - 2.5%)
BRAND_BENCHMARK_DISCOUNT = 0.015     # brand benchmark = WAC x (1 - 1.5%)
SHORTAGE_SUB_PROB = 0.60             # in a shortage, primary substitutes 60% of the time, backorders 40%
SHORTAGE_SUB_PRICE_FACTOR = 1.35
SHORTAGE_ALLOCATION = 1           # max small packs shipped per order while on allocation
SHORTAGE_SECONDARY_PREMIUM = 1.25
SHORTAGE_BENCHMARK_PEAK = 1.25

SHORTAGES = [  # synthetic events, not real FDA shortages
    dict(event_id="SYN-SHORT-01", cls="AMOX500", start=dt.date(2026, 1, 12), end=dt.date(2026, 3, 20)),
    dict(event_id="SYN-SHORT-02", cls="ALBU", start=dt.date(2026, 6, 8), end=dt.date(2026, 7, 24)),
]
HOLIDAYS = {dt.date(2025, 11, 27), dt.date(2025, 12, 25), dt.date(2026, 1, 1),
            dt.date(2026, 5, 25), dt.date(2026, 7, 3), dt.date(2026, 9, 7)}
DOW_FACTOR = [1.15, 1.15, 1.15, 1.15, 1.15, 0.80, 0.45]  # Mon..Sun, mean = 1.0
# monthly demand multipliers (Jan..Dec) for seasonal products
RESP_SEASON = [1.45, 1.30, 1.10, 0.90, 0.80, 0.70, 0.65, 0.70, 0.85, 0.90, 1.10, 1.35]
FLU_SEASON = [3.00, 2.40, 1.20, 0.50, 0.30, 0.20, 0.20, 0.20, 0.30, 0.30, 0.80, 2.20]
SEASONAL = {"AMOX500": RESP_SEASON, "AZIT250": RESP_SEASON, "DOXY100": RESP_SEASON,
            "CEPH500": RESP_SEASON, "PRED20": RESP_SEASON, "OSEL75": FLU_SEASON}

# ----------------------------------------------------------------------------------
# PRODUCT CLASSES
# key, generic name, strength, form, unit, category, B/G, US fills (M/yr, approx),
# strength share, benchmark $/unit (approx), units per 30-day fill (None = acute),
# acute course units, small pkg, large pkg, # manufacturers, secondary-eligible,
# brand name, brand marketer
# ----------------------------------------------------------------------------------
C = [
 ("ATOR20","Atorvastatin calcium","20 mg","Tablet","TAB","Lipids","G",115,.35,.035,30,None,90,1000,3,True),
 ("ATOR40","Atorvastatin calcium","40 mg","Tablet","TAB","Lipids","G",115,.35,.050,30,None,90,1000,3,True),
 ("LEVO50","Levothyroxine sodium","50 mcg","Tablet","TAB","Endocrine","G",89,.25,.120,30,None,90,1000,2,False),
 ("LEVO100","Levothyroxine sodium","100 mcg","Tablet","TAB","Endocrine","G",89,.20,.140,30,None,90,1000,2,False),
 ("LISI10","Lisinopril","10 mg","Tablet","TAB","Cardiovascular","G",82,.35,.020,30,None,90,1000,3,True),
 ("LISI20","Lisinopril","20 mg","Tablet","TAB","Cardiovascular","G",82,.35,.025,30,None,90,1000,3,True),
 ("METF500","Metformin HCl","500 mg","Tablet","TAB","Diabetes","G",86,.45,.020,60,None,100,1000,3,True),
 ("METF1000","Metformin HCl","1000 mg","Tablet","TAB","Diabetes","G",86,.35,.030,60,None,100,500,3,True),
 ("AMLO5","Amlodipine besylate","5 mg","Tablet","TAB","Cardiovascular","G",69,.45,.015,30,None,90,1000,3,True),
 ("AMLO10","Amlodipine besylate","10 mg","Tablet","TAB","Cardiovascular","G",69,.40,.020,30,None,90,1000,3,True),
 ("METOS50","Metoprolol succinate ER","50 mg","Tablet ER","TAB","Cardiovascular","G",64,.30,.100,30,None,100,1000,2,True),
 ("METOT25","Metoprolol tartrate","25 mg","Tablet","TAB","Cardiovascular","G",64,.25,.020,60,None,100,1000,3,True),
 ("OMEP20","Omeprazole DR","20 mg","Capsule DR","CAP","GI","G",51,.60,.050,30,None,100,1000,3,True),
 ("LOSA50","Losartan potassium","50 mg","Tablet","TAB","Cardiovascular","G",54,.40,.040,30,None,90,1000,3,True),
 ("LOSA100","Losartan potassium","100 mg","Tablet","TAB","Cardiovascular","G",54,.35,.060,30,None,90,1000,3,True),
 ("ALBU","Albuterol sulfate HFA","90 mcg/act, 200 act","Inhaler","EA","Respiratory","G",59,.85,22.00,1,None,1,None,2,False),
 ("SIMV40","Simvastatin","40 mg","Tablet","TAB","Lipids","G",30,.40,.025,30,None,90,1000,3,True),
 ("GABA300","Gabapentin","300 mg","Capsule","CAP","CNS","G",41,.40,.040,90,None,100,500,3,True),
 ("SERT50","Sertraline HCl","50 mg","Tablet","TAB","Psychiatric","G",39,.40,.030,30,None,90,1000,3,True),
 ("HCTZ25","Hydrochlorothiazide","25 mg","Tablet","TAB","Cardiovascular","G",26,.60,.020,30,None,100,1000,2,True),
 ("ROSU10","Rosuvastatin calcium","10 mg","Tablet","TAB","Lipids","G",37,.40,.040,30,None,90,500,3,True),
 ("MONT10","Montelukast sodium","10 mg","Tablet","TAB","Respiratory","G",27,.80,.040,30,None,90,1000,3,True),
 ("ESCI10","Escitalopram oxalate","10 mg","Tablet","TAB","Psychiatric","G",33,.45,.030,30,None,100,500,3,True),
 ("BUPXL150","Bupropion HCl XL","150 mg","Tablet ER","TAB","Psychiatric","G",30,.40,.120,30,None,90,500,2,False),
 ("PANT40","Pantoprazole sodium DR","40 mg","Tablet DR","TAB","GI","G",30,.85,.040,30,None,90,1000,3,True),
 ("FURO40","Furosemide","40 mg","Tablet","TAB","Cardiovascular","G",27,.45,.020,30,None,100,1000,2,True),
 ("FLUT","Fluticasone propionate nasal","50 mcg/act, 16 g","Nasal spray","EA","Allergy","G",23,1.0,6.00,1,None,1,None,2,False),
 ("TRAZ50","Trazodone HCl","50 mg","Tablet","TAB","Psychiatric","G",26,.50,.030,30,None,100,1000,3,True),
 ("TAMS04","Tamsulosin HCl","0.4 mg","Capsule","CAP","Urology","G",22,1.0,.040,30,None,100,1000,3,True),
 ("CARV12","Carvedilol","12.5 mg","Tablet","TAB","Cardiovascular","G",22,.30,.020,60,None,100,500,2,True),
 ("PRED20","Prednisone","20 mg","Tablet","TAB","Anti-inflammatory","G",21,.35,.050,None,10,100,500,2,False),
 ("AMOX500","Amoxicillin","500 mg","Capsule","CAP","Anti-infective","G",23,.50,.060,None,30,100,500,3,False),
 ("MELO15","Meloxicam","15 mg","Tablet","TAB","Pain/MSK","G",19,.55,.020,30,None,100,1000,3,True),
 ("CLOP75","Clopidogrel bisulfate","75 mg","Tablet","TAB","Cardiovascular","G",17,1.0,.040,30,None,90,500,3,True),
 ("FLUO20","Fluoxetine HCl","20 mg","Capsule","CAP","Psychiatric","G",26,.50,.040,30,None,100,1000,3,True),
 ("DULO60","Duloxetine DR","60 mg","Capsule DR","CAP","Psychiatric","G",21,.50,.100,30,None,90,1000,2,True),
 ("PRAV40","Pravastatin sodium","40 mg","Tablet","TAB","Lipids","G",16,.45,.050,30,None,90,500,2,True),
 ("GLIP5","Glipizide","5 mg","Tablet","TAB","Diabetes","G",13,.50,.040,30,None,100,1000,2,True),
 ("CYCL10","Cyclobenzaprine HCl","10 mg","Tablet","TAB","Pain/MSK","G",12,.60,.030,None,30,100,1000,2,True),
 ("ALLO100","Allopurinol","100 mg","Tablet","TAB","Other","G",15,.50,.050,30,None,100,1000,2,True),
 ("ONDA4","Ondansetron ODT","4 mg","Tablet ODT","TAB","GI","G",12,.50,.060,None,12,30,None,2,False),
 ("SPIR25","Spironolactone","25 mg","Tablet","TAB","Cardiovascular","G",15,.70,.050,30,None,100,1000,2,True),
 ("AZIT250","Azithromycin","250 mg","Tablet","TAB","Anti-infective","G",12,.70,.300,None,6,30,None,2,False),
 ("CEPH500","Cephalexin","500 mg","Capsule","CAP","Anti-infective","G",10,.70,.080,None,28,100,500,2,False),
 ("WARF5","Warfarin sodium","5 mg","Tablet","TAB","Anticoagulant","G",7,.30,.100,30,None,100,1000,2,False),
 ("VENL75","Venlafaxine ER","75 mg","Capsule ER","CAP","Psychiatric","G",15,.45,.150,30,None,90,None,2,True),
 ("LAMO100","Lamotrigine","100 mg","Tablet","TAB","CNS","G",12,.35,.040,60,None,100,1000,2,False),
 ("FINA5","Finasteride","5 mg","Tablet","TAB","Urology","G",10,.70,.040,30,None,90,1000,2,True),
 ("VALA1G","Valacyclovir HCl","1 g","Tablet","TAB","Anti-infective","G",9,.60,.200,None,21,30,90,2,True),
 ("HYDX25","Hydroxyzine HCl","25 mg","Tablet","TAB","Psychiatric","G",15,.50,.040,None,30,100,500,2,True),
 ("BUSP10","Buspirone HCl","10 mg","Tablet","TAB","Psychiatric","G",16,.45,.040,60,None,100,500,2,True),
 ("TOPI50","Topiramate","50 mg","Tablet","TAB","CNS","G",11,.40,.040,60,None,100,500,2,True),
 ("MEDR4","Methylprednisolone dose pack","4 mg x 21 tabs","Dose pack","EA","Anti-inflammatory","G",8,1.0,3.00,None,1,1,None,2,False),
 ("FAMO20","Famotidine","20 mg","Tablet","TAB","GI","G",16,.55,.040,60,None,100,1000,2,True),
 ("DOXY100","Doxycycline hyclate","100 mg","Capsule","CAP","Anti-infective","G",9,.60,.150,None,20,50,500,2,False),
 ("EZET10","Ezetimibe","10 mg","Tablet","TAB","Lipids","G",8,1.0,.050,30,None,90,500,2,True),
 ("TIZA4","Tizanidine HCl","4 mg","Tablet","TAB","Pain/MSK","G",10,.60,.030,None,60,150,1000,2,True),
 ("ESTR1","Estradiol","1 mg","Tablet","TAB","Women's health","G",9,.40,.100,30,None,100,500,2,False),
 ("TADA5","Tadalafil","5 mg","Tablet","TAB","Urology","G",6,.50,.100,30,None,30,90,2,True),
 ("FLSA250","Fluticasone/salmeterol inhalation powder","250/50 mcg, 60 blisters","Inhaler","EA","Respiratory","G",10,.50,70.00,1,None,1,None,2,True),
 ("BUFO160","Budesonide/formoterol HFA","160/4.5 mcg, 120 act","Inhaler","EA","Respiratory","G",8,.55,180.00,1,None,1,None,2,True),
 ("OSEL75","Oseltamivir phosphate","75 mg","Capsule","CAP","Anti-infective","G",6,.80,1.000,None,10,10,None,2,False),
 ("ESOM40","Esomeprazole magnesium DR","40 mg","Capsule DR","CAP","GI","G",10,.60,.250,30,None,90,1000,3,True),
 ("MESA12","Mesalamine DR","1.2 g","Tablet DR","TAB","GI","G",2,.90,1.500,60,None,120,None,2,True),
 ("LATA","Latanoprost ophthalmic","0.005%, 2.5 mL","Eye drops","EA","Ophthalmic","G",9,1.0,3.00,1,None,1,None,2,True),
 ("VALS160","Valsartan","160 mg","Tablet","TAB","Cardiovascular","G",10,.40,.120,30,None,90,1000,3,True),
 ("NITF100","Nitrofurantoin monohydrate/macrocrystals","100 mg","Capsule","CAP","Anti-infective","G",8,1.0,.350,None,10,100,None,2,False),
]
B = [  # brands: WAC per unit approximate; marketer is real, NDC is synthetic
 ("ELIQ5","Apixaban","5 mg","Tablet","TAB","Anticoagulant","B",25,.75,10.1017,60,None,60,180,"Eliquis","Bristol-Myers Squibb"),
 ("XARE20","Rivaroxaban","20 mg","Tablet","TAB","Anticoagulant","B",10,.70,18.00,30,None,30,90,"Xarelto","Janssen Pharmaceuticals"),
 ("JARD10","Empagliflozin","10 mg","Tablet","TAB","Diabetes","B",12,.60,20.981,30,None,30,90,"Jardiance","Boehringer Ingelheim"),
 ("OZEM1","Semaglutide pen","1 mg/dose","Pen injector","PEN","Diabetes (GLP-1)","B",15,.45,998.00,1,None,1,None,"Ozempic","Novo Nordisk"),
 ("MOUN5","Tirzepatide pen","5 mg/0.5 mL","Pen injector","PEN","Diabetes (GLP-1)","B",12,.30,270.00,4,None,4,None,"Mounjaro","Eli Lilly"),
 ("TRUL15","Dulaglutide pen","1.5 mg/0.5 mL","Pen injector","PEN","Diabetes (GLP-1)","B",8,.45,246.50,4,None,4,None,"Trulicity","Eli Lilly"),
 ("TREL","Fluticasone/umeclidinium/vilanterol","100/62.5/25 mcg, 30 doses","Inhaler","EA","Respiratory","B",7,.80,650.00,1,None,1,None,"Trelegy Ellipta","GlaxoSmithKline"),
]
GEN_MFRS = [("Northfield Generics", "90011", "NFG"), ("Harborview Pharma", "90012", "HBV"),
            ("Cascade Laboratories", "90013", "CSC"), ("Pinecrest Pharmaceuticals", "90014", "PNC"),
            ("Meridian Labs", "90015", "MRD"), ("Bluewater Rx", "90016", "BLW")]


def is_business_day(d):
    return d.weekday() < 5 and d not in HOLIDAYS


def next_business_day(d, n=1):
    while n > 0:
        d += dt.timedelta(days=1)
        if is_business_day(d):
            n -= 1
    return d


def build(store=STORE, start=START, end=END, lt_scale_g=1.0, lt_scale_b=1.0):
    rng = np.random.default_rng(store["seed"])
    primary, sec_a, sec_b = store["primary"], store["secondaries"][0], store["secondaries"][1]

    # ---------------- product master ----------------
    classes, products = {}, []
    prod_counter = defaultdict(lambda: 100)

    def add_ndc(cls, mfr, labeler, abbrev, pkg, pkg_code, source):
        prod_code = prod_counter[(labeler, cls["key"])] if (labeler, cls["key"]) in prod_counter else None
        if prod_code is None:
            prod_counter["__next__" + labeler] = prod_counter["__next__" + labeler] + 1
            prod_code = prod_counter["__next__" + labeler]
            prod_counter[(labeler, cls["key"])] = prod_code
        ndc = f"{labeler}-{prod_code:04d}-{pkg_code}"
        desc_name = cls["brand_name"].upper() if cls["bg"] == "B" else cls["generic"].upper()
        products.append(dict(
            ndc11=ndc, ndc11_digits=ndc.replace("-", ""), ndc_is_synthetic="Y",
            product_description=" ".join(p for p in [desc_name, cls['strength'].upper(), cls['form'].upper(),
                                                     f"{pkg} {cls['unit']}", f"- {abbrev}"] if p),
            equivalence_class_id=cls["key"], generic_name=cls["generic"], brand_name=cls.get("brand_name") or "",
            strength=cls["strength"], dosage_form=cls["form"], brand_generic=cls["bg"],
            therapeutic_category=cls["category"], manufacturer=mfr, labeler_code=labeler,
            package_size=pkg, package_unit=cls["unit"], primary_source_program="Y" if source else "N"))
        return ndc

    for row in C:
        (key, gen, strg, form, unit, cat, bg, usm, ss, bench, f30, course, ps, pl, nm, sec_ok) = row
        cls = dict(key=key, generic=gen, strength=strg, form=form, unit=unit, category=cat, bg=bg,
                   us_fills_m=usm, strength_share=ss, bench0=bench, fill30=f30, course=course,
                   pkg_small=ps, pkg_large=pl, sec_ok=sec_ok, glp1=False, brand_name=None)
        mfr_idx = rng.choice(len(GEN_MFRS), size=nm, replace=False)
        cls["ndcs"] = {}  # (mfr_rank, 'S'/'L') -> ndc
        for rank, mi in enumerate(mfr_idx):
            mfr, lab, ab = GEN_MFRS[mi]
            cls["ndcs"][(rank, "S")] = add_ndc(cls, mfr, lab, ab, ps, "01", rank == 0)
            if pl:
                cls["ndcs"][(rank, "L")] = add_ndc(cls, mfr, lab, ab, pl, "05", rank == 0)
        cls["n_mfr"] = nm
        cls["wac26"] = 1.0
        classes[key] = cls

    for i, row in enumerate(B):
        (key, gen, strg, form, unit, cat, bg, usm, ss, wac, f30, course, ps, pl, bname, bmfr) = row
        cls = dict(key=key, generic=gen, strength=strg, form=form, unit=unit, category=cat, bg=bg,
                   us_fills_m=usm, strength_share=ss, bench0=wac, fill30=f30, course=course,
                   pkg_small=ps, pkg_large=pl, sec_ok=False, glp1="GLP-1" in cat, brand_name=bname)
        lab = f"{90090 + i}"
        cls["ndcs"] = {(0, "S"): add_ndc(cls, bmfr, lab, bname[:3].upper(), ps, "01", True)}
        if pl:
            cls["ndcs"][(0, "L")] = add_ndc(cls, bmfr, lab, bname[:3].upper(), pl, "05", True)
        cls["n_mfr"] = 1
        cls["wac26"] = WAC_2026_FACTOR.get(key, 1.0)
        classes[key] = cls

    # ---------------- long tail (synthetic placeholder items) ----------------
    # Fills left over after the named basket are spread across many low-volume items so that
    # total prescriptions and total purchase dollars match an NCPA-average store.
    basket_g = sum(store["annual_rx"] * r[7] / US_TOTAL_RX_MILLIONS * r[8] for r in C)
    basket_b = sum(store["annual_rx"] * r[7] / US_TOTAL_RX_MILLIONS * r[8] for r in B)
    lt_fills_g = store["annual_rx"] * GENERIC_FILL_SHARE - basket_g
    lt_fills_b = store["annual_rx"] * (1 - GENERIC_FILL_SHARE) - basket_b

    def alloc(n, total, sigma, cap):
        f = rng.lognormal(0, sigma, n)
        f = f / f.sum() * total
        for _ in range(30):
            over = f > cap
            if not over.any():
                break
            excess = (f[over] - cap).sum()
            f[over] = cap
            f[~over] += excess * f[~over] / f[~over].sum()
        return f

    def lt_costs(n, mean, sigma, cap):
        x = rng.lognormal(0, sigma, n)
        x = np.minimum(x / x.mean() * mean, cap)
        return x

    g_fills = alloc(LT_N_GENERIC, lt_fills_g, 1.2, 300)
    g_cost = lt_costs(LT_N_GENERIC, 14.0, 1.0, 400.0) * lt_scale_g   # $ per 30-unit fill
    g_cats = rng.choice(list(LT_GEN_CATS), size=LT_N_GENERIC, p=list(LT_GEN_CATS.values()))
    for i in range(LT_N_GENERIC):
        key = f"LTG{i + 1:04d}"
        ps = int(rng.choice([30, 90, 100], p=[.2, .4, .4]))
        pl = 500 if g_fills[i] >= 120 else None
        nm = int(rng.choice([2, 3], p=[.6, .4]))
        cls = dict(key=key, generic=f"Long-tail generic #{i + 1:04d} (synthetic)", strength="", form="Tablet",
                   unit="TAB", category=str(g_cats[i]), bg="G", us_fills_m=None, strength_share=1.0,
                   bench0=float(g_cost[i] / 30), fill30=30, course=None, pkg_small=ps, pkg_large=pl,
                   sec_ok=bool(rng.random() < LT_GENERIC_SECONDARY_SHARE), glp1=False, brand_name=None,
                   lt=True, lt_fills=float(g_fills[i]))
        mfr_idx = rng.choice(len(GEN_MFRS), size=nm, replace=False)
        cls["ndcs"] = {}
        for rank, mi in enumerate(mfr_idx):
            mfr, lab, ab = GEN_MFRS[mi]
            cls["ndcs"][(rank, "S")] = add_ndc(cls, mfr, lab, ab, ps, "01", rank == 0)
            if pl:
                cls["ndcs"][(rank, "L")] = add_ndc(cls, mfr, lab, ab, pl, "05", rank == 0)
        cls["n_mfr"] = nm
        classes[key] = cls

    b_fills = alloc(LT_N_BRAND, lt_fills_b, 1.2, 250)
    b_cost = lt_costs(LT_N_BRAND, 260.0, 1.1, 6000.0) * lt_scale_b
    b_cats = rng.choice(list(LT_BRAND_CATS), size=LT_N_BRAND, p=list(LT_BRAND_CATS.values()))
    for i in range(LT_N_BRAND):
        key = f"LTB{i + 1:04d}"
        ps = int(rng.choice([30, 90], p=[.75, .25]))
        cls = dict(key=key, generic=f"Long-tail brand #{i + 1:04d} active ingredient (synthetic)", strength="",
                   form="Tablet", unit="TAB", category=str(b_cats[i]), bg="B", us_fills_m=None, strength_share=1.0,
                   bench0=float(b_cost[i] / 30), fill30=30, course=None, pkg_small=ps, pkg_large=None,
                   sec_ok=False, glp1=False, brand_name=f"LT Brand #{i + 1:04d}", lt=True, lt_fills=float(b_fills[i]),
                   wac26=(1 + LT_BRAND_WAC_INCREASE) if rng.random() < 0.5 else 1.0)
        lab = f"{90200 + i}"
        cls["ndcs"] = {(0, "S"): add_ndc(cls, f"Brand Manufacturer {i + 1:04d} (fictional)", lab, "BRD", ps, "01", True)}
        cls["n_mfr"] = 1
        classes[key] = cls

    pm = pd.DataFrame(products)
    pkg_of = dict(zip(pm.ndc11, pm.package_size))

    # ---------------- demand parameters ----------------
    for c in classes.values():
        if c.get("lt"):
            c["annual_fills"] = c["lt_fills"]
        else:
            c["annual_fills"] = store["annual_rx"] * c["us_fills_m"] / US_TOTAL_RX_MILLIONS * c["strength_share"]
        if c["fill30"] is None:
            mean_units = c["course"]
        else:
            s90 = SHARE_90_DAY_GLP1 if c["glp1"] else SHARE_90_DAY
            mean_units = c["fill30"] * ((1 - s90) + 3 * s90)
            c["s90"] = s90
        c["mean_units_per_fill"] = mean_units
        c["avg_daily_units"] = c["annual_fills"] * mean_units / 365
        if c["bg"] == "B":
            rp, up = BRAND_REORDER_DAYS, BRAND_ORDER_UP_TO_DAYS
        else:
            rp, up = GEN_REORDER_DAYS, GEN_ORDER_UP_TO_DAYS
        c["s"] = c["avg_daily_units"] * rp
        c["S"] = max(c["avg_daily_units"] * up, c["pkg_small"])
        # store-specific primary price multiplier (source NDC) and secondary multipliers
        c["m_primary"] = float(store["price_multiplier_center"] *
                               math.exp(rng.normal(-0.5 * store["price_multiplier_sd"] ** 2,
                                                   store["price_multiplier_sd"])))
        c["m_secondary"] = {sec_a: float(rng.uniform(0.78, 0.95)), sec_b: float(rng.uniform(0.78, 0.95))}
        c["sec_carrier"] = [sec_a, sec_b] if c["sec_ok"] else []

    # ---------------- benchmark price paths (weekly) ----------------
    n_days = (end - start).days + 1
    dates = [start + dt.timedelta(days=i) for i in range(n_days)]
    week_of = {d: (d - start).days // 7 for d in dates}
    n_weeks = max(week_of.values()) + 1
    bench = {}
    for k, c in classes.items():
        if c["bg"] == "G":
            steps = rng.normal(GENERIC_WEEKLY_DRIFT_MEAN, GENERIC_WEEKLY_DRIFT_SD, n_weeks)
            path = c["bench0"] * np.exp(np.cumsum(steps))
        else:
            path = np.full(n_weeks, c["bench0"] * (1 - BRAND_BENCHMARK_DISCOUNT))
        bench[k] = path
    for ev in SHORTAGES:
        k = ev["cls"]
        w0, w1 = (ev["start"] - start).days // 7, (ev["end"] - start).days // 7
        for w in range(n_weeks):
            if w0 <= w <= w1:
                ramp = min(1.0, (w - w0 + 1) / 4)
            elif w1 < w <= w1 + 6:
                ramp = max(0.0, 1 - (w - w1) / 6)
            else:
                ramp = 0.0
            bench[k][w] *= 1 + (SHORTAGE_BENCHMARK_PEAK - 1) * ramp

    JAN1 = dt.date(2026, 1, 1)

    def brand_factor(c, d):
        return c["wac26"] if (c["bg"] == "B" and d >= JAN1) else 1.0

    def bench_unit(k, d):
        w = min(max((d - start).days // 7, 0), n_weeks - 1)
        return float(bench[k][w]) * brand_factor(classes[k], d)

    def primary_pkg_price(c, d, size_flag, source=True):
        pkg = c["pkg_small"] if size_flag == "S" else c["pkg_large"]
        if c["bg"] == "B":
            wac = c["bench0"] * brand_factor(c, d)
            return round(wac * (1 - BRAND_INVOICE_DISCOUNT) * pkg, 2)
        unit = bench_unit(c["key"], d) * c["m_primary"]
        if size_flag == "L":
            unit *= LARGE_PKG_PRICE_FACTOR
        if not source:
            unit *= NON_SOURCE_PRIMARY_FACTOR
        return round(unit * pkg, 2)

    def secondary_pkg_price(c, d, supplier, size_flag, premium=1.0):
        pkg = c["pkg_small"] if size_flag == "S" else c["pkg_large"]
        m = c["m_secondary"].get(supplier, 0.9)
        if size_flag == "L":
            m *= LARGE_PKG_PRICE_FACTOR
        return round(bench_unit(c["key"], d) * m * premium * pkg, 2)

    def choose_pkg(c, units):
        if c["pkg_large"] and units >= LARGE_PKG_THRESHOLD * c["pkg_large"]:
            return "L", max(1, math.ceil(units / c["pkg_large"]))
        return "S", max(1, math.ceil(units / c["pkg_small"]))

    def active_shortage(k, d):
        for ev in SHORTAGES:
            if ev["cls"] == k and ev["start"] <= d <= ev["end"]:
                return ev["event_id"]
        return ""

    # ---------------- simulation ----------------
    lines = []
    state = {k: dict(on_hand=float(rng.uniform(c["s"], c["S"])), pipeline=[]) for k, c in classes.items()}
    disp = defaultdict(lambda: dict(units=0.0, fills=0))
    month_end_onhand = {}
    inv_value_daily = []
    mtd = defaultdict(lambda: dict(prim_g=0.0, sec_g=0.0))
    first_tuesday = next(d for d in dates if d.weekday() == 1)
    expected_monthly_generic = sum(c["avg_daily_units"] * c["bench0"] * c["m_primary"] * 30.4
                                   for c in classes.values() if c["bg"] == "G")

    today = [start]

    def add_line(inv_date, supplier, stype, c, ndc, size_flag, qty_ord, qty_ship, pkg_price,
                 sub="N", ordered_ndc="", backorder="N", event=""):
        lines.append(dict(
            store_id=store["store_id"], order_date=today[0], invoice_date=inv_date, supplier=supplier,
            supplier_type=stype, transaction_type="INVOICE",
            ndc11=ndc, equivalence_class_id=c["key"], qty_ordered=qty_ord, qty_shipped=qty_ship,
            unit_cost_per_package=pkg_price, nadac_per_unit=round(bench_unit(c["key"], inv_date), 4),
            substitution_flag=sub, ordered_ndc=ordered_ndc, backorder_flag=backorder, shortage_event_id=event))
        cost = qty_ship * pkg_price
        mkey = inv_date.strftime("%Y-%m")
        if c["bg"] == "G":
            if stype == "Primary":
                mtd[mkey]["prim_g"] += cost
            else:
                mtd[mkey]["sec_g"] += cost

    def place_primary_order(c, units, d):
        size_flag, n = choose_pkg(c, units)
        src_ndc = c["ndcs"][(0, size_flag)]
        deliver = next_business_day(d)
        ev = active_shortage(c["key"], d)
        pkg = c["pkg_small"] if size_flag == "S" else c["pkg_large"]
        if ev and c["n_mfr"] > 1:
            # shortage: source NDC unavailable; supply is allocated (max SHORTAGE_ALLOCATION small packs per order)
            n_small = max(1, math.ceil(units / c["pkg_small"]))
            src_small = c["ndcs"][(0, "S")]
            alt = c["ndcs"][(1, "S")]
            if rng.random() < SHORTAGE_SUB_PROB:
                ship = min(n_small, SHORTAGE_ALLOCATION)
                price = round(primary_pkg_price(c, deliver, "S") * SHORTAGE_SUB_PRICE_FACTOR, 2)
                add_line(deliver, primary, "Primary", c, alt, "S", n_small, ship, price,
                         sub="Y", ordered_ndc=src_small, backorder="Y" if ship < n_small else "N", event=ev)
                state[c["key"]]["pipeline"].append((deliver, ship * c["pkg_small"]))
            else:
                add_line(deliver, primary, "Primary", c, src_small, "S", n_small, 0,
                         primary_pkg_price(c, deliver, "S"), backorder="Y", event=ev)
                sup = store["secondaries"][int(rng.integers(0, 2))]
                ship = min(n_small, SHORTAGE_ALLOCATION)
                sdeliver = next_business_day(d, 2)
                add_line(sdeliver, sup, "Secondary", c, alt, "S", ship, ship,
                         secondary_pkg_price(c, sdeliver, sup, "S", premium=SHORTAGE_SECONDARY_PREMIUM), event=ev)
                state[c["key"]]["pipeline"].append((sdeliver, ship * c["pkg_small"]))
            return
        add_line(deliver, primary, "Primary", c, src_ndc, size_flag, n, n, primary_pkg_price(c, deliver, size_flag))
        state[c["key"]]["pipeline"].append((deliver, n * pkg))

    for d in dates:
        today[0] = d
        # receive
        for k, st in state.items():
            arrived = sum(u for (ad, u) in st["pipeline"] if ad <= d)
            if arrived:
                st["on_hand"] += arrived
                st["pipeline"] = [(ad, u) for (ad, u) in st["pipeline"] if ad > d]
        # dispense
        mkey = d.strftime("%Y-%m")
        for k, c in classes.items():
            lam = c["annual_fills"] / 365 * DOW_FACTOR[d.weekday()]
            if k in SEASONAL:
                lam *= SEASONAL[k][d.month - 1]
            nf = rng.poisson(lam)
            if nf == 0:
                continue
            if c["fill30"] is None:
                units = nf * c["course"]
            else:
                n90 = rng.binomial(nf, c["s90"])
                units = (nf - n90) * c["fill30"] + n90 * 3 * c["fill30"]
            state[k]["on_hand"] -= units
            disp[(mkey, k)]["units"] += units
            disp[(mkey, k)]["fills"] += nf
        # forward buys from secondary (every other Tuesday)
        if is_business_day(d) and d.weekday() == 1 and ((d - first_tuesday).days // 7) % FWD_BUY_EVERY_N_WEEKS == 0:
            cands = []
            for k, c in classes.items():
                if not c["sec_carrier"] or active_shortage(k, d):
                    continue
                units = c["avg_daily_units"] * FWD_BUY_DAYS_SUPPLY
                if units < 0.5 * c["pkg_small"]:
                    continue
                size_flag, n = choose_pkg(c, units)
                pkg = c["pkg_small"] if size_flag == "S" else c["pkg_large"]
                best_sup = min(c["sec_carrier"], key=lambda s_: c["m_secondary"][s_])
                p_sec = secondary_pkg_price(c, d, best_sup, size_flag) / pkg
                p_pri = primary_pkg_price(c, d, size_flag) / pkg
                sav = 1 - p_sec / p_pri
                if sav >= FWD_BUY_MIN_SAVINGS:
                    cands.append((sav, k, best_sup, size_flag, n, pkg))
            cands.sort(reverse=True)
            bought = 0
            for sav, k, sup, size_flag, n, pkg in cands:
                if mtd[mkey]["sec_g"] > FWD_BUY_MAX_SECONDARY_SHARE * expected_monthly_generic:
                    break
                if bought >= FWD_BUY_MAX_CLASSES:
                    break
                c = classes[k]
                rank = 1 if sup == sec_a else min(2, c["n_mfr"] - 1)
                ndc = c["ndcs"].get((rank, size_flag), c["ndcs"][(1, "S")])
                sdeliver = next_business_day(d, 2)
                add_line(sdeliver, sup, "Secondary", c, ndc, size_flag, n, n,
                         secondary_pkg_price(c, sdeliver, sup, size_flag))
                state[k]["pipeline"].append((sdeliver, n * pkg_of[ndc]))
                bought += 1
        # replenish from primary
        if is_business_day(d):
            for k, c in classes.items():
                st = state[k]
                position = st["on_hand"] + sum(u for (_, u) in st["pipeline"])
                if position <= c["s"]:
                    place_primary_order(c, c["S"] - position, d)
        # quarter-end overstock returns to the primary (generics only)
        if d in RETURN_DAYS:
            cands = []
            for k, c in classes.items():
                oh = state[k]["on_hand"]
                if c["bg"] == "G" and c["avg_daily_units"] > 0 and oh >= c["pkg_small"]:
                    dos = oh / c["avg_daily_units"]
                    if dos >= RETURN_MIN_DAYS_SUPPLY:
                        cands.append((dos, k))
            for dos, k in sorted(cands, reverse=True)[:RETURN_MAX_ITEMS]:
                c = classes[k]
                credit = -round(primary_pkg_price(c, d, "S") * RETURN_CREDIT_PCT, 2)
                add_line(d, primary, "Primary", c, c["ndcs"][(0, "S")], "S", 0, 1, credit)
                lines[-1].update(transaction_type="CREDIT", nadac_per_unit=0.0,
                                 credit_reason=f"Overstock return to wholesaler ({int(RETURN_CREDIT_PCT * 100)}% credit)")
                state[k]["on_hand"] -= c["pkg_small"]
        # inventory value (at primary source unit cost) and month-end snapshot
        val = 0.0
        for k, c in classes.items():
            if state[k]["on_hand"] > 0:
                val += state[k]["on_hand"] * primary_pkg_price(c, d, "S") / c["pkg_small"]
        inv_value_daily.append(val)
        nxt = d + dt.timedelta(days=1)
        if nxt.month != d.month:
            for k in classes:
                month_end_onhand[(mkey, k)] = state[k]["on_hand"]

    # ---------------- Eliquis shelf-stock credit (purchases Dec 22-31, 2025) ----------------
    w0, w1, credit_day = ELIQUIS_SHELF_STOCK
    for ln in list(lines):
        if ln["equivalence_class_id"] == "ELIQ5" and w0 <= ln["invoice_date"] <= w1 and ln["qty_shipped"] > 0:
            c = classes["ELIQ5"]
            pkg = pkg_of[ln["ndc11"]]
            new_price = round(c["bench0"] * c["wac26"] * (1 - BRAND_INVOICE_DISCOUNT) * pkg, 2)
            lines.append(dict(ln, order_date=ln["invoice_date"], invoice_date=credit_day, transaction_type="CREDIT",
                              qty_ordered=0, unit_cost_per_package=-round(ln["unit_cost_per_package"] - new_price, 2),
                              nadac_per_unit=0.0, substitution_flag="N", ordered_ndc="", backorder_flag="N",
                              shortage_event_id="", credit_reason="Manufacturer shelf-stock adjustment (WAC decrease 1/1/2026)"))

    # ---------------- assemble invoice lines ----------------
    il = pd.DataFrame(lines)
    if "credit_reason" not in il:
        il["credit_reason"] = ""
    il["credit_reason"] = il["credit_reason"].fillna("")
    il = il[il.invoice_date <= end].copy()
    il = il.merge(pm[["ndc11", "product_description", "generic_name", "brand_name", "strength", "dosage_form",
                      "brand_generic", "therapeutic_category", "manufacturer", "package_size", "package_unit",
                      "primary_source_program"]], on="ndc11", how="left")
    il["supplier_rank"] = il.supplier_type.map({"Primary": 0, "Secondary": 1})
    il["tx_rank"] = il.transaction_type.map({"INVOICE": 0, "CREDIT": 1})
    il = il.sort_values(["invoice_date", "supplier_rank", "supplier", "tx_rank", "equivalence_class_id"]).reset_index(drop=True)
    prefix = {primary: "ATL", sec_a: "CRS", sec_b: "SPD"}
    acct = {primary: "ATL-104882", sec_a: "CRS-55120", sec_b: "SPD-30917"}   # synthetic account numbers
    il["account_number"] = il.supplier.map(acct)
    il["invoice_id"] = il.apply(lambda r: f"{prefix[r.supplier]}-{'CM' if r.transaction_type == 'CREDIT' else 'IN'}-"
                                          f"{r.invoice_date:%Y%m%d}", axis=1)
    il["line_no"] = il.groupby("invoice_id").cumcount() + 1
    il["po_number"] = il.apply(lambda r: f"PO-{store['store_id'][-3:]}-{r.order_date:%y%m%d}-{prefix[r.supplier]}", axis=1)
    il["order_number"] = il.apply(lambda r: f"{prefix[r.supplier]}{zlib.crc32(f'{r.supplier}{r.order_date}'.encode()) % 10**8:08d}", axis=1)
    il["wholesaler_item_number"] = il.apply(lambda r: f"{zlib.crc32(f'{r.supplier}|{r.ndc11}'.encode()) % 9_000_000 + 1_000_000}", axis=1)
    il["month"] = il.invoice_date.apply(lambda d_: d_.strftime("%Y-%m"))
    il["extended_cost"] = (il.qty_shipped * il.unit_cost_per_package).round(2)
    il["nadac_extended"] = (il.qty_shipped * il.package_size * il.nadac_per_unit).round(2)
    il["variance_vs_nadac"] = (il.extended_cost - il.nadac_extended).round(2)
    il["item_tier"] = il.equivalence_class_id.map(lambda k: "Long tail (synthetic)" if classes[k].get("lt") else "Named basket")
    cols = ["store_id", "account_number", "invoice_id", "transaction_type", "invoice_date", "order_date", "month",
            "po_number", "order_number", "supplier", "supplier_type", "line_no", "wholesaler_item_number",
            "ndc11", "product_description", "generic_name", "brand_name", "strength", "dosage_form",
            "brand_generic", "equivalence_class_id", "item_tier", "therapeutic_category", "manufacturer",
            "package_size", "package_unit", "qty_ordered", "qty_shipped", "unit_cost_per_package",
            "extended_cost", "nadac_per_unit", "nadac_extended", "variance_vs_nadac",
            "primary_source_program", "substitution_flag", "ordered_ndc", "backorder_flag", "shortage_event_id",
            "credit_reason"]
    il = il[cols]

    # dispensing / inventory ground truth
    drows = []
    for (mkey, k), v in sorted(disp.items()):
        c = classes[k]
        oh = month_end_onhand.get((mkey, k), np.nan)
        drows.append(dict(month=mkey, equivalence_class_id=k,
                          drug=((c["brand_name"] or c["generic"]) + " " + c["strength"]).strip(),
                          brand_generic=c["bg"], fills=v["fills"], units_dispensed=round(v["units"]),
                          month_end_on_hand_units=round(oh),
                          month_end_days_of_supply=round(oh / c["avg_daily_units"], 1) if c["avg_daily_units"] else None))
    dsp = pd.DataFrame(drows)

    cls_rows = [dict(equivalence_class_id=k, generic_name=c["generic"], brand_name=c["brand_name"] or "",
                     strength=c["strength"], brand_generic=c["bg"], therapeutic_category=c["category"],
                     us_fills_millions_approx=c["us_fills_m"], strength_share=c["strength_share"],
                     store_annual_fills=round(c["annual_fills"], 1), avg_daily_units=round(c["avg_daily_units"], 2),
                     reorder_point_units=round(c["s"]), order_up_to_units=round(c["S"]),
                     benchmark_unit_price_start=c["bench0"] if c["bg"] == "G" else round(c["bench0"] * (1 - BRAND_BENCHMARK_DISCOUNT), 2),
                     store_primary_price_multiplier=round(c["m_primary"], 3) if c["bg"] == "G" else None,
                     secondary_eligible="Y" if c["sec_ok"] else "N")
                for k, c in classes.items()]
    cm = pd.DataFrame(cls_rows)

    lt = il.item_tier.str.startswith("Long")
    stats = dict(avg_inventory_value=float(np.mean(inv_value_daily)),
                 total_purchases=float(il.extended_cost.sum()),
                 basket_g=float(il[~lt & (il.brand_generic == "G")].extended_cost.sum()),
                 basket_b=float(il[~lt & (il.brand_generic == "B")].extended_cost.sum()),
                 lt_g=float(il[lt & (il.brand_generic == "G")].extended_cost.sum()),
                 lt_b=float(il[lt & (il.brand_generic == "B")].extended_cost.sum()),
                 lt_scale_g=lt_scale_g, lt_scale_b=lt_scale_b)
    stats["inventory_turns"] = stats["total_purchases"] / stats["avg_inventory_value"]
    return il, pm, cm, dsp, stats


def calibrated_build(store=STORE, tol=0.003, max_iter=6):
    """Rescale long-tail prices until total purchases ~= NCPA-average COGS and generic $ share ~= target."""
    target_total = TARGET_SALES * (1 - TARGET_GROSS_MARGIN)
    target_g = target_total * TARGET_GENERIC_DOLLAR_SHARE
    target_b = target_total - target_g
    sg = sb = 1.0
    for _ in range(max_iter):
        il, pm, cm, dsp, st = build(store, lt_scale_g=sg, lt_scale_b=sb)
        gen, brd = st["basket_g"] + st["lt_g"], st["basket_b"] + st["lt_b"]
        if abs(gen / target_g - 1) < tol and abs(brd / target_b - 1) < tol:
            break
        sg *= (target_g - st["basket_g"]) / st["lt_g"]
        sb *= (target_b - st["basket_b"]) / st["lt_b"]
    st["target_total"], st["target_g"], st["target_b"] = target_total, target_g, target_b
    return il, pm, cm, dsp, st


if __name__ == "__main__":
    import os
    os.makedirs("out", exist_ok=True)
    il, pm, cm, dsp, stats = calibrated_build()
    il.to_csv("out/invoice_lines.csv", index=False)
    pm.to_csv("out/product_master.csv", index=False)
    cm.to_csv("out/class_master.csv", index=False)
    dsp.to_csv("out/dispensing_monthly.csv", index=False)
    print(len(il), "invoice lines;", stats)
