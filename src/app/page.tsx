import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight">
        WORKING HARD <span className="text-primary">with EXCEL</span>
      </h1>
      <p className="text-muted-foreground">Under construction.</p>
      <Link href="/health" className="text-sm underline underline-offset-4">
        System status
      </Link>
    </main>
  );
}
