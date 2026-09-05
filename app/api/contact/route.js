import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const data = await req.json();
    
    // Here you would typically send an email using Resend, Sendgrid, Nodemailer, etc.
    // For now, we simulate a delay and log the submission.
    
    console.log('Contact form submission received:', data);
    
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return NextResponse.json(
      { message: 'Message sent successfully.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing contact form:', error);
    return NextResponse.json(
      { message: 'Failed to send message.' },
      { status: 500 }
    );
  }
}
