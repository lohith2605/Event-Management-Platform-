import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import CouponRedemption from '../models/CouponRedemption.js';
import AuditLog from '../models/AuditLog.js';

/**
 * @desc    Fetch platform-wide coupons with search, filter, and pagination
 * @route   GET /api/admin/coupons
 * @access  Private (Admin only)
 */
export const getAdminCoupons = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'all',
      search = '',
      organizerId = '',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    const now = new Date();

    if (status === 'active') {
      query.isActive = true;
      query.endDate = { $gte: now };
    } else if (status === 'disabled') {
      query.isActive = false;
    } else if (status === 'expired') {
      query.endDate = { $lt: now };
    }

    if (organizerId && mongoose.Types.ObjectId.isValid(organizerId)) {
      query.organizerId = organizerId;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ code: searchRegex }, { description: searchRegex }];
    }

    const [coupons, total] = await Promise.all([
      Coupon.find(query)
        .populate('organizerId', 'name email phone avatar')
        .populate('applicableEvents', 'title date price priceNumber city')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Coupon.countDocuments(query),
    ]);

    const pages = Math.ceil(total / limitNum) || 1;

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pages,
      coupons,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get aggregate metrics across all platform coupons
 * @route   GET /api/admin/coupons/stats
 * @access  Private (Admin only)
 */
export const getAdminCouponStats = async (req, res, next) => {
  try {
    const now = new Date();

    const [allCoupons, redemptionStats] = await Promise.all([
      Coupon.find().select('isActive startDate endDate redemptionCount').lean(),
      CouponRedemption.aggregate([
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
    const disabledCoupons = allCoupons.filter((c) => !c.isActive).length;
    const expiredCoupons = allCoupons.filter((c) => new Date(c.endDate) < now).length;
    const totalRedemptions = allCoupons.reduce((acc, curr) => acc + (curr.redemptionCount || 0), 0);

    const completed = redemptionStats.find((s) => s._id === 'completed');
    const totalDiscountGranted = completed ? completed.totalDiscount : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalCoupons,
        activeCoupons,
        disabledCoupons,
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
 * @desc    Update coupon status (Enable / Disable) with administrative audit log
 * @route   PATCH /api/admin/coupons/:id/status
 * @access  Private (Admin only)
 */
export const updateAdminCouponStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, reason = 'Administrative moderation policy' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coupon ID format.',
      });
    }

    const coupon = await Coupon.findById(id).populate('organizerId', 'name email');
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found.',
      });
    }

    const targetState = typeof isActive === 'boolean' ? isActive : !coupon.isActive;
    coupon.isActive = targetState;
    await coupon.save();

    // Create tamper-evident audit log
    await AuditLog.create({
      adminId: req.user._id,
      adminEmail: req.user.email,
      adminName: req.user.name,
      action: 'coupon_status_updated',
      targetType: 'Coupon',
      targetId: coupon._id.toString(),
      targetTitle: coupon.code,
      details: `Coupon ${coupon.code} status changed to ${targetState ? 'active' : 'disabled'}`,
      reason: reason.trim(),
      metadata: {
        couponCode: coupon.code,
        previousState: !targetState,
        newState: targetState,
        organizerId: coupon.organizerId?._id || coupon.organizerId,
      },
      ipAddress: req.ip || '',
    });

    res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" has been ${targetState ? 'enabled' : 'disabled'}.`,
      coupon,
    });
  } catch (error) {
    next(error);
  }
};
