import "dotenv/config"
import { getAuth } from "../lib/auth"

async function main() {
  const auth = getAuth()
  try {
    const result = await auth.api.signUpEmail({
      body: {
        name: "Admin",
        email: "admin@suos.store",
        password: "SuosAdmin#7vK9mP2xQ4",
      },
    })
    console.log("User created:", result.user)
  } catch (error) {
    console.error("Failed to create user:", error)
  }
}

main()
