import { GlassCard } from "@/components/ui/GlassCard";

type ModulePlaceholderProps = {
  title: string;
  description: string;
};

export function ModulePlaceholder({ title, description }: ModulePlaceholderProps) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-100">{title}</h1>
      </div>
      <GlassCard className="p-8 text-center">
        <p className="text-lg font-bold text-slate-100">Segera hadir</p>
        <p className="text-sm text-slate-300/70 mt-2 max-w-md mx-auto">
          {description}
        </p>
      </GlassCard>
    </div>
  );
}
