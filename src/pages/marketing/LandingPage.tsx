import React from 'react';
import { Link } from 'react-router-dom';

const FeatureCard: React.FC<{
  title: string;
  desc: string;
  icon?: React.ReactNode;
}> = ({ title, desc, icon }) => (
  <div className="io-card p-6">
    <div className="flex items-start gap-3">
      <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-io-surface-2 border border-io-border">
        {icon ?? <span className="text-xl">✨</span>}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-io-text">{title}</h3>
        <p className="text-io-text-muted mt-1">{desc}</p>
      </div>
    </div>
  </div>
);

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen relative">
      {/* page background */}
      <div className="io-bg-grid" />

      {/* Top nav with Sign in/Sign up on the right */}
      <header className="relative z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold tracking-tight">
            IO Education
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="io-btn">Sign in</Link>
            <Link to="/signup" className="io-btn io-btn-primary">Sign up</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-6 pt-10 pb-16">
        <div className="io-card p-10 md:p-14">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-io-primary/40 text-io-text-muted mb-4">
                <span className="w-2 h-2 rounded-full bg-io-primary inline-block" />
                IO Education
              </span>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight text-io-text">
                A modern workspace for learning, feedback, and analytics.
              </h1>
              <p className="text-io-text-muted mt-3">
                Draw, collaborate, assess, and understand progress — all in one place.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/login" className="io-btn io-btn-primary">Get started</Link>
                <Link to="/courses" className="io-btn">Browse Courses</Link>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-io-border bg-io-surface-2">
              <div className="p-6">
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="h-20 rounded-lg bg-io-surface border border-io-border" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-14">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            title="Interactive Canvases"
            desc="Students sketch solutions live; teachers review, lock, and give feedback."
          />
          <FeatureCard
            title="Assessment & Feedback"
            desc="Marks, comments, and release controls designed for classrooms."
          />
          <FeatureCard
            title="Analytics"
            desc="Time-on-task, attempts, and progress — by lesson, topic, and class."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="io-card p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-io-text">Ready to get started?</h2>
            <p className="text-io-text-muted mt-1">Log in to your workspace or explore available courses.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/login" className="io-btn io-btn-primary">Sign in</Link>
            <Link to="/courses" className="io-btn">Explore Courses</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
