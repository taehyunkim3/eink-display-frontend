import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_340px]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-600">
              ESP32 E-ink
            </p>
            <h1 className="mt-2 text-4xl font-bold">Weather + Calendar Dashboard</h1>
          </div>

          <Image
            src="/images/home-dog.png"
            alt="웃고 있는 반려견"
            width={1190}
            height={1212}
            priority
            className="aspect-square w-full border-2 border-neutral-900 object-cover"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/preview"
            className="border-2 border-neutral-900 bg-white p-5 text-lg font-semibold"
          >
            화면 미리보기
          </Link>
          <a
            href="/api/health"
            className="border-2 border-neutral-900 bg-white p-5 text-lg font-semibold"
          >
            Health API
          </a>
          <div className="border-2 border-neutral-900 bg-white p-5 text-lg font-semibold">
            Device API: /api/screen.png
          </div>
        </div>
      </section>
    </main>
  );
}
