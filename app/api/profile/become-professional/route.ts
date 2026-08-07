import { getAuth } from "firebase-admin/auth";

import { authenticateRequest } from "@/src/server/auth";
import { createBecomeProfessionalHandler } from "@/app/api/profile/become-professional/handler";

export const POST = createBecomeProfessionalHandler({
  authenticate: authenticateRequest,
  setProfessionalRole: async (userId: string) => {
    await getAuth().setCustomUserClaims(userId, { role: "professional" });
  },
});
