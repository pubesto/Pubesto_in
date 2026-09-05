import React from 'react';
import PolicyLayout from '../../components/PolicyLayout';

export const metadata = {
  title: 'Shipping Policy | Pubesto',
  description: 'Learn about Pubesto delivery timelines and shipping practices.',
};

export default function ShippingPolicy() {
  return (
    <PolicyLayout title="Shipping Policy">
      <h2>Business Ownership</h2>
      <p>Pubesto is owned and operated by GO HYPE MEDIA.</p>

      <p>Most in-stock products dispatch within 1-2 business days and arrive within 5-7 business days after dispatch.</p>
      <p>Delivery timelines can vary by product, address, courier availability, and public holidays.</p>
      <p>We work with trusted logistics partners to ensure your products reach you safely and as quickly as possible. Once your order is dispatched, you will receive a notification with tracking details.</p>
    </PolicyLayout>
  );
}
