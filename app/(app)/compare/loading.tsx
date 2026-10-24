import { LoadingState } from "@/components/StateViews";

export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-[1280px]">
      <LoadingState label="Loading comparison" rows={5} />
    </section>
  );
}
