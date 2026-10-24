import UploadClient, { type UploadCatalogDrug } from "@/components/upload/UploadClient";
import { getDrugViews } from "@/lib/data";
import { loadUploadDemo } from "@/lib/sample";

/** Base drug name: the sample name up to the first digit ("Atorvastatin 20 mg tab" -> "Atorvastatin"). */
function baseName(name: string): string {
  const cut = name.search(/\d/);
  return (cut === -1 ? name : name.slice(0, cut)).trim();
}

export default function UploadPage() {
  const catalog: UploadCatalogDrug[] = getDrugViews().map((d) => ({
    id: d.id,
    name: baseName(d.name),
    strength: d.strength,
    form: d.form,
  }));
  const demo = loadUploadDemo();

  return (
    <section className="mx-auto w-full max-w-[900px]">
      <h1 className="page-title">Upload data</h1>
      <p className="mt-2 text-muted">
        Upload your purchase history to see your own numbers. We map the columns and match each
        drug name for you, and you confirm anything we are not sure about.
      </p>
      <UploadClient catalog={catalog} demoHeaders={demo.headers} demoItems={demo.items} />
    </section>
  );
}
