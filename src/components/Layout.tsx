import React from 'react';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-sigma-light">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <span className="text-2xl font-bold text-sigma-blue">Σ</span>
                <span className="ml-2 text-xl font-semibold text-gray-800">
                  SigmaDesk
                </span>
              </Link>
              <span className="ml-4 text-sm text-gray-500 italic">
                Where Every Step Counts
              </span>
            </div>
            <nav>
              <span className="text-sm text-gray-500">
                v0.0.1 - Development
              </span>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;