export default function MarketingLoading() {
  return (
    <div>
      {/* Navbar Skeleton */}
      <div className="skeleton" style={{ height: '64px', width: '100%', borderRadius: 0 }} />
      
      {/* Content Skeleton */}
      <div className="container" style={{ paddingTop: '120px', display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
        <div className="skeleton" style={{ height: '60px', width: '70%', maxWidth: '600px', borderRadius: '12px' }} />
        <div className="skeleton" style={{ height: '24px', width: '90%', maxWidth: '800px' }} />
        <div className="skeleton" style={{ height: '24px', width: '80%', maxWidth: '700px' }} />
        <div className="skeleton" style={{ height: '56px', width: '200px', marginTop: '2rem', borderRadius: '28px' }} />
      </div>
    </div>
  );
}
