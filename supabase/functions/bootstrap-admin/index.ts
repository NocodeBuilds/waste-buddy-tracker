// Public bootstrap has been retired. Existing users and administrators are unaffected.
// First administrator provisioning is an operator-only SQL procedure (docs/REMEDIATION.md).
import { serve } from "../_shared/request.ts";
serve(async()=>{ throw new Error("Administrator bootstrap is disabled. Contact the deployment operator."); });
