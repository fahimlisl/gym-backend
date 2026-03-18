import { razorpay } from '../utils/razorpay.js';
import crypto from "crypto";


export const createOrder = async(req,res) => {
  try {
    const { amount, currency = 'INR', receipt, description } = req.body;

    // Amount in paise (multiply by 100)
    const options = {
      amount: amount * 100,
      currency: currency,
      receipt: receipt || `receipt_${Date.now()}`,
      description: description || 'Payment for service'
    };
    console.log(options)
    const order = await razorpay.orders.create(options);
    console.log(order)
    res.status(201).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

export const verifyPayment = async(req,res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Generate signature to verify
    const generated_signature = crypto
    //   .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .createHmac('sha256', process.env.TEST_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Payment is verified ✅
      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id
      });
    } else {
      // Payment verification failed ❌
      res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message
    });
  }
};