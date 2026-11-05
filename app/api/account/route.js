import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { getStorefrontUser, normalizeAddresses } from "@/lib/server/storefront/account";
import { cleanAuthName, cleanAuthPhone } from "@/lib/auth-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getStorefrontUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ user });
}

/** Update name, phone and saved addresses. */
export async function PATCH(request) {
  try {
    const user = await getStorefrontUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const data = {};
    if (body.name !== undefined) {
      const name = cleanAuthName(body.name);
      if (!name) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
      data.name = name;
    }
    if (body.phone !== undefined) {
      data.phone = cleanAuthPhone(body.phone) || null;
    }
    if (body.addresses !== undefined) {
      const addresses = normalizeAddresses(body.addresses);
      if (addresses.length && !addresses.some((address) => address.isDefault)) addresses[0].isDefault = true;
      data.addresses = addresses;
    }

    await getPrisma().user.update({ where: { id: user.id }, data });
    return NextResponse.json({ success: true, user: await getStorefrontUser() });
  } catch (error) {
    console.error("PATCH /api/account error:", error);
    return NextResponse.json({ error: "Could not update your account." }, { status: 400 });
  }
}
