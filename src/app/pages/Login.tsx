import { ShieldCheck, LockKeyhole, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthProvider";
import { getFirstAllowedPath } from "../auth/permissions";

export function Login() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading, login } = useAuth();
  const [email, setEmail] = useState("admin@empresa.com");
  const [password, setPassword] = useState("Admin123!2026");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      const targetPath = getFirstAllowedPath(user.permissions);
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const currentUser = await login(email.trim(), password);
      toast.success("Sesión iniciada correctamente");
      navigate(getFirstAllowedPath(currentUser.permissions), { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo iniciar sesión";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-6 py-12 lg:flex-row lg:items-center lg:gap-20">
       

        <section className="w-full max-w-md">
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="rounded-3xl border border-white/10 bg-white/8 p-8 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-8 space-y-2">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Acceso</p>
              <h2 className="text-3xl font-semibold text-white">Iniciar sesión</h2>
              <p className="text-sm text-slate-400">Usuario inicial listo para pruebas seguras.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Correo</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Contraseña</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Validando acceso..." : "Ingresar al ERP"}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              Credenciales demo: <strong>admin@empresa.com</strong> / <strong>Admin123!2026</strong>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
