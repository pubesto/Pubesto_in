import React from 'react';
import PolicyLayout from '../../components/PolicyLayout';

export const metadata = {
  title: 'Refund & Return Policy | Pubesto',
  description: 'Understand the conditions for returns, replacements, and refunds at Pubesto.',
};

export default function RefundReturnPolicy() {
  return (
    <PolicyLayout title="Refund & Return Policy">
      <h2>Business Ownership</h2>
      <p>Pubesto is owned and operated by GO HYPE MEDIA.</p>

      <h2>Introduction</h2>
      <p>At Pubesto, customer satisfaction is important to us. This Refund & Return Policy explains the conditions under which returns, replacements, and refunds are accepted. By placing an order on our website, you agree to this policy.</p>

      <h2>1. Eligibility for Returns</h2>
      <p>Products may be eligible for return if:</p>
      <ul>
        <li>The product received is damaged</li>
        <li>The wrong item was delivered</li>
        <li>The product has manufacturing defects</li>
        <li>The item is significantly different from the description</li>
      </ul>
      <p>To be eligible:</p>
      <ul>
        <li>Return requests must be made within 7 days of delivery</li>
        <li>The product must be unused and in original condition</li>
        <li>Original packaging, tags, invoices, and accessories must be included</li>
      </ul>

      <h2>2. Non-Returnable Items</h2>
      <p>The following items are generally not eligible for return:</p>
      <ul>
        <li>Used or damaged products caused by customer handling</li>
        <li>Customized or personalized products</li>
        <li>Products without original packaging</li>
        <li>Clearance or final sale items</li>
        <li>Personal care or hygiene-related products (if applicable)</li>
      </ul>

      <h2>3. Return Process</h2>
      <p>To request a return:</p>
      <ul>
        <li>Contact customer support with order details and issue description</li>
        <li>Share clear images/videos of the product if requested</li>
        <li>Once approved, return instructions will be provided</li>
        <li>Products must be shipped within the instructed timeframe</li>
      </ul>
      <p>Returns sent without approval may not be accepted.</p>

      <h2>4. Refund Policy</h2>
      <p>Refunds are processed after the returned product passes inspection. Approved refunds may be issued through original payment method, store credit, or wallet balance.</p>
      <p>Typical processing time: 5–10 business days after approval.</p>

      <h2>5. Replacement Policy</h2>
      <p>Eligible products may qualify for replacement instead of refund depending on product availability, the nature of the issue, and customer preference.</p>

      <h2>6. Cancellation Policy</h2>
      <p>Orders may be cancelled before dispatch. Once shipped, cancellation requests may not be accepted. Refunds for cancelled orders will be processed to the original payment method within 5–10 business days.</p>

      <h2>7. Damaged or Incorrect Orders</h2>
      <p>Customers must report damaged, defective, or incorrect products within 48 hours of delivery along with supporting photos or videos. Failure to report within the specified timeframe may affect claim eligibility.</p>

      <h2>8. Shipping Charges</h2>
      <ul>
        <li>Original shipping charges may be non-refundable</li>
        <li>Return shipping charges may apply depending on the reason for return</li>
        <li>If the error is from our side, return shipping costs may be covered by us</li>
      </ul>

      <h2>9. Fraud Prevention</h2>
      <p>We reserve the right to reject refund or return requests in cases involving excessive returns, suspicious activity, policy abuse, or fraudulent claims.</p>

      <h2>10. Contact Support</h2>
      <p>For refund or return assistance, customers may contact our support team through the official contact information available on the website.</p>
      <p>
        <strong>Email:</strong> support@pubesto.com<br />
        <strong>Address:</strong> D-6/1, Okhla Phase 2, New Delhi-110020<br />
        <strong>Contact No:</strong> +91 7056063693
      </p>
    </PolicyLayout>
  );
}
