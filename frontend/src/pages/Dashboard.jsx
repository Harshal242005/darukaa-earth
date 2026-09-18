import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome, {user?.full_name || user?.email}
        </h1>
        <p className="text-slate-500 mt-2">
          Dashboard coming soon. Map + projects will appear here.
        </p>
        <button
          onClick={logout}
          className="mt-6 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
