import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import CouponRedemption from '../models/CouponRedemption.js';
import Event from '../models/Event.js';
import { normalizeCouponCode } from '../utils/couponCalculator.js';

/**
 * Helper to verify organizer owns the coupon (or is an admin).
 */
const verifyCouponOwnership = async (couponId, user) => {
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    return { error: 'Invalid coupon ID format', status: 400 };
  }

  const coupon = await Coupon.findById(couponId).populate('applicableEvents', 'title date');
  if (!coupon) {
    return { error: 'Coupon not found', status: 404 };
  }

  const isOwner = coupon.organizerId && coupon.organizerId.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return {
      error: 'Forbidden: You do not have permission to manage this coupon.',
      status: 403,
    };
  }

  return { coupon };
};

/**
 * @desc    Create a new coupon for organizer's events
 * @route   POST /api/organizer/coupons
 * @access  Private (Organizer / Admin)
 */
export const createOrganizerCoupon = async (req, res, next) => {
  try {
    const {
      code,
      description = '',
      discountType,
      discountValue,
      minBookingAmount = 0,
      maxDiscountAmount = null,
      startDate,
      endDate,
      maxRedemptions = null,
      maxRedemptionsPerUser = 1,
      applicableEvents = [],
      isActive = true,
    } = req.body;

    const normalizedCode = normalizeCouponCode(code);

    if (!normalizedCode) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required.',
      });
    }

    if (!/^[A-Z0-9_-]+$/.test(normalizedCode)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code can only contain letters, numbers, hyphens, and underscores.',
      });
    }

    if (normalizedCode.length < 3 || normalizedCode.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code must be between 3 and 30 characters.',
      });
    }

    // Check code uniqueness
    const existingCoupon = await Coupon.findOne({ code: normalizedCode });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: `Coupon code "${normalizedCode}" is already in use. Please choose a different code.`,
      });
    }

    // Validate discount type & value
    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: 'Discount type must be either "percentage" or "fixed".',
      });
    }

    const numericDiscountValue = Number(discountValue);
    if (isNaN(numericDiscountValue) || numericDiscountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount value must be a positive number greater than 0.',
      });
    }

    if (discountType === 'percentage' && numericDiscountValue > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount cannot exceed 100%.',
      });
    }

    // Validate date ranges
    const start = startDate ? new Date(startDate) : new Date();
    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start date format.',
      });
    }

    if (!endDate) {
      return res.status(400).json({
        success: false,
        message: 'Expiration end date is required.',
      });
    }

    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expiration end date format.',
      });
    }

    if (end.getTime() <= start.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'Expiration date must be strictly after the start date.',
      });
    }

    // Validate limits
    const numMinBooking = Number(minBookingAmount) || 0;
    if (numMinBooking < 0) {
      return res.status(400).json({
        success: false,
        message: 'Minimum booking amount cannot be negative.',
      });
    }

    const numMaxDiscount = maxDiscountAmount ? Number(maxDiscountAmount) : null;
    if (numMaxDiscount !== null && numMaxDiscount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Maximum discount amount must be greater than 0 if specified.',
      });
    }

    const numMaxRedemptions = maxRedemptions ? parseInt(maxRedemptions, 10) : null;
    if (numMaxRedemptions !== null && (isNaN(numMaxRedemptions) || numMaxRedemptions < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Maximum total redemptions must be at least 1 if specified.',
      });
    }

    const numMaxPerUser = parseInt(maxRedemptionsPerUser, 10) || 1;
    if (numMaxPerUser < 1) {
      return res.status(400).json({
        success: false,
        message: 'Maximum redemptions per attendee must be at least 1.',
      });
    }

    // Validate applicable events ownership
    const validEventIds = [];
    if (Array.isArray(applicableEvents) && applicableEvents.length > 0) {
      for (const eventId of applicableEvents) {
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
          return res.status(400).json({
            success: false,
            message: `Invalid event ID: ${eventId}`,
          });
        }

        const ev = await Event.findById(eventId);
        if (!ev) {
          return res.status(404).json({
            success: false,
            message: `Event not found: ${eventId}`,
          });
        }

        // Verify organizer ownership if not admin
        if (req.user.role !== 'admin' && ev.organizerId.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            success: false,
            message: `You cannot apply a coupon to event "${ev.title}" because it belongs to another organizer.`,
          });
        }

        validEventIds.push(ev._id);
      }
    }

    const coupon = await Coupon.create({
      code: normalizedCode,
      description: description.trim(),
      discountType,
      discountValue: numericDiscountValue,
      minBookingAmount: numMinBooking,
      maxDiscountAmount: numMaxDiscount,
      startDate: start,
      endDate: end,
      maxRedemptions: numMaxRedemptions,
      maxRedemptionsPerUser: numMaxPerUser,
      applicableEvents: validEventIds,
      isActive: Boolean(isActive),
      organizerId: req.user._id,
      createdBy: req.user._id,
    });

    const populatedCoupon = await Coupon.findById(coupon._id).populate(
      'applicableEvents',
      'title date price priceNumber city'
    );

    res.status(201).json({
      success: true,
      message: `Coupon "${normalizedCode}" created successfully.`,
      coupon: populatedCoupon,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all coupons owned by the organizer with filtering & search
 * @route   GET /api/organizer/coupons
 * @access  Private (Organizer / Admin)
 */
export const getOrganizerCoupons = async (req, res, next) => {
  try {
    const isRootAdmin = req.user.role === 'admin' && req.query.scope === 'all';
    const query = isRootAdmin ? {} : { organizerId: req.user._id };

    const { status, eventId, search } = req.query;

    const now = new Date();
    if (status === 'active') {
      query.isActive = true;
      query.endDate = { $gte: now };
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'expired') {
      query.endDate = { $lt: now };
    }

    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      query.$or = [{ applicableEvents: eventId }, { applicableEvents: { $size: 0 } }];
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { code: searchRegex },
        { description: searchRegex },
      ];
    }

    const coupons = await Coupon.find(query)
      .populate('applicableEvents', 'title date price priceNumber city spotsLeft')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: coupons.length,
      coupons,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get genuine summary metrics for organizer coupons
 * @route   GET /api/organizer/coupons/stats
 * @access  Private (Organizer / Admin)
 */
export const getOrganizerCouponStats = async (req, res, next) => {
  try {
    const isRootAdmin = req.user.role === 'admin' && req.query.scope === 'all';
    const couponFilter = isRootAdmin ? {} : { organizerId: req.user._id };

    const now = new Date();

    const [allCoupons, redemptionStats] = await Promise.all([
      Coupon.find(couponFilter).select('_id code isActive startDate endDate redemptionCount'),
      CouponRedemption.aggregate([
        {
          $lookup: {
            from: 'coupons',
            localField: 'couponId',
            foreignField: '_id',
            as: 'coupon',
          },
        },
        { $unwind: '$coupon' },
        ...(isRootAdmin ? [] : [{ $match: { 'coupon.organizerId': req.user._id } }]),
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalDiscount: { $sum: '$discountAmount' },
          },
        },
      ]),
    ]);

    const totalCoupons = allCoupons.length;
    const activeCoupons = allCoupons.filter(
      (c) => c.isActive && new Date(c.endDate) >= now && new Date(c.startDate) <= now
    ).length;
    const expiredCoupons = allCoupons.filter((c) => new Date(c.endDate) < now).length;
    const totalRedemptions = allCoupons.reduce((acc, curr) => acc + (curr.redemptionCount || 0), 0);

    const completedStats = redemptionStats.find((s) => s._id === 'completed');
    const totalDiscountGranted = completedStats ? completedStats.totalDiscount : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        totalRedemptions,
        totalDiscountGranted,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single coupon by ID with redemption history
 * @route   GET /api/organizer/coupons/:id
 * @access  Private (Organizer / Admin)
 */
export const getOrganizerCouponById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { coupon, error, status } = await verifyCouponOwnership(id, req.user);

    if (error) {
      return res.status(status).json({ success: false, message: error });
    }

    const redemptions = await CouponRedemption.find({ couponId: coupon._id })
      .populate('userId', 'name email phone')
      .populate('eventId', 'title date')
      .populate('bookingId', 'bookingReference status paymentStatus')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      coupon,
      redemptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update coupon details
 * @route   PUT /api/organizer/coupons/:id
 * @access  Private (Organizer / Admin)
 */
export const updateOrganizerCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { coupon, error, status } = await verifyCouponOwnership(id, req.user);

    if (error) {
      return res.status(status).json({ success: false, message: error });
    }

    const {
      code,
      description,
      discountType,
      discountValue,
      minBookingAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      maxRedemptions,
      maxRedemptionsPerUser,
      applicableEvents,
      isActive,
    } = req.body;

    // Check code modification
    if (code) {
      const normalizedCode = normalizeCouponCode(code);
      if (normalizedCode !== coupon.code) {
        if (coupon.redemptionCount > 0) {
          return res.status(400).json({
            success: false,
            message: 'Coupon code cannot be changed once it has been redeemed. Create a new coupon instead.',
          });
        }

        const existing = await Coupon.findOne({ code: normalizedCode });
        if (existing && existing._id.toString() !== coupon._id.toString()) {
          return res.status(400).json({
            success: false,
            message: `Coupon code "${normalizedCode}" is already in use.`,
          });
        }
        coupon.code = normalizedCode;
      }
    }

    if (description !== undefined) coupon.description = description.trim();

    if (discountType) {
      if (!['percentage', 'fixed'].includes(discountType)) {
        return res.status(400).json({
          success: false,
          message: 'Discount type must be "percentage" or "fixed".',
        });
      }
      coupon.discountType = discountType;
    }

    if (discountValue !== undefined) {
      const numVal = Number(discountValue);
      if (isNaN(numVal) || numVal <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Discount value must be greater than 0.',
        });
      }
      if (coupon.discountType === 'percentage' && numVal > 100) {
        return res.status(400).json({
          success: false,
          message: 'Percentage discount cannot exceed 100%.',
        });
      }
      coupon.discountValue = numVal;
    }

    if (minBookingAmount !== undefined) {
      coupon.minBookingAmount = Math.max(0, Number(minBookingAmount) || 0);
    }

    if (maxDiscountAmount !== undefined) {
      coupon.maxDiscountAmount = maxDiscountAmount ? Math.max(0, Number(maxDiscountAmount)) : null;
    }

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) coupon.startDate = start;
    }

    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid expiration end date.',
        });
      }
      if (end.getTime() <= new Date(coupon.startDate).getTime()) {
        return res.status(400).json({
          success: false,
          message: 'Expiration date must be after start date.',
        });
      }
      coupon.endDate = end;
    }

    if (maxRedemptions !== undefined) {
      coupon.maxRedemptions = maxRedemptions ? Math.max(1, parseInt(maxRedemptions, 10)) : null;
    }

    if (maxRedemptionsPerUser !== undefined) {
      coupon.maxRedemptionsPerUser = Math.max(1, parseInt(maxRedemptionsPerUser, 10) || 1);
    }

    if (Array.isArray(applicableEvents)) {
      const validEventIds = [];
      for (const eventId of applicableEvents) {
        if (mongoose.Types.ObjectId.isValid(eventId)) {
          const ev = await Event.findById(eventId);
          if (ev && (req.user.role === 'admin' || ev.organizerId.toString() === req.user._id.toString())) {
            validEventIds.push(ev._id);
          }
        }
      }
      coupon.applicableEvents = validEventIds;
    }

    if (isActive !== undefined) {
      coupon.isActive = Boolean(isActive);
    }

    await coupon.save();

    const updated = await Coupon.findById(coupon._id).populate(
      'applicableEvents',
      'title date price priceNumber city'
    );

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully.',
      coupon: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle coupon active/inactive status
 * @route   PATCH /api/organizer/coupons/:id/status
 * @access  Private (Organizer / Admin)
 */
export const toggleOrganizerCouponStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { coupon, error, status } = await verifyCouponOwnership(id, req.user);

    if (error) {
      return res.status(status).json({ success: false, message: error });
    }

    const { isActive } = req.body;
    coupon.isActive = typeof isActive === 'boolean' ? isActive : !coupon.isActive;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" has been ${coupon.isActive ? 'enabled' : 'disabled'}.`,
      coupon,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Safely delete coupon (only if zero redemptions)
 * @route   DELETE /api/organizer/coupons/:id
 * @access  Private (Organizer / Admin)
 */
export const deleteOrganizerCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { coupon, error, status } = await verifyCouponOwnership(id, req.user);

    if (error) {
      return res.status(status).json({ success: false, message: error });
    }

    if (coupon.redemptionCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          'This coupon has historical redemptions and cannot be deleted. Please disable it instead to preserve financial records.',
      });
    }

    await Coupon.findByIdAndDelete(coupon._id);

    res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" has been deleted.`,
    });
  } catch (error) {
    next(error);
  }
};
