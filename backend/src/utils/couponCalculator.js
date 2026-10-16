import Coupon from '../models/Coupon.js';
import CouponRedemption from '../models/CouponRedemption.js';

/**
 * Normalizes a coupon code for consistent comparison and storage.
 * Uppercase, trimmed, stripping extraneous whitespace.
 */
export const normalizeCouponCode = (code) => {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
};

/**
 * Validates a coupon against an event, attendee, and server-calculated subtotal,
 * and computes the exact discount amount and final payable price.
 *
 * All amounts are calculated server-side; client-submitted prices are ignored.
 *
 * @param {Object} params
 * @param {string} params.code - The raw coupon code entered by the user
 * @param {Object} params.event - The mongoose Event document
 * @param {number} params.originalSubtotal - Server-calculated subtotal (unitPrice * qty)
 * @param {string|mongoose.Types.ObjectId} [params.userId] - The authenticated attendee's ID
 * @returns {Promise<{
 *   isValid: boolean,
 *   error?: string,
 *   coupon?: Object,
 *   originalSubtotal: number,
 *   discountAmount: number,
 *   finalAmount: number,
 *   isFree: boolean
 * }>}
 */
export const validateAndCalculateCouponDiscount = async ({
  code,
  event,
  originalSubtotal,
  userId = null,
}) => {
  const normalizedCode = normalizeCouponCode(code);

  if (!normalizedCode) {
    return {
      isValid: false,
      error: 'Please enter a coupon code.',
      originalSubtotal,
      discountAmount: 0,
      finalAmount: originalSubtotal,
      isFree: originalSubtotal === 0,
    };
  }

  // 1. Fetch coupon
  const coupon = await Coupon.findOne({ code: normalizedCode });
  if (!coupon) {
    return {
      isValid: false,
      error: 'Invalid coupon code. Please verify the code and try again.',
      originalSubtotal,
      discountAmount: 0,
      finalAmount: originalSubtotal,
      isFree: originalSubtotal === 0,
    };
  }

  // 2. Active status check
  if (!coupon.isActive) {
    return {
      isValid: false,
      error: 'This coupon has been disabled and is no longer active.',
      originalSubtotal,
      discountAmount: 0,
      finalAmount: originalSubtotal,
      isFree: originalSubtotal === 0,
    };
  }

  // 3. Time window check
  const now = new Date();
  if (coupon.startDate && new Date(coupon.startDate).getTime() > now.getTime()) {
    return {
      isValid: false,
      error: `This coupon will be active starting from ${new Date(coupon.startDate).toLocaleDateString()}.`,
      originalSubtotal,
      discountAmount: 0,
      finalAmount: originalSubtotal,
      isFree: originalSubtotal === 0,
    };
  }

  if (coupon.endDate && new Date(coupon.endDate).getTime() < now.getTime()) {
    return {
      isValid: false,
      error: 'This coupon has expired.',
      originalSubtotal,
      discountAmount: 0,
      finalAmount: originalSubtotal,
      isFree: originalSubtotal === 0,
    };
  }

  // 4. Organizer ownership & Applicable events check
  if (event) {
    const eventOrganizerId = event.organizerId ? event.organizerId.toString() : '';
    const couponOrganizerId = coupon.organizerId ? coupon.organizerId.toString() : '';

    if (eventOrganizerId && couponOrganizerId && eventOrganizerId !== couponOrganizerId) {
      return {
        isValid: false,
        error: 'This coupon cannot be used for events by this organizer.',
        originalSubtotal,
        discountAmount: 0,
        finalAmount: originalSubtotal,
        isFree: originalSubtotal === 0,
      };
    }

    if (coupon.applicableEvents && coupon.applicableEvents.length > 0) {
      const eventIdStr = event._id.toString();
      const isApplicable = coupon.applicableEvents.some(
        (appEventId) => appEventId.toString() === eventIdStr
      );

      if (!isApplicable) {
        return {
          isValid: false,
          error: 'This coupon is not applicable to the selected event.',
          originalSubtotal,
          discountAmount: 0,
          finalAmount: originalSubtotal,
          isFree: originalSubtotal === 0,
        };
      }
    }
  }

  // 5. Minimum booking amount check
  if (coupon.minBookingAmount && originalSubtotal < coupon.minBookingAmount) {
    return {
      isValid: false,
      error: `This coupon requires a minimum booking amount of ₹${coupon.minBookingAmount}. Current subtotal is ₹${originalSubtotal}.`,
      originalSubtotal,
      discountAmount: 0,
      finalAmount: originalSubtotal,
      isFree: originalSubtotal === 0,
    };
  }

  // 6. Global redemption limit check
  if (
    coupon.maxRedemptions !== null &&
    coupon.maxRedemptions !== undefined &&
    coupon.redemptionCount >= coupon.maxRedemptions
  ) {
    return {
      isValid: false,
      error: 'This coupon has reached its total usage limit.',
      originalSubtotal,
      discountAmount: 0,
      finalAmount: originalSubtotal,
      isFree: originalSubtotal === 0,
    };
  }

  // 7. Per-attendee redemption limit check
  if (userId && coupon.maxRedemptionsPerUser) {
    const userRedemptionCount = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      userId,
      status: 'completed',
    });

    if (userRedemptionCount >= coupon.maxRedemptionsPerUser) {
      return {
        isValid: false,
        error: `You have reached the maximum allowed uses (${coupon.maxRedemptionsPerUser}) for this coupon.`,
        originalSubtotal,
        discountAmount: 0,
        finalAmount: originalSubtotal,
        isFree: originalSubtotal === 0,
      };
    }
  }

  // 8. Server-side discount calculation
  let calculatedDiscount = 0;
  if (coupon.discountType === 'percentage') {
    calculatedDiscount = (originalSubtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, coupon.maxDiscountAmount);
    }
  } else if (coupon.discountType === 'fixed') {
    calculatedDiscount = Math.min(coupon.discountValue, originalSubtotal);
  }

  // Round currency to two decimals
  calculatedDiscount = Math.round(calculatedDiscount * 100) / 100;
  const finalPayable = Math.max(0, Math.round((originalSubtotal - calculatedDiscount) * 100) / 100);

  return {
    isValid: true,
    coupon: {
      _id: coupon._id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
      minBookingAmount: coupon.minBookingAmount,
    },
    originalSubtotal,
    discountAmount: calculatedDiscount,
    finalAmount: finalPayable,
    isFree: finalPayable === 0,
  };
};
