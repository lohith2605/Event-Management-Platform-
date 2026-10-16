import { useState, useEffect } from 'react';
import {
  X,
  Save,
  AlertCircle,
  Calendar,
  Clock,
  MapPin,
  Image as ImageIcon,
  Ticket,
  Plus,
  Trash2,
} from 'lucide-react';
import { EVENT_CATEGORIES, BANNER_PRESETS } from './EventPresets';

export default function EditEventModal({ event, isOpen, onClose, onSave, isSaving }) {
  const [formData, setFormData] = useState({
    title: event?.title || '',
    tagline: event?.tagline || '',
    description: event?.description || '',
    category: event?.category || EVENT_CATEGORIES[0],
    format: event?.format || 'In-Person',
    date: event?.date || '',
    isoDate: event?.isoDate ? new Date(event.isoDate).toISOString().split('T')[0] : '',
    time: event?.time || '10:00 AM IST',
    city: event?.city || '',
    venue: event?.venue || '',
    priceNumber: event?.priceNumber || 0,
    image: event?.image || '',
    ticketTiers:
      Array.isArray(event?.ticketTiers) && event.ticketTiers.length > 0
        ? event.ticketTiers.map((t) => ({ ...t }))
        : [
            {
              name: 'General Admission',
              price: event?.priceNumber || 0,
              capacity: event?.totalCapacity || 100,
              spotsLeft: event?.spotsLeft || 100,
              description: '',
            },
          ],
  });

  const [error, setError] = useState(null);

  if (!isOpen || !event) return null;

  const handleIsoDateChange = (isoVal) => {
    setFormData((prev) => ({ ...prev, isoDate: isoVal }));
    if (isoVal) {
      try {
        const dateObj = new Date(isoVal);
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        const formatted = dateObj.toLocaleDateString('en-IN', options);
        setFormData((prev) => ({ ...prev, date: formatted }));
      } catch (e) {
        // ignore
      }
    }
  };

  const handleTierChange = (index, field, value) => {
    setFormData((prev) => {
      const nextTiers = [...prev.ticketTiers];
      nextTiers[index] = {
        ...nextTiers[index],
        [field]: field === 'price' || field === 'capacity' ? Math.max(0, Number(value) || 0) : value,
      };
      return { ...prev, ticketTiers: nextTiers };
    });
  };

  const handleAddTier = () => {
    setFormData((prev) => ({
      ...prev,
      ticketTiers: [
        ...prev.ticketTiers,
        {
          name: `Tier ${prev.ticketTiers.length + 1}`,
          price: 0,
          capacity: 100,
          spotsLeft: 100,
          description: '',
        },
      ],
    }));
  };

  const handleRemoveTier = (idx) => {
    if (formData.ticketTiers.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      ticketTiers: prev.ticketTiers.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim() || !formData.city.trim() || !formData.venue.trim()) {
      setError('Title, city, and venue are mandatory.');
      return;
    }

    try {
      await onSave(event._id, formData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update event details.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[var(--color-borders)] flex items-center justify-between sticky top-0 bg-[var(--color-card-bg)] z-10">
          <div>
            <h3 className="text-base font-extrabold text-[var(--color-main-text)]">
              Edit Event: {event.title}
            </h3>
            <p className="text-xs text-[var(--color-secondary-text)]">
              {event.status === 'rejected'
                ? 'Update fields to address admin feedback and resubmit for approval.'
                : 'Modify event information and ticket capacities.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-[var(--color-main-text)] mb-1">
              Event Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Tagline
              </label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)]"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] cursor-pointer"
              >
                {EVENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Format
              </label>
              <select
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] cursor-pointer"
              >
                <option value="In-Person">In-Person</option>
                <option value="Online">Online</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Start Date (Calendar)
              </label>
              <input
                type="date"
                value={formData.isoDate}
                onChange={(e) => handleIsoDateChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)]"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Display Time
              </label>
              <input
                type="text"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Host City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)]"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Venue
              </label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[var(--color-main-text)] mb-1">
              Banner Image URL
            </label>
            <input
              type="url"
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)]"
            />
          </div>

          <div>
            <label className="block font-bold text-[var(--color-main-text)] mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] resize-y"
            />
          </div>

          {/* Ticket Tiers */}
          <div className="space-y-2 pt-2 border-t border-[var(--color-borders)]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--color-main-text)]">
                Ticket Tiers & Capacity
              </span>
              <button
                type="button"
                onClick={handleAddTier}
                className="text-[11px] font-bold text-[var(--color-primary-action)] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Tier</span>
              </button>
            </div>

            <div className="space-y-2">
              {formData.ticketTiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] flex items-center gap-3"
                >
                  <input
                    type="text"
                    value={tier.name}
                    onChange={(e) => handleTierChange(idx, 'name', e.target.value)}
                    placeholder="Tier Name"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)]"
                  />
                  <div className="w-24">
                    <input
                      type="number"
                      min="0"
                      value={tier.price}
                      onChange={(e) => handleTierChange(idx, 'price', e.target.value)}
                      placeholder="Price ₹"
                      className="w-full px-3 py-1.5 rounded-lg bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)]"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      value={tier.capacity}
                      onChange={(e) => handleTierChange(idx, 'capacity', e.target.value)}
                      placeholder="Capacity"
                      className="w-full px-3 py-1.5 rounded-lg bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)]"
                    />
                  </div>
                  {formData.ticketTiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTier(idx)}
                      className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[var(--color-borders)] flex items-center justify-end gap-3 sticky bottom-0 bg-[var(--color-card-bg)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-bold text-xs hover:bg-[var(--color-primary-action-hover)] transition-colors cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Save & Update'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
