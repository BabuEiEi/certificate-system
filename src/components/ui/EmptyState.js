export default function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl text-slate-400 shadow-sm">
        ⌕
      </div>
      <h2 className="font-semibold text-slate-700">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}
