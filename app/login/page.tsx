import Image from "next/image";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border bg-card shadow-2xl shadow-sky-950/10 lg:grid-cols-[1fr_0.9fr]">
        <section className="relative hidden min-h-[620px] overflow-hidden bg-sky-950 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.32),transparent_24rem),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.24),transparent_24rem)]" />
          <div className="relative flex h-full flex-col justify-between p-10 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white p-2 shadow-xl">
                <Image src="/logo1-clean.png" alt="La Esquinita" width={64} height={64} className="h-full w-full object-contain" priority />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-sky-100/80">La Esquinita</p>
                <h1 className="text-2xl font-bold">Control financiero simple</h1>
              </div>
            </div>
            <div className="max-w-md">
              <p className="text-4xl font-bold leading-tight tracking-tight">Ventas, gastos y utilidad protegidos.</p>
              <p className="mt-4 text-base leading-7 text-sky-100/75">
                Acceso privado para registrar movimientos del negocio y revisar la salud diaria en segundos.
              </p>
            </div>
          </div>
        </section>

        <section className="flex min-h-[620px] flex-col justify-center p-6 sm:p-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1.5 shadow-lg">
              <Image src="/logo1-clean.png" alt="La Esquinita" width={56} height={56} className="h-full w-full object-contain" priority />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">La Esquinita</p>
              <h1 className="text-xl font-bold">Control financiero</h1>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Bienvenido</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Iniciar sesion</h2>
              <p className="mt-2 text-sm text-muted-foreground">Usa tu email y contrasena para entrar al dashboard.</p>
            </div>
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
