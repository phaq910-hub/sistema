import { Link } from "react-router-dom";
import { usePublicCompany } from "@/components/PublicExtras";

export function BrandMark({ to = "/", compact = false }: { to?: string; compact?: boolean }) {
  const { data: c } = usePublicCompany();
  const name = c?.name ?? "Techline Consultoria";
  const [first, ...rest] = name.split(" ");
  return (
    <Link to={to} data-testid="brand-logo" className="flex items-center gap-2.5 group">
      {c?.logo ? (
        <img src={c.logo} alt={name} className="size-9 rounded-lg bg-white object-contain p-0.5 transition-transform duration-200 group-hover:-rotate-6" />
      ) : (
        <span className="relative grid size-9 place-items-center rounded-lg bg-sky-600 font-heading text-sm font-extrabold text-white shadow-[0_0_24px_-4px_rgb(2_132_199/0.7)] transition-transform duration-200 group-hover:-rotate-6">
          {name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
      )}
      {!compact && (
        <span className="leading-tight">
          <span className="block font-heading text-[15px] font-bold tracking-tight">{first}</span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{rest.join(" ") || c?.tagline}</span>
        </span>
      )}
    </Link>
  );
}
