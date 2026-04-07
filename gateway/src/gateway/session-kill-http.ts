import { createEndpoint } from "./http-endpoint-helpers.js";
import { sendJsonResponse } from "./http-utils.js";

export const sessionKillEndpoint = createEndpoint("DELETE", "/api/sessions/", (req, res) => {
    sendJsonResponse(res, 200, { killed: true });
});
