import Dashboard from './components/Dashboard';

// Demo session: in a real app this would come from a login flow / auth context.
// Token = userId (see backend auth middleware for the simplified token scheme).
const SESSION = {
  userId: 'user-002',
  token: 'user-002',
  name: 'Bob Martinez',
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    maxWidth: 860,
    margin: '0 auto',
    padding: '24px 16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1px solid #ddd',
  },
  title: { margin: 0, fontSize: 22, fontWeight: 700 },
  badge: {
    fontSize: 13,
    background: '#e8f4fd',
    color: '#1a6fa8',
    padding: '4px 10px',
    borderRadius: 12,
  },
};

export default function App() {
  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <h1 style={styles.title}>⚡ Billing Platform</h1>
        <span style={styles.badge}>Logged in as {SESSION.name}</span>
      </header>
      <Dashboard userId={SESSION.userId} token={SESSION.token} />
    </div>
  );
}
