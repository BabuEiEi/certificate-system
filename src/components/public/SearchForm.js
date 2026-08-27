export default function SearchForm({ defaultValue = "", compact = false }) {
  return (
    <form
      action="/search"
      method="get"
      className={compact ? "flex flex-col gap-3 sm:flex-row" : "space-y-4"}
    >
      <label className="sr-only" htmlFor={compact ? "search-query-page" : "search-query-home"}>
        ชื่อ–นามสกุล หรือเลขที่เกียรติบัตร
      </label>
      <div className="relative flex-1">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
        >
          ⌕
        </span>
        <input
          id={compact ? "search-query-page" : "search-query-home"}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder="ชื่อ–นามสกุล หรือเลขที่เกียรติบัตร"
          className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-100"
        />
      </div>
      <button
        type="submit"
        className="h-13 rounded-xl bg-brand px-8 font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-blue-200"
      >
        ค้นหา
      </button>
    </form>
  );
}
