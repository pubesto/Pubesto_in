import { NextResponse } from "next/server";
import { after } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { notifyContactMessage } from "@/lib/server/notifications";
import { contactMessageSchema } from "@/lib/validations/contact";

export const dynamic = "force-dynamic";

/** Contact form: saved for the team (dashboard) and emailed to ADMIN_NOTIFICATION_EMAIL. */
export async function POST(req) {
  try {
    const data = await req.json();
    const result = contactMessageSchema.safeParse({
      name: data.name,
      email: data.email,
      subject: data.subject || "General enquiry",
      message: data.message,
      website: data.website || undefined,
    });
    if (!result.success) {
      const issue = result.error.issues[0];
      return NextResponse.json({ message: issue?.message || "Please check the form and try again." }, { status: 400 });
    }

    const { website: _honeypot, ...message } = result.data;
    void _honeypot;
    const created = await getPrisma().contactMessage.create({ data: message, select: { id: true } });
    after(() => notifyContactMessage(created.id));

    return NextResponse.json({ message: "Message sent successfully." }, { status: 200 });
  } catch (error) {
    console.error("Error processing contact form:", error);
    return NextResponse.json({ message: "Failed to send message." }, { status: 500 });
  }
}
