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
      {/* Temporary until the app shell (epic fondasi entry 8) moves Log out to the sidebar and avatar menu. */}
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
