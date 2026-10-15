import { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Image as ImageIcon,
  Sparkles,
  Ticket,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info,
  DollarSign,
  Layers,
} from 'lucide-react';
import { EVENT_CATEGORIES, BANNER_PRESETS } from './EventPresets';

export default function CreateEventTab({ onSubmit, isSubmitting, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    tagline: '',
    description: '',
    category: EVENT_CATEGORIES[0],
    format: 'In-Person',
    date: '',
    isoDate: '',
    time: '06:00 PM IST',
    city: 'Bengaluru',
    venue: '',
    priceNumber: 0,
    image: BANNER_PRESETS[0].url,
    registrationDeadline: '',
    ticketTiers: [
      {
        name: 'General Admission',
        price: 0,
        capacity: 200,
        description: 'Standard access to main stage and venue',
      },
    ],
  });

  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);
  const [serverError, setServerError] = useState(null);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleIsoDateChange = (isoVal) => {
    handleInputChange('isoDate', isoVal);
    if (isoVal) {
      try {
        const dateObj = new Date(isoVal);
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        const formatted = dateObj.toLocaleDateString('en-IN', options);
        handleInputChange('date', formatted);
      } catch (e) {
        // keep manual display date
      }
    }
  };

  // Ticket tiers management
  const handleAddTier = () => {
    setFormData((prev) => ({
      ...prev,
      ticketTiers: [
        ...prev.ticketTiers,
        {
          name: `Tier ${prev.ticketTiers.length + 1}`,
          price: 0,
          capacity: 100,
          description: '',
        },
      ],
    }));
  };

  const handleRemoveTier = (index) => {
    if (formData.ticketTiers.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      ticketTiers: prev.ticketTiers.filter((_, i) => i !== index),
    }));
  };

  const handleTierChange = (index, field, value) => {
    setFormData((prev) => {
      const nextTiers = [...prev.ticketTiers];
      nextTiers[index] = {
        ...nextTiers[index],
        [field]: field === 'price' || field === 'capacity' ? Math.max(0, Number(value) || 0) : value,
      };

      // Also update primary priceNumber from first tier or minimum price
      const minPrice = Math.min(...nextTiers.map((t) => t.price || 0));
      return {
        ...prev,
        ticketTiers: nextTiers,
        priceNumber: minPrice,
      };
    });
  };

  const validate = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Event title is required';
    if (!formData.category) errors.category = 'Category is required';
    if (!formData.isoDate) errors.isoDate = 'Start date is required';
    if (!formData.city.trim()) errors.city = 'City is required';
    if (!formData.venue.trim()) errors.venue = 'Venue or online stream URL is required';
    if (!formData.image.trim()) errors.image = 'Banner image is required';

    if (formData.ticketTiers.length === 0) {
      errors.tiers = 'At least one ticket tier must be defined.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    if (!validate()) return;

    try {
      const payload = {
        ...formData,
        date: formData.date || new Date(formData.isoDate).toDateString(),
        price: formData.priceNumber === 0 ? 'Free' : `₹${formData.priceNumber}`,
        totalCapacity: formData.ticketTiers.reduce((acc, t) => acc + (Number(t.capacity) || 0), 0),
      };

      const result = await onSubmit(payload);
      setSuccessMessage(
        result?.message || 'Your event has been submitted and is currently pending administrator review!'
      );

      if (onSuccess) {
        setTimeout(() => onSuccess(), 1600);
      }
    } catch (err) {
      setServerError(err.message || 'Failed to submit event. Please review input fields.');
    }
  };

  const totalCalculatedCapacity = formData.ticketTiers.reduce(
    (acc, t) => acc + (Number(t.capacity) || 0),
    0
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info Banner */}
      <div className="p-5 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] flex items-start gap-4 shadow-xs">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-[var(--color-main-text)]">
            Create a New Experience on UTSAV
          </h2>
          <p className="text-xs text-[var(--color-secondary-text)] mt-1 leading-relaxed">
            Fill in the details below to publish your event. To maintain high platform quality and prevent spam, newly authored organizer events undergo quick administrative approval before appearing in public discovery.
          </p>
        </div>
      </div>

      {serverError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information */}
        <div className="p-6 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] space-y-4 shadow-xs">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--color-primary-action)]" />
            <span>1. Core Event Information</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-main-text)] mb-1">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g. HackBangalore 2026: 36h Agentic AI Hackathon"
                className={`w-full px-4 py-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] text-[var(--color-main-text)] border ${
                  formErrors.title ? 'border-red-500' : 'border-[var(--color-borders)]'
                } focus:outline-none focus:border-[var(--color-primary-action)] transition-colors`}
              />
              {formErrors.title && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.title}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-main-text)] mb-1">
                  Tagline / Catchphrase
                </label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => handleInputChange('tagline', e.target.value)}
                  placeholder="e.g. Build the Future of Autonomous Systems"
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-main-text)] mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors cursor-pointer"
                >
                  {EVENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-main-text)] mb-1">
                Description & Schedule Highlights
              </label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe key speakers, hackathon tracks, artist line-ups, prerequisites, perks, and schedule..."
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors resize-y"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Date, Time & Venue */}
        <div className="p-6 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] space-y-4 shadow-xs">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--color-golden-accent)]" />
            <span>2. Schedule & Location</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-main-text)] mb-1">
                Event Format <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.format}
                onChange={(e) => handleInputChange('format', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors cursor-pointer"
              >
                <option value="In-Person">In-Person</option>
                <option value="Online">Online / Virtual</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-main-text)] mb-1">
                Start Date (Calendar) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.isoDate}
                onChange={(e) => handleIsoDateChange(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] text-[var(--color-main-text)] border ${
                  formErrors.isoDate ? 'border-red-500' : 'border-[var(--color-borders)]'
                } focus:outline-none focus:border-[var(--color-primary-action)] transition-colors`}
              />
              {formErrors.isoDate && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.isoDate}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-main-text)] mb-1">
                Display Time
              </label>
              <input
                type="text"
                value={formData.time}
                onChange={(e) => handleInputChange('time', e.target.value)}
                placeholder="e.g. 10:00 AM IST"
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-main-text)] mb-1">
                Host City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="e.g. Bengaluru, New Delhi, Mumbai, Hyderabad..."
                className={`w-full px-4 py-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] text-[var(--color-main-text)] border ${
                  formErrors.city ? 'border-red-500' : 'border-[var(--color-borders)]'
                } focus:outline-none focus:border-[var(--color-primary-action)] transition-colors`}
              />
              {formErrors.city && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.city}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-main-text)] mb-1">
                Venue or Streaming Link <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => handleInputChange('venue', e.target.value)}
                placeholder="e.g. KTPO Convention Centre, Whitefield or Zoom Link"
                className={`w-full px-4 py-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] text-[var(--color-main-text)] border ${
                  formErrors.venue ? 'border-red-500' : 'border-[var(--color-borders)]'
                } focus:outline-none focus:border-[var(--color-primary-action)] transition-colors`}
              />
              {formErrors.venue && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.venue}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-main-text)] mb-1">
              Registration Deadline (Optional)
            </label>
            <input
              type="datetime-local"
              value={formData.registrationDeadline}
              onChange={(e) => handleInputChange('registrationDeadline', e.target.value)}
              className="w-full sm:max-w-xs px-4 py-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors"
            />
          </div>
        </div>

        {/* Section 3: High-Res Banner Image */}
        <div className="p-6 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] space-y-4 shadow-xs">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[var(--color-primary-action)]" />
            <span>3. Event Banner Image</span>
          </h3>

          {/* Quick presets */}
          <div>
            <label className="block text-xs font-bold text-[var(--color-main-text)] mb-2">
              Choose from High-Res Curated Presets:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BANNER_PRESETS.map((preset) => (
                <div
                  key={preset.title}
                  onClick={() => handleInputChange('image', preset.url)}
                  className={`p-2 rounded-xl border cursor-pointer transition-all ${
                    formData.image === preset.url
                      ? 'border-[var(--color-primary-action)] ring-2 ring-[var(--color-primary-action)]/20 bg-[var(--color-accent-soft)]'
                      : 'border-[var(--color-borders)] hover:border-[var(--color-primary-action)]/40'
                  }`}
                >
                  <img
                    src={preset.url}
                    alt={preset.title}
                    className="w-full h-18 object-cover rounded-lg mb-1.5"
                  />
                  <p className="text-[10px] font-bold text-[var(--color-main-text)] truncate">
                    {preset.title}
                  </p>
                  <p className="text-[9px] text-[var(--color-secondary-text)] truncate">
                    {preset.category}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-main-text)] mb-1">
              Custom Image URL
            </label>
            <input
              type="url"
              value={formData.image}
              onChange={(e) => handleInputChange('image', e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className={`w-full px-4 py-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] text-[var(--color-main-text)] border ${
                formErrors.image ? 'border-red-500' : 'border-[var(--color-borders)]'
              } focus:outline-none focus:border-[var(--color-primary-action)] transition-colors`}
            />
            {formErrors.image && (
              <p className="text-[11px] text-red-500 mt-1">{formErrors.image}</p>
            )}
          </div>
        </div>

        {/* Section 4: Ticket Tiers & Capacity Management */}
        <div className="p-6 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
              <Ticket className="w-4 h-4 text-[var(--color-golden-accent)]" />
              <span>4. Ticket Tiers & Capacity</span>
            </h3>
            <span className="text-xs font-bold text-[var(--color-primary-action)]">
              Total Capacity: {totalCalculatedCapacity} Seats
            </span>
          </div>

          <p className="text-xs text-[var(--color-secondary-text)]">
            Define one or multiple ticket tiers (e.g. Free Pass, Early Bird, General Admission, VIP) with designated capacities to prevent overselling.
          </p>

          <div className="space-y-3">
            {formData.ticketTiers.map((tier, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-main-text)]">
                    Tier #{idx + 1}
                  </span>
                  {formData.ticketTiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTier(idx)}
                      className="text-xs text-rose-500 hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--color-secondary-text)] mb-1">
                      Tier Name
                    </label>
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => handleTierChange(idx, 'name', e.target.value)}
                      placeholder="e.g. General Admission"
                      className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--color-secondary-text)] mb-1">
                      Price (₹) <span className="opacity-60">(0 = Free)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={tier.price}
                      onChange={(e) => handleTierChange(idx, 'price', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--color-secondary-text)] mb-1">
                      Capacity / Passes Available
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={tier.capacity}
                      onChange={(e) => handleTierChange(idx, 'capacity', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-secondary-text)] mb-1">
                    Tier Benefits / Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={tier.description}
                    onChange={(e) => handleTierChange(idx, 'description', e.target.value)}
                    placeholder="e.g. Access to all technical keynotes + hackathon kit"
                    className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)]"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddTier}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[var(--color-primary-action)] bg-[var(--color-accent-soft)] hover:bg-[var(--color-primary-action)]/15 border border-[var(--color-primary-action)]/20 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Ticket Tier</span>
            </button>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-extrabold text-xs sm:text-sm hover:bg-[var(--color-primary-action-hover)] shadow-sm transition-all disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting Event...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Submit Event for Approval</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
