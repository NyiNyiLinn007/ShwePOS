export default function DashboardRouteLoading() {
  return (
    <div className="route-skeleton-page" aria-busy="true" aria-label="Loading page">
      {/* Page Header Skeleton */}
      <div className="page-header">
        <div className="page-title-group" style={{ gap: 8 }}>
          <div className="skeleton" style={{ width: 210, height: 26 }} />
          <div className="skeleton" style={{ width: 300, height: 14 }} />
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ width: 110, height: 36 }} />
          <div className="skeleton" style={{ width: 132, height: 36 }} />
        </div>
      </div>

      {/* Page Body Skeleton */}
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* KPI Row */}
        <div className="route-skeleton-kpis">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="route-skeleton-kpi-card">
              <div className="skeleton" style={{ width: '48%', height: 12 }} />
              <div className="skeleton" style={{ width: '72%', height: 28 }} />
              <div className="skeleton" style={{ width: '36%', height: 11 }} />
            </div>
          ))}
        </div>

        {/* Filter Toolbar Skeleton */}
        <div className="route-skeleton-toolbar">
          <div className="skeleton" style={{ width: 260, height: 38 }} />
          <div className="skeleton" style={{ width: 150, height: 38 }} />
          <div className="skeleton" style={{ width: 150, height: 38 }} />
        </div>

        {/* Data Table Skeleton */}
        <div className="route-skeleton-table">
          <div className="route-skeleton-row route-skeleton-row-header">
            <div className="skeleton" style={{ width: '55%', height: 12 }} />
            <div className="skeleton" style={{ width: '50%', height: 12 }} />
            <div className="skeleton" style={{ width: '45%', height: 12 }} />
            <div className="skeleton" style={{ width: '50%', height: 12 }} />
            <div className="skeleton" style={{ width: '60%', height: 12 }} />
          </div>
          {[0, 1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="route-skeleton-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="skeleton" style={{ width: `${65 + ((row * 7) % 25)}%`, height: 14 }} />
                <div className="skeleton" style={{ width: '40%', height: 11 }} />
              </div>
              <div className="skeleton" style={{ width: '70%', height: 14 }} />
              <div className="skeleton" style={{ width: '60%', height: 14 }} />
              <div className="skeleton" style={{ width: '55%', height: 22, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: '75%', height: 24 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
