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

  const amountInPaise = Math.round(amount * 100);

  const notes = {
    bookingReference: bookingRef || 'UTSAV-BK',
    reason: (reason || '').substring(0, 255),
  };
  if (adminId) {
    notes.adminId = adminId.toString();
  }

  const receipt = (bookingRef || 'UTSAV-BK').substring(0, 40);

  // 1. Pre-refund gateway check: Check if a refund already exists for this payment on Razorpay
  try {
    if (typeof razorpay.payments.allRefunds === 'function') {
      const existingRefunds = await razorpay.payments.allRefunds(paymentId);
      const items = existingRefunds?.items || (Array.isArray(existingRefunds) ? existingRefunds : []);
      if (items.length > 0) {
        const matching = items.find(
          (r) => r.receipt === receipt || r.notes?.bookingReference === bookingRef
        ) || items[0];

        if (matching && matching.status !== 'failed') {
          console.log(`ℹ️ [Razorpay Refund] Found existing refund ${matching.id} (${matching.status}) for ${paymentId}`);
          return {
            success: true,
            status: matching.status === 'processed' ? 'processed' : 'initiated',
            refundId: matching.id,
            amount: (matching.amount || amountInPaise) / 100,
            alreadyExists: true,
            raw: matching,
          };
        }
      }
    }
  } catch (checkErr) {
    console.warn(`⚠️ [Razorpay Refund Check] Could not inspect existing refunds for ${paymentId}:`, checkErr.message);
  }

  // 2. Request new refund with receipt identifier
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amountInPaise,
      notes,
      receipt,
    });

    console.log(`✅ [Razorpay Refund] Created: ${refund.id} (status: ${refund.status}) for ${paymentId}`);

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

    // 3. Post-error gateway reconciliation: Check if refund was created despite gateway timeout / network drop
    try {
      if (typeof razorpay.payments.allRefunds === 'function') {
        const postCheck = await razorpay.payments.allRefunds(paymentId);
        const postItems = postCheck?.items || (Array.isArray(postCheck) ? postCheck : []);
        const matching = postItems.find(
          (r) => r.receipt === receipt || r.notes?.bookingReference === bookingRef
        ) || postItems[0];

        if (matching && matching.status !== 'failed') {
          console.log(`✅ [Razorpay Refund Reconciled] Found created refund ${matching.id} after error for ${paymentId}`);
          return {
            success: true,
            status: matching.status === 'processed' ? 'processed' : 'initiated',
            refundId: matching.id,
            amount: (matching.amount || amountInPaise) / 100,
            reconciled: true,
            raw: matching,
          };
        }
      }
    } catch (reconcileErr) {
      console.warn(`⚠️ [Razorpay Refund Post-Check Failed] ${reconcileErr.message}`);
    }

    const isTimeout =
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ECONNRESET' ||
      error?.code === 'ESOCKETTIMEDOUT' ||
      /timeout|econnreset|socket/i.test(errorMessage);

    return {
      success: false,
      status: 'failed',
      isAmbiguous: isTimeout,
      error: errorMessage,
    };
  }
};

/**
 * Reconciles the refund state of a payment with Razorpay without creating a new refund
 * @param {string} paymentId
 * @param {string} bookingRef
 * @returns {Promise<{ found: boolean, refund?: Object, error?: string }>}
 */
export const reconcilePaymentRefund = async (paymentId, bookingRef) => {
  if (!paymentId) return { found: false, error: 'Payment ID is required' };

  const razorpay = getRazorpayInstance();
  if (!razorpay || paymentId.startsWith('pay_Fake') || paymentId.startsWith('pay_Simulated')) {
    return { found: false, simulated: true };
  }

  try {
    if (typeof razorpay.payments.allRefunds === 'function') {
      const res = await razorpay.payments.allRefunds(paymentId);
      const items = res?.items || (Array.isArray(res) ? res : []);
      const receipt = (bookingRef || '').substring(0, 40);
      const matching = items.find(
        (r) => r.receipt === receipt || r.notes?.bookingReference === bookingRef
      ) || items[0];

      if (matching && matching.status !== 'failed') {
        return {
          found: true,
          refund: {
            id: matching.id,
            status: matching.status === 'processed' ? 'processed' : 'initiated',
            amount: (matching.amount || 0) / 100,
            raw: matching,
          },
        };
      }
    }
    return { found: false };
  } catch (err) {
    return { found: false, error: err.message };
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
  reconcilePaymentRefund,
};
