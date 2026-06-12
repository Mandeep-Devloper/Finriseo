export default function GlobalLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
      <div 
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--gray-200)',
          borderTopColor: 'var(--green-500)',
          borderRadius: '50%',
        }}
        className="spin"
      />
      <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', fontWeight: 500 }}>Loading...</p>
    </div>
  );
}
