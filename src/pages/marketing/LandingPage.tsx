import React from 'react';
import { Link } from 'react-router-dom';
import IoLogo from '../../components/brand/IOLogo';

const FeatureCard: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <div className="io-card p-6">
    <div className="text-lg font-semibold">{title}</div>
    <p className="mt-2 text-sm text-io-text-muted">{desc}</p>
  </div>
);

const LandingPage: React.FC = () => {
  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-io-border bg-io-bg/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <IoLogo />
          <nav className="hidden md:flex items-center gap-6 text-sm text-io-text-muted">
            <a href="#features" className="hover:text-io-text">Features</a>
            <a href="#why" className="hover:text-io-text">Why IO</a>
            <a href="#pricing" className="hover:text-io-text">Pricing</a>
            <Link to="/login" className="io-btn">Sign in</Link>
            <Link to="/signup" className="io-btn io-btn-primary">Get started</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Learning tools that feel <span className="text-io-highlight">alive</span>.
            </h1>
            <p className="mt-4 text-io-text-muted text-lg">
              IO Education brings interactive canvases, feedback, and analytics together—so teachers teach more and click less.
            </p>
            <div className="mt-6 flex gap-3">
              <Link to="/signup" className="io-btn io-btn-primary">Create your account</Link>
              <Link to="/login" className="io-btn io-btn-accent">Sign in</Link>
            </div>
            <p className="mt-3 text-xs text-io-text-muted">Free plan available • No credit card required</p>
          </div>
          <div className="io-card p-0 overflow-hidden">
            {/* Replace this with an app screenshot later */}
            <div className="aspect-video bg-io-muted grid place-items-center">
              <span className="text-io-text-muted">App preview</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold mb-6">Built for real classrooms</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <FeatureCard
            title="Live canvases"
            desc="Students write, draw, and annotate. Teachers can lock, review, and replay work."
          />
          <FeatureCard
            title="Actionable feedback"
            desc="Marks, letters, and comments—release when ready, per student or class."
          />
          <FeatureCard
            title="Analytics that help"
            desc="Time-on-task, attempts, and progress at a glance—find who needs support fast."
          />
        </div>
      </section>

      {/* Why */}
      <section id="why" className="max-w-7xl mx-auto px-4 py-12">
        <div className="io-card p-6">
          <h3 className="text-xl font-semibold">Why IO Education?</h3>
          <ul className="mt-3 space-y-2 text-sm text-io-text-muted list-disc pl-5">
            <li>Warm, accessible UI designed for long teaching days</li>
            <li>Fast workflows—reduce clicks for common tasks</li>
            <li>Privacy-first architecture with secure roles & policies</li>
            <li>Works great on school networks and devices</li>
          </ul>
        </div>
      </section>

      {/* Pricing (placeholder) */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold mb-4">Simple pricing</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="io-card p-6">
            <div className="text-lg font-semibold">Starter</div>
            <div className="text-3xl font-bold mt-1">$0</div>
            <p className="text-io-text-muted mt-2 text-sm">For individual teachers</p>
          </div>
          <div className="io-card p-6 border-io-highlight">
            <div className="text-lg font-semibold">Professional</div>
            <div className="text-3xl font-bold mt-1">$—</div>
            <p className="text-io-text-muted mt-2 text-sm">Departments & small schools</p>
          </div>
          <div className="io-card p-6">
            <div className="text-lg font-semibold">Enterprise</div>
            <div className="text-3xl font-bold mt-1">Contact</div>
            <p className="text-io-text-muted mt-2 text-sm">Districts & multi-site orgs</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-io-border mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-sm text-io-text-muted flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <IoLogo wordmark={false} />
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-io-text">Sign in</Link>
            <Link to="/signup" className="hover:text-io-text">Get started</Link>
            <a href="mailto:hello@ioeducation.com.au" className="hover:text-io-text">Contact</a>
          </div>
          <div>© {new Date().getFullYear()} IO Education</div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
