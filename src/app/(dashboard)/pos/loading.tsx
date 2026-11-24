export default function PosRouteLoading() {
  return (
    <div className="pos-skeleton-layout" aria-busy="true" aria-label="Loading POS terminal">
      {/* Left: Search, Categories & Product Grid */}
      <div className="pos-skeleton-products">
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ flex: 1, height: 42 }} />
          <div className="skeleton" style={{ width: 42, height: 42 }} />
          <div className="skeleton" style={{ width: 42, height: 42 }} />
        </div>

        <div className="pos-skeleton-pills">
          {[96, 84, 110, 76, 102, 90].map((w, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ width: w, height: 32, borderRadius: 999, flexShrink: 0 }}
            />
          ))}
        </div>

        <div className="pos-skeleton-grid">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="pos-skeleton-card">
              <div className="skeleton" style={{ width: '100%', height: 92 }} />
              <div className="skeleton" style={{ width: '80%', height: 14 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: '48%', height: 15 }} />
                <div className="skeleton" style={{ width: '26%', height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Cart Panel */}
      <div className="pos-skeleton-cart">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skeleton" style={{ width: 110, height: 22 }} />
            <div className="skeleton" style={{ width: 64, height: 26 }} />
          </div>
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                paddingBottom: 12,
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="skeleton" style={{ width: '75%', height: 14 }} />
                <div className="skeleton" style={{ width: '45%', height: 11 }} />
              </div>
              <div className="skeleton" style={{ width: 68, height: 26 }} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton" style={{ width: 80, height: 14 }} />
            <div className="skeleton" style={{ width: 92, height: 14 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton" style={{ width: 70, height: 20 }} />
            <div className="skeleton" style={{ width: 115, height: 24 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <div className="skeleton" style={{ width: 96, height: 46 }} />
            <div className="skeleton" style={{ flex: 1, height: 46 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
