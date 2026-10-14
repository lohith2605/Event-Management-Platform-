import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, QrCode, X, FileText } from 'lucide-react';
import { BRAND } from '../config/brand';

const CURRENT_YEAR = 2026;

export default function Footer() {
  const [activePolicy, setActivePolicy] = useState(null); // 'terms', 'privacy', 'cancellation', or null

  const policies = {
    terms: {
      title: 'Terms of Service',
      lastUpdated: 'October 2026',
      content: (
        <div className="space-y-4 text-xs text-[var(--color-secondary-text)] leading-relaxed">
          <p>
            Welcome to <strong className="text-[var(--color-main-text)]">{BRAND.name}</strong>. By accessing or booking through our platform, you agree to adhere to these Terms of Service.
          </p>
          <div>
            <h4 className="font-bold text-[var(--color-main-text)] text-sm mb-1">1. Pass Reservations & Authenticity</h4>
            <p>
              All event passes booked through {BRAND.name} are issued as secure digital tickets with dynamic QR codes. Passes are registered to the booking account and are non-transferable without authorized re-assignment through the platform.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-[var(--color-main-text)] text-sm mb-1">2. Organizer Obligations</h4>
            <p>
              Event organizers are solely responsible for event schedules, venues, safety compliance, and admission protocols. Organizers must honor valid digital passes verified at the gate.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-[var(--color-main-text)] text-sm mb-1">3. Code of Conduct</h4>
            <p>
              Attendees and organizers agree to maintain respectful, safe behavior at all collegiate and public gatherings. Counterfeiting, scalping, or harassment results in immediate account suspension.
            </p>
          </div>
        </div>
      ),
    },
    privacy: {
      title: 'Privacy Policy',
      lastUpdated: 'October 2026',
      content: (
        <div className="space-y-4 text-xs text-[var(--color-secondary-text)] leading-relaxed">
          <p>
            At <strong className="text-[var(--color-main-text)]">{BRAND.name}</strong>, we respect your personal data and maintain transparent privacy practices.
          </p>
          <div>
            <h4 className="font-bold text-[var(--color-main-text)] text-sm mb-1">1. Information We Collect</h4>
            <p>
              We collect your full name, email address, mobile number (for SMS/WhatsApp pass delivery), and ticket booking history to process your digital admissions.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-[var(--color-main-text)] text-sm mb-1">2. How Data Is Used</h4>
            <p>
              Your data is utilized strictly for pass generation, gate verification, event updates (such as schedule adjustments or venue notices), and account security. We never sell your data to third-party ad brokers.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-[var(--color-main-text)] text-sm mb-1">3. Security</h4>
            <p>
              All transactions and account credentials are encrypted following industry-standard TLS protocols with strictly controlled administrative access.
            </p>
          </div>
        </div>
      ),
    },
    cancellation: {
      title: 'Ticket Cancellation & Refund Policy',
      lastUpdated: 'October 2026',
      content: (
        <div className="space-y-4 text-xs text-[var(--color-secondary-text)] leading-relaxed">
          <p>
            We provide transparent cancellation guidelines for attendees and organizers on <strong className="text-[var(--color-main-text)]">{BRAND.name}</strong>.
          </p>
          <div>
            <h4 className="font-bold text-[var(--color-main-text)] text-sm mb-1">1. Free Passes</h4>
            <p>
              Free collegiate and community passes can be cancelled anytime up to 2 hours before the event start time to release capacity for waitlisted attendees.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-[var(--color-main-text)] text-sm mb-1">2. Paid Passes</h4>
            <p>
              For paid events, cancellations requested more than 48 hours prior to the event start receive a full refund minus minimal payment gateway processing charges. Cancellations within 48 hours are subject to the specific organizer's policy.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-[var(--color-main-text)] text-sm mb-1">3. Event Postponement or Cancellation</h4>
            <p>
              If an event is cancelled or rescheduled by the organizer, 100% of ticket amounts are automatically refunded to the original payment method within 5-7 business days.
            </p>
          </div>
        </div>
      ),
    },
  };

  return (
    <footer className="bg-[var(--color-secondary-bg)] border-t border-[var(--color-borders)] text-[var(--color-main-text)] pt-14 pb-10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[var(--color-borders)]">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary-action)] via-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-all">
                <svg
                  className="w-5 h-5 text-white drop-shadow-xs"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path
                    d="M4 3h16a1 1 0 0 1 1 1v16l-5-2.8L12 19l-4-1.8L4 20V4a1 1 0 0 1 1-1z"
                    fill="currentColor"
                    fillOpacity="0.22"
                  />
                  <path
                    d="M12 6.5l1.1 2.3 2.5.4-1.8 1.8.4 2.5L12 12.3l-2.2 1.2.4-2.5-1.8-1.8 2.5-.4L12 6.5z"
                    fill="#fbbf24"
                    stroke="#fbbf24"
                    strokeWidth="0.8"
                  />
                </svg>
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-extrabold text-2xl font-serif text-[var(--color-main-text)] leading-tight">
                  {BRAND.name}
                </span>
                <span className="text-[10px] tracking-wide text-[var(--color-secondary-text)] font-medium leading-tight">
                  {BRAND.tagline}
                </span>
              </div>
            </Link>
            <p className="text-[var(--color-secondary-text)] text-xs sm:text-sm leading-relaxed max-w-sm">
              Discover and book authentic events across India—from college cultural fests and hackathons to music concerts, tech conferences, and artisan exhibitions.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-secondary-text)] pt-1">
              <span className="flex items-center gap-1.5 font-medium text-[var(--color-main-text)]">
                <ShieldCheck className="w-4 h-4 text-[var(--color-golden-accent)]" />
                Admin-Reviewed
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-medium text-[var(--color-main-text)]">
                <QrCode className="w-4 h-4 text-[var(--color-primary-action)]" />
                Digital QR Passes
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold tracking-widest text-[var(--color-secondary-text)]">
              Discover
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[var(--color-secondary-text)]">
              <li>
                <Link to="/events" className="hover:text-[var(--color-primary-action)] transition-colors">
                  All Upcoming Events
                </Link>
              </li>
              <li>
                <Link to="/events?category=Technology+%26+Hackathons" className="hover:text-[var(--color-primary-action)] transition-colors">
                  Hackathons & Tech
                </Link>
              </li>
              <li>
                <Link to="/events?category=Music+%26+Concerts" className="hover:text-[var(--color-primary-action)] transition-colors">
                  Concerts & Gigs
                </Link>
              </li>
              <li>
                <Link to="/events?category=Cultural+%26+Arts" className="hover:text-[var(--color-primary-action)] transition-colors">
                  College Fests
                </Link>
              </li>
              <li>
                <Link to="/events?category=Startup+%26+Innovation" className="hover:text-[var(--color-primary-action)] transition-colors">
                  Startup Summits
                </Link>
              </li>
            </ul>
          </div>

          {/* Organizers */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold tracking-widest text-[var(--color-secondary-text)]">
              For Organizers
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[var(--color-secondary-text)]">
              <li>
                <Link to="/organizers" className="hover:text-[var(--color-primary-action)] transition-colors">
                  Overview & Features
                </Link>
              </li>
              <li>
                <Link to="/signup?role=organizer" className="hover:text-[var(--color-primary-action)] transition-colors">
                  Create Organizer Account
                </Link>
              </li>
              <li>
                <Link to="/organizers#workflow" className="hover:text-[var(--color-primary-action)] transition-colors">
                  Approval Guidelines
                </Link>
              </li>
              <li>
                <Link to="/organizers#features" className="hover:text-[var(--color-primary-action)] transition-colors">
                  Sub-Second QR Scanning
                </Link>
              </li>
            </ul>
          </div>

          {/* Hub Cities */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-bold tracking-widest text-[var(--color-secondary-text)]">
              Top Hubs
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[var(--color-secondary-text)]">
              {['Bengaluru', 'Mumbai', 'Delhi-NCR', 'Hyderabad', 'Pune', 'Jaipur'].map((city) => (
                <li key={city}>
                  <Link to={`/events?city=${encodeURIComponent(city)}`} className="hover:text-[var(--color-primary-action)] transition-colors">
                    {city}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar without developer messages */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[var(--color-secondary-text)]">
          <p>© {CURRENT_YEAR} {BRAND.name} Platform. All rights reserved.</p>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActivePolicy('terms')}
              className="hover:text-[var(--color-primary-action)] transition-colors underline-offset-4 hover:underline cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => setActivePolicy('privacy')}
              className="hover:text-[var(--color-primary-action)] transition-colors underline-offset-4 hover:underline cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setActivePolicy('cancellation')}
              className="hover:text-[var(--color-primary-action)] transition-colors underline-offset-4 hover:underline cursor-pointer"
            >
              Cancellation Policy
            </button>
          </div>
        </div>
      </div>

      {/* Policy Modal */}
      {activePolicy && policies[activePolicy] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-dark-panel)]/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl relative max-h-[85vh] overflow-y-auto text-[var(--color-main-text)]">
            <div className="flex items-center justify-between border-b border-[var(--color-borders)] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--color-primary-action)]" />
                <h3 className="font-extrabold text-lg text-[var(--color-main-text)] font-serif">
                  {policies[activePolicy].title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePolicy(null)}
                className="w-8 h-8 rounded-full bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] flex items-center justify-center text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
                aria-label="Close policy"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-1">
              {policies[activePolicy].content}
            </div>

            <div className="pt-3 border-t border-[var(--color-borders)] flex justify-end">
              <button
                type="button"
                onClick={() => setActivePolicy(null)}
                className="px-5 py-2 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
