// Types for the three "Live" government feeds, plus the list of tracked drugs.
// Each type is defined once as a zod schema so the same shape is used to
// check the cache files and to give TypeScript its types.
import { z } from "zod";

// ---------------------------------------------------------------------------
// Tracked drugs
// ---------------------------------------------------------------------------

export type TrackedDrug = {
  drugKey: string; // stable key shared by all three cache files
  name: string;
  strength: string;
  form: string;
  category: string;
  // How to find this drug in each feed:
  nadacDescription: string; // exact "NDC Description" in the NADAC file
  obIngredient: string; // Orange Book "Ingredient"
  obStrength: string; // Orange Book "Strength" (annotations after "**" removed)
  obForm: string; // Orange Book "DF;Route"
  shortageWord: string; // lowercase word to look for in openFDA shortage names
};

export const TRACKED_DRUGS: TrackedDrug[] = [
  {
    drugKey: "atorvastatin-20mg-tablet",
    name: "Atorvastatin", strength: "20 mg", form: "tablet", category: "Cardio",
    nadacDescription: "ATORVASTATIN 20 MG TABLET",
    obIngredient: "ATORVASTATIN CALCIUM", obStrength: "EQ 20MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "atorvastatin",
  },
  {
    drugKey: "lisinopril-10mg-tablet",
    name: "Lisinopril", strength: "10 mg", form: "tablet", category: "Cardio",
    nadacDescription: "LISINOPRIL 10 MG TABLET",
    obIngredient: "LISINOPRIL", obStrength: "10MG", obForm: "TABLET;ORAL",
    shortageWord: "lisinopril",
  },
  {
    drugKey: "amlodipine-5mg-tablet",
    name: "Amlodipine", strength: "5 mg", form: "tablet", category: "Cardio",
    nadacDescription: "AMLODIPINE BESYLATE 5 MG TAB",
    obIngredient: "AMLODIPINE BESYLATE", obStrength: "EQ 5MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "amlodipine",
  },
  {
    drugKey: "metformin-500mg-tablet",
    name: "Metformin", strength: "500 mg", form: "tablet", category: "Diabetes",
    nadacDescription: "METFORMIN HCL 500 MG TABLET",
    obIngredient: "METFORMIN HYDROCHLORIDE", obStrength: "500MG", obForm: "TABLET;ORAL",
    shortageWord: "metformin",
  },
  {
    drugKey: "sertraline-50mg-tablet",
    name: "Sertraline", strength: "50 mg", form: "tablet", category: "Mental health",
    nadacDescription: "SERTRALINE HCL 50 MG TABLET",
    obIngredient: "SERTRALINE HYDROCHLORIDE", obStrength: "EQ 50MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "sertraline",
  },
  {
    drugKey: "amoxicillin-500mg-capsule",
    name: "Amoxicillin", strength: "500 mg", form: "capsule", category: "Antibiotics",
    nadacDescription: "AMOXICILLIN 500 MG CAPSULE",
    obIngredient: "AMOXICILLIN", obStrength: "500MG", obForm: "CAPSULE;ORAL",
    shortageWord: "amoxicillin",
  },
  {
    drugKey: "albuterol-90mcg-inhalation-aerosol",
    name: "Albuterol", strength: "90 mcg", form: "inhalation aerosol HFA", category: "Respiratory",
    nadacDescription: "ALBUTEROL HFA 90 MCG INHALER",
    obIngredient: "ALBUTEROL SULFATE", obStrength: "EQ 0.09MG BASE/INH", obForm: "AEROSOL, METERED;INHALATION",
    shortageWord: "albuterol",
  },
  {
    drugKey: "omeprazole-20mg-dr-capsule",
    name: "Omeprazole", strength: "20 mg", form: "delayed-release capsule", category: "GI",
    nadacDescription: "OMEPRAZOLE DR 20 MG CAPSULE",
    obIngredient: "OMEPRAZOLE", obStrength: "20MG", obForm: "CAPSULE, DELAYED REL PELLETS;ORAL",
    shortageWord: "omeprazole",
  },
  {
    drugKey: "levothyroxine-50mcg-tablet",
    name: "Levothyroxine", strength: "50 mcg", form: "tablet", category: "Thyroid",
    nadacDescription: "LEVOTHYROXINE 50 MCG TABLET",
    obIngredient: "LEVOTHYROXINE SODIUM", obStrength: "0.05MG", obForm: "TABLET;ORAL",
    shortageWord: "levothyroxine",
  },
  {
    drugKey: "gabapentin-300mg-capsule",
    name: "Gabapentin", strength: "300 mg", form: "capsule", category: "Pain",
    nadacDescription: "GABAPENTIN 300 MG CAPSULE",
    obIngredient: "GABAPENTIN", obStrength: "300MG", obForm: "CAPSULE;ORAL",
    shortageWord: "gabapentin",
  },
  {
    // Not one of the 10 core drugs. Included because supplier quotes mention it.
    drugKey: "glipizide-5mg-tablet",
    name: "Glipizide", strength: "5 mg", form: "tablet", category: "Diabetes",
    nadacDescription: "GLIPIZIDE 5 MG TABLET",
    obIngredient: "GLIPIZIDE", obStrength: "5MG", obForm: "TABLET;ORAL",
    shortageWord: "glipizide",
  },

  // ---- 10 extra common generics (not in the sample data) ----
  {
    drugKey: "losartan-50mg-tablet",
    name: "Losartan", strength: "50 mg", form: "tablet", category: "Cardio",
    nadacDescription: "LOSARTAN POTASSIUM 50 MG TAB",
    obIngredient: "LOSARTAN POTASSIUM", obStrength: "50MG", obForm: "TABLET;ORAL",
    shortageWord: "losartan",
  },
  {
    drugKey: "hydrochlorothiazide-25mg-tablet",
    name: "Hydrochlorothiazide", strength: "25 mg", form: "tablet", category: "Cardio",
    nadacDescription: "HYDROCHLOROTHIAZIDE 25 MG TAB",
    obIngredient: "HYDROCHLOROTHIAZIDE", obStrength: "25MG", obForm: "TABLET;ORAL",
    shortageWord: "hydrochlorothiazide",
  },
  {
    drugKey: "simvastatin-20mg-tablet",
    name: "Simvastatin", strength: "20 mg", form: "tablet", category: "Cardio",
    nadacDescription: "SIMVASTATIN 20 MG TABLET",
    obIngredient: "SIMVASTATIN", obStrength: "20MG", obForm: "TABLET;ORAL",
    shortageWord: "simvastatin",
  },
  {
    drugKey: "metoprolol-tartrate-25mg-tablet",
    name: "Metoprolol tartrate", strength: "25 mg", form: "tablet", category: "Cardio",
    nadacDescription: "METOPROLOL TARTRATE 25 MG TAB",
    obIngredient: "METOPROLOL TARTRATE", obStrength: "25MG", obForm: "TABLET;ORAL",
    shortageWord: "metoprolol",
  },
  {
    drugKey: "furosemide-40mg-tablet",
    name: "Furosemide", strength: "40 mg", form: "tablet", category: "Cardio",
    nadacDescription: "FUROSEMIDE 40 MG TABLET",
    obIngredient: "FUROSEMIDE", obStrength: "40MG", obForm: "TABLET;ORAL",
    shortageWord: "furosemide",
  },
  {
    drugKey: "montelukast-10mg-tablet",
    name: "Montelukast", strength: "10 mg", form: "tablet", category: "Respiratory",
    nadacDescription: "MONTELUKAST SOD 10 MG TABLET",
    obIngredient: "MONTELUKAST SODIUM", obStrength: "EQ 10MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "montelukast",
  },
  {
    drugKey: "escitalopram-10mg-tablet",
    name: "Escitalopram", strength: "10 mg", form: "tablet", category: "Mental health",
    nadacDescription: "ESCITALOPRAM 10 MG TABLET",
    obIngredient: "ESCITALOPRAM OXALATE", obStrength: "EQ 10MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "escitalopram",
  },
  {
    drugKey: "trazodone-50mg-tablet",
    name: "Trazodone", strength: "50 mg", form: "tablet", category: "Mental health",
    nadacDescription: "TRAZODONE 50 MG TABLET",
    obIngredient: "TRAZODONE HYDROCHLORIDE", obStrength: "50MG", obForm: "TABLET;ORAL",
    shortageWord: "trazodone",
  },
  {
    drugKey: "pantoprazole-40mg-dr-tablet",
    name: "Pantoprazole", strength: "40 mg", form: "delayed-release tablet", category: "GI",
    nadacDescription: "PANTOPRAZOLE SOD DR 40 MG TAB",
    obIngredient: "PANTOPRAZOLE SODIUM", obStrength: "EQ 40MG BASE", obForm: "TABLET, DELAYED RELEASE;ORAL",
    shortageWord: "pantoprazole",
  },
  {
    drugKey: "prednisone-10mg-tablet",
    name: "Prednisone", strength: "10 mg", form: "tablet", category: "Other",
    nadacDescription: "PREDNISONE 10 MG TABLET",
    obIngredient: "PREDNISONE", obStrength: "10MG", obForm: "TABLET;ORAL",
    shortageWord: "prednisone",
  },

  // ---- 52 more common generics (not in the sample data) ----
  {
    drugKey: "clopidogrel-75mg-tablet",
    name: "Clopidogrel", strength: "75 mg", form: "tablet", category: "Cardio",
    nadacDescription: "CLOPIDOGREL 75 MG TABLET",
    obIngredient: "CLOPIDOGREL BISULFATE", obStrength: "EQ 75MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "clopidogrel",
  },
  {
    drugKey: "carvedilol-12-5mg-tablet",
    name: "Carvedilol", strength: "12.5 mg", form: "tablet", category: "Cardio",
    nadacDescription: "CARVEDILOL 12.5 MG TABLET",
    obIngredient: "CARVEDILOL", obStrength: "12.5MG", obForm: "TABLET;ORAL",
    shortageWord: "carvedilol",
  },
  {
    drugKey: "pravastatin-40mg-tablet",
    name: "Pravastatin", strength: "40 mg", form: "tablet", category: "Cardio",
    nadacDescription: "PRAVASTATIN SODIUM 40 MG TAB",
    obIngredient: "PRAVASTATIN SODIUM", obStrength: "40MG", obForm: "TABLET;ORAL",
    shortageWord: "pravastatin",
  },
  {
    drugKey: "rosuvastatin-10mg-tablet",
    name: "Rosuvastatin", strength: "10 mg", form: "tablet", category: "Cardio",
    nadacDescription: "ROSUVASTATIN CALCIUM 10 MG TAB",
    obIngredient: "ROSUVASTATIN CALCIUM", obStrength: "EQ 10MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "rosuvastatin",
  },
  {
    drugKey: "warfarin-5mg-tablet",
    name: "Warfarin", strength: "5 mg", form: "tablet", category: "Cardio",
    nadacDescription: "WARFARIN SODIUM 5 MG TABLET",
    obIngredient: "WARFARIN SODIUM", obStrength: "5MG", obForm: "TABLET;ORAL",
    shortageWord: "warfarin",
  },
  {
    drugKey: "spironolactone-25mg-tablet",
    name: "Spironolactone", strength: "25 mg", form: "tablet", category: "Cardio",
    nadacDescription: "SPIRONOLACTONE 25 MG TABLET",
    obIngredient: "SPIRONOLACTONE", obStrength: "25MG", obForm: "TABLET;ORAL",
    shortageWord: "spironolactone",
  },
  {
    drugKey: "atenolol-50mg-tablet",
    name: "Atenolol", strength: "50 mg", form: "tablet", category: "Cardio",
    nadacDescription: "ATENOLOL 50 MG TABLET",
    obIngredient: "ATENOLOL", obStrength: "50MG", obForm: "TABLET;ORAL",
    shortageWord: "atenolol",
  },
  {
    drugKey: "clonidine-0-1mg-tablet",
    name: "Clonidine", strength: "0.1 mg", form: "tablet", category: "Cardio",
    nadacDescription: "CLONIDINE HCL 0.1 MG TABLET",
    obIngredient: "CLONIDINE HYDROCHLORIDE", obStrength: "0.1MG", obForm: "TABLET;ORAL",
    shortageWord: "clonidine",
  },
  {
    drugKey: "valsartan-80mg-tablet",
    name: "Valsartan", strength: "80 mg", form: "tablet", category: "Cardio",
    nadacDescription: "VALSARTAN 80 MG TABLET",
    obIngredient: "VALSARTAN", obStrength: "80MG", obForm: "TABLET;ORAL",
    shortageWord: "valsartan",
  },
  {
    drugKey: "benazepril-20mg-tablet",
    name: "Benazepril", strength: "20 mg", form: "tablet", category: "Cardio",
    nadacDescription: "BENAZEPRIL HCL 20 MG TABLET",
    obIngredient: "BENAZEPRIL HYDROCHLORIDE", obStrength: "20MG", obForm: "TABLET;ORAL",
    shortageWord: "benazepril",
  },
  {
    drugKey: "propranolol-20mg-tablet",
    name: "Propranolol", strength: "20 mg", form: "tablet", category: "Cardio",
    nadacDescription: "PROPRANOLOL 20 MG TABLET",
    obIngredient: "PROPRANOLOL HYDROCHLORIDE", obStrength: "20MG", obForm: "TABLET;ORAL",
    shortageWord: "propranolol",
  },
  {
    drugKey: "glimepiride-2mg-tablet",
    name: "Glimepiride", strength: "2 mg", form: "tablet", category: "Diabetes",
    nadacDescription: "GLIMEPIRIDE 2 MG TABLET",
    obIngredient: "GLIMEPIRIDE", obStrength: "2MG", obForm: "TABLET;ORAL",
    shortageWord: "glimepiride",
  },
  {
    drugKey: "pioglitazone-30mg-tablet",
    name: "Pioglitazone", strength: "30 mg", form: "tablet", category: "Diabetes",
    nadacDescription: "PIOGLITAZONE HCL 30 MG TABLET",
    obIngredient: "PIOGLITAZONE HYDROCHLORIDE", obStrength: "EQ 30MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "pioglitazone",
  },
  {
    drugKey: "citalopram-20mg-tablet",
    name: "Citalopram", strength: "20 mg", form: "tablet", category: "Mental health",
    nadacDescription: "CITALOPRAM HBR 20 MG TABLET",
    obIngredient: "CITALOPRAM HYDROBROMIDE", obStrength: "EQ 20MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "citalopram",
  },
  {
    drugKey: "fluoxetine-20mg-capsule",
    name: "Fluoxetine", strength: "20 mg", form: "capsule", category: "Mental health",
    nadacDescription: "FLUOXETINE HCL 20 MG CAPSULE",
    obIngredient: "FLUOXETINE HYDROCHLORIDE", obStrength: "EQ 20MG BASE", obForm: "CAPSULE;ORAL",
    shortageWord: "fluoxetine",
  },
  {
    drugKey: "buspirone-10mg-tablet",
    name: "Buspirone", strength: "10 mg", form: "tablet", category: "Mental health",
    nadacDescription: "BUSPIRONE HCL 10 MG TABLET",
    obIngredient: "BUSPIRONE HYDROCHLORIDE", obStrength: "10MG", obForm: "TABLET;ORAL",
    shortageWord: "buspirone",
  },
  {
    drugKey: "alprazolam-0-5mg-tablet",
    name: "Alprazolam", strength: "0.5 mg", form: "tablet", category: "Mental health",
    nadacDescription: "ALPRAZOLAM 0.5 MG TABLET",
    obIngredient: "ALPRAZOLAM", obStrength: "0.5MG", obForm: "TABLET;ORAL",
    shortageWord: "alprazolam",
  },
  {
    drugKey: "lorazepam-1mg-tablet",
    name: "Lorazepam", strength: "1 mg", form: "tablet", category: "Mental health",
    nadacDescription: "LORAZEPAM 1 MG TABLET",
    obIngredient: "LORAZEPAM", obStrength: "1MG", obForm: "TABLET;ORAL",
    shortageWord: "lorazepam",
  },
  {
    drugKey: "clonazepam-0-5mg-tablet",
    name: "Clonazepam", strength: "0.5 mg", form: "tablet", category: "Mental health",
    nadacDescription: "CLONAZEPAM 0.5 MG TABLET",
    obIngredient: "CLONAZEPAM", obStrength: "0.5MG", obForm: "TABLET;ORAL",
    shortageWord: "clonazepam",
  },
  {
    drugKey: "zolpidem-10mg-tablet",
    name: "Zolpidem", strength: "10 mg", form: "tablet", category: "Mental health",
    nadacDescription: "ZOLPIDEM TARTRATE 10 MG TABLET",
    obIngredient: "ZOLPIDEM TARTRATE", obStrength: "10MG", obForm: "TABLET;ORAL",
    shortageWord: "zolpidem",
  },
  {
    drugKey: "quetiapine-100mg-tablet",
    name: "Quetiapine", strength: "100 mg", form: "tablet", category: "Mental health",
    nadacDescription: "QUETIAPINE FUMARATE 100 MG TAB",
    obIngredient: "QUETIAPINE FUMARATE", obStrength: "EQ 100MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "quetiapine",
  },
  {
    drugKey: "aripiprazole-5mg-tablet",
    name: "Aripiprazole", strength: "5 mg", form: "tablet", category: "Mental health",
    nadacDescription: "ARIPIPRAZOLE 5 MG TABLET",
    obIngredient: "ARIPIPRAZOLE", obStrength: "5MG", obForm: "TABLET;ORAL",
    shortageWord: "aripiprazole",
  },
  {
    drugKey: "amitriptyline-25mg-tablet",
    name: "Amitriptyline", strength: "25 mg", form: "tablet", category: "Mental health",
    nadacDescription: "AMITRIPTYLINE HCL 25 MG TAB",
    obIngredient: "AMITRIPTYLINE HYDROCHLORIDE", obStrength: "25MG", obForm: "TABLET;ORAL",
    shortageWord: "amitriptyline",
  },
  {
    drugKey: "lamotrigine-100mg-tablet",
    name: "Lamotrigine", strength: "100 mg", form: "tablet", category: "Pain",
    nadacDescription: "LAMOTRIGINE 100 MG TABLET",
    obIngredient: "LAMOTRIGINE", obStrength: "100MG", obForm: "TABLET;ORAL",
    shortageWord: "lamotrigine",
  },
  {
    drugKey: "topiramate-25mg-tablet",
    name: "Topiramate", strength: "25 mg", form: "tablet", category: "Pain",
    nadacDescription: "TOPIRAMATE 25 MG TABLET",
    obIngredient: "TOPIRAMATE", obStrength: "25MG", obForm: "TABLET;ORAL",
    shortageWord: "topiramate",
  },
  {
    drugKey: "levetiracetam-500mg-tablet",
    name: "Levetiracetam", strength: "500 mg", form: "tablet", category: "Pain",
    nadacDescription: "LEVETIRACETAM 500 MG TABLET",
    obIngredient: "LEVETIRACETAM", obStrength: "500MG", obForm: "TABLET;ORAL",
    shortageWord: "levetiracetam",
  },
  {
    drugKey: "cyclobenzaprine-10mg-tablet",
    name: "Cyclobenzaprine", strength: "10 mg", form: "tablet", category: "Pain",
    nadacDescription: "CYCLOBENZAPRINE 10 MG TABLET",
    obIngredient: "CYCLOBENZAPRINE HYDROCHLORIDE", obStrength: "10MG", obForm: "TABLET;ORAL",
    shortageWord: "cyclobenzaprine",
  },
  {
    drugKey: "tramadol-50mg-tablet",
    name: "Tramadol", strength: "50 mg", form: "tablet", category: "Pain",
    nadacDescription: "TRAMADOL HCL 50 MG TABLET",
    obIngredient: "TRAMADOL HYDROCHLORIDE", obStrength: "50MG", obForm: "TABLET;ORAL",
    shortageWord: "tramadol",
  },
  {
    drugKey: "meloxicam-15mg-tablet",
    name: "Meloxicam", strength: "15 mg", form: "tablet", category: "Pain",
    nadacDescription: "MELOXICAM 15 MG TABLET",
    obIngredient: "MELOXICAM", obStrength: "15MG", obForm: "TABLET;ORAL",
    shortageWord: "meloxicam",
  },
  {
    drugKey: "ibuprofen-800mg-tablet",
    name: "Ibuprofen", strength: "800 mg", form: "tablet", category: "Pain",
    nadacDescription: "IBUPROFEN 800 MG TABLET",
    obIngredient: "IBUPROFEN", obStrength: "800MG", obForm: "TABLET;ORAL",
    shortageWord: "ibuprofen",
  },
  {
    drugKey: "naproxen-500mg-tablet",
    name: "Naproxen", strength: "500 mg", form: "tablet", category: "Pain",
    nadacDescription: "NAPROXEN 500 MG TABLET",
    obIngredient: "NAPROXEN", obStrength: "500MG", obForm: "TABLET;ORAL",
    shortageWord: "naproxen",
  },
  {
    drugKey: "methocarbamol-500mg-tablet",
    name: "Methocarbamol", strength: "500 mg", form: "tablet", category: "Pain",
    nadacDescription: "METHOCARBAMOL 500 MG TABLET",
    obIngredient: "METHOCARBAMOL", obStrength: "500MG", obForm: "TABLET;ORAL",
    shortageWord: "methocarbamol",
  },
  {
    drugKey: "baclofen-10mg-tablet",
    name: "Baclofen", strength: "10 mg", form: "tablet", category: "Pain",
    nadacDescription: "BACLOFEN 10 MG TABLET",
    obIngredient: "BACLOFEN", obStrength: "10MG", obForm: "TABLET;ORAL",
    shortageWord: "baclofen",
  },
  {
    drugKey: "tizanidine-4mg-tablet",
    name: "Tizanidine", strength: "4 mg", form: "tablet", category: "Pain",
    nadacDescription: "TIZANIDINE HCL 4 MG TABLET",
    obIngredient: "TIZANIDINE HYDROCHLORIDE", obStrength: "EQ 4MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "tizanidine",
  },
  {
    drugKey: "ondansetron-4mg-tablet",
    name: "Ondansetron", strength: "4 mg", form: "tablet", category: "GI",
    nadacDescription: "ONDANSETRON HCL 4 MG TABLET",
    obIngredient: "ONDANSETRON HYDROCHLORIDE", obStrength: "EQ 4MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "ondansetron",
  },
  {
    drugKey: "famotidine-20mg-tablet",
    name: "Famotidine", strength: "20 mg", form: "tablet", category: "GI",
    nadacDescription: "FAMOTIDINE 20 MG TABLET",
    obIngredient: "FAMOTIDINE", obStrength: "20MG", obForm: "TABLET;ORAL",
    shortageWord: "famotidine",
  },
  {
    drugKey: "azithromycin-250mg-tablet",
    name: "Azithromycin", strength: "250 mg", form: "tablet", category: "Antibiotics",
    nadacDescription: "AZITHROMYCIN 250 MG TABLET",
    obIngredient: "AZITHROMYCIN", obStrength: "EQ 250MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "azithromycin",
  },
  {
    drugKey: "ciprofloxacin-500mg-tablet",
    name: "Ciprofloxacin", strength: "500 mg", form: "tablet", category: "Antibiotics",
    nadacDescription: "CIPROFLOXACIN HCL 500 MG TAB",
    obIngredient: "CIPROFLOXACIN HYDROCHLORIDE", obStrength: "EQ 500MG BASE", obForm: "TABLET;ORAL",
    shortageWord: "ciprofloxacin",
  },
  {
    drugKey: "cephalexin-500mg-capsule",
    name: "Cephalexin", strength: "500 mg", form: "capsule", category: "Antibiotics",
    nadacDescription: "CEPHALEXIN 500 MG CAPSULE",
    obIngredient: "CEPHALEXIN", obStrength: "EQ 500MG BASE", obForm: "CAPSULE;ORAL",
    shortageWord: "cephalexin",
  },
  {
    drugKey: "doxycycline-hyclate-100mg-capsule",
    name: "Doxycycline hyclate", strength: "100 mg", form: "capsule", category: "Antibiotics",
    nadacDescription: "DOXYCYCLINE HYCLATE 100 MG CAP",
    obIngredient: "DOXYCYCLINE HYCLATE", obStrength: "EQ 100MG BASE", obForm: "CAPSULE;ORAL",
    shortageWord: "doxycycline",
  },
  {
    drugKey: "levofloxacin-500mg-tablet",
    name: "Levofloxacin", strength: "500 mg", form: "tablet", category: "Antibiotics",
    nadacDescription: "LEVOFLOXACIN 500 MG TABLET",
    obIngredient: "LEVOFLOXACIN", obStrength: "500MG", obForm: "TABLET;ORAL",
    shortageWord: "levofloxacin",
  },
  {
    drugKey: "fluconazole-150mg-tablet",
    name: "Fluconazole", strength: "150 mg", form: "tablet", category: "Antibiotics",
    nadacDescription: "FLUCONAZOLE 150 MG TABLET",
    obIngredient: "FLUCONAZOLE", obStrength: "150MG", obForm: "TABLET;ORAL",
    shortageWord: "fluconazole",
  },
  {
    drugKey: "acyclovir-400mg-tablet",
    name: "Acyclovir", strength: "400 mg", form: "tablet", category: "Antibiotics",
    nadacDescription: "ACYCLOVIR 400 MG TABLET",
    obIngredient: "ACYCLOVIR", obStrength: "400MG", obForm: "TABLET;ORAL",
    shortageWord: "acyclovir",
  },
  {
    drugKey: "allopurinol-100mg-tablet",
    name: "Allopurinol", strength: "100 mg", form: "tablet", category: "Other",
    nadacDescription: "ALLOPURINOL 100 MG TABLET",
    obIngredient: "ALLOPURINOL", obStrength: "100MG", obForm: "TABLET;ORAL",
    shortageWord: "allopurinol",
  },
  {
    drugKey: "tamsulosin-0-4mg-capsule",
    name: "Tamsulosin", strength: "0.4 mg", form: "capsule", category: "Other",
    nadacDescription: "TAMSULOSIN HCL 0.4 MG CAPSULE",
    obIngredient: "TAMSULOSIN HYDROCHLORIDE", obStrength: "0.4MG", obForm: "CAPSULE;ORAL",
    shortageWord: "tamsulosin",
  },
  {
    drugKey: "finasteride-5mg-tablet",
    name: "Finasteride", strength: "5 mg", form: "tablet", category: "Other",
    nadacDescription: "FINASTERIDE 5 MG TABLET",
    obIngredient: "FINASTERIDE", obStrength: "5MG", obForm: "TABLET;ORAL",
    shortageWord: "finasteride",
  },
  {
    drugKey: "dexamethasone-4mg-tablet",
    name: "Dexamethasone", strength: "4 mg", form: "tablet", category: "Other",
    nadacDescription: "DEXAMETHASONE 4 MG TABLET",
    obIngredient: "DEXAMETHASONE", obStrength: "4MG", obForm: "TABLET;ORAL",
    shortageWord: "dexamethasone",
  },
  {
    drugKey: "hydroxyzine-25mg-tablet",
    name: "Hydroxyzine", strength: "25 mg", form: "tablet", category: "Other",
    nadacDescription: "HYDROXYZINE HCL 25 MG TABLET",
    obIngredient: "HYDROXYZINE HYDROCHLORIDE", obStrength: "25MG", obForm: "TABLET;ORAL",
    shortageWord: "hydroxyzine",
  },
  {
    drugKey: "oxybutynin-5mg-tablet",
    name: "Oxybutynin", strength: "5 mg", form: "tablet", category: "Other",
    nadacDescription: "OXYBUTYNIN 5 MG TABLET",
    obIngredient: "OXYBUTYNIN CHLORIDE", obStrength: "5MG", obForm: "TABLET;ORAL",
    shortageWord: "oxybutynin",
  },
  {
    drugKey: "meclizine-25mg-tablet",
    name: "Meclizine", strength: "25 mg", form: "tablet", category: "Other",
    nadacDescription: "MECLIZINE 25 MG TABLET",
    obIngredient: "MECLIZINE HYDROCHLORIDE", obStrength: "25MG", obForm: "TABLET;ORAL",
    shortageWord: "meclizine",
  },
  {
    drugKey: "promethazine-25mg-tablet",
    name: "Promethazine", strength: "25 mg", form: "tablet", category: "Other",
    nadacDescription: "PROMETHAZINE 25 MG TABLET",
    obIngredient: "PROMETHAZINE HYDROCHLORIDE", obStrength: "25MG", obForm: "TABLET;ORAL",
    shortageWord: "promethazine",
  },
  {
    drugKey: "methylprednisolone-4mg-tablet",
    name: "Methylprednisolone", strength: "4 mg", form: "tablet", category: "Other",
    nadacDescription: "METHYLPREDNISOLONE 4 MG TABLET",
    obIngredient: "METHYLPREDNISOLONE", obStrength: "4MG", obForm: "TABLET;ORAL",
    shortageWord: "methylprednisolone",
  },
];

export const DRUG_KEYS = TRACKED_DRUGS.map((d) => d.drugKey);

// ---------------------------------------------------------------------------
// Shared header on every cache file
// ---------------------------------------------------------------------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const statusSchema = z.enum(["live", "cached"]);
const cadenceSchema = z.enum(["daily", "weekly", "monthly"]);

export const FeedStatusSchema = z.object({
  feed: z.string(),
  cadence: cadenceSchema,
  fetchedAt: z.string(),
  effectiveDate: isoDate,
  status: statusSchema,
});
export type FeedStatus = z.infer<typeof FeedStatusSchema>;

const header = {
  source: z.string(),
  cadence: cadenceSchema,
  fetchedAt: z.string(), // ISO timestamp of the last successful download
  effectiveDate: isoDate,
  status: statusSchema,
};

// ---------------------------------------------------------------------------
// NADAC
// ---------------------------------------------------------------------------

export const BenchmarkSchema = z.object({
  ndc: z.string().regex(/^\d{11}$/), // 11 digits, no dashes
  description: z.string(),
  nadac: z.number(), // dollars per pricing unit, not rounded
  pricingUnit: z.string(), // "EA" (each), "GM" (gram), "ML" ...
  classification: z.enum(["G", "B"]), // generic or brand
  effectiveDate: isoDate,
  drugKey: z.string(),
});
export type Benchmark = z.infer<typeof BenchmarkSchema>;

export const NadacByDrugSchema = z.object({
  nadac: z.number(),
  pricingUnit: z.string(),
  ndcCount: z.number(),
  method: z.string(),
});

export const NadacCacheSchema = z.object({
  feed: z.literal("nadac"),
  ...header,
  items: z.array(BenchmarkSchema),
  byDrug: z.record(z.string(), NadacByDrugSchema),
});
export type NadacCache = z.infer<typeof NadacCacheSchema>;

// ---------------------------------------------------------------------------
// Orange Book
// ---------------------------------------------------------------------------

export const OrangeBookProductSchema = z.object({
  drugKey: z.string(),
  ingredient: z.string(),
  strength: z.string(),
  dosageForm: z.string(),
  applicant: z.string(),
  applNo: z.string(),
  applType: z.string(), // "A" = generic (ANDA), "N" = brand (NDA)
  teCode: z.string(), // "AB", "AB1", ... or "" when none
});
export type OrangeBookProduct = z.infer<typeof OrangeBookProductSchema>;

export const EquivalentSchema = z.object({
  drugKey: z.string(),
  mfr: z.string(),
  teCode: z.string(),
  applNo: z.string(),
});
export type Equivalent = z.infer<typeof EquivalentSchema>;

export const OrangeBookCacheSchema = z.object({
  feed: z.literal("orangebook"),
  ...header,
  products: z.array(OrangeBookProductSchema),
  equivalents: z.array(EquivalentSchema),
});
export type OrangeBookCache = z.infer<typeof OrangeBookCacheSchema>;

// ---------------------------------------------------------------------------
// Drug shortages
// ---------------------------------------------------------------------------

export const ShortageSchema = z.object({
  drugKey: z.string(),
  ingredient: z.string(),
  status: z.enum(["current", "resolved"]),
  updated: isoDate,
  dosageForm: z.string(),
  company: z.string(),
});
export type Shortage = z.infer<typeof ShortageSchema>;

export const ShortagesCacheSchema = z.object({
  feed: z.literal("shortages"),
  ...header,
  items: z.array(ShortageSchema),
  history: z.record(z.string(), z.object({ currentCount: z.number(), last3yCount: z.number() })),
});
export type ShortagesCache = z.infer<typeof ShortagesCacheSchema>;

// ---------------------------------------------------------------------------
// Feed names
// ---------------------------------------------------------------------------

export const FEED_NAMES = ["nadac", "orangebook", "shortages"] as const;
export type FeedName = (typeof FEED_NAMES)[number];

export type FeedDataMap = {
  nadac: NadacCache;
  orangebook: OrangeBookCache;
  shortages: ShortagesCache;
};

export const FEED_SCHEMAS = {
  nadac: NadacCacheSchema,
  orangebook: OrangeBookCacheSchema,
  shortages: ShortagesCacheSchema,
};
