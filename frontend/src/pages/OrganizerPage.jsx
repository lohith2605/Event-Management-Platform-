import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  ArrowRight,
  QrCode,
  Users,
  BarChart3,
  BellRing,
  Ticket,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileCheck,
  Layers,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { BRAND } from '../config/brand';
import {
  fadeInUp,
  staggerContainer,
  cardRevealVariant,
  buttonHoverTap,
} from '../config/animations';

const ORGANIZER_ROTATING_PHRASES = [
  'Launch Your Next Event',
  'Grow Your Audience',
  'Manage Every Ticket',
  'Bring Your Community Together',
  'Create Memorable Experiences',
];

export default function OrganizerPage() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  // Unconditional phrase rotation timer
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % ORGANIZER_ROTATING_PHRASES.length);
    }, 2400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] transition-colors">
      {/* 1. Hero Section with Independent Rotating Phrases */}
      <section className="relative pt-14 pb-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--color-borders)] overflow-hidden">
        <div className="absolute top-10 right-10 w-96 h-96 bg-[var(--color-accent-soft)]/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-80 h-80 bg-[var(--color-secondary-bg)]/70 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs font-semibold text-[var(--color-secondary-text)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-golden-accent)]" />
            <span>Dedicated Infrastructure for Indian College Committees & Event Creators</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.08, ease: 'easeOut' }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--color-main-text)] font-serif leading-[1.18] text-center"
          >
            <span className="block text-[var(--color-primary-action)] italic min-h-[1.25em]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={ORGANIZER_ROTATING_PHRASES[phraseIndex]}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block"
                  aria-live="polite"
                >
                  {ORGANIZER_ROTATING_PHRASES[phraseIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="block mt-1">With Effortless QR Ticketing.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.16, ease: 'easeOut' }}
            className="max-w-2xl mx-auto text-base sm:text-lg text-[var(--color-secondary-text)] leading-relaxed"
          >
            From technical hackathons and collegiate fests to cultural galas and professional conclaves. Launch tiered ticketing, issue dynamic QR passes, and monitor admissions in real time.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.22, ease: 'easeOut' }}
            className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.div
              whileHover={buttonHoverTap.hover}
              whileTap={buttonHoverTap.tap}
            >
              <Link
                to="/signup?role=organizer"
                className="w-full sm:w-auto px-8 py-3.5 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Start Organizing Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <motion.div
              whileHover={buttonHoverTap.hover}
              whileTap={buttonHoverTap.tap}
            >
              <a
                href="#workflow"
                className="w-full sm:w-auto px-6 py-3.5 bg-[var(--color-primary-bg)] hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>How Approval Works</span>
              </a>
            </motion.div>
          </motion.div>

          <div className="pt-2 text-xs text-[var(--color-secondary-text)] flex flex-wrap items-center justify-center gap-4">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
              No upfront setup fees
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
              Instant QR check-in app
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
              Automated attendee alerts
            </span>
          </div>
        </div>
      </section>

      {/* 2. Genuine Operational Capabilities (Zero Mock Data) */}
      <section className="py-14 bg-[var(--color-secondary-bg)] border-b border-[var(--color-borders)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 pb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-golden-accent)]">
              Organizer Toolkit
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-main-text)] font-serif">
              Built for Seamless Event Orchestration
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-secondary-text)] max-w-xl mx-auto">
              Manage ticket batches, real-time gate entries, and transparent reconciliations from a unified command center.
            </p>
          </div>

          {/* Feature Architecture Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-[var(--color-card-bg)] p-5 rounded-2xl border border-[var(--color-borders)] space-y-3 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-[var(--color-main-text)]">
                Flexible Ticket Tiers
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Configure free student passes, VIP lounge packages, and early-bird limits with configurable capacity caps.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-[var(--color-card-bg)] p-5 rounded-2xl border border-[var(--color-borders)] space-y-3 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-gold-soft)] text-[var(--color-golden-accent)] flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-[var(--color-main-text)]">
                Sub-Second Gate Scanner
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Volunteers scan dynamic QR passes on mobile with instant validation, audio feedback, and double-entry prevention.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-[var(--color-card-bg)] p-5 rounded-2xl border border-[var(--color-borders)] space-y-3 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/15 text-[#10b981] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-[var(--color-main-text)]">
                Administrative Verification
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Every host undergoes committee verification before publication, ensuring legitimate ticketing for all buyers.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-[var(--color-card-bg)] p-5 rounded-2xl border border-[var(--color-borders)] space-y-3 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-[var(--color-main-text)]">
                Transparent Settlements
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Direct bank settlements with structured accounting statements covering fees, refunds, and net payouts.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. Workflow Section */}
      <section id="workflow" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center space-y-3 pb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-golden-accent)]">
            4 Simple Steps
          </span>
          <h2 className="text-3xl font-extrabold text-[var(--color-main-text)] font-serif">
            How Event Publishing & Approval Works
          </h2>
          <p className="text-sm text-[var(--color-secondary-text)]">
            To eliminate spam and protect ticket buyers, every submitted event passes administrative verification before opening for public booking.
          </p>
        </div>

        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 relative"
        >
          {/* Step 1 */}
          <motion.div
            variants={cardRevealVariant}
            className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs hover:border-[var(--color-primary-action)]/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-[var(--color-accent-soft)] border border-[var(--color-primary-action)]/30 font-bold text-sm text-[var(--color-primary-action)] flex items-center justify-center">
              1
            </div>
            <h3 className="font-bold text-base text-[var(--color-main-text)]">
              Create Your Event
            </h3>
            <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
              Upload banner, set venue or streaming link, configure schedule, and define ticket tiers (Free, Paid, or VIP).
            </p>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            variants={cardRevealVariant}
            className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs hover:border-[var(--color-primary-action)]/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-[var(--color-gold-soft)] border border-[var(--color-golden-accent)]/30 font-bold text-sm text-[var(--color-golden-accent)] flex items-center justify-center">
              2
            </div>
            <h3 className="font-bold text-base text-[var(--color-main-text)] flex items-center gap-1.5">
              <span>Admin Review</span>
              <Clock className="w-4 h-4 text-[var(--color-golden-accent)]" />
            </h3>
            <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
              Our review team verifies event legitimacy, organizer affiliation, and transparent pricing policies within 24 hours.
            </p>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            variants={cardRevealVariant}
            className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs hover:border-[var(--color-primary-action)]/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 font-bold text-sm text-[#10b981] flex items-center justify-center">
              3
            </div>
            <h3 className="font-bold text-base text-[var(--color-main-text)]">
              Go Live & Public
            </h3>
            <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
              Once approved, your event appears on the explore feed, search results, and city category listings for attendees to book.
            </p>
          </motion.div>

          {/* Step 4 */}
          <motion.div
            variants={cardRevealVariant}
            className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs hover:border-[var(--color-primary-action)]/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-[var(--color-accent-soft)] border border-[var(--color-primary-action)]/30 font-bold text-sm text-[var(--color-primary-action)] flex items-center justify-center">
              4
            </div>
            <h3 className="font-bold text-base text-[var(--color-main-text)]">
              Manage & Check In
            </h3>
            <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
              Scan attendee QR codes at entrance gates using any mobile camera, export guest lists, and receive automated payout summaries.
            </p>
          </motion.div>
        </motion.div>

        {/* Admin Verification Notice Callout */}
        <div className="mt-8 bg-[var(--color-gold-soft)] border border-[var(--color-golden-accent)]/40 rounded-2xl p-5 flex items-start gap-3.5 text-xs text-[var(--color-main-text)]">
          <ShieldCheck className="w-5 h-5 text-[var(--color-golden-accent)] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Important Note on Administrative Review:</span> Submitted events undergo platform verification before tickets become open for public booking. This ensures university societies, students, and attendees enjoy a secure and trusted ticketing environment.
          </div>
        </div>
      </section>

      {/* 4. Core Organizer Features Grid */}
      <section id="features" className="py-16 bg-[var(--color-secondary-bg)] border-t border-[var(--color-borders)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-golden-accent)]">
              Feature Suite
            </span>
            <h2 className="text-3xl font-extrabold text-[var(--color-main-text)] font-serif">
              Built for High-Energy Events
            </h2>
            <p className="text-sm text-[var(--color-secondary-text)]">
              Purpose-built tooling designed to withstand peak college fest traffic and registration rushes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center">
                <Ticket className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-main-text)]">
                Custom Tiered Ticketing
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Set early-bird limits, student-ID discount codes, VIP passes, and automated cutoff timers per ticket tier.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-gold-soft)] text-[var(--color-golden-accent)] flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-main-text)]">
                Sub-Second QR Gate Scanning
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Volunteers and security scan attendee QR tickets on mobile with instant validation, audio feedback, and double-entry prevention.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-main-text)]">
                Attendee Management & CSV Export
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Access full registration rosters, filter checked-in versus no-show guests, and export structured spreadsheets anytime.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-gold-soft)] text-[var(--color-golden-accent)] flex items-center justify-center">
                <BellRing className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-main-text)]">
                Broadcast Updates & Reminders
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Send venue changes, schedule updates, or parking notices directly to registered attendees via email alerts.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-main-text)]">
                Transparent Financials & Payouts
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Direct bank settlements with detailed breakdowns of ticket sales, platform fees, taxes, and net payouts.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-gold-soft)] text-[var(--color-golden-accent)] flex items-center justify-center">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-main-text)]">
                College Committee Verification
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Official institutional badge for university societies, tech clubs, and verified student unions.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. Bottom CTA Banner */}
      <section className="py-16 bg-[var(--color-dark-panel)] text-[var(--color-primary-text)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-golden-accent)]">
            Launch Your Event Today
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-serif">
            Ready to host an unforgettable experience?
          </h2>
          <p className="text-sm opacity-80 max-w-lg mx-auto leading-relaxed">
            Create an organizer account today. Set up your event details and submit it for review in less than 10 minutes.
          </p>
          <div className="pt-2">
            <motion.div
              whileHover={buttonHoverTap.hover}
              whileTap={buttonHoverTap.tap}
              className="inline-block"
            >
              <Link
                to="/signup?role=organizer"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-sm rounded-xl transition-all shadow-md active:translate-y-0.5 cursor-pointer"
              >
                <span>Create Organizer Account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
