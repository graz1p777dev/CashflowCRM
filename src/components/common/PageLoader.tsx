// Фирменный экран загрузки: вращающийся круглый логотип Cashflow.
// Тот же приём, что на лендинге, — чтобы CRM и сайт выглядели одинаково.
export default function PageLoader({ minHeight = '60vh' }: { minHeight?: string }) {
  return (
    <div className="page-loader" style={{ minHeight }} role="status" aria-live="polite">
      <span className="page-loader__mark" aria-hidden />
      <span className="page-loader__name">cashflow</span>
      <span className="sr-only">Загрузка</span>
    </div>
  )
}
