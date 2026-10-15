import { getRazorpayInstance } from '../config/razorpay.js';

/**
 * Initiates a server-validated refund via Razorpay
 * @param {Object} params
 * @param {string} params.paymentId - Verified Razorpay payment ID (e.g. pay_...)
 * @param {number} params.amount - Refund amount in INR
 * @param {string} params.bookingRef - Booking reference for reconciliation
 * @param {string} [params.reason] - Stated cancellation/refund reason
 * @param {string|mongoose.Types.ObjectId} [params.adminId] - Admin initiating the refund
 * @returns {Promise<{ success: boolean, status: string, refundId?: string, amount?: number, error?: string, simulated?: boolean }>}
 */
export const processRazorpayRefund = async ({
  paymentId,
  amount,
  bookingRef,
  reason = 'Administrative cancellation',
  adminId,
}) => {
  if (!paymentId) {
    return {
      success: false,
      status: 'failed',
      error: 'Cannot process refund: No payment ID associated with this booking.',
    };
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return {
      success: false,
      status: 'failed',
      error: 'Cannot process refund: Invalid refund amount.',
    };
  }

  const razorpay = getRazorpayInstance();

  // If Razorpay instance is not configured, or if testing with simulated payment IDs
  if (!razorpay || paymentId.startsWith('pay_Fake') || paymentId.startsWith('pay_Simulated')) {
    console.log(`ℹ️ [Razorpay Refund Simulation] Payment: ${paymentId} | Amount: ₹${amount}`);
    return {
      success: true,
      status: 'processed',
      refundId: `rfnd_sim_${Date.now()}`,
      amount,
      simulated: true,
    };
  }

  try {
    const amountInPaise = Math.round(amount * 100);

    const notes = {
      bookingReference: bookingRef || 'UTSAV-BK',
      reason: (reason || '').substring(0, 255),
    };
    if (adminId) {
      notes.adminId = adminId.toString();
    }

    // Call Razorpay Payments Refund API
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amountInPaise,
      notes,
    });

    console.log(`✅ [Razorpay Refund] Created: ${refund.id} (status: ${refund.status}) for ${paymentId}`);

    // Razorpay refund status: 'processed' or 'pending'
    const status = refund.status === 'processed' ? 'processed' : 'initiated';

    return {
      success: true,
      status,
      refundId: refund.id,
      amount: (refund.amount || amountInPaise) / 100,
      raw: refund,
    };
  } catch (error) {
    const errorMessage =
      error?.error?.description ||
      error?.message ||
      'Refund request rejected by payment provider.';
    console.error(`❌ [Razorpay Refund Error] Payment ${paymentId}:`, errorMessage);

    return {
      success: false,
      status: 'failed',
      error: errorMessage,
    };
  }
};

/**
 * Fetches the current live status of a refund from Razorpay
 * @param {string} refundId
 * @returns {Promise<{ success: boolean, status: string, amount?: number, error?: string }>}
 */
export const fetchRazorpayRefund = async (refundId) => {
  if (!refundId) {
    return { success: false, error: 'Refund ID is required.' };
  }

  const razorpay = getRazorpayInstance();
  if (!razorpay || refundId.startsWith('rfnd_sim_')) {
    return {
      success: true,
      status: 'processed',
      simulated: true,
    };
  }

  try {
    const refund = await razorpay.refunds.fetch(refundId);
    const status =
      refund.status === 'processed'
        ? 'processed'
        : refund.status === 'failed'
        ? 'failed'
        : 'initiated';

    return {
      success: true,
      status,
      amount: (refund.amount || 0) / 100,
      raw: refund,
    };
  } catch (error) {
    const errorMessage =
      error?.error?.description || error?.message || 'Failed to fetch refund status.';
    return {
      success: false,
      error: errorMessage,
    };
  }
};

export default {
  processRazorpayRefund,
  fetchRazorpayRefund,
};
