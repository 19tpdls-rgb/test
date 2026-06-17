export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-24 text-center text-foreground">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-medium uppercase text-muted-foreground">
          PICUP PICNIC
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Admin scaffold is ready.
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          Supabase, authentication, and operational workflows will be added in
          later implementation tasks.
        </p>
      </div>
    </main>
  );
}
