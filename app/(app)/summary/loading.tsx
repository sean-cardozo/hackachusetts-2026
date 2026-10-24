import { LoadingState } from "@/components/StateViews";

export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-[1280px]">
      <h1 className="page-title">Summary</h1>
      <div className="mt-6">
        <LoadingState label="Loading summary" rows={4} />
      </div>
    </section>
  );
}
