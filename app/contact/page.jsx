"use client";

import "../contact.css";
import React, { useState } from 'react';
import { Mail, Clock, ShieldCheck, Send, PhoneCall, MapPin, Loader2 } from 'lucide-react';


export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [status, setStatus] = useState({
    loading: false,
    success: null,
    message: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: null, message: '' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus({
          loading: false,
          success: true,
          message: result.message || 'Thank you! Your message has been sent successfully.'
        });
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: ''
        });
      } else {
        setStatus({
          loading: false,
          success: false,
          message: result.message || 'Failed to send message. Please try again later.'
        });
      }
    } catch (error) {
      console.error('Contact submission error:', error);
      setStatus({
        loading: false,
        success: false,
        message: 'Something went wrong. Please check your connection and try again.'
      });
    }
  };

  return (
    <main className="pubesto-contact-page-v2">
      <div className="contact-page-container">
        {/* Hero Section */}
        <div className="contact-hero-v2">
          <p className="contact-eyebrow">Get In Touch</p>
          <h1 className="contact-title">Contact Us</h1>
          <div className="contact-divider" />
          <p className="contact-description">
            Whether you have a question about our artisanal collection or need assistance with an order, 
            we're here to help you every step of the way.
          </p>
        </div>

        {/* Content Section */}
        <div className="contact-main-content">
          <div className="contact-layout-grid">
            
            {/* Left: Info Cards */}
            <div className="contact-info-panel">
              <div className="contact-info-card-v2">
                <div className="icon-wrapper">
                  <Mail size={22} />
                </div>
                <div className="card-details">
                  <span className="card-label">Email Us</span>
                  <p className="card-value">support@pubesto.com</p>
                  <p className="card-sub">Fast & helpful support</p>
                </div>
              </div>

              <div className="contact-info-card-v2">
                <div className="icon-wrapper">
                  <Clock size={22} />
                </div>
                <div className="card-details">
                  <span className="card-label">Business Hours</span>
                  <p className="card-value">Mon - Sat: 10AM - 7PM</p>
                  <p className="card-sub">Response within 24 hours</p>
                </div>
              </div>

              <div className="contact-info-card-v2">
                <div className="icon-wrapper">
                  <PhoneCall size={22} />
                </div>
                <div className="card-details">
                  <span className="card-label">Call Us</span>
                  <p className="card-value">+91 7056063693</p>
                  <p className="card-sub">Mon - Sat: 10AM - 7PM</p>
                </div>
              </div>

              <div className="contact-info-card-v2">
                <div className="icon-wrapper">
                  <MapPin size={22} />
                </div>
                <div className="card-details">
                  <span className="card-label">Our Address</span>
                  <p className="card-value">D-6/1, Okhla Phase 2, New Delhi-110020</p>
                  <p className="card-sub">Our corporate headquarters</p>
                </div>
              </div>
            </div>

            {/* Right: Form */}
            <div className="contact-form-panel">
              <div className="contact-form-card-v2">
                <h3>Send a Message</h3>

                {status.success !== null && (
                  <div className={`contact-alert ${status.success ? 'success' : 'error'}`}>
                    <span>{status.message}</span>
                  </div>
                )}

                <form className="contact-form-v2" onSubmit={handleSubmit}>
                  <div className="form-group-v2">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      name="name"
                      placeholder="Your name" 
                      value={formData.name}
                      onChange={handleChange}
                      required 
                      disabled={status.loading}
                    />
                  </div>
                  <div className="form-group-v2">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      name="email"
                      placeholder="Your email" 
                      value={formData.email}
                      onChange={handleChange}
                      required 
                      disabled={status.loading}
                    />
                  </div>
                  <div className="form-group-v2">
                    <label>Subject</label>
                    <input 
                      type="text" 
                      name="subject"
                      placeholder="How can we help?" 
                      value={formData.subject}
                      onChange={handleChange}
                      required 
                      disabled={status.loading}
                    />
                  </div>
                  <div className="form-group-v2">
                    <label>Message</label>
                    <textarea 
                      rows="4" 
                      name="message"
                      placeholder="Type your message here..." 
                      value={formData.message}
                      onChange={handleChange}
                      required
                      disabled={status.loading}
                    ></textarea>
                  </div>
                  <button type="submit" className="contact-send-btn" disabled={status.loading}>
                    <span>{status.loading ? 'Sending...' : 'Send Message'}</span>
                    {status.loading ? (
                      <Loader2 size={18} className="spinner-icon" />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
