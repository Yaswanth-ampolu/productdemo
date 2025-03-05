import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-grafana-dark p-4 md:p-6 rounded-lg shadow-lg">
        <h2 className="text-xl md:text-2xl font-bold mb-4">Welcome to Your Dashboard</h2>
        <p className="text-gray-300">
          You are logged in as <span className="font-semibold">{user?.username}</span> with role:{' '}
          <span className="font-semibold">{user?.role}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-grafana-dark p-4 md:p-6 rounded-lg shadow-lg">
          <h3 className="text-lg md:text-xl font-semibold mb-2">Quick Stats</h3>
          <p className="text-gray-300">Your activity overview will appear here.</p>
        </div>
        
        <div className="bg-grafana-dark p-4 md:p-6 rounded-lg shadow-lg">
          <h3 className="text-lg md:text-xl font-semibold mb-2">Recent Activity</h3>
          <p className="text-gray-300">Your recent actions will be listed here.</p>
        </div>

        <div className="bg-grafana-dark p-4 md:p-6 rounded-lg shadow-lg">
          <h3 className="text-lg md:text-xl font-semibold mb-2">System Status</h3>
          <p className="text-gray-300">System health metrics will be shown here.</p>
        </div>
      </div>
    </div>
  );
} 